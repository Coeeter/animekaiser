import type { KaiserExecutor } from "@animekaiser/db"
import { Database, friendship, profile, user } from "@animekaiser/db"
import type {
  FriendRelation,
  SocialUser,
  SocialUserWithRelation,
} from "@animekaiser/domain"
import { SocialOperationError } from "@animekaiser/domain"
import { and, eq, gt, inArray, like, ne, or, sql } from "drizzle-orm"
import * as Effect from "effect/Effect"

type FriendshipRow = typeof friendship.$inferSelect

// A declined request keeps showing as pending to its sender for this long, so
// repeated requests cannot be used to badger the recipient.
const declineCooldownMs = 7 * 24 * 60 * 60 * 1000
const dailyRequestLimit = 20

const fail = (reason: SocialOperationError["reason"], message: string) =>
  new SocialOperationError({ reason, message })

const pair = (left: string, right: string) =>
  left < right ? ([left, right] as const) : ([right, left] as const)

export const relationFor = (
  viewerId: string,
  row: Pick<FriendshipRow, "status" | "requesterId" | "respondedAt"> | null,
  now: number
): FriendRelation => {
  if (!row) return "none"
  if (row.status === "accepted") return "friends"
  const outgoing = row.requesterId === viewerId
  if (row.status === "pending") return outgoing ? "outgoing" : "incoming"
  const coolingDown =
    (row.respondedAt?.getTime() ?? 0) > now - declineCooldownMs
  return outgoing && coolingDown ? "outgoing" : "none"
}

const toSocialUser = (row: {
  id: string
  name: string
  username: string | null
  displayUsername: string | null
  image: string | null
}): SocialUser => ({
  id: row.id,
  username: row.username,
  displayName: row.displayUsername ?? row.username ?? row.name,
  image: row.image,
})

const userColumns = {
  id: user.id,
  name: user.name,
  username: user.username,
  displayUsername: user.displayUsername,
  image: user.image,
}

const findRow = async (ex: KaiserExecutor, left: string, right: string) => {
  const [low, high] = pair(left, right)
  const [row] = await ex
    .select()
    .from(friendship)
    .where(and(eq(friendship.userLowId, low), eq(friendship.userHighId, high)))
    .for("update")
  return row ?? null
}

