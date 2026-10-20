import type {
  StreamPlayback,
  StreamProvider,
  StreamProviderId,
} from "@animekaiser/domain"
import { Badge } from "@animekaiser/ui/components/badge"
import { Button } from "@animekaiser/ui/components/button"
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@animekaiser/ui/components/sheet"
import { useAtomRefresh, useAtomValue } from "@effect/atom-react"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { Check, ChevronDown, Loader2 } from "lucide-react"
import { useState } from "react"
import {
  streamEpisodesAtom,
  streamPlaybackAtom,
  streamProvidersAtom,
} from "../atoms"
import { audioLabel } from "../player-format"
import { type SourceChoice, sourceEpisodeAtom } from "../sources"

export function SourceSheet({
  open,
  onOpenChange,
  portalContainer,
  playback,
  onChoose,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  portalContainer: HTMLElement | null
  playback: StreamPlayback
  onChoose: (choice: SourceChoice) => void
}) {
  const providers = useAtomValue(streamProvidersAtom)
  const refresh = useAtomRefresh(streamProvidersAtom)
  const [expanded, setExpanded] = useState<StreamProviderId | null>(
    playback.provider
  )
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="w-[min(92vw,28rem)] bg-background"
        portalContainer={portalContainer}
        side="right"
      >
        <SheetHeader>
          <SheetTitle>Source</SheetTitle>
          <SheetDescription>
            Episode {playback.episode.number} · {audioLabel(playback.audio)}.
            Choose a provider and server for this episode.
          </SheetDescription>
        </SheetHeader>
        <SheetBody className="flex flex-col gap-3">
          {AsyncResult.builder(providers)
            .onInitialOrWaiting(() => <p role="status">Loading providers…</p>)
            .onFailure(() => (
              <Button variant="outline" onClick={refresh}>
                Retry loading providers
              </Button>
            ))
            .onSuccess((entries) =>
              entries.map((provider) => (
                <section key={provider.id} className="rounded-xl border">
                  <Button
                    variant="ghost"
                    className="w-full justify-between"
                    aria-expanded={expanded === provider.id}
                    aria-controls={`source-${provider.id}`}
                    onClick={() =>
                      setExpanded(expanded === provider.id ? null : provider.id)
                    }
                  >
                    {provider.label}
                    {provider.id === playback.provider ? (
                      <Badge variant="secondary">Playing</Badge>
                    ) : null}
                    <ChevronDown data-icon="inline-end" />
                  </Button>
                  {open && expanded === provider.id ? (
                    <div
                      id={`source-${provider.id}`}
                      className="flex flex-col gap-2 p-2"
                    >
                      {provider.id === playback.provider ? (
                        <SourceServers
                          playback={playback}
                          selected={playback}
                          onChoose={onChoose}
                          onClose={() => onOpenChange(false)}
                        />
                      ) : (
                        <ProviderSource
                          provider={provider}
                          playback={playback}
                          onChoose={onChoose}
                          onClose={() => onOpenChange(false)}
                        />
                      )}
                    </div>
                  ) : null}
                </section>
              ))
            )
            .render()}
        </SheetBody>
      </SheetContent>
    </Sheet>
  )
}

function ProviderSource({
  provider,
  playback,
  onChoose,
  onClose,
}: {
  provider: StreamProvider
  playback: StreamPlayback
  onChoose: (choice: SourceChoice) => void
  onClose: () => void
}) {
  const atom = sourceEpisodeAtom({
    malId: playback.anime.malId,
    provider: provider.id,
    number: playback.episode.number,
    audio: playback.audio,
  })
  const result = useAtomValue(atom)
  const refresh = useAtomRefresh(
    streamEpisodesAtom(playback.anime.malId, provider.id)
  )
  return AsyncResult.builder(result)
    .onInitialOrWaiting(() => <SourceLoading />)
    .onFailure(() => (
      <Button variant="outline" onClick={refresh}>
        Retry {provider.label}
      </Button>
    ))
    .onSuccess((episode) =>
      episode ? (
        <ResolvedSource
          malId={playback.anime.malId}
          choice={{ provider: provider.id, episode, audio: playback.audio }}
          selected={playback}
          onChoose={onChoose}
          onClose={onClose}
        />
      ) : (
        <p className="p-2 text-sm text-muted-foreground">
          No Episode {playback.episode.number} {playback.audio} available.
        </p>
      )
    )
    .render()
}

function ResolvedSource({
  malId,
  choice,
  selected,
  onChoose,
  onClose,
}: {
  malId: number
  choice: SourceChoice
  selected: StreamPlayback
  onChoose: (choice: SourceChoice) => void
  onClose: () => void
}) {
  const atom = streamPlaybackAtom(
    malId,
    choice.provider,
    choice.episode.id,
    choice.audio
  )
  const result = useAtomValue(atom)
  const refresh = useAtomRefresh(atom)
  return AsyncResult.builder(result)
    .onInitialOrWaiting(() => <SourceLoading />)
    .onFailure(() => (
      <div className="flex flex-col gap-2 p-2">
        <p className="text-sm text-muted-foreground">
          This source couldn't be loaded.
        </p>
        <Button variant="outline" onClick={refresh}>
          Retry source
        </Button>
      </div>
    ))
    .onSuccess((playback) => (
      <SourceServers
        playback={playback}
        selected={selected}
        onChoose={onChoose}
        onClose={onClose}
      />
    ))
    .render()
}

function SourceServers({
  playback,
  selected,
  onChoose,
  onClose,
}: {
  playback: StreamPlayback
  selected: StreamPlayback
  onChoose: (choice: SourceChoice) => void
  onClose: () => void
}) {
  return playback.servers
    .filter((server) => server.audio === selected.audio)
    .map((server) => {
      const current =
        playback.provider === selected.provider &&
        server.id === selected.server.id
      return (
        <Button
          key={server.id}
          variant={current ? "secondary" : "outline"}
          className="h-auto min-h-11 justify-between whitespace-normal"
          onClick={() => {
            onChoose({
              provider: playback.provider,
              episode: playback.episode,
              audio: playback.audio,
              serverId: server.id,
            })
            onClose()
          }}
        >
          {server.name}
          {current ? <Check data-icon="inline-end" /> : null}
        </Button>
      )
    })
}

function SourceLoading() {
  return (
    <p
      className="flex items-center gap-2 p-2 text-sm text-muted-foreground"
      role="status"
    >
      <Loader2 className="size-4 animate-spin" />
      Loading source…
    </p>
  )
}
