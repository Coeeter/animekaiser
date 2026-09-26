import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { animeMetadata } from "./library"

export const airedEpisodeSources = ["anilist", "anizip", "metadata"] as const

export const animeAiringState = pgTable("anime_airing_state", {
  malId: integer("mal_id")
    .primaryKey()
    .references(() => animeMetadata.malId),
  airingStatus: text("airing_status"),
  totalEpisodes: integer("total_episodes"),
  latestAiredEpisode: integer("latest_aired_episode"),
  latestAiredAt: timestamp("latest_aired_at"),
  latestAiredSource: text("latest_aired_source", {
    enum: airedEpisodeSources,
  }),
  nextEpisode: integer("next_episode"),
  nextAiringAt: timestamp("next_airing_at"),
  availableEpisode: integer("available_episode"),
  availableCheckedAt: timestamp("available_checked_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
})
