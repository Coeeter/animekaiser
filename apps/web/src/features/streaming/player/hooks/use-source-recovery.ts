import type { StreamPlayback, StreamProviderId } from "@animekaiser/domain"
import { useAtomSet } from "@effect/atom-react"
import * as Exit from "effect/Exit"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { nextSourceAtom, type SourceChoice } from "../../sources"
import type { StreamPlaybackInput } from "../page"

export function useSourceRecovery({
  input,
  number,
  failed,
  onChoose,
  revision,
  lastPlayback,
  askBeforeSwitching,
}: {
  input: StreamPlaybackInput
  number: number | null
  failed: boolean
  onChoose: (choice: SourceChoice) => void
  revision?: number
  lastPlayback: StreamPlayback | null
  askBeforeSwitching: boolean
}) {
  const findNext = useAtomSet(nextSourceAtom, { mode: "promiseExit" })
  const [exhausted, setExhausted] = useState(false)
  const [recovering, setRecovering] = useState(false)
  const [suggestion, setSuggestion] = useState<SourceChoice | null>(null)
  const context = `${input.malId}:${number}:${input.audio}:${revision ?? "solo"}`
  const inputKey = `${input.provider}:${input.episodeId}:${input.serverId ?? "default"}`
  const current = useRef({ context, inputKey, onChoose })
  current.current = { context, inputKey, onChoose }
  const attempts = useRef<{
    context: string
    providers: Set<StreamProviderId>
    inputs: Set<string>
  }>({ context, providers: new Set(), inputs: new Set() })
  if (attempts.current.context !== context)
    attempts.current = { context, providers: new Set(), inputs: new Set() }

  useEffect(() => {
    setExhausted(false)
    setRecovering(false)
    setSuggestion(null)
  }, [context, inputKey])

  const recover = async (playback?: StreamPlayback) => {
    const episodeNumber = playback?.episode.number ?? number
    if (episodeNumber === null || attempts.current.inputs.has(inputKey)) return
    const activeAttempts = attempts.current
    activeAttempts.inputs.add(inputKey)
    if (
      playback &&
      playback.provider === input.provider &&
      playback.episode.id === input.episodeId &&
      playback.audio === input.audio
    ) {
      const servers = playback.servers.filter(
        (entry) => entry.audio === input.audio
      )
      const server =
        servers[
          servers.findIndex(
            (entry) => entry.id === (input.serverId ?? playback.server.id)
          ) + 1
        ]
      if (server) {
        toast.message(`Trying ${server.name}…`)
        current.current.onChoose({
          provider: playback.provider,
          episode: playback.episode,
          audio: playback.audio,
          serverId: server.id,
        })
        return
      }
    }
    attempts.current.providers.add(input.provider)
    setRecovering(true)
    if (!askBeforeSwitching)
      toast.message("Trying another provider for this episode…")
    const exit = await findNext({
      malId: input.malId,
      number: episodeNumber,
      audio: input.audio,
      tried: [...attempts.current.providers],
    })
    if (
      attempts.current !== activeAttempts ||
      current.current.context !== context ||
      current.current.inputKey !== inputKey
    )
      return
    setRecovering(false)
    if (Exit.isSuccess(exit) && exit.value) {
      if (askBeforeSwitching) setSuggestion(exit.value)
      else current.current.onChoose(exit.value)
    } else {
      setExhausted(true)
      toast.error(
        "No other source could play this episode and audio. Try again or choose another episode."
      )
    }
  }
  const recoverRef = useRef(recover)
  recoverRef.current = recover
  useEffect(() => {
    if (failed && number !== null)
      void recoverRef.current(lastPlayback ?? undefined)
  }, [failed, number, inputKey, context, lastPlayback])
  const reset = () => {
    attempts.current = { context, providers: new Set(), inputs: new Set() }
    setExhausted(false)
    setRecovering(false)
    setSuggestion(null)
  }
  const acceptSuggestion = () => {
    if (!suggestion) return
    setSuggestion(null)
    current.current.onChoose(suggestion)
  }
  return {
    recover,
    exhausted,
    recovering,
    suggestion,
    acceptSuggestion,
    reset,
  }
}
