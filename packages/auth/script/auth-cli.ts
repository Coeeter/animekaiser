import { createDrizzleClient, createPgPool } from "@animekaiser/db"
import { initAuth } from "../src/init-auth"

const pool = createPgPool({
  url: process.env.DATABASE_URL ?? "postgres://localhost:5432/kaiser",
})

export const auth = initAuth({
  appName: "Kaiser",
  appURL: process.env.APP_URL ?? "http://localhost:3000",
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:8080",
  cookieDomain: process.env.AUTH_COOKIE_DOMAIN,
  secret:
    process.env.BETTER_AUTH_SECRET ??
    "development-only-better-auth-secret-change-before-use",
  trustedOrigins: [process.env.APP_URL ?? "http://localhost:3000"],
  db: createDrizzleClient(pool),
  logger: {
    info: console.info,
    warn: console.warn,
    error: console.error,
  },
  mailer: {
    sendEmailOtp: async () => {},
  },
})
