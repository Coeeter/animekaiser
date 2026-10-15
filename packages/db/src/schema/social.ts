import { sql } from "drizzle-orm"
import {
  check,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"
import { user } from "./auth"

export const friendshipStatuses = ["pending", "accepted", "declined"] as const

// One row per unordered account pair: `userLowId < userHighId` makes crossed
// requests collide on the unique index instead of creating two friendships.
export const friendship = pgTable(
  "friendship",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userLowId: text("user_low_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    userHighId: text("user_high_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    requesterId: text("requester_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: text("status", { enum: friendshipStatuses }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("friendship_pair_idx").on(table.userLowId, table.userHighId),
    index("friendship_high_idx").on(table.userHighId),
    check(
      "friendship_ordered_pair",
      sql`${table.userLowId} < ${table.userHighId}`
    ),
  ]
)
