import {
  createFileRoute,
  getRouteApi,
  useNavigate,
} from "@tanstack/react-router"
import * as Schema from "effect/Schema"
import { loadAnimeDetail } from "../features/anime/anime.functions"
import {
  AnimeDetailPage,
  AnimeDetailPendingPage,
  AnimeDetailTab,
} from "../features/anime/detail-page"

const SeriesId = Schema.NumberFromString.pipe(Schema.int(), Schema.positive())
const SeriesSearch = Schema.Struct({
  tab: Schema.optional(AnimeDetailTab),
})
const rootRoute = getRouteApi("__root__")

export const Route = createFileRoute("/series/$id")({
  parseParams: ({ id }) => ({ id: Schema.decodeUnknownSync(SeriesId)(id) }),
  stringifyParams: ({ id }) => ({ id: String(id) }),
  validateSearch: Schema.decodeUnknownSync(SeriesSearch),
  loader: ({ params }) => loadAnimeDetail(params.id),
  pendingComponent: AnimeDetailPendingPage,
  component: AnimeDetailRoute,
})

function AnimeDetailRoute() {
  const id = Route.useParams().id
  const search = Route.useSearch()
  const session = rootRoute.useLoaderData()
  const navigate = useNavigate()
  const activeTab = search.tab ?? "episodes"
  const setActiveTab = (tab: AnimeDetailTab) => {
    void navigate({
      to: "/series/$id",
      params: { id },
      search: { tab: tab === "episodes" ? undefined : tab },
      replace: true,
    })
  }

  return (
    <AnimeDetailPage
      id={id}
      initial={Route.useLoaderData()}
      isAuthenticated={session !== null}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    />
  )
}
