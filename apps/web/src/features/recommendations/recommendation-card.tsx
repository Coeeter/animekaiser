import type { RecommendationCard as Card } from "@animekaiser/domain"
import { Badge } from "@animekaiser/ui/components/badge"
import { Button } from "@animekaiser/ui/components/button"
import { useAtomSet } from "@effect-atom/atom-react"
import { Link } from "@tanstack/react-router"
import { BookmarkPlus, Info, Send } from "lucide-react"
import { toast } from "sonner"
import { AnimeTitle } from "../anime/common/anime-title"
import { formatAnimeFormat } from "../anime/common/format"
import { libraryMutationKeys, upsertLibraryAtom } from "../library/atoms"
import { WatchNowButton } from "../streaming/watch-now-button"

export function RecommendationCardView({
  card,
  onSendToRoom,
  signedIn,
}: {
  card: Card
  onSendToRoom?: () => void
  signedIn: boolean
}) {
  const upsert = useAtomSet(upsertLibraryAtom, { mode: "promise" })

  const addToList = async () => {
    try {
      await upsert({
        payload: {
          anime: card.anime,
          status: "planning",
          score: null,
          progress: 0,
          notes: null,
        },
        reactivityKeys: libraryMutationKeys(card.anime.malId),
      })
      toast.success("Added to your planning list")
    } catch {
      toast.error("Unable to add this to your list.")
    }
  }

  return (
    <article className="flex gap-3 rounded-2xl border bg-card p-3">
      {card.anime.coverImage ? (
        <img
          src={card.anime.coverImage}
          alt=""
          className="h-28 w-20 shrink-0 rounded-xl object-cover"
          loading="lazy"
        />
      ) : (
        <div className="h-28 w-20 shrink-0 rounded-xl bg-muted" />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <h3 className="line-clamp-2 text-sm font-semibold">
          <AnimeTitle title={card.anime.title} />
        </h3>
        <p className="text-xs text-muted-foreground">
          {[
            card.format ? formatAnimeFormat(card.format) : null,
            card.anime.episodes ? `${card.anime.episodes} eps` : null,
            card.anime.seasonYear ?? null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <p className="text-sm">{card.reason}</p>
        {card.notes.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {card.notes.map((note) => (
              <Badge key={note} variant="outline">
                {note}
              </Badge>
            ))}
          </div>
        ) : null}
        {card.synopsis ? (
          card.sequel ? (
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer">
                Sequel — synopsis may spoil earlier entries
              </summary>
              <p className="mt-1 line-clamp-6 whitespace-pre-line">
                {card.synopsis}
              </p>
            </details>
          ) : (
            <p className="line-clamp-3 text-xs whitespace-pre-line text-muted-foreground">
              {card.synopsis}
            </p>
          )
        ) : null}
        <div className="mt-1 flex flex-wrap gap-1.5">
          <Button asChild size="xs" variant="ghost">
            <Link to="/series/$id" params={{ id: card.anime.malId }}>
              <Info data-icon="inline-start" />
              Details
            </Link>
          </Button>
          {signedIn ? (
            <Button
              size="xs"
              variant="outline"
              onClick={() => void addToList()}
            >
              <BookmarkPlus data-icon="inline-start" />
              Add to my list
            </Button>
          ) : null}
          <WatchNowButton malId={card.anime.malId} label="Watch" size="xs" />
          {onSendToRoom ? (
            <Button size="xs" variant="outline" onClick={onSendToRoom}>
              <Send data-icon="inline-start" />
              Send to room
            </Button>
          ) : null}
        </div>
      </div>
    </article>
  )
}
