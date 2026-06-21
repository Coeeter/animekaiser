import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { user } from "./auth"

export const profile = pgTable("profile", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  bannerKey: text("banner_key"),
  description: text("description"),
  private: boolean("private").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
})
