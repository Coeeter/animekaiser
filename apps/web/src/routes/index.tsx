import { Result, useAtomValue } from "@effect-atom/atom-react"
import { createFileRoute } from "@tanstack/react-router"
import type { AnimeHome } from "@workspace/domain"
import { AlertTriangle } from "lucide-react"
import { getAppSession } from "../auth.functions"
import { loadAnimeHome } from "../api"
import { AnimeScrollRow } from "../features/anime/anime-scroll-row"
import { accountHealthAtom, homeAtom } from "../features/anime/atoms"
import { HeroCarousel } from "../features/anime/hero-carousel"

export const Route = createFileRoute("/")({
  loader: async () => {
    const [home, session] = await Promise.all([
      loadAnimeHome(),
      getAppSession(),
    ])
    return { home, loggedIn: Boolean(session) }
  },
  component: HomePage,
})

function HomePage() {
  const initial = Route.useLoaderData()
  const result = useAtomValue(homeAtom(initial.home))

  return Result.match(result, {
    onInitial: () => (
      <HomeContent home={initial.home} loggedIn={initial.loggedIn} />
    ),
    onFailure: () => (
      <HomeContent home={initial.home} loggedIn={initial.loggedIn} />
    ),
    onSuccess: ({ value: home }) => (
      <HomeContent home={home} loggedIn={initial.loggedIn} />
    ),
  })
}

function HomeContent({
  home,
  loggedIn,
}: {
  home: AnimeHome
  loggedIn: boolean
}) {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-10 p-4 pb-10 md:p-6">
      {loggedIn ? <AccountWarning /> : null}
      <HeroCarousel items={home.trending.slice(0, 6)} />
      <AnimeScrollRow
        title="Trending now"
        items={home.trending}
        moreHref="/discover?tab=trending"
      />
      <AnimeScrollRow
        title="This season"
        items={home.seasonal}
        moreHref="/discover?tab=seasonal"
      />
      <AnimeScrollRow
        title="Popular"
        items={home.popular}
        moreHref="/discover?tab=popular"
      />
    </main>
  )
}

function AccountWarning() {
  const result = useAtomValue(accountHealthAtom)
  return Result.match(result, {
    onInitial: () => null,
    onFailure: () => null,
    onSuccess: ({ value: accounts }) => {
      const unhealthy = accounts.filter(
        (account) =>
          account.state === "expiring" ||
          account.state === "expired" ||
          account.state === "relink_required"
      )
      return unhealthy.length ? (
        <button
          type="button"
          onClick={() =>
            window.dispatchEvent(
              new CustomEvent("kaiser:settings", { detail: "Integrations" })
            )
          }
          className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-left"
        >
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-500" />
          <span>
            <strong className="block text-sm">
              Reconnect your external list
            </strong>
            <span className="text-sm text-muted-foreground">
              {unhealthy
                .map(({ provider }) =>
                  provider === "mal" ? "MyAnimeList" : "AniList"
                )
                .join(" and ")}{" "}
              needs attention before imports or sync can continue.
            </span>
          </span>
        </button>
      ) : null
    },
  })
}
