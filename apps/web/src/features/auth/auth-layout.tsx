import { Link, Outlet } from "@tanstack/react-router"

export function AuthLayout() {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center md:justify-start">
          <Link
            to="/"
            className="flex items-center gap-2 font-medium text-foreground"
          >
            <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <img src="/logo.svg" alt="AnimeKaiser" className="size-8" />
            </div>
            animekaiser
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <Outlet />
        </div>
      </div>
      <div className="relative hidden bg-muted lg:block">
        <img
          className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.75]"
          src="/auth.png"
          alt="AnimeKaiser placeholder artwork"
        />
      </div>
    </div>
  )
}
