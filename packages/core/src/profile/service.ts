import { Database, profile, user } from "@animekaiser/db"
import { ProfileOperationError } from "@animekaiser/domain"
import { eq } from "drizzle-orm"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"

export type ProfileRecord = {
  user: {
    id: string
    username: string | null
    image: string | null
  }
  profile: {
    bannerKey: string | null
    description: string | null
    private: boolean
    shareStats: boolean
    shareActivity: boolean
    shareList: boolean
  }
}

type JoinedProfile = {
  user: typeof user.$inferSelect
  profile: typeof profile.$inferSelect | null
}

const emptyProfile = {
  bannerKey: null,
  description: null,
  private: false,
  shareStats: true,
  shareActivity: true,
  shareList: true,
} as const

export class ProfileService extends Effect.Service<ProfileService>()(
  "@animekaiser/core/ProfileService",
  {
    accessors: true,
    effect: Effect.gen(function* () {
      const database = yield* Database

      const loadByUserId = Effect.fn("ProfileService.loadByUserId")(function* (
        userId: string
      ) {
        const rows = yield* database
          .execute((db) =>
            db
              .select({ user, profile })
              .from(user)
              .leftJoin(profile, eq(profile.userId, user.id))
              .where(eq(user.id, userId))
              .limit(1)
          )
          .pipe(
            Effect.catchTag("DatabaseError", () =>
              Effect.fail(
                new ProfileOperationError({
                  message: "Unable to load profile.",
                })
              )
            )
          )

        return Option.fromNullable(rows[0])
      })

      const loadByUsername = Effect.fn("ProfileService.loadByUsername")(
        function* (username: string) {
          const rows = yield* database
            .execute((db) =>
              db
                .select({ user, profile })
                .from(user)
                .leftJoin(profile, eq(profile.userId, user.id))
                .where(eq(user.username, username.toLowerCase()))
                .limit(1)
            )
            .pipe(
              Effect.catchTag("DatabaseError", () =>
                Effect.fail(
                  new ProfileOperationError({
                    message: "Unable to load profile.",
                  })
                )
              )
            )

          return Option.fromNullable(rows[0])
        }
      )

      const toRecord = (row: JoinedProfile) =>
        ({
          user: {
            id: row.user.id,
            username: row.user.displayUsername ?? row.user.username,
            image: row.user.image,
          },
          profile: row.profile
            ? {
                bannerKey: row.profile.bannerKey,
                description: row.profile.description,
                private: row.profile.private,
                shareStats: row.profile.shareStats,
                shareActivity: row.profile.shareActivity,
                shareList: row.profile.shareList,
              }
            : emptyProfile,
        }) satisfies ProfileRecord

      const getOwnProfile = Effect.fn("ProfileService.getOwnProfile")(
        function* (userId: string) {
          const row = yield* loadByUserId(userId)
          return yield* Option.match(row, {
            onNone: () =>
              Effect.fail(
                new ProfileOperationError({ message: "Profile not found." })
              ),
            onSome: (value) => Effect.succeed(toRecord(value)),
          })
        }
      )

      const getPublicProfile = Effect.fn("ProfileService.getPublicProfile")(
        function* (username: string) {
          const row = yield* loadByUsername(username)
          return Option.map(row, toRecord)
        }
      )

      const updateDescription = Effect.fn("ProfileService.updateDescription")(
        function* (userId: string, description: string | null) {
          yield* database
            .execute((db) =>
              db
                .insert(profile)
                .values({ userId, description })
                .onConflictDoUpdate({
                  target: profile.userId,
                  set: { description, updatedAt: new Date() },
                })
            )
            .pipe(
              Effect.catchTag("DatabaseError", () =>
                Effect.fail(
                  new ProfileOperationError({
                    message: "Unable to update profile.",
                  })
                )
              )
            )
          return yield* getOwnProfile(userId)
        }
      )

      const updatePrivacy = Effect.fn("ProfileService.updatePrivacy")(
        function* (
          userId: string,
          patch: {
            private?: boolean
            shareStats?: boolean
            shareActivity?: boolean
            shareList?: boolean
          }
        ) {
          const changes = {
            ...(patch.private === undefined ? {} : { private: patch.private }),
            ...(patch.shareStats === undefined
              ? {}
              : { shareStats: patch.shareStats }),
            ...(patch.shareActivity === undefined
              ? {}
              : { shareActivity: patch.shareActivity }),
            ...(patch.shareList === undefined
              ? {}
              : { shareList: patch.shareList }),
          }

          yield* database
            .execute((db) =>
              db
                .insert(profile)
                .values({ userId, ...changes })
                .onConflictDoUpdate({
                  target: profile.userId,
                  set: { ...changes, updatedAt: new Date() },
                })
            )
            .pipe(
              Effect.catchTag("DatabaseError", () =>
                Effect.fail(
                  new ProfileOperationError({
                    message: "Unable to update privacy.",
                  })
                )
              )
            )
          return yield* getOwnProfile(userId)
        }
      )

      const setBannerKey = Effect.fn("ProfileService.setBannerKey")(function* (
        userId: string,
        bannerKey: string | null
      ) {
        yield* database
          .execute((db) =>
            db
              .insert(profile)
              .values({ userId, bannerKey })
              .onConflictDoUpdate({
                target: profile.userId,
                set: { bannerKey, updatedAt: new Date() },
              })
          )
          .pipe(
            Effect.catchTag("DatabaseError", () =>
              Effect.fail(
                new ProfileOperationError({
                  message: "Unable to update profile banner.",
                })
              )
            )
          )
      })

      return {
        getOwnProfile,
        getPublicProfile,
        updateDescription,
        updatePrivacy,
        setBannerKey,
      }
    }),
  }
) {}
