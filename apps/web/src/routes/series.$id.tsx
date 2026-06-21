import { Result, useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { Link, createFileRoute } from "@tanstack/react-router"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import {
  BookmarkPlus,
  CalendarDays,
  ExternalLink,
  Play,
  Star,
} from "lucide-react"
import { toast } from "sonner"
import { loadAnimeDetail } from "../api"
import { AnimeScrollRow } from "../features/anime/anime-scroll-row"
import { AnimeTitle } from "../features/anime/anime-title"
import {
  detailAtom,
  recommendationsAtom,
  upsertLibraryAtom,
} from "../features/anime/atoms"
import { formatAnimeMeta } from "../features/anime/format"

export const Route = createFileRoute("/series/$id")({
  parseParams: ({ id }) => ({ id: Number(id) }),
  stringifyParams: ({ id }) => ({ id: String(id) }),
  loader: ({ params }) => loadAnimeDetail(params.id),
  component: AnimeDetailPage,
})

function AnimeDetailPage() {
  const initial = Route.useLoaderData()
  const { id } = Route.useParams()
  const result = useAtomValue(detailAtom({ malId: id, initialValue: initial }))
  const anime = Result.match(result, {
    onInitial: () => initial,
    onFailure: () => initial,
    onSuccess: ({ value }) => value,
  })
  const recommendations = useAtomValue(recommendationsAtom(id))
  const save = useAtomSet(upsertLibraryAtom, { mode: "promise" })

  const addToList = async () => {
    try {
      await save({
        anime: {
          malId: anime.malId,
          aniListId: anime.aniListId,
          title: anime.title,
          coverImage: anime.coverImage,
          episodes: anime.episodes,
        },
        status: "planning",
        score: null,
        progress: 0,
        notes: null,
      })
      toast.success("Added to your list")
    } catch {
      toast.error("Log in to add this title to your list")
    }
  }

  return (
    <main className="pb-12">
      <div className="relative min-h-72 overflow-hidden border-b bg-muted md:min-h-96">
        {(anime.bannerImage ?? anime.coverImage) ? (
          <img
            src={anime.bannerImage ?? anime.coverImage ?? ""}
            alt=""
            className="absolute inset-0 size-full object-cover"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-black/20" />
        <div className="relative mx-auto flex min-h-72 max-w-7xl items-end gap-5 p-4 md:min-h-96 md:p-6">
          {anime.coverImage ? (
            <img
              src={anime.coverImage}
              alt=""
              className="hidden aspect-2/3 w-44 rounded-xl object-cover shadow-2xl ring-1 ring-white/10 sm:block"
            />
          ) : null}
          <div className="flex min-w-0 flex-1 flex-col gap-3 pb-2">
            <div className="flex flex-wrap gap-2">
              {anime.averageScore !== null ? (
                <Badge className="gap-1">
                  <Star className="size-3 fill-current" />
                  {anime.averageScore}%
                </Badge>
              ) : null}
              {anime.format ? (
                <Badge variant="secondary">{anime.format}</Badge>
              ) : null}
              {anime.status ? (
                <Badge variant="outline">
                  {anime.status.replaceAll("_", " ")}
                </Badge>
              ) : null}
            </div>
            <h1 className="max-w-4xl font-heading text-3xl font-black tracking-tight text-balance md:text-5xl">
              <AnimeTitle title={anime.title} />
            </h1>
            {anime.title.english &&
            anime.title.english !== anime.title.romaji ? (
              <p className="text-sm text-muted-foreground">
                {anime.title.english}
              </p>
            ) : null}
            <p className="text-sm text-muted-foreground">
              {formatAnimeMeta(anime.format, anime.status, anime.episodes)}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button onClick={() => void addToList()}>
                <BookmarkPlus />
                Add to list
              </Button>
              {anime.trailer ? (
                <Button asChild variant="secondary">
                  <a
                    href={
                      anime.trailer.site === "youtube"
                        ? `https://youtube.com/watch?v=${anime.trailer.id}`
                        : anime.trailer.id
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Play />
                    Trailer
                  </a>
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-9 p-4 md:p-6">
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="episodes">Episodes</TabsTrigger>
          </TabsList>
          <TabsContent
            value="overview"
            className="mt-6 grid gap-8 lg:grid-cols-[1fr_18rem]"
          >
            <div className="flex flex-col gap-8">
              <section>
                <h2 className="mb-3 font-heading text-xl font-bold">
                  Synopsis
                </h2>
                <p className="leading-7 whitespace-pre-line text-muted-foreground">
                  {anime.description ??
                    "No synopsis is available for this title."}
                </p>
              </section>
              {anime.relations.length ? (
                <section>
                  <h2 className="mb-3 font-heading text-xl font-bold">
                    Relations
                  </h2>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {anime.relations.map((relation) =>
                      relation.malId ? (
                        <Link
                          key={`${relation.relationType}-${relation.malId}`}
                          to="/series/$id"
                          params={{ id: relation.malId }}
                          className="flex gap-3 rounded-xl border bg-card p-3 hover:bg-accent"
                        >
                          {relation.coverImage ? (
                            <img
                              src={relation.coverImage}
                              alt=""
                              className="aspect-2/3 w-12 rounded object-cover"
                            />
                          ) : null}
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-primary">
                              {relation.relationType.replaceAll("_", " ")}
                            </p>
                            <p className="line-clamp-2 text-sm font-medium">
                              <AnimeTitle title={relation.title} />
                            </p>
                          </div>
                        </Link>
                      ) : null
                    )}
                  </div>
                </section>
              ) : null}
            </div>
            <aside className="h-fit rounded-xl border bg-card p-4">
              <h2 className="mb-4 font-heading font-bold">Information</h2>
              <dl className="grid gap-3 text-sm">
                <Meta label="Episodes" value={anime.episodes?.toString()} />
                <Meta
                  label="Duration"
                  value={
                    anime.duration ? `${anime.duration} minutes` : undefined
                  }
                />
                <Meta
                  label="Season"
                  value={
                    anime.season && anime.seasonYear
                      ? `${anime.season} ${anime.seasonYear}`
                      : undefined
                  }
                />
                <Meta label="Studios" value={anime.studios.join(", ")} />
              </dl>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {anime.genres.map((genre) => (
                  <Badge key={genre} variant="secondary">
                    {genre}
                  </Badge>
                ))}
              </div>
              {anime.externalLinks.length ? (
                <div className="mt-5 border-t pt-4">
                  {anime.externalLinks.slice(0, 5).map((link) => (
                    <a
                      key={link.url}
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between py-1.5 text-sm text-muted-foreground hover:text-foreground"
                    >
                      {link.site}
                      <ExternalLink className="size-3" />
                    </a>
                  ))}
                </div>
              ) : null}
            </aside>
          </TabsContent>
          <TabsContent value="episodes" className="mt-6">
            <div className="grid min-h-64 place-items-center rounded-2xl border border-dashed bg-card/40 text-center">
              <div>
                <CalendarDays className="mx-auto mb-4 size-9 text-muted-foreground" />
                <h2 className="font-heading text-xl font-bold">
                  Episodes are coming later
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Episode and streaming data is not available yet.
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
        {Result.match(recommendations, {
          onInitial: () => null,
          onFailure: () => null,
          onSuccess: ({ value: page }) => (
            <AnimeScrollRow title="Recommendations" items={page.items} />
          ),
        })}
      </div>
    </main>
  )
}

function Meta({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  )
}
