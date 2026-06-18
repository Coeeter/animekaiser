import { relations } from "drizzle-orm"
import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import { user } from "./auth"

export const externalListAccount = pgTable(
  "external_list_account",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    provider: text("provider", { enum: ["mal", "anilist"] }).notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    accessToken: text("access_token").notNull(),
    refreshToken: text("refresh_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scopes: text("scopes"),
    tokenType: text("token_type"),
    lastTokenRefreshAt: timestamp("last_token_refresh_at"),
    nextTokenRefreshAt: timestamp("next_token_refresh_at"),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("external_list_account_user_provider_idx").on(
      table.userId,
      table.provider
    ),
    uniqueIndex("external_list_account_provider_account_idx").on(
      table.provider,
      table.providerAccountId
    ),
    index("external_list_account_refresh_idx").on(table.nextTokenRefreshAt),
  ]
)

export const externalListAccountRelations = relations(
  externalListAccount,
  ({ one }) => ({
    user: one(user, {
      fields: [externalListAccount.userId],
      references: [user.id],
    }),
  })
)
