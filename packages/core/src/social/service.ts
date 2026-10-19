import type { DatabaseError } from "@animekaiser/db"
import { Database, friendship, profile, user } from "@animekaiser/db"
import type {
  FriendRelation,
  SocialUser,
  SocialUserWithRelation,
} from "@animekaiser/domain"
import { SocialOperationError } from "@animekaiser/domain"
import { and, eq, gt, inArray, like, ne, or, sql } from "drizzle-orm"
import * as Clock from "effect/Clock"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"

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

export class SocialService extends Context.Service<SocialService>()(
  "@animekaiser/core/SocialService",
  {
    make: Effect.gen(function* () {
      const database = yield* Database

      const transact = <A, R>(
        effect: Effect.Effect<A, SocialOperationError | DatabaseError, R>
      ) =>
        database.transaction(effect).pipe(
          Effect.tapErrorTag("DatabaseError", (error) =>
            Effect.logError("[Social] Database operation failed", error)
          ),
          Effect.catchTag("DatabaseError", () =>
            Effect.fail(fail("unavailable", "Something went wrong. Try again."))
          )
        )

      const findRow = Effect.fnUntraced(function* (
        left: string,
        right: string
      ) {
        const [low, high] = pair(left, right)
        const [row] = yield* database.execute((db) =>
          db
            .select()
            .from(friendship)
            .where(
              and(
                eq(friendship.userLowId, low),
                eq(friendship.userHighId, high)
              )
            )
            .for("update")
        )
        return row ?? null
      })

      const relationsFor = Effect.fnUntraced(function* (
        viewerId: string,
        others: ReadonlyArray<string>
      ) {
        if (others.length === 0) return new Map<string, FriendRelation>()
        const rows = yield* database.execute((db) =>
          db
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
        )
        const now = yield* Clock.currentTimeMillis
        return new Map(
          rows.map((row) => [
            row.userLowId === viewerId ? row.userHighId : row.userLowId,
            relationFor(viewerId, row, now),
          ])
        )
      })

      // Private profiles are found only by their exact username; public ones
      // also match by prefix. Email is never searchable.
      const search = Effect.fn("SocialService.search")(function* (
        viewerId: string,
        query: string
      ) {
        const term = query.trim().replace(/^@/, "").toLowerCase()
        if (term.length < 2) return []
        const pattern = `${term.replace(/[\\%_]/g, (char) => `\\${char}`)}%`
        const rows = yield* database.execute((db) =>
          db
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
        )
        const relations = yield* relationsFor(
          viewerId,
          rows.map((row) => row.id)
        )
        return rows.map(
          (row): SocialUserWithRelation => ({
            ...toSocialUser(row),
            relation: relations.get(row.id) ?? "none",
          })
        )
      }, transact)

      const overview = Effect.fn("SocialService.overview")(function* (
        viewerId: string
      ) {
        const rows = yield* database.execute((db) =>
          db
            .select()
            .from(friendship)
            .where(
              or(
                eq(friendship.userLowId, viewerId),
                eq(friendship.userHighId, viewerId)
              )
            )
        )
        const now = yield* Clock.currentTimeMillis
        const others = rows.map((row) => ({
          id: row.userLowId === viewerId ? row.userHighId : row.userLowId,
          relation: relationFor(viewerId, row, now),
        }))
        const users =
          others.length === 0
            ? []
            : yield* database.execute((db) =>
                db
                  .select(userColumns)
                  .from(user)
                  .where(
                    inArray(
                      user.id,
                      others.map((other) => other.id)
                    )
                  )
                  .orderBy(user.username)
              )
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
      }, transact)

      const relation = Effect.fn("SocialService.relation")(function* (
        viewerId: string,
        username: string
      ) {
        const [other] = yield* database.execute((db) =>
          db
            .select({ id: user.id })
            .from(user)
            .where(eq(user.username, username.toLowerCase()))
        )
        if (!other) return null
        if (other.id === viewerId)
          return { userId: other.id, relation: "self" as FriendRelation }
        const row = yield* findRow(viewerId, other.id)
        return {
          userId: other.id,
          relation: relationFor(viewerId, row, yield* Clock.currentTimeMillis),
        }
      }, transact)

      const sendRequest = Effect.fn("SocialService.sendRequest")(function* (
        viewerId: string,
        targetId: string
      ) {
        if (viewerId === targetId) return "self" as const
        const now = yield* Clock.currentTimeMillis
        const [target] = yield* database.execute((db) =>
          db.select({ id: user.id }).from(user).where(eq(user.id, targetId))
        )
        if (!target)
          return yield* fail("not_found", "That person couldn't be found.")
        const row = yield* findRow(viewerId, targetId)
        const current = relationFor(viewerId, row, now)
        if (current === "friends" || current === "outgoing") return current
        if (row && current === "incoming") {
          yield* database.execute((db) =>
            db
              .update(friendship)
              .set({ status: "accepted", respondedAt: new Date(now) })
              .where(eq(friendship.id, row.id))
          )
          return "friends" as const
        }
        const [sent] = yield* database.execute((db) =>
          db
            .select({ count: sql<number>`count(*)::int` })
            .from(friendship)
            .where(
              and(
                eq(friendship.requesterId, viewerId),
                gt(friendship.createdAt, new Date(now - 24 * 60 * 60 * 1000))
              )
            )
        )
        if ((sent?.count ?? 0) >= dailyRequestLimit)
          return yield* fail(
            "rate_limited",
            "You've sent a lot of friend requests today. Try again tomorrow."
          )
        const [low, high] = pair(viewerId, targetId)
        yield* database.execute((db) =>
          db
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
        )
        return "outgoing" as const
      }, transact)

      const respond = Effect.fn("SocialService.respond")(function* (
        viewerId: string,
        requesterId: string,
        accept: boolean
      ) {
        const now = yield* Clock.currentTimeMillis
        const row = yield* findRow(viewerId, requesterId)
        if (row?.status !== "pending" || row.requesterId !== requesterId)
          return relationFor(viewerId, row, now)
        yield* database.execute((db) =>
          db
            .update(friendship)
            .set({
              status: accept ? "accepted" : "declined",
              respondedAt: new Date(now),
            })
            .where(eq(friendship.id, row.id))
        )
        return accept ? "friends" : "none"
      }, transact)

      const remove = Effect.fn("SocialService.remove")(function* (
        viewerId: string,
        otherId: string
      ) {
        const now = yield* Clock.currentTimeMillis
        const row = yield* findRow(viewerId, otherId)
        if (!row) return "none"
        const current = relationFor(viewerId, row, now)
        if (current === "incoming") {
          yield* database.execute((db) =>
            db
              .update(friendship)
              .set({ status: "declined", respondedAt: new Date(now) })
              .where(eq(friendship.id, row.id))
          )
          return "none"
        }
        if (row.status === "declined") return current
        yield* database.execute((db) =>
          db.delete(friendship).where(eq(friendship.id, row.id))
        )
        return "none"
      }, transact)

      return { search, overview, relation, sendRequest, respond, remove }
    }),
  }
) {
  static readonly layer = Layer.effect(SocialService, SocialService.make)
}
