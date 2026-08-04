import { relations } from "drizzle-orm"
import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"
import { user } from "./auth"
import { animeMetadata } from "./library"

export const watchHistoryStatus = ["watching", "completed"] as const
export const watchHistoryAudio = ["sub", "dub"] as const

export const watchHistory = pgTable(
  "watch_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    malId: integer("mal_id")
      .notNull()
      .references(() => animeMetadata.malId),
    provider: text("provider").notNull(),
    episodeId: text("episode_id").notNull(),
    serverId: text("server_id"),
    serverName: text("server_name"),
    episode: integer("episode").notNull(),
    audio: text("audio", { enum: watchHistoryAudio }).default("sub").notNull(),
    positionSeconds: integer("position_seconds").default(0).notNull(),
    durationSeconds: integer("duration_seconds"),
    status: text("status", { enum: watchHistoryStatus }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("watch_history_user_episode_idx").on(
      table.userId,
      table.malId,
      table.episode
    ),
    index("watch_history_user_updated_idx").on(table.userId, table.updatedAt),
  ]
)

export const watchHistoryRelations = relations(watchHistory, ({ one }) => ({
  user: one(user, {
    fields: [watchHistory.userId],
    references: [user.id],
  }),
  animeMetadata: one(animeMetadata, {
    fields: [watchHistory.malId],
    references: [animeMetadata.malId],
  }),
}))
