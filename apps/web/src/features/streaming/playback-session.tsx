import { Atom, useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { useLocation, useNavigate } from "@tanstack/react-router"
import { type StreamPlaybackInput, StreamPlayerPage } from "./player-page"

export const playbackSessionAtom = Atom.make<StreamPlaybackInput | null>(
  null
).pipe(Atom.keepAlive)

export function PlaybackSessionHost() {
  const location = useLocation()
  const navigate = useNavigate()
  const input = useAtomValue(playbackSessionAtom)
  const setInput = useAtomSet(playbackSessionAtom)
  const expanded = location.pathname.startsWith("/watch/")

  const close = () => {
    setInput(null)
    if (expanded && input)
      void navigate({ to: "/series/$id", params: { id: input.malId } })
  }

  return input ? (
    <StreamPlayerPage
      input={input}
      mode={expanded ? "full" : "mini"}
      onClose={close}
    />
  ) : null
}
