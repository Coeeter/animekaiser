import { drizzleAdapter } from "@better-auth/drizzle-adapter"
import { passkey } from "@better-auth/passkey"
import type { KaiserDb } from "@workspace/db"
import { betterAuth } from "better-auth"
import {
  emailOTP,
  haveIBeenPwned,
  lastLoginMethod,
  username,
} from "better-auth/plugins"

export type AuthLogger = {
  info: (message: string, meta?: AuthLogMetadata) => void
  warn: (message: string, meta?: AuthLogMetadata) => void
  error: (message: string, meta?: AuthLogMetadata) => void
}

type AuthLogMetadata = Readonly<
  Record<string, string | number | boolean | null | undefined>
>

export type AuthMailer = {
  sendEmailOtp: (params: {
    email: string
    otp: string
    type: "sign-in" | "email-verification" | "forget-password" | "change-email"
  }) => Promise<void>
}

export type AuthConfig = {
  appName: string
  appURL: string
  baseURL: string
  cookieDomain?: string
  secret: string
  trustedOrigins: ReadonlyArray<string>
  db: KaiserDb
  logger: AuthLogger
  mailer: AuthMailer
  useSecureCookies?: boolean
}

export const initAuth = (config: AuthConfig) =>
  betterAuth({
    appName: config.appName,
    baseURL: config.baseURL,
    secret: config.secret,
    trustedOrigins: [...config.trustedOrigins],
    database: drizzleAdapter(config.db, {
      provider: "pg",
    }),
    emailAndPassword: {
      enabled: true,
    },
    user: {
      deleteUser: {
        enabled: true,
      },
    },
    account: {
      accountLinking: {
        enabled: true,
      },
    },
    logger: {
      disabled: false,
      level: "info",
    },
    advanced: {
      useSecureCookies: config.useSecureCookies,
      crossSubDomainCookies: config.cookieDomain
        ? { enabled: true, domain: config.cookieDomain }
        : undefined,
    },
    plugins: [
      passkey({
        rpID: new URL(config.appURL).hostname,
        rpName: config.appName,
        origin: config.appURL,
      }),
      emailOTP({
        async sendVerificationOTP({ email, otp, type }) {
          await config.mailer.sendEmailOtp({ email, otp, type })
          config.logger.info("[Auth] Email OTP sent.", { email, type })
        },
      }),
      haveIBeenPwned(),
      username(),
      lastLoginMethod({
        storeInDatabase: true,
        customResolveMethod: (context) =>
          context.path === "/sign-in/email-otp" ? "email-otp" : null,
      }),
    ],
  })
