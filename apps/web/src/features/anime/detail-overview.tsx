import { Link } from "@tanstack/react-router"
import type { AnimeDetail } from "@workspace/domain"
import { Badge } from "@workspace/ui/components/badge"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import { CalendarDays, ExternalLink } from "lucide-react"
import { AnimeTitle } from "./anime-title"

function Meta({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  )
}

export function DetailOverview({ anime }: { anime: AnimeDetail }) {
  return (
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
            <h2 className="mb-3 font-heading text-xl font-bold">Synopsis</h2>
            <p className="leading-7 whitespace-pre-line text-muted-foreground">
              {anime.description ?? "No synopsis is available for this title."}
            </p>
          </section>
          {anime.relations.length ? (
            <section>
              <h2 className="mb-3 font-heading text-xl font-bold">Relations</h2>
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
              value={anime.duration ? `${anime.duration} minutes` : undefined}
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
  )
}
