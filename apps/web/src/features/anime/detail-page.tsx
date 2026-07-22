import { Result, useAtomValue } from "@effect-atom/atom-react"
import { Link } from "@tanstack/react-router"
import type {
  AnimeDetail,
  AnimeItem,
  AnimeTitle as AnimeTitleValue,
  LibraryEntry,
  LibraryStatus,
  StreamProviderId,
} from "@workspace/domain"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Separator } from "@workspace/ui/components/separator"
import { Skeleton } from "@workspace/ui/components/skeleton"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import { cn } from "@workspace/ui/lib/utils"
import * as Schema from "effect/Schema"
import type { LucideIcon } from "lucide-react"
import {
  BookmarkPlus,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Eye,
  PauseCircle,
  PlayCircle,
  Repeat2,
  Star,
  XCircle,
} from "lucide-react"
import { useState } from "react"
import { AddToLibraryDialog } from "../library/add-to-library-dialog"
import { libraryEntryAtom } from "../library/atoms"
import { libraryStatuses } from "../library/constants"
import { streamEpisodesAtom } from "../streaming/atoms"
import { EpisodesPanel } from "../streaming/episodes-panel"
import { preferredAudio, watchAction } from "../streaming/player-format"
import { AnimeGrid } from "./anime-grid"
import { AnimeSubtitle, AnimeTitle } from "./anime-title"
import { detailAtom, recommendationsAtom } from "./atoms"
import { formatAnimeFormat, formatAnimeStatus } from "./format"

export const AnimeDetailTab = Schema.Literal(
  "episodes",
  "relations",
  "recommendations"
)
export type AnimeDetailTab = typeof AnimeDetailTab.Type

const decodeAnimeDetailTab = Schema.decodeUnknownSync(AnimeDetailTab)

const stripHtml = (value: string | null) =>
  value?.replace(/<[^>]*>/g, "").trim() ?? null

const hiddenRelationFormats = new Set(["MUSIC"])

const normalizeRelationValue = (value: string | null | undefined) =>
  value?.trim().replace(/[\s-]/g, "_").toUpperCase() ?? ""

type AnimeRelationItem = AnimeDetail["relations"][number]

const sortRelations = (relations: ReadonlyArray<AnimeRelationItem>) =>
  Array.from(relations)
    .sort((left, right) => {
      const leftType = normalizeRelationValue(left.relationType)
      const rightType = normalizeRelationValue(right.relationType)

      if (leftType === "PREQUEL") return -1
      if (rightType === "PREQUEL") return 1
      if (leftType === "SEQUEL") return -1
      if (rightType === "SEQUEL") return 1

      return 0
    })
    .filter(
      (relation) =>
        !hiddenRelationFormats.has(normalizeRelationValue(relation.format))
    )

const libraryStatusIcons: Record<LibraryStatus, LucideIcon> = {
  watching: Eye,
  completed: CheckCircle2,
  paused: PauseCircle,
  dropped: XCircle,
  planning: Clock3,
  rewatching: Repeat2,
}

const libraryStatusLabel = (status: LibraryStatus) =>
  libraryStatuses.find((item) => item.value === status)?.label ?? status

const formatLibraryProgress = (entry: LibraryEntry) =>
  entry.anime.episodes
    ? `${entry.progress}/${entry.anime.episodes} episodes`
    : `${entry.progress} episodes`

