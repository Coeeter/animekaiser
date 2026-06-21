import { Result, useAtomValue } from "@effect-atom/atom-react"
import type { AnimeHome } from "@workspace/domain"
import { AlertTriangle } from "lucide-react"
import { accountHealthAtom } from "../integrations/atoms"
import { AnimeScrollRow } from "./anime-scroll-row"
import { homeAtom } from "./atoms"
import { HeroCarousel } from "./hero-carousel"

export function HomePage({
  home,
  loggedIn,
}: {
  home: AnimeHome
  loggedIn: boolean
}) {
  const result = useAtomValue(homeAtom(home))

  return Result.match(result, {
    onInitial: () => <HomeContent home={home} loggedIn={loggedIn} />,
    onFailure: () => <HomeContent home={home} loggedIn={loggedIn} />,
    onSuccess: ({ value }) => <HomeContent home={value} loggedIn={loggedIn} />,
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
