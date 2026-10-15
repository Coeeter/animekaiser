import type {
  AiAvailability,
  RecapRequest,
  RecommendationMessage,
  RecommendationOperationError,
} from "@animekaiser/domain"
import { Button } from "@animekaiser/ui/components/button"
import { Textarea } from "@animekaiser/ui/components/textarea"
import {
  Result,
  useAtomRefresh,
  useAtomSet,
  useAtomValue,
} from "@effect-atom/atom-react"
import { Link } from "@tanstack/react-router"
import * as Cause from "effect/Cause"
import * as Exit from "effect/Exit"
import * as Option from "effect/Option"
import { Loader2, Lock, SendHorizontal, Share2, Square } from "lucide-react"
import type { ReactNode } from "react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { sessionAtom } from "../auth/atoms"
import { activeRoomIdAtom, roomReactivityKeys } from "../rooms/atoms"
import {
  aiAvailabilityAtom,
  aiReactivityKeys,
  aiThreadAtom,
  createAiThreadAtom,
  sendAiMessageAtom,
  shareToRoomAtom,
  stopAiAtom,
} from "./atoms"
import { AssistantMarkdown } from "./markdown"
import { RecapPicker } from "./recap-picker"
import { RecapView } from "./recap-view"
import { RecommendationCardView } from "./recommendation-card"

export const aiErrorOf = (exit: Exit.Exit<unknown, unknown>) => {
  if (Exit.isSuccess(exit)) return null
  const failure = Cause.failureOption(exit.cause)
  return Option.isSome(failure) &&
    (failure.value as { _tag?: string })._tag === "RecommendationOperationError"
    ? (failure.value as RecommendationOperationError)
    : null
}

const resetLabel = (resetsAt: number | null | undefined) =>
  resetsAt
    ? ` Available again ${new Date(resetsAt).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}.`
    : ""

export const unavailableCopy = (availability: AiAvailability) => {
  switch (availability.reason) {
    case "not_configured":
      return "AI recommendations aren't available right now. Search and your list still work."
    case "budget":
      return `AI is paused for the rest of the month.${resetLabel(availability.resetsAt)}`
    case "daily_limit":
      return `You've used today's AI requests.${resetLabel(availability.resetsAt)}`
    default:
      return ""
  }
}

const starters = [
  "Help me pick something for tonight",
  "Recommend from my planning list",
  "Something short and funny, under 13 episodes",
]

export function Conversation({
  threadId,
  onThreadId,
  seedMalId,
  recap,
  roomId,
  scopeLabel = "Private · only you",
  header,
}: {
  threadId: string | null
  onThreadId: (threadId: string) => void
  seedMalId?: number
  recap?: { malId: number; episode: number | null }
  roomId?: string
  scopeLabel?: string
  header?: ReactNode
}) {
  const availability = Result.getOrElse(
    useAtomValue(aiAvailabilityAtom(roomId ?? "")),
    () => null
  )
  const create = useAtomSet(createAiThreadAtom, { mode: "promiseExit" })
  const send = useAtomSet(sendAiMessageAtom, { mode: "promiseExit" })
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(recap !== undefined)

  const submit = async (content: string, recapRequest?: RecapRequest) => {
    const text = content.trim()
    if (!text) return
    setSending(true)
    setError(null)
    let id = threadId
    if (!id) {
      const newId = crypto.randomUUID()
      const created = await create({
        payload: { threadId: newId, seedMalId, roomId },
        reactivityKeys: [aiReactivityKeys.threads],
      })
      if (Exit.isFailure(created)) {
        setSending(false)
        setError(
          aiErrorOf(created)?.message ?? "Unable to start a conversation."
        )
        return
      }
      id = newId
      onThreadId(newId)
    }
    const exit = await send({
      payload: {
        threadId: id,
        requestId: crypto.randomUUID(),
        content: text,
        recap: recapRequest,
      },
      reactivityKeys: [
        aiReactivityKeys.thread(id),
        aiReactivityKeys.threads,
        aiReactivityKeys.availability,
      ],
    })
    setSending(false)
    if (Exit.isFailure(exit)) {
      setError(aiErrorOf(exit)?.message ?? "Something went wrong. Try again.")
      return
    }
    setDraft("")
    setPickerOpen(false)
  }

  const blocked = availability !== null && !availability.available

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {header}
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        {threadId ? (
          <ThreadMessages
            threadId={threadId}
            roomId={roomId}
            onRetry={(content, recapRequest) =>
              void submit(content, recapRequest)
            }
          />
        ) : recap ? null : (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">
              Tell me what you're in the mood for. Your conversation is saved
              and only you can see it.
            </p>
            <div className="flex flex-wrap gap-2">
              {starters.map((starter) => (
                <Button
                  key={starter}
                  size="sm"
                  variant="outline"
                  disabled={blocked || sending}
                  onClick={() => setDraft(starter)}
                >
                  {starter}
                </Button>
              ))}
            </div>
          </div>
        )}
        {recap && pickerOpen ? (
          <RecapPicker
            malId={recap.malId}
            currentEpisode={recap.episode}
            busy={sending || blocked}
            onConfirm={(request, description) =>
              void submit(description, request)
            }
          />
        ) : recap ? (
          <Button
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={() => setPickerOpen(true)}
          >
            Recap another range
          </Button>
        ) : null}
      </div>
      {blocked && availability ? (
        <p
          className="border-t px-4 py-3 text-sm text-muted-foreground"
          role="status"
        >
          {unavailableCopy(availability)}{" "}
          <Link
            to="/series"
            search={{ page: 1, sort: "popularity" }}
            className="underline underline-offset-2"
          >
            Browse anime
          </Link>
        </p>
      ) : null}
      {error ? (
        <p className="px-4 pt-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {recap && !threadId ? null : (
        <form
          className="flex flex-col gap-1 border-t px-3 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]"
          onSubmit={(event) => {
            event.preventDefault()
            void submit(draft)
          }}
        >
          <span className="flex items-center gap-1 px-1 text-xs text-muted-foreground">
            <Lock className="size-3" />
            {scopeLabel}
          </span>
          <div className="flex items-end gap-2">
            <Textarea
              aria-label="Message the assistant"
              value={draft}
              maxLength={2000}
              rows={1}
              placeholder={
                recap ? "Ask a follow-up" : "What do you feel like watching?"
              }
              className="max-h-32 min-h-10 flex-1 resize-none"
              onChange={(event) => setDraft(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault()
                  void submit(draft)
                }
              }}
            />
            <Button
              type="submit"
              size="icon"
              aria-label="Send to assistant"
              disabled={sending || blocked || draft.trim().length === 0}
            >
              {sending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <SendHorizontal />
              )}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}

