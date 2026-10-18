import * as Context from "effect/Context"
import { initAuth } from "./init-auth"

export type KaiserAuth = ReturnType<typeof initAuth>

export class AuthServer extends Context.Service<AuthServer, KaiserAuth>()(
  "@animekaiser/auth/AuthServer"
) {}

export type { AuthConfig, AuthLogger, AuthMailer } from "./init-auth"
export { initAuth }
