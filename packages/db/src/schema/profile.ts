import { boolean, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { user } from "./auth"

export const profile = pgTable("profile", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  bannerKey: text("banner_key"),
  description: text("description"),
  private: boolean("private").default(false).notNull(),
  shareStats: boolean("share_stats").default(true).notNull(),
  shareActivity: boolean("share_activity").default(true).notNull(),
  shareList: boolean("share_list").default(true).notNull(),
  onboarded: boolean("onboarded").default(false).notNull(),
  // Encoded domain UserPreferences; null until the user's first save.
  preferences: jsonb("preferences"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
})
