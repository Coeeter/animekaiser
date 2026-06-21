import * as Context from "effect/Context"
import { initAuth } from "./init-auth"

export type KaiserAuth = ReturnType<typeof initAuth>

export class AuthServer extends Context.Tag("@workspace/auth/AuthServer")<
  AuthServer,
  KaiserAuth
>() {}

export { initAuth }
export type { AuthConfig, AuthLogger, AuthMailer } from "./init-auth"
