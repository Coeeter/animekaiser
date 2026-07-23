import { relations } from "drizzle-orm"
import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { user } from "./auth"
import { animeMetadata } from "./library"

export const watchHistoryStatus = ["watching", "completed"] as const

export const watchHistory = pgTable("watch_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  malId: integer("mal_id")
    .notNull()
    .references(() => animeMetadata.malId),
  episode: integer("episode").notNull(),
  progress: integer("progress").notNull(),
  status: text("status", { enum: watchHistoryStatus }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
})

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
