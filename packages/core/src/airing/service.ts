import {
  animeAiringState,
  animeMetadata,
  Database,
  userLibraryEntry,
} from "@animekaiser/db"
import type { LibraryNewEpisode, LibraryStatus } from "@animekaiser/domain"
import { and, desc, eq, gt, inArray, isNull, lt, or, sql } from "drizzle-orm"
import * as Chunk from "effect/Chunk"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import type { AniListAiringStatus, EpisodeMetadata } from "../anime"
import { AniListAnimeService, AnimeService } from "../anime"
import { StreamingService } from "../streaming"

export class AiringServiceError extends Schema.TaggedError<AiringServiceError>()(
  "AiringServiceError",
  { message: Schema.String, cause: Schema.optional(Schema.Unknown) }
) {}

const trackedStatuses = [
  "watching",
  "rewatching",
  "planning",
] as const satisfies ReadonlyArray<LibraryStatus>

const recentWindowMs = 14 * 24 * 60 * 60 * 1000
const providerRecheckMs = 45 * 60 * 1000
// Provider sites are scrapers; a cap per sync keeps a large library from
// turning one tick into hundreds of requests from the VPS.
const providerChecksPerSync = 25

export type AiredEpisodeResolution = {
  episode: number
  source: "anilist" | "anizip" | "metadata"
  airedAt: Date | null
}

const aniListAired = (anilist: AniListAiringStatus | undefined) => {
  if (!anilist) return null
  if (anilist.nextAiringEpisode) return anilist.nextAiringEpisode.episode - 1
  if (anilist.status === "NOT_YET_RELEASED") return 0
  if (anilist.status === "FINISHED") return anilist.episodes
  return null
}

const aniZipAired = (episodes: ReadonlyArray<EpisodeMetadata>, now: Date) => {
  const dated = episodes.filter((episode) => episode.airedAt !== null)
  if (dated.length === 0) return null
  return dated.reduce(
    (latest, episode) =>
      Date.parse(episode.airedAt ?? "") <= now.getTime()
        ? Math.max(latest, episode.number)
        : latest,
    0
  )
}

// AniList answers first because its airing schedule is maintained live;
// ani.zip's air dates come from TVDB and lag for simulcasts.
export const resolveAiredEpisode = (input: {
  anilist: AniListAiringStatus | undefined
  anizip: ReadonlyArray<EpisodeMetadata>
  knownEpisodes: number | null
  now: Date
}): AiredEpisodeResolution | null => {
  const fromAniList = aniListAired(input.anilist)
  const fromAniZip = aniZipAired(input.anizip, input.now)
  const airedAtOf = (episode: number) => {
    const airedAt = input.anizip.find(
      (item) => item.number === episode
    )?.airedAt
    const date = airedAt ? new Date(airedAt) : null
    return date && date.getTime() <= input.now.getTime() ? date : null
  }

  if (fromAniList !== null) {
    return {
      episode: fromAniList,
      source: "anilist",
      airedAt: airedAtOf(fromAniList),
    }
  }
  if (fromAniZip !== null) {
    return {
      episode: fromAniZip,
      source: "anizip",
      airedAt: airedAtOf(fromAniZip),
    }
  }
  if (input.anilist?.status === "FINISHED" && input.knownEpisodes !== null) {
    return {
      episode: input.knownEpisodes,
      source: "metadata",
      airedAt: null,
    }
  }
  return null
}

