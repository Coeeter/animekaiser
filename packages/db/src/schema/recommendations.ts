import { sql } from "drizzle-orm"
import {
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"
import { user } from "./auth"
import { room, roomParticipant } from "./rooms"

const tz = { withTimezone: true } as const

// A personal thread has one account owner. A guest catch-up thread instead
// belongs to one room participant and lives only as long as that room access.
export const recommendationThread = pgTable(
  "recommendation_thread",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerUserId: text("owner_user_id").references(() => user.id, {
      onDelete: "cascade",
    }),
    guestParticipantId: uuid("guest_participant_id").references(
      () => roomParticipant.id,
      { onDelete: "cascade" }
    ),
    roomId: uuid("room_id").references(() => room.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    context: jsonb("context"),
    summary: text("summary"),
    createdAt: timestamp("created_at", tz).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", tz)
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("recommendation_thread_owner_idx").on(
      table.ownerUserId,
      table.updatedAt
    ),
    index("recommendation_thread_guest_idx").on(table.guestParticipantId),
  ]
)

export const recommendationMessageStatuses = [
  "complete",
  "pending",
  "failed",
  "stopped",
  "interrupted",
] as const

export const recommendationMessage = pgTable(
  "recommendation_message",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => recommendationThread.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),
    role: text("role", { enum: ["user", "assistant"] }).notNull(),
    status: text("status", { enum: recommendationMessageStatuses }).notNull(),
    content: text("content").notNull(),
    data: jsonb("data"),
    requestId: text("request_id"),
    generationId: uuid("generation_id"),
    createdAt: timestamp("created_at", tz).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("recommendation_message_seq_idx").on(table.threadId, table.seq),
    uniqueIndex("recommendation_message_request_idx")
      .on(table.threadId, table.requestId)
      .where(sql`${table.requestId} is not null`),
  ]
)

export const aiGenerationStatuses = [
  "running",
  "completed",
  "failed",
  "stopped",
  "interrupted",
] as const

export const aiGeneration = pgTable(
  "ai_generation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: text("request_id").notNull(),
    actorKey: text("actor_key").notNull(),
    roomId: uuid("room_id").references(() => room.id, { onDelete: "set null" }),
    threadId: uuid("thread_id").references(() => recommendationThread.id, {
      onDelete: "set null",
    }),
    kind: text("kind", { enum: ["recommend", "recap"] }).notNull(),
    status: text("status", { enum: aiGenerationStatuses }).notNull(),
    model: text("model").notNull(),
    reservedUsd: numeric("reserved_usd", { precision: 10, scale: 6 }).notNull(),
    actualUsd: numeric("actual_usd", { precision: 10, scale: 6 }),
    usage: jsonb("usage"),
    error: text("error"),
    createdAt: timestamp("created_at", tz).defaultNow().notNull(),
    finishedAt: timestamp("finished_at", tz),
  },
  (table) => [
    uniqueIndex("ai_generation_request_idx").on(
      table.actorKey,
      table.requestId
    ),
    uniqueIndex("ai_generation_thread_running_idx")
      .on(table.threadId)
      .where(
        sql`${table.status} = 'running' and ${table.threadId} is not null`
      ),
    uniqueIndex("ai_generation_room_running_idx")
      .on(table.roomId)
      .where(sql`${table.status} = 'running' and ${table.threadId} is null`),
  ]
)

export const aiUsageDaily = pgTable(
  "ai_usage_daily",
  {
    key: text("key").notNull(),
    day: date("day").notNull(),
    count: integer("count").default(0).notNull(),
  },
  (table) => [primaryKey({ columns: [table.key, table.day] })]
)

export const aiBudgetMonth = pgTable("ai_budget_month", {
  month: text("month").primaryKey(),
  reservedUsd: numeric("reserved_usd", { precision: 10, scale: 6 })
    .default("0")
    .notNull(),
  spentUsd: numeric("spent_usd", { precision: 10, scale: 6 })
    .default("0")
    .notNull(),
})

export const aiPreference = pgTable("ai_preference", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  notes: jsonb("notes").$type<Array<string>>().default([]).notNull(),
  updatedAt: timestamp("updated_at", tz)
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
})
