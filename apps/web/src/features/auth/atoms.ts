import { Atom } from "@effect-atom/atom-react"
import { KaiserRpcClient } from "../../services/api-clients"

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
