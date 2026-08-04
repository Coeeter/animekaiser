import {
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core"
import { animeMetadata } from "./library"

export const animeStreamProviderMapping = pgTable(
  "anime_stream_provider_mapping",
  {
    malId: integer("mal_id")
      .notNull()
      .references(() => animeMetadata.malId),
    provider: text("provider").notNull(),
    providerAnimeId: text("provider_anime_id").notNull(),
    matchedTitle: text("matched_title"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.malId, table.provider] }),
    index("anime_stream_provider_mapping_provider_idx").on(
      table.provider,
      table.providerAnimeId
    ),
  ]
)
