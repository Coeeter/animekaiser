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

export type LibraryEntryValue = {
  status: (typeof libraryStatuses)[number]
  score: number | null
  progress: number
  notes: string | null
}

export const userLibraryEntry = pgTable(
  "user_library_entry",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    malId: integer("mal_id").notNull(),
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

export const libraryConflict = pgTable(
  "library_conflict",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    malId: integer("mal_id").notNull(),
    provider: text("provider", { enum: ["mal", "anilist"] }).notNull(),
    localValue: jsonb("local_value").$type<LibraryEntryValue>().notNull(),
    externalValue: jsonb("external_value").$type<LibraryEntryValue>().notNull(),
    status: text("status", { enum: ["pending", "resolved"] })
      .default("pending")
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    resolvedAt: timestamp("resolved_at"),
  },
  (table) => [
    uniqueIndex("library_conflict_entry_provider_idx").on(
      table.userId,
      table.malId,
      table.provider
    ),
    index("library_conflict_user_status_idx").on(table.userId, table.status),
  ]
)

export type LibraryImportJobPayload = {
  provider: "mal" | "anilist"
}

export type LibraryImportJobResult = {
  importedCount: number
  conflictCount: number
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