export class SocialService extends Effect.Service<SocialService>()(
  "@animekaiser/core/SocialService",
  {
    effect: Effect.gen(function* () {
      const database = yield* Database

      const transact = <T>(fn: (tx: KaiserExecutor) => Promise<T>) =>
        database
          .execute((db) => db.transaction((tx) => fn(tx)))
          .pipe(
            Effect.catchAll((error) =>
              error.cause instanceof SocialOperationError
                ? Effect.fail(error.cause)
                : Effect.logError(
                    "[Social] Database operation failed",
                    error
                  ).pipe(
                    Effect.zipRight(
                      Effect.fail(
                        fail("unavailable", "Something went wrong. Try again.")
                      )
                    )
                  )
            )
          )

      const relationsFor = async (
        ex: KaiserExecutor,
        viewerId: string,
        others: ReadonlyArray<string>
      ) => {
        if (others.length === 0) return new Map<string, FriendRelation>()
        const rows = await ex
          .select()
          .from(friendship)
          .where(
            or(
              and(
                eq(friendship.userLowId, viewerId),
                inArray(friendship.userHighId, [...others])
              ),
              and(
                eq(friendship.userHighId, viewerId),
                inArray(friendship.userLowId, [...others])
              )
            )
          )
        const now = Date.now()
        return new Map(
          rows.map((row) => [
            row.userLowId === viewerId ? row.userHighId : row.userLowId,
            relationFor(viewerId, row, now),
          ])
        )
      }

      // Private profiles are found only by their exact username; public ones
      // also match by prefix. Email is never searchable.
      const search = Effect.fn("SocialService.search")(function* (
        viewerId: string,
        query: string
      ) {
        const term = query.trim().replace(/^@/, "").toLowerCase()
        if (term.length < 2) return []
        const pattern = `${term.replace(/[\\%_]/g, (char) => `\\${char}`)}%`
        return yield* transact(async (tx) => {
          const rows = await tx
            .select(userColumns)
            .from(user)
            .leftJoin(profile, eq(profile.userId, user.id))
            .where(
              and(
                ne(user.id, viewerId),
                or(
                  eq(user.username, term),
                  and(
                    like(user.username, pattern),
                    sql`coalesce(${profile.private}, false) = false`
                  )
                )
              )
            )
            .orderBy(sql`${user.username} = ${term} desc`, user.username)
            .limit(10)
          const relations = await relationsFor(
            tx,
            viewerId,
            rows.map((row) => row.id)
          )
          return rows.map(
            (row): SocialUserWithRelation => ({
              ...toSocialUser(row),
              relation: relations.get(row.id) ?? "none",
            })
          )
        })
      })

      const overview = Effect.fn("SocialService.overview")(function* (
        viewerId: string
      ) {
        return yield* transact(async (tx) => {
          const rows = await tx
            .select()
            .from(friendship)
            .where(
              or(
                eq(friendship.userLowId, viewerId),
                eq(friendship.userHighId, viewerId)
              )
            )
          const now = Date.now()
          const others = rows.map((row) => ({
            id: row.userLowId === viewerId ? row.userHighId : row.userLowId,
            relation: relationFor(viewerId, row, now),
          }))
          const users =
            others.length === 0
              ? []
              : await tx
                  .select(userColumns)
                  .from(user)
                  .where(
                    inArray(
                      user.id,
                      others.map((other) => other.id)
                    )
                  )
                  .orderBy(user.username)
          const byRelation = (wanted: FriendRelation) => {
            const ids = new Set(
              others
                .filter((other) => other.relation === wanted)
                .map((other) => other.id)
            )
            return users.filter((row) => ids.has(row.id)).map(toSocialUser)
          }
          return {
            friends: byRelation("friends"),
            incoming: byRelation("incoming"),
            outgoing: byRelation("outgoing"),
          }
        })
      })

      const relation = Effect.fn("SocialService.relation")(function* (
        viewerId: string,
        username: string
      ) {
        return yield* transact(async (tx) => {
          const [other] = await tx
            .select({ id: user.id })
            .from(user)
            .where(eq(user.username, username.toLowerCase()))
          if (!other) return null
          if (other.id === viewerId)
            return { userId: other.id, relation: "self" as FriendRelation }
          return {
            userId: other.id,
            relation: relationFor(
              viewerId,
              await findRow(tx, viewerId, other.id),
              Date.now()
            ),
          }
        })
      })

      const sendRequest = Effect.fn("SocialService.sendRequest")(function* (
        viewerId: string,
        targetId: string
      ) {
        if (viewerId === targetId) return "self" as const
        const now = Date.now()
        return yield* transact(async (tx): Promise<FriendRelation> => {
          const [target] = await tx
            .select({ id: user.id })
            .from(user)
            .where(eq(user.id, targetId))
          if (!target) throw fail("not_found", "That person couldn't be found.")
          const row = await findRow(tx, viewerId, targetId)
          const current = relationFor(viewerId, row, now)
          if (current === "friends" || current === "outgoing") return current
          if (row && current === "incoming") {
            await tx
              .update(friendship)
              .set({ status: "accepted", respondedAt: new Date(now) })
              .where(eq(friendship.id, row.id))
            return "friends"
          }
          const [sent] = await tx
            .select({ count: sql<number>`count(*)::int` })
            .from(friendship)
            .where(
              and(
                eq(friendship.requesterId, viewerId),
                gt(friendship.createdAt, new Date(now - 24 * 60 * 60 * 1000))
              )
            )
          if ((sent?.count ?? 0) >= dailyRequestLimit)
            throw fail(
              "rate_limited",
              "You've sent a lot of friend requests today. Try again tomorrow."
            )
          const [low, high] = pair(viewerId, targetId)
          await tx
            .insert(friendship)
            .values({
              userLowId: low,
              userHighId: high,
              requesterId: viewerId,
              status: "pending",
              createdAt: new Date(now),
            })
            .onConflictDoUpdate({
              target: [friendship.userLowId, friendship.userHighId],
              set: {
                requesterId: viewerId,
                status: "pending",
                createdAt: new Date(now),
                respondedAt: null,
              },
            })
          return "outgoing"
        })
      })

      const respond = Effect.fn("SocialService.respond")(function* (
        viewerId: string,
        requesterId: string,
        accept: boolean
      ) {
        const now = Date.now()
        return yield* transact(async (tx): Promise<FriendRelation> => {
          const row = await findRow(tx, viewerId, requesterId)
          if (row?.status !== "pending" || row.requesterId !== requesterId)
            return relationFor(viewerId, row, now)
          await tx
            .update(friendship)
            .set({
              status: accept ? "accepted" : "declined",
              respondedAt: new Date(now),
            })
            .where(eq(friendship.id, row.id))
          return accept ? "friends" : "none"
        })
      })

      const remove = Effect.fn("SocialService.remove")(function* (
        viewerId: string,
        otherId: string
      ) {
        const now = Date.now()
        return yield* transact(async (tx): Promise<FriendRelation> => {
          const row = await findRow(tx, viewerId, otherId)
          if (!row) return "none"
          const current = relationFor(viewerId, row, now)
          if (current === "incoming") {
            await tx
              .update(friendship)
              .set({ status: "declined", respondedAt: new Date(now) })
              .where(eq(friendship.id, row.id))
            return "none"
          }
          if (row.status === "declined") return current
          await tx.delete(friendship).where(eq(friendship.id, row.id))
          return "none"
        })
      })

      return { search, overview, relation, sendRequest, respond, remove }
    }),
  }
) {}
