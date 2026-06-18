import { passkeyClient } from "@better-auth/passkey/client"
import {
  emailOTPClient,
  lastLoginMethodClient,
  usernameClient,
} from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

export type AuthClientConfig = {
  baseURL?: string
}

export const createKaiserAuthClient = (config: AuthClientConfig = {}) =>
  createAuthClient({
    baseURL: config.baseURL,
    plugins: [
      passkeyClient(),
      emailOTPClient(),
      lastLoginMethodClient(),
      usernameClient(),
    ],
  })
