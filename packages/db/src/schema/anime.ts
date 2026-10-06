import { integer, jsonb, pgTable, timestamp } from "drizzle-orm/pg-core"

// Durable copy of upstream anime detail, so losing Redis doesn't send every
// page back to AniList. `detail` is the encoded domain AnimeDetail.
export const animeDetailRecord = pgTable("anime_detail_record", {
  malId: integer("mal_id").primaryKey(),
  detail: jsonb("detail").notNull(),
  freshUntil: timestamp("fresh_until").notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
})