export class AiringService extends Effect.Service<AiringService>()(
  "@animekaiser/core/AiringService",
  {
    accessors: true,
    dependencies: [
      AnimeService.Default,
      AniListAnimeService.Default,
      StreamingService.Default,
    ],
    effect: Effect.gen(function* () {
      const database = yield* Database
      const animeService = yield* AnimeService
      const aniList = yield* AniListAnimeService
      const streaming = yield* StreamingService

      const query = <A>(
        message: string,
        run: Parameters<typeof database.execute<A>>[0]
      ) =>
        database
          .execute(run)
          .pipe(
            Effect.mapError(
              (cause) => new AiringServiceError({ message, cause })
            )
          )

      const syncAiredEpisodes = Effect.fn("AiringService.syncAiredEpisodes")(
        function* (now: Date) {
          const tracked = yield* query("Unable to load tracked anime.", (db) =>
            db
              .selectDistinct({
                malId: animeMetadata.malId,
                episodes: animeMetadata.episodes,
              })
              .from(userLibraryEntry)
              .innerJoin(
                animeMetadata,
                eq(animeMetadata.malId, userLibraryEntry.malId)
              )
              .where(inArray(userLibraryEntry.status, trackedStatuses))
          )
          if (tracked.length === 0) return 0

          const malIds = tracked.map((row) => row.malId)
          const previous = new Map(
            (yield* query("Unable to load airing state.", (db) =>
              db
                .select()
                .from(animeAiringState)
                .where(inArray(animeAiringState.malId, malIds))
            )).map((row) => [row.malId, row])
          )

          const aniListStatuses = new Map(
            (yield* Effect.forEach(
              Chunk.toReadonlyArray(
                Chunk.chunksOf(Chunk.fromIterable(malIds), 50)
              ),
              (batch) =>
                aniList.getAiringStatus(Chunk.toReadonlyArray(batch)).pipe(
                  Effect.tapError((error) =>
                    Effect.logWarning("AniList airing lookup failed", {
                      message: error.message,
                    })
                  ),
                  Effect.orElseSucceed(
                    (): ReadonlyArray<AniListAiringStatus> => []
                  )
                ),
              { concurrency: 1 }
            )).flatMap((statuses) =>
              statuses.map((status) => [status.malId, status] as const)
            )
          )

          yield* Effect.forEach(
            tracked,
            (anime) =>
              Effect.gen(function* () {
                const anilist = aniListStatuses.get(anime.malId)
                const anizip = yield* animeService.getEpisodeMetadata(
                  anime.malId
                )
                const resolved = resolveAiredEpisode({
                  anilist,
                  anizip,
                  knownEpisodes: anime.episodes,
                  now,
                })

                const aniListValue = aniListAired(anilist)
                const aniZipValue = aniZipAired(anizip, now)
                if (
                  aniListValue !== null &&
                  aniZipValue !== null &&
                  aniListValue !== aniZipValue
                ) {
                  yield* Effect.logInfo("Aired episode sources disagree", {
                    malId: anime.malId,
                    anilist: aniListValue,
                    anizip: aniZipValue,
                  })
                }

                const prior = previous.get(anime.malId)
                const advanced =
                  resolved !== null &&
                  prior?.latestAiredEpisode !== undefined &&
                  prior.latestAiredEpisode !== null &&
                  resolved.episode > prior.latestAiredEpisode
                const latestAiredAt =
                  resolved?.airedAt ??
                  (advanced ? now : (prior?.latestAiredAt ?? null))

                const values = {
                  airingStatus: anilist?.status ?? prior?.airingStatus ?? null,
                  totalEpisodes: anilist?.episodes ?? anime.episodes,
                  latestAiredEpisode:
                    resolved?.episode ?? prior?.latestAiredEpisode ?? null,
                  latestAiredAt,
                  latestAiredSource:
                    resolved?.source ?? prior?.latestAiredSource ?? null,
                  nextEpisode: anilist?.nextAiringEpisode?.episode ?? null,
                  nextAiringAt: anilist?.nextAiringEpisode
                    ? new Date(anilist.nextAiringEpisode.airingAt * 1000)
                    : null,
                }

                yield* query("Unable to save airing state.", (db) =>
                  db
                    .insert(animeAiringState)
                    .values({ malId: anime.malId, ...values })
                    .onConflictDoUpdate({
                      target: animeAiringState.malId,
                      set: values,
                    })
                )
              }),
            { concurrency: 4, discard: true }
          )
          return tracked.length
        }
      )

      const syncProviderAvailability = Effect.fn(
        "AiringService.syncProviderAvailability"
      )(function* (now: Date) {
        const candidates = yield* query(
          "Unable to load availability candidates.",
          (db) =>
            db
              .select({
                malId: animeAiringState.malId,
                latestAiredEpisode: animeAiringState.latestAiredEpisode,
              })
              .from(animeAiringState)
              .where(
                and(
                  gt(
                    animeAiringState.latestAiredEpisode,
                    sql`coalesce(${animeAiringState.availableEpisode}, 0)`
                  ),
                  or(
                    eq(animeAiringState.airingStatus, "RELEASING"),
                    gt(
                      animeAiringState.latestAiredAt,
                      new Date(now.getTime() - recentWindowMs)
                    )
                  ),
                  or(
                    isNull(animeAiringState.availableCheckedAt),
                    lt(
                      animeAiringState.availableCheckedAt,
                      new Date(now.getTime() - providerRecheckMs)
                    )
                  )
                )
              )
              .orderBy(sql`${animeAiringState.latestAiredAt} desc nulls last`)
              .limit(providerChecksPerSync)
        )

        yield* Effect.forEach(
          candidates,
          (candidate) =>
            Effect.gen(function* () {
              const catalog = yield* streaming
                .listEpisodes(candidate.malId)
                .pipe(Effect.option)
              const provider =
                catalog._tag === "Some"
                  ? catalog.value.providers.find(
                      (item) => item.status === "available"
                    )
                  : undefined
              const availableEpisode = provider
                ? Math.max(
                    0,
                    ...provider.episodes.map((episode) =>
                      Math.floor(episode.number)
                    )
                  )
                : undefined

              yield* query("Unable to save availability.", (db) =>
                db
                  .update(animeAiringState)
                  .set({
                    availableCheckedAt: now,
                    ...(availableEpisode === undefined
                      ? {}
                      : { availableEpisode }),
                  })
                  .where(eq(animeAiringState.malId, candidate.malId))
              )
            }),
          { concurrency: 2, discard: true }
        )
        return candidates.length
      })

      const sync = Effect.fn("AiringService.sync")(function* () {
        const now = new Date()
        const tracked = yield* syncAiredEpisodes(now)
        const checked = yield* syncProviderAvailability(now)
        yield* Effect.logInfo("Airing sync finished", {
          tracked,
          providerChecks: checked,
        })
      })

      const listNewEpisodes = Effect.fn("AiringService.listNewEpisodes")(
        function* (userId: string) {
          const now = new Date()
          const rows = yield* query("Unable to load new episodes.", (db) =>
            db
              .select({
                entry: userLibraryEntry,
                anime: animeMetadata,
                airing: animeAiringState,
              })
              .from(userLibraryEntry)
              .innerJoin(
                animeAiringState,
                eq(animeAiringState.malId, userLibraryEntry.malId)
              )
              .innerJoin(
                animeMetadata,
                eq(animeMetadata.malId, userLibraryEntry.malId)
              )
              .where(
                and(
                  eq(userLibraryEntry.userId, userId),
                  inArray(userLibraryEntry.status, trackedStatuses),
                  gt(
                    animeAiringState.latestAiredEpisode,
                    userLibraryEntry.progress
                  ),
                  or(
                    eq(animeAiringState.airingStatus, "RELEASING"),
                    gt(
                      animeAiringState.latestAiredAt,
                      new Date(now.getTime() - recentWindowMs)
                    )
                  )
                )
              )
              .orderBy(
                sql`${animeAiringState.latestAiredAt} desc nulls last`,
                desc(userLibraryEntry.updatedAt)
              )
              .limit(40)
          )

          return yield* Effect.forEach(
            rows,
            (row) =>
              Effect.gen(function* () {
                const nextNumber = row.entry.progress + 1
                const metadata = yield* animeService.getEpisodeMetadata(
                  row.anime.malId
                )
                return {
                  anime: {
                    malId: row.anime.malId,
                    aniListId: row.anime.aniListId,
                    title: {
                      romaji: row.anime.titleRomaji,
                      english: row.anime.titleEnglish,
                    },
                    coverImage: row.anime.coverImage,
                    episodes: row.anime.episodes,
                  },
                  status: row.entry.status,
                  progress: row.entry.progress,
                  latestAiredEpisode: row.airing.latestAiredEpisode ?? 0,
                  latestAiredAt: row.airing.latestAiredAt,
                  availableEpisode: row.airing.availableEpisode,
                  nextEpisode: row.airing.nextEpisode,
                  nextAiringAt: row.airing.nextAiringAt,
                  nextEpisodeImage:
                    metadata.find((episode) => episode.number === nextNumber)
                      ?.image ?? null,
                } satisfies LibraryNewEpisode
              }),
            { concurrency: 4 }
          )
        }
      )

      return { sync, listNewEpisodes }
    }),
  }
) {}
