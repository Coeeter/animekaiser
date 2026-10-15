import { sql } from "drizzle-orm"
import {
  bigint,
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"
import { user } from "./auth"
import { animeMetadata } from "./library"

export const roomAccessModes = ["public", "friends", "invite"] as const
export const roomPlaybackControls = ["host", "everyone"] as const
export const roomAiAccessModes = ["off", "host", "everyone"] as const
export const roomStatuses = ["open", "closed"] as const

const tz = { withTimezone: true } as const

export const room = pgTable(
  "room",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    hostUserId: text("host_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    access: text("access", { enum: roomAccessModes }).notNull(),
    playbackControl: text("playback_control", { enum: roomPlaybackControls })
      .default("host")
      .notNull(),
    aiAccess: text("ai_access", { enum: roomAiAccessModes })
      .default("host")
      .notNull(),
    status: text("status", { enum: roomStatuses }).default("open").notNull(),
    revision: bigint("revision", { mode: "number" }).default(1).notNull(),
    messageSeq: bigint("message_seq", { mode: "number" }).default(0).notNull(),
    malId: integer("mal_id").references(() => animeMetadata.malId),
    provider: text("provider"),
    episodeId: text("episode_id"),
    episodeNumber: real("episode_number"),
    audio: text("audio", { enum: ["sub", "dub"] }),
    selectionRevision: bigint("selection_revision", { mode: "number" })
      .default(0)
      .notNull(),
    playing: boolean("playing").default(false).notNull(),
    positionSeconds: doublePrecision("position_seconds").default(0).notNull(),
    positionAt: timestamp("position_at", tz).defaultNow().notNull(),
    rate: real("rate").default(1).notNull(),
    hostAwaySince: timestamp("host_away_since", tz),
    lastConnectedAt: timestamp("last_connected_at", tz).defaultNow().notNull(),
    closedAt: timestamp("closed_at", tz),
    createdAt: timestamp("created_at", tz).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", tz)
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("room_host_idx").on(table.hostUserId),
    index("room_public_idx")
      .on(table.updatedAt)
      .where(sql`${table.status} = 'open' and ${table.access} = 'public'`),
  ]
)

export const roomParticipantKinds = ["account", "guest"] as const
export const roomParticipantStates = [
  "invited",
  "admitted",
  "left",
  "removed",
  "banned",
  "expired",
] as const

export const roomParticipant = pgTable(
  "room_participant",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => room.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: roomParticipantKinds }).notNull(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    guestTokenHash: text("guest_token_hash"),
    guestExpiresAt: timestamp("guest_expires_at", tz),
    displayName: text("display_name"),
    state: text("state", { enum: roomParticipantStates }).notNull(),
    invitedBy: text("invited_by").references(() => user.id, {
      onDelete: "set null",
    }),
    shareTaste: boolean("share_taste").default(false).notNull(),
    admittedAt: timestamp("admitted_at", tz),
    lastSeenAt: timestamp("last_seen_at", tz),
    createdAt: timestamp("created_at", tz).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", tz)
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("room_participant_user_idx")
      .on(table.roomId, table.userId)
      .where(sql`${table.userId} is not null`),
    uniqueIndex("room_participant_guest_idx")
      .on(table.guestTokenHash)
      .where(sql`${table.guestTokenHash} is not null`),
    index("room_participant_user_state_idx").on(table.userId, table.state),
  ]
)

export const roomInviteLink = pgTable(
  "room_invite_link",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => room.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    expiresAt: timestamp("expires_at", tz).notNull(),
    revokedAt: timestamp("revoked_at", tz),
    createdAt: timestamp("created_at", tz).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("room_invite_link_token_idx").on(table.tokenHash),
    index("room_invite_link_room_idx").on(table.roomId),
  ]
)

export const roomMessageKinds = [
  "text",
  "system",
  "ai",
  "recommendation",
  "recap",
] as const

export const roomMessage = pgTable(
  "room_message",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => room.id, { onDelete: "cascade" }),
    seq: bigint("seq", { mode: "number" }).notNull(),
    participantId: uuid("participant_id").references(() => roomParticipant.id, {
      onDelete: "set null",
    }),
    kind: text("kind", { enum: roomMessageKinds }).notNull(),
    body: text("body").notNull(),
    data: jsonb("data"),
    requestId: text("request_id"),
    deletedAt: timestamp("deleted_at", tz),
    createdAt: timestamp("created_at", tz).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("room_message_seq_idx").on(table.roomId, table.seq),
    uniqueIndex("room_message_request_idx")
      .on(table.roomId, table.participantId, table.requestId)
      .where(sql`${table.requestId} is not null`),
  ]
)

export const roomPick = pgTable(
  "room_pick",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => room.id, { onDelete: "cascade" }),
    malId: integer("mal_id")
      .notNull()
      .references(() => animeMetadata.malId),
    addedBy: uuid("added_by").references(() => roomParticipant.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", tz).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("room_pick_anime_idx").on(table.roomId, table.malId)]
)

export const roomVote = pgTable(
  "room_vote",
  {
    pickId: uuid("pick_id")
      .notNull()
      .references(() => roomPick.id, { onDelete: "cascade" }),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => roomParticipant.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", tz).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.pickId, table.participantId] })]
)

// Live watch streams. Rows are leases refreshed by the owning API process and
// swept when stale, so a crashed process cannot leave members present forever.
export const roomConnection = pgTable(
  "room_connection",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tabId: uuid("tab_id").notNull(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => room.id, { onDelete: "cascade" }),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => roomParticipant.id, { onDelete: "cascade" }),
    runtimeId: text("runtime_id").notNull(),
    controller: boolean("controller").default(false).notNull(),
    playbackState: text("playback_state", {
      enum: ["idle", "ready", "buffering", "blocked", "error"],
    })
      .default("idle")
      .notNull(),
    connectedAt: timestamp("connected_at", tz).defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at", tz).defaultNow().notNull(),
  },
  (table) => [
    index("room_connection_room_idx").on(table.roomId),
    index("room_connection_participant_idx").on(table.participantId),
  ]
)

// Merged [start, end) second ranges a viewer actually played locally in room
// mode; room completion is derived from this rather than from position.
export const watchCoverage = pgTable(
  "watch_coverage",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    malId: integer("mal_id")
      .notNull()
      .references(() => animeMetadata.malId),
    episode: integer("episode").notNull(),
    intervals: jsonb("intervals")
      .$type<Array<[number, number]>>()
      .default([])
      .notNull(),
    durationSeconds: integer("duration_seconds"),
    completedAt: timestamp("completed_at", tz),
    updatedAt: timestamp("updated_at", tz)
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.malId, table.episode] }),
  ]
)