function ThreadMessages({
  threadId,
  roomId,
  onRetry,
}: {
  threadId: string
  roomId?: string
  onRetry: (content: string, recap?: RecapRequest) => void
}) {
  const result = useAtomValue(aiThreadAtom(threadId))
  const refresh = useAtomRefresh(aiThreadAtom(threadId))
  const stop = useAtomSet(stopAiAtom, { mode: "promiseExit" })
  const share = useAtomSet(shareToRoomAtom, { mode: "promiseExit" })
  const session = Result.getOrElse(useAtomValue(sessionAtom), () => null)
  const activeRoom = useAtomValue(activeRoomIdAtom)
  const thread = Result.isSuccess(result) ? result.value : null
  const busy = thread?.busy ?? false

  useEffect(() => {
    if (!busy) return
    const interval = window.setInterval(refresh, 1500)
    return () => window.clearInterval(interval)
  }, [busy, refresh])

  if (!thread)
    return Result.isFailure(result) ? (
      <p className="text-sm text-muted-foreground">
        This conversation couldn't be loaded.
      </p>
    ) : (
      <Loader2 className="size-5 animate-spin text-muted-foreground" />
    )

  const shareRoom =
    session && activeRoom && thread.scope === "personal" ? activeRoom : null
  const sendShare = (messageId: string, malId?: number) => {
    if (!shareRoom) return
    void share({
      payload: { roomId: shareRoom, threadId, messageId, malId },
      reactivityKeys: [roomReactivityKeys.lists],
    }).then((exit) => {
      if (Exit.isSuccess(exit)) toast.success("Shared to your room")
      else toast.error(aiErrorOf(exit)?.message ?? "Unable to share.")
    })
  }

  return (
    <>
      {thread.messages.map((message, index) => (
        <MessageView
          key={message.id}
          message={message}
          signedIn={session !== null}
          onStop={() => void stop({ payload: { threadId } }).then(refresh)}
          onRetry={() => {
            const previous = thread.messages[index - 1]
            if (previous?.role === "user")
              onRetry(previous.content, previous.recapRequest ?? undefined)
          }}
          onShareCard={
            shareRoom ? (malId) => sendShare(message.id, malId) : undefined
          }
          onShareRecap={shareRoom ? () => sendShare(message.id) : undefined}
        />
      ))}
      {roomId && thread.scope === "guest" ? (
        <p className="text-xs text-muted-foreground">
          Only you can see this catch-up. It ends when your guest access does.
        </p>
      ) : null}
    </>
  )
}

function MessageView({
  message,
  signedIn,
  onStop,
  onRetry,
  onShareCard,
  onShareRecap,
}: {
  message: RecommendationMessage
  signedIn: boolean
  onStop: () => void
  onRetry: () => void
  onShareCard?: (malId: number) => void
  onShareRecap?: () => void
}) {
  if (message.role === "user")
    return (
      <p className="max-w-[85%] self-end rounded-2xl rounded-br-md bg-primary px-3 py-2 text-sm whitespace-pre-wrap text-primary-foreground">
        {message.content}
      </p>
    )
  if (message.status === "pending")
    return (
      <div
        className="flex items-center gap-2 text-sm text-muted-foreground"
        role="status"
      >
        <Loader2 className="size-4 animate-spin" />
        {message.recapRequest ? "Researching sources…" : "Thinking…"}
        <Button size="xs" variant="ghost" onClick={onStop}>
          <Square data-icon="inline-start" />
          Stop
        </Button>
      </div>
    )
  if (message.status !== "complete")
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>{message.content || "This answer didn't finish."}</span>
        <Button size="xs" variant="outline" onClick={onRetry}>
          Retry
        </Button>
      </div>
    )
  return (
    <div className="flex flex-col gap-3">
      <AssistantMarkdown>{message.content}</AssistantMarkdown>
      {message.cards.map((card) => (
        <RecommendationCardView
          key={card.anime.malId}
          card={card}
          signedIn={signedIn}
          onSendToRoom={
            onShareCard ? () => onShareCard(card.anime.malId) : undefined
          }
        />
      ))}
      {message.recap ? (
        <div className="rounded-2xl border p-3">
          <RecapView recap={message.recap} />
          {onShareRecap && message.recap.sections.length > 0 ? (
            <Button
              size="sm"
              variant="outline"
              className="mt-3"
              onClick={onShareRecap}
            >
              <Share2 data-icon="inline-start" />
              Share recap to room (collapsed)
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
