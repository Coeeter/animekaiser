import { Link, Outlet } from "@tanstack/react-router"

export function AuthLayout() {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <Link
          className="flex w-fit items-center gap-3 font-heading font-semibold"
          to="/"
        >
          <img className="size-9 rounded-xl" src="/logo.svg" alt="" />
          <span>animekaiser</span>
        </Link>
        <div className="flex flex-1 items-center justify-center">
          <Outlet />
        </div>
      </div>
      <div className="relative hidden overflow-hidden bg-zinc-950 lg:block">
        <img
          className="absolute inset-0 size-full object-cover opacity-80"
          src="/auth.png"
          alt="Anime character artwork"
        />
        <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/10 to-black/20" />
        <p className="absolute bottom-10 left-10 max-w-md font-heading text-3xl font-semibold text-white">
          Your anime life, all in one place.
        </p>
      </div>
    </div>
  )
}
