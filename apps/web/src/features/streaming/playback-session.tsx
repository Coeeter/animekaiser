import { useIsMobile } from "@animekaiser/ui/hooks/use-mobile"
import { Atom, useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { useLocation, useNavigate } from "@tanstack/react-router"
import { useEffect } from "react"
import { type StreamPlaybackInput, StreamPlayerPage } from "./player/page"

export const playbackSessionAtom = Atom.make<StreamPlaybackInput | null>(
  null
).pipe(Atom.keepAlive)

export const mountPlaybackSessionAtom = Atom.family(
  (input: StreamPlaybackInput) =>
    Atom.make((get) => {
      get.set(playbackSessionAtom, input)
    })
)

export function PlaybackSessionHost() {
  const location = useLocation()
  const navigate = useNavigate()
  const input = useAtomValue(playbackSessionAtom)
  const setInput = useAtomSet(playbackSessionAtom)
  const expanded = location.pathname.startsWith("/watch/")
  const isMobile = useIsMobile()

  useEffect(() => {
    if (isMobile && !expanded) setInput(null)
  }, [expanded, isMobile, setInput])

  const close = () => {
    setInput(null)
    if (expanded && input)
      void navigate({ to: "/series/$id", params: { id: input.malId } })
  }

  if (!input) return null
  if (isMobile && !expanded) return null

  return (
    <StreamPlayerPage
      input={input}
      mode={expanded ? "full" : "mini"}
      onClose={close}
    />
  )
}
