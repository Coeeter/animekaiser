import * as Atom from "effect/reactivity/Atom"
import { type authClient, KaiserRpcClient } from "../../services/api-clients"
import { auth } from "../../services/auth"

export const sessionReactivityKeys = ["session"]

const sessionQueryAtom = KaiserRpcClient.query("GetCurrentSession", void 0, {
  reactivityKeys: sessionReactivityKeys,
})

export const sessionAtom = sessionQueryAtom.pipe(Atom.keepAlive)

const protectedRoutes = new Set([
  "/friends",
  "/my-list",
  "/profile",
  "/recommendations",
  "/rooms",
  "/sync-activity",
  "/watch-history",
  "/watching",
])

export const isProtectedRoute = (pathname: string) =>
  protectedRoutes.has(pathname)

type AuthClient = typeof authClient
type ArgOf<F> = F extends (input: infer I, ...rest: Array<never>) => unknown
  ? I
  : never

export const signOutAtom = Atom.fn<void>()(() =>
  auth((client) => client.signOut())
)
export const signInEmailAtom = Atom.fn(
  (input: ArgOf<AuthClient["signIn"]["email"]>) =>
    auth((client) => client.signIn.email(input))
)
export const signInUsernameAtom = Atom.fn(
  (input: ArgOf<AuthClient["signIn"]["username"]>) =>
    auth((client) => client.signIn.username(input))
)
export const signInEmailOtpAtom = Atom.fn(
  (input: ArgOf<AuthClient["signIn"]["emailOtp"]>) =>
    auth((client) => client.signIn.emailOtp(input))
)
export const signInPasskeyAtom = Atom.fn<void>()(() =>
  auth((client) => client.signIn.passkey())
)
export const signUpEmailAtom = Atom.fn(
  (input: ArgOf<AuthClient["signUp"]["email"]>) =>
    auth((client) => client.signUp.email(input))
)
export const sendVerificationOtpAtom = Atom.fn(
  (input: ArgOf<AuthClient["emailOtp"]["sendVerificationOtp"]>) =>
    auth((client) => client.emailOtp.sendVerificationOtp(input))
)
export const requestPasswordResetAtom = Atom.fn(
  (input: ArgOf<AuthClient["emailOtp"]["requestPasswordReset"]>) =>
    auth((client) => client.emailOtp.requestPasswordReset(input))
)
export const resetPasswordAtom = Atom.fn(
  (input: ArgOf<AuthClient["emailOtp"]["resetPassword"]>) =>
    auth((client) => client.emailOtp.resetPassword(input))
)
export const requestEmailChangeAtom = Atom.fn(
  (input: ArgOf<AuthClient["emailOtp"]["requestEmailChange"]>) =>
    auth((client) => client.emailOtp.requestEmailChange(input))
)
export const changeEmailAtom = Atom.fn(
  (input: ArgOf<AuthClient["emailOtp"]["changeEmail"]>) =>
    auth((client) => client.emailOtp.changeEmail(input))
)
export const changePasswordAtom = Atom.fn(
  (input: ArgOf<AuthClient["changePassword"]>) =>
    auth((client) => client.changePassword(input))
)
export const updateUserAtom = Atom.fn(
  (input: ArgOf<AuthClient["updateUser"]>) =>
    auth((client) => client.updateUser(input))
)
