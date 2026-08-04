import { StreamProviderId } from "@animekaiser/domain"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import * as Schema from "effect/Schema"
import {
  AnimeDetailPage,
  AnimeDetailPendingPage,
  AnimeDetailTab,
} from "../features/anime/detail/detail-page"

const SeriesId = Schema.NumberFromString.pipe(Schema.int(), Schema.positive())
const PositivePage = Schema.Union(Schema.Number, Schema.NumberFromString).pipe(
  Schema.int(),
  Schema.positive()
)

const SeriesSearch = Schema.Struct({
  tab: Schema.optional(AnimeDetailTab),
  episodePage: Schema.optional(PositivePage),
  provider: Schema.optional(
    Schema.String.pipe(
      Schema.transform(Schema.Union(StreamProviderId, Schema.Undefined), {
        strict: true,
        decode: (provider) =>
          Schema.is(StreamProviderId)(provider) ? provider : undefined,
        encode: (provider) => provider ?? "",
      })
    )
  ),
})

export const Route = createFileRoute("/series/$id")({
  staticData: { title: "Anime" },
  parseParams: ({ id }) => ({ id: Schema.decodeUnknownSync(SeriesId)(id) }),
  stringifyParams: ({ id }) => ({ id: String(id) }),
  validateSearch: Schema.decodeUnknownSync(SeriesSearch),
  pendingComponent: AnimeDetailPendingPage,
  component: AnimeDetailRoute,
})

function AnimeDetailRoute() {
  const id = Route.useParams().id
  const search = Route.useSearch()
  const navigate = useNavigate()

  const activeTab = search.tab ?? "episodes"

  const setActiveTab = (tab: AnimeDetailTab) => {
    void navigate({
      to: "/series/$id",
      params: { id },
      search: {
        tab: tab === "episodes" ? undefined : tab,
        episodePage: tab === "episodes" ? search.episodePage : undefined,
        provider: search.provider,
      },
      replace: true,
    })
  }

  const setEpisodePage = (episodePage: number) => {
    void navigate({
      to: "/series/$id",
      params: { id },
      search: {
        tab: search.tab,
        episodePage: episodePage === 1 ? undefined : episodePage,
        provider: search.provider,
      },
      replace: true,
    })
  }

  const setProvider = (provider: StreamProviderId) => {
    void navigate({
      to: "/series/$id",
      params: { id },
      search: {
        tab: search.tab,
        episodePage: undefined,
        provider,
      },
      replace: true,
    })
  }

  return (
    <AnimeDetailPage
      id={id}
      activeTab={activeTab}
      episodePage={search.episodePage ?? 1}
      episodeProvider={search.provider}
      onEpisodePageChange={setEpisodePage}
      onEpisodeProviderChange={setProvider}
      onTabChange={setActiveTab}
    />
  )
}
