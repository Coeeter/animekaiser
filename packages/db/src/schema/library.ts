import { sql } from "drizzle-orm"
import {
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import { user } from "./auth"

export const libraryStatuses = [
  "watching",
  "completed",
  "paused",
  "dropped",
  "planning",
  "rewatching",
] as const

export const animeMetadata = pgTable(
  "anime_metadata",
  {
    malId: integer("mal_id").primaryKey(),
    aniListId: integer("anilist_id"),
    titleRomaji: text("title_romaji").notNull(),
    titleEnglish: text("title_english"),
    coverImage: text("cover_image"),
    episodes: integer("episodes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [uniqueIndex("anime_metadata_anilist_id_idx").on(table.aniListId)]
)

export const userLibraryEntry = pgTable(
  "user_library_entry",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    malId: integer("mal_id")
      .notNull()
      .references(() => animeMetadata.malId),
    status: text("status", { enum: libraryStatuses }).notNull(),
    score: integer("score"),
    progress: integer("progress").default(0).notNull(),
    notes: text("notes"),
    aniListEntryId: integer("anilist_entry_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.malId] }),
    index("user_library_entry_user_status_idx").on(table.userId, table.status),
  ]
)

export type LibraryImportJobPayload = {
  provider: "mal" | "anilist"
}

export type LibraryImportJobResult = {
  insertedCount: number
  updatedCount: number
  unchangedCount: number
  skippedCount: number
}

export const job = pgTable(
  "job",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: text("type", { enum: ["library_import"] }).notNull(),
    status: text("status", {
      enum: ["pending", "running", "completed", "failed"],
    })
      .default("pending")
      .notNull(),
    payload: jsonb("payload").$type<LibraryImportJobPayload>().notNull(),
    result: jsonb("result").$type<LibraryImportJobResult>(),
    attempts: integer("attempts").default(0).notNull(),
    errorMessage: text("error_message"),
    availableAt: timestamp("available_at").defaultNow().notNull(),
    lockedAt: timestamp("locked_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("job_claim_idx").on(table.type, table.status, table.availableAt),
  ]
)

export type LibrarySyncEventPayload = {
  status: (typeof libraryStatuses)[number]
  score: number | null
  progress: number
  notes: string | null
  aniListId: number | null
  aniListEntryId: number | null
}

export const librarySyncEvent = pgTable(
  "library_sync_event",
  {
    id: text("id").primaryKey(),
    sourceEventId: text("source_event_id"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    malId: integer("mal_id")
      .notNull()
      .references(() => animeMetadata.malId),
    provider: text("provider", { enum: ["mal", "anilist"] }).notNull(),
    action: text("action", { enum: ["upsert", "delete"] }).notNull(),
    status: text("status", {
      enum: ["pending", "running", "completed", "failed", "superseded"],
    })
      .default("pending")
      .notNull(),
    attempts: integer("attempts").default(0).notNull(),
    payload: jsonb("payload").$type<LibrarySyncEventPayload>().notNull(),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("library_sync_event_claim_idx").on(table.status, table.createdAt),
    index("library_sync_event_user_idx").on(table.userId, table.createdAt),
    uniqueIndex("library_sync_event_pending_idx")
      .on(table.userId, table.malId, table.provider)
      .where(sql`${table.status} = 'pending'`),
  ]
)