const formatLibraryScore = (score: number | null) => {
  if (score === null) return null
  const value = score / 10
  return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)}/10`
}

const formatLibraryUpdatedAt = (value: Date) =>
  new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(value)

export function AnimeDetailPage({
  id,
  initial,
  isAuthenticated,
  activeTab,
  episodePage,
  episodeProvider,
  onEpisodePageChange,
  onEpisodeProviderChange,
  onTabChange,
}: {
  id: number
  initial: AnimeDetail
  isAuthenticated: boolean
  activeTab: AnimeDetailTab
  episodePage: number
  episodeProvider: StreamProviderId
  onEpisodePageChange: (page: number) => void
  onEpisodeProviderChange: (provider: StreamProviderId) => void
  onTabChange: (tab: AnimeDetailTab) => void
}) {
  const result = useAtomValue(detailAtom(id))
  const libraryEntryResult = useAtomValue(libraryEntryAtom(id))
  if (Result.isWaiting(result)) return <AnimeDetailPendingPage />

  const anime = Result.match(result, {
    onInitial: () => initial,
    onFailure: () => initial,
    onSuccess: ({ value }) => value,
  })
  const libraryEntry = Result.match(libraryEntryResult, {
    onInitial: () => null,
    onFailure: () => null,
    onSuccess: ({ value }) => value,
  })

  return (
    <SeriesDetail
      key={id}
      anime={anime}
      libraryEntry={libraryEntry}
      libraryEntryLoading={
        isAuthenticated && Result.isWaiting(libraryEntryResult)
      }
      isAuthenticated={isAuthenticated}
      activeTab={activeTab}
      episodePage={episodePage}
      episodeProvider={episodeProvider}
      onEpisodePageChange={onEpisodePageChange}
      onEpisodeProviderChange={onEpisodeProviderChange}
      onTabChange={onTabChange}
    />
  )
}

function SeriesDetail({
  anime,
  libraryEntry,
  libraryEntryLoading,
  isAuthenticated,
  activeTab,
  episodePage,
  episodeProvider,
  onEpisodePageChange,
  onEpisodeProviderChange,
  onTabChange,
}: {
  anime: AnimeDetail
  libraryEntry: LibraryEntry | null
  libraryEntryLoading: boolean
  isAuthenticated: boolean
  activeTab: AnimeDetailTab
  episodePage: number
  episodeProvider: StreamProviderId
  onEpisodePageChange: (page: number) => void
  onEpisodeProviderChange: (provider: StreamProviderId) => void
  onTabChange: (tab: AnimeDetailTab) => void
}) {
  const description = stripHtml(anime.description)
  const recommendationsResult = useAtomValue(recommendationsAtom(anime.malId))
  const [trailerOpen, setTrailerOpen] = useState(false)
  const [libraryDialogOpen, setLibraryDialogOpen] = useState(false)
  const [loginPromptOpen, setLoginPromptOpen] = useState(false)
  const [synopsisExpanded, setSynopsisExpanded] = useState(false)
  const relations = sortRelations(anime.relations)

  const hasYoutubeTrailer = anime.trailer?.site.toLowerCase() === "youtube"
  const isLongSynopsis = description && description.length > 400
  const bannerSrc = anime.bannerImage ?? anime.coverImage
  const hasRelations = relations.length > 0
  const recommendations = Result.match(recommendationsResult, {
    onInitial: () => null,
    onFailure: () => null,
    onSuccess: ({ value }) => value.items,
  })
  const recommendationsLoading =
    activeTab === "recommendations" && Result.isWaiting(recommendationsResult)
  const recommendationsFailed =
    activeTab === "recommendations" &&
    !Result.isWaiting(recommendationsResult) &&
    recommendationsResult._tag === "Failure"

  return (
    <div className="flex w-full flex-col">
      <div className="relative bg-black">
        <div className="sticky top-0 z-0 h-80 overflow-hidden md:h-96">
          {bannerSrc ? (
            <img
              src={bannerSrc}
              alt=""
              className="absolute inset-0 size-full object-cover opacity-50"
            />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-black/20" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black to-transparent backdrop-blur-[3px]" />
        </div>

        <div className="relative z-10 -mt-80 md:-mt-96">
          <div className="min-h-80 md:min-h-96">
            <nav className="mx-auto flex w-full max-w-7xl items-center gap-2 px-4 pt-3 text-xs text-white/50 md:px-6">
              <Link to="/" className="transition hover:text-white">
                Home
              </Link>
              <span>/</span>
              <Link
                to="/series"
                search={{ sort: "popularity", page: 1 }}
                className="transition hover:text-white"
              >
                Series
              </Link>
              <span>/</span>
              <span className="max-w-40 truncate text-white/70 md:max-w-80">
                <AnimeTitleText title={anime.title} />
              </span>
            </nav>

            <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pt-6 pb-6 md:flex-row md:gap-8 md:px-6 md:pt-10 md:pb-8">
              <div className="flex w-44 shrink-0 flex-col gap-3 self-center md:w-44 md:self-auto lg:w-52">
                {anime.coverImage ? (
                  <img
                    src={anime.coverImage}
                    alt=""
                    className="aspect-2/3 w-full rounded-xl object-cover shadow-2xl ring-1 ring-white/10"
                  />
                ) : null}
                {hasYoutubeTrailer ? (
                  <Button
                    className="w-full"
                    variant="secondary"
                    onClick={() => setTrailerOpen(true)}
                  >
                    <PlayCircle data-icon="inline-start" />
                    Watch Trailer
                  </Button>
                ) : null}
              </div>

              <div className="flex min-w-0 flex-1 flex-col justify-end gap-3">
                <AnimeSubtitle title={anime.title}>
                  {(subtitle) => (
                    <p className="text-sm text-white/50">{subtitle}</p>
                  )}
                </AnimeSubtitle>
                <h1 className="font-heading text-3xl leading-tight font-black tracking-tight text-white md:text-5xl">
                  <AnimeTitle title={anime.title} />
                </h1>
                <div className="flex flex-wrap gap-1.5">
                  {anime.genres.slice(0, 6).map((genre) => (
                    <Badge
                      key={genre}
                      className="border-0 bg-white/12 text-xs text-white backdrop-blur-sm"
                    >
                      {genre}
                    </Badge>
                  ))}
                </div>

                {anime.averageScore ? (
                  <div className="flex items-center gap-2 pt-1">
                    <Star className="size-5 fill-amber-400 text-amber-400" />
                    <span className="text-xl font-bold text-white">
                      {(anime.averageScore / 10).toFixed(1)}
                    </span>
                    <span className="text-xs tracking-wider text-white/40 uppercase">
                      / 10
                    </span>
                  </div>
                ) : null}

                <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center">
                  <WatchButton
                    malId={anime.malId}
                    provider={episodeProvider}
                    progress={libraryEntry?.progress ?? null}
                    progressLoading={libraryEntryLoading}
                  />
                  <Button
                    className="w-fit"
                    variant="outline"
                    onClick={() =>
                      isAuthenticated
                        ? setLibraryDialogOpen(true)
                        : setLoginPromptOpen(true)
                    }
                  >
                    <BookmarkPlus data-icon="inline-start" />
                    {libraryEntry ? "Edit Library" : "Add to Library"}
                  </Button>
                  {libraryEntry ? (
                    <LibraryEntrySummary entry={libraryEntry} />
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="relative bg-background">
            <div className="mx-auto grid w-full max-w-7xl gap-6 p-4 md:grid-cols-[176px_1fr] md:gap-8 md:p-6 lg:grid-cols-[208px_1fr]">
              <aside className="flex flex-col gap-4">
                <div className="rounded-xl border bg-card/80 p-4">
                  <dl className="flex flex-col gap-3 text-sm">
                    <MetaField
                      label="Format"
                      value={formatAnimeFormat(anime.format)}
                    />
                    <MetaField
                      label="Status"
                      value={formatAnimeStatus(anime.status)}
                    />
                    {anime.season || anime.seasonYear ? (
                      <MetaField
                        label="Season"
                        value={[anime.season, anime.seasonYear]
                          .filter(Boolean)
                          .join(" ")}
                      />
                    ) : null}
                    <MetaField label="Episodes" value={anime.episodes} />
                    {anime.duration ? (
                      <MetaField
                        label="Duration"
                        value={`${anime.duration} min`}
                      />
                    ) : null}
                    {anime.averageScore ? (
                      <MetaField
                        label="Score"
                        value={`${anime.averageScore}%`}
                      />
                    ) : null}
                  </dl>

                  {anime.studios.length > 0 ? (
                    <>
                      <Separator className="my-3" />
                      <p className="mb-2 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                        Studios
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {anime.studios.slice(0, 5).map((studio) => (
                          <Badge
                            key={studio}
                            variant="secondary"
                            className="text-xs"
                          >
                            {studio}
                          </Badge>
                        ))}
                      </div>
                    </>
                  ) : null}

                  {anime.tags.length > 0 ? (
                    <>
                      <Separator className="my-3" />
                      <p className="mb-2 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                        Tags
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {anime.tags.slice(0, 8).map((tag) => (
                          <Badge
                            key={tag}
                            variant="outline"
                            className="text-xs"
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </>
                  ) : null}
                </div>

                <div className="rounded-xl border bg-card/80 p-4">
                  <p className="mb-2 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                    Links
                  </p>
                  <div className="flex flex-col gap-0.5">
                    <ExternalSiteLink
                      href={`https://myanimelist.net/anime/${anime.malId}`}
                      label="MyAnimeList"
                    />
                    {anime.aniListId ? (
                      <ExternalSiteLink
                        href={`https://anilist.co/anime/${anime.aniListId}`}
                        label="AniList"
                      />
                    ) : null}
                    {anime.externalLinks.slice(0, 5).map((link) => (
                      <ExternalSiteLink
                        key={`${link.site}-${link.url}`}
                        href={link.url}
                        label={link.site}
                      />
                    ))}
                  </div>
                </div>
              </aside>

              <main className="flex min-w-0 flex-col gap-6">
                <section>
                  <h2 className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                    Synopsis
                  </h2>
                  <div className="mt-2">
                    {description ? (
                      <>
                        <p
                          className={cn(
                            "text-sm leading-7 text-muted-foreground",
                            !synopsisExpanded &&
                              isLongSynopsis &&
                              "line-clamp-5"
                          )}
                        >
                          {description}
                        </p>
                        {isLongSynopsis ? (
                          <button
                            type="button"
                            className="mt-1 text-sm font-medium text-primary hover:underline"
                            onClick={() =>
                              setSynopsisExpanded(!synopsisExpanded)
                            }
                          >
                            {synopsisExpanded ? "Show less" : "Show more"}
                          </button>
                        ) : null}
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No synopsis is available for this title yet.
                      </p>
                    )}
                  </div>
                </section>

                <Tabs
                  value={activeTab}
                  onValueChange={(value) =>
                    onTabChange(decodeAnimeDetailTab(value))
                  }
                  className="max-w-full min-w-0 gap-4"
                >
                  <TabsList
                    variant="line"
                    className="max-w-full justify-start overflow-x-auto"
                  >
                    <TabsTrigger value="episodes">Episodes</TabsTrigger>
                    <TabsTrigger value="relations" disabled={!hasRelations}>
                      Relations
                    </TabsTrigger>
                    <TabsTrigger value="recommendations">
                      Recommendations
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="episodes">
                    <EpisodesPanel
                      anime={anime}
                      page={episodePage}
                      provider={episodeProvider}
                      onPageChange={onEpisodePageChange}
                      onProviderChange={onEpisodeProviderChange}
                    />
                  </TabsContent>
                  <TabsContent value="relations">
                    <RelationsPanel relations={relations} />
                  </TabsContent>
                  <TabsContent value="recommendations">
                    <RecommendationsPanel
                      recommendations={recommendations}
                      loading={recommendationsLoading}
                      failed={recommendationsFailed}
                    />
                  </TabsContent>
                </Tabs>
              </main>
            </div>
          </div>
        </div>
      </div>

      {hasYoutubeTrailer ? (
        <Dialog open={trailerOpen} onOpenChange={setTrailerOpen}>
          <DialogContent className="max-w-5xl overflow-hidden p-0 sm:max-w-[90vw] lg:max-w-5xl">
            <DialogHeader className="sr-only">
              <DialogTitle>
                <AnimeTitleText title={anime.title} /> – Trailer
              </DialogTitle>
              <DialogDescription>
                Watch the trailer for <AnimeTitleText title={anime.title} />.
              </DialogDescription>
            </DialogHeader>
            <div className="aspect-video w-full">
              {trailerOpen ? (
                <iframe
                  src={`https://www.youtube.com/embed/${anime.trailer.id}?autoplay=1`}
                  title="Trailer"
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                  className="size-full"
                />
              ) : null}
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
      <AddToLibraryDialog
        anime={anime}
        entry={libraryEntry}
        open={libraryDialogOpen}
        onOpenChange={setLibraryDialogOpen}
      />
      <Dialog open={loginPromptOpen} onOpenChange={setLoginPromptOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Login required</DialogTitle>
            <DialogDescription>
              Login to add this anime to your library.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLoginPromptOpen(false)}>
              Cancel
            </Button>
            <Button asChild>
              <Link to="/login" search={{ redirect: `/series/${anime.malId}` }}>
                Login
              </Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function AnimeDetailPendingPage() {
  return (
    <div className="flex w-full flex-col">
      <div className="relative bg-muted">
        <div className="mx-auto flex w-full max-w-7xl items-center gap-2 px-4 pt-3 md:px-6">
          <Skeleton className="h-3.5 w-48 bg-white/10" />
        </div>
        <div className="mx-auto flex w-full max-w-7xl gap-6 px-4 pt-6 pb-6 md:gap-8 md:px-6 md:pt-10 md:pb-8">
          <div className="flex w-36 shrink-0 flex-col gap-3 md:w-44 lg:w-52">
            <Skeleton className="aspect-2/3 w-full rounded-xl bg-white/10" />
            <Skeleton className="h-9 w-full rounded-md bg-white/10" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-end gap-3">
            <Skeleton className="h-4 w-32 bg-white/10" />
            <Skeleton className="h-10 w-3/4 bg-white/10 md:h-12" />
            <div className="flex gap-1.5">
              <Skeleton className="h-5 w-16 rounded-full bg-white/10" />
              <Skeleton className="h-5 w-20 rounded-full bg-white/10" />
              <Skeleton className="h-5 w-14 rounded-full bg-white/10" />
            </div>
            <Skeleton className="h-6 w-24 bg-white/10" />
          </div>
        </div>
      </div>

      <div className="relative bg-background">
        <div className="mx-auto grid w-full max-w-7xl gap-6 p-4 md:grid-cols-[176px_1fr] md:gap-8 md:p-6 lg:grid-cols-[208px_1fr]">
          <div className="flex flex-col gap-4">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
          </div>
          <div className="flex flex-col gap-4">
            <Skeleton className="h-48 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  )
}

function AnimeTitleText({ title }: { title: AnimeTitleValue }) {
  return <AnimeTitle title={title} />
}

function WatchButton({
  malId,
  provider: selectedProvider,
  progress,
  progressLoading,
}: {
  malId: number
  provider: StreamProviderId
  progress: number | null
  progressLoading: boolean
}) {
  const result = useAtomValue(streamEpisodesAtom(malId, selectedProvider))
  if (progressLoading || Result.isWaiting(result))
    return (
      <Skeleton
        className="h-9 w-40 rounded-4xl bg-white/10"
        role="status"
        aria-label="Loading watch status"
      />
    )

  const catalog = Result.match(result, {
    onInitial: () => null,
    onFailure: () => null,
    onSuccess: ({ value }) => value,
  })
  const provider = catalog?.providers.find(
    (item) => item.status === "available" && item.episodes.length > 0
  )
  const episodes = Array.from(provider?.episodes ?? []).sort(
    (left, right) => left.number - right.number
  )
  const action = watchAction(
    progress,
    episodes.map((item) => item.number)
  )
  const episode = action
    ? episodes.find((item) => item.number === action.episodeNumber)
    : null
  const audio = episode ? preferredAudio(episode) : null

  if (!provider || !action || !episode || !audio) return null

  return (
    <Button className="w-fit" asChild>
      <Link
        to="/watch/$malId/$provider/$episodeId"
        params={{ malId, provider: provider.provider, episodeId: episode.id }}
        search={{ audio }}
      >
        <PlayCircle data-icon="inline-start" />
        {action.label}
      </Link>
    </Button>
  )
}

function LibraryEntrySummary({ entry }: { entry: LibraryEntry }) {
  const StatusIcon = libraryStatusIcons[entry.status]
  const score = formatLibraryScore(entry.score)

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-xl border border-white/15 bg-black/25 px-3 py-2 text-xs text-white/80 backdrop-blur-md">
      <span className="inline-flex items-center gap-1.5 font-semibold text-white">
        <StatusIcon className="size-3.5" />
        {libraryStatusLabel(entry.status)}
      </span>
      <span className="h-3 w-px bg-white/20" />
      <span>{formatLibraryProgress(entry)}</span>
      {score ? (
        <>
          <span className="h-3 w-px bg-white/20" />
          <span className="inline-flex items-center gap-1">
            <Star className="size-3 fill-amber-400 text-amber-400" />
            {score}
          </span>
        </>
      ) : null}
      <span className="h-3 w-px bg-white/20" />
      <span className="text-white/55">
        Updated {formatLibraryUpdatedAt(entry.updatedAt)}
      </span>
    </div>
  )
}

function RelationsPanel({
  relations,
}: {
  relations: ReadonlyArray<AnimeRelationItem>
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {relations.slice(0, 8).map((relation) => {
        const content = (
          <div
            key={`${relation.relationType}-${relation.malId ?? relation.aniListId}`}
            className="flex min-w-0 gap-3 rounded-xl border bg-card/80 p-3 transition hover:bg-accent"
          >
            {relation.coverImage ? (
              <img
                src={relation.coverImage}
                alt=""
                className="aspect-2/3 w-12 shrink-0 rounded-lg object-cover"
              />
            ) : null}
            <div className="min-w-0">
              <p className="line-clamp-2 text-sm font-medium">
                <AnimeTitle title={relation.title} />
              </p>
              <p className="text-xs font-semibold text-primary capitalize">
                {relation.relationType.split("_").join(" ").toLowerCase()}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatAnimeFormat(relation.format)}
              </p>
            </div>
          </div>
        )

        return relation.malId ? (
          <Link
            key={`${relation.relationType}-${relation.malId}`}
            to="/series/$id"
            params={{ id: relation.malId }}
            preload="intent"
          >
            {content}
          </Link>
        ) : (
          <div key={`${relation.relationType}-${relation.aniListId}`}>
            {content}
          </div>
        )
      })}
    </div>
  )
}

function RecommendationsPanel({
  recommendations,
  loading,
  failed,
}: {
  recommendations: ReadonlyArray<AnimeItem> | null
  loading: boolean
  failed: boolean
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="flex flex-col gap-2.5">
            <Skeleton className="aspect-2/3 rounded-xl" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-3 w-2/5" />
          </div>
        ))}
      </div>
    )
  }

  if (failed) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
        Recommendations are not available right now.
      </div>
    )
  }

  return <AnimeGrid items={recommendations ?? []} compact />
}

function MetaField({
  label,
  value,
}: {
  label: string
  value: string | number | null | undefined
}) {
  if (value === null || value === undefined) return null
  return (
    <div>
      <dt className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  )
}

function ExternalSiteLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm transition hover:bg-accent"
    >
      <span className="truncate">{label}</span>
      <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
    </a>
  )
}
