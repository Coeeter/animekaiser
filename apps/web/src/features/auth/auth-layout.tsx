import { Link, Outlet } from "@tanstack/react-router"
import { authCaption, PosterWall } from "./poster-wall"

export function AuthLayout() {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex flex-col items-center gap-2 md:items-start">
          <Link
            to="/"
            className="flex items-center gap-2 font-medium text-foreground"
          >
            <img src="/logo.svg" alt="AnimeKaiser" className="size-8" />
            animekaiser
          </Link>
          <p className="text-center text-sm text-muted-foreground lg:hidden">
            {authCaption}
          </p>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <Outlet />
        </div>
      </div>
      <PosterWall />
    </div>
  )
}
