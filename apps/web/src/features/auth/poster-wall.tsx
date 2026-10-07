import { cn } from "@animekaiser/ui/lib/utils"
import { Atom, Result, useAtomValue } from "@effect-atom/atom-react"
import * as Effect from "effect/Effect"
import { homeAtom } from "../anime/home/atoms"

const columnCount = 5
const durations = ["90s", "110s", "80s", "120s", "100s"]

export const authCaption = "Every anime. One list. Synced everywhere."

// AniList's extraLarge covers are ~460px wide; the wall's columns are ~140px,
// so the "large" size is plenty even on retina screens.
const wallSize = (src: string) => src.replace("/cover/large/", "/cover/medium/")

const preload = (src: string) =>
  new Promise<void>((resolve) => {
    const image = new Image()
    image.onload = () => resolve()
    image.onerror = () => resolve()
    image.src = src
  })

// Real covers from the public home lists, so the artwork is the catalogue
// itself and changes with the season. Every cover is downloaded before the
// wall shows, so none pop in while it drifts.
const posterWallAtom = Atom.make((get) =>
  Effect.gen(function* () {
    const home = yield* get.result(homeAtom)
    const covers = Array.from(
      new Set(
        [
          ...home.trending,
          ...home.seasonal,
          ...home.popular,
          ...home.topRated,
        ].flatMap((anime) =>
          anime.coverImage ? [wallSize(anime.coverImage)] : []
        )
      )
    )
    yield* Effect.promise(() => Promise.all(covers.map(preload))).pipe(
      Effect.timeout("8 seconds"),
      Effect.ignore
    )
    return covers
  })
)

export function PosterWall() {
  const covers = Result.builder(useAtomValue(posterWallAtom))
    .onSuccess((value) => value)
    .orElse((): ReadonlyArray<string> => [])
  const loaded = covers.length > 0

  const columns = Array.from({ length: columnCount }, (_, column) =>
    covers.filter((_cover, index) => index % columnCount === column)
  )

  return (
    <div className="relative hidden overflow-hidden bg-black lg:block">
      <div
        aria-hidden
        className={cn(
          "absolute inset-0 grid grid-cols-5 gap-3 px-3 opacity-85",
          loaded && "animate-in duration-1000 fade-in-0"
        )}
      >
        {columns.map((column, index) => (
          <div
            key={index}
            className={cn(
              "flex flex-col gap-3 motion-reduce:animate-none",
              index % 2 === 0 ? "animate-drift-up" : "animate-drift-down"
            )}
            style={{ animationDuration: durations[index] }}
          >
            {loaded
              ? [...column, ...column].map((src, cover) => (
                  <img
                    key={`${src}-${cover}`}
                    src={src}
                    alt=""
                    decoding="async"
                    className="aspect-2/3 w-full rounded-lg object-cover"
                  />
                ))
              : Array.from({ length: 12 }, (_, cover) => (
                  <div
                    key={cover}
                    className="aspect-2/3 w-full rounded-lg bg-white/5"
                  />
                ))}
          </div>
        ))}
      </div>

      <div className="absolute inset-0 bg-background/25" />
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-background to-transparent" />
      <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-background to-transparent" />

      <p className="absolute inset-x-0 bottom-8 text-center text-sm font-medium text-white/80">
        {authCaption}
      </p>
    </div>
  )
}
