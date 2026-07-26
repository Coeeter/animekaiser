import { Atom } from "@effect-atom/atom-react"
import {
  KaiserRpcClient,
  refreshOnAuthChange,
} from "../../services/api-clients"

const sessionQueryAtom = KaiserRpcClient.query("GetCurrentSession", void 0)

export const sessionAtom = refreshOnAuthChange(sessionQueryAtom).pipe(
  Atom.keepAlive
)

const protectedRoutes = new Set([
  "/my-list",
  "/profile",
  "/sync-activity",
  "/watch-history",
])

export const isProtectedRoute = (pathname: string) =>
  protectedRoutes.has(pathname)
