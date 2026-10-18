import { useIsMobile } from "@animekaiser/ui/hooks/use-mobile"
import { useAtomSet, useAtomValue } from "@effect/atom-react"
import { useLocation, useNavigate } from "@tanstack/react-router"
import * as Atom from "effect/reactivity/Atom"
import { useEffect } from "react"
import { activeRoomIdAtom } from "../rooms/atoms"
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
  const activeRoom = useAtomValue(activeRoomIdAtom)

  useEffect(() => {
    if (activeRoom) setInput(null)
  }, [activeRoom, setInput])

  useEffect(() => {
    if (isMobile && !expanded) setInput(null)
  }, [expanded, isMobile, setInput])

  const close = () => {
    setInput(null)
    if (expanded && input)
      void navigate({ to: "/series/$id", params: { id: input.malId } })
  }

  if (!input || activeRoom) return null
  if (isMobile && !expanded) return null

  return (
    <StreamPlayerPage
      input={input}
      mode={expanded ? "full" : "mini"}
      onClose={close}
    />
  )
}
