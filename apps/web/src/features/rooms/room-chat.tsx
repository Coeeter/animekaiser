import type { RoomMessage, RoomState } from "@animekaiser/domain"
import { Button } from "@animekaiser/ui/components/button"
import { cn } from "@animekaiser/ui/lib/utils"
import { useAtomSet } from "@effect/atom-react"
import * as Exit from "effect/Exit"
import { Loader2, Square, Trash2 } from "lucide-react"
import { useLayoutEffect, useRef, useState } from "react"
import { KaiserRpcClient } from "../../services/api-clients"
import { toastFailure } from "../../utils/error"
import {
  aiReactivityKeys,
  askRoomAiAtom,
  stopRoomAiAtom,
} from "../recommendations/atoms"
import { AssistantMarkdown } from "../recommendations/markdown"
import {
  deleteRoomMessageAtom,
  mergeMessages,
  type RoomLive,
  sendRoomMessageAtom,
} from "./atoms"
import { hasAiMention } from "./mentions"
import { RoomComposer } from "./room-composer"
import { roomErrorOf, toastRoomFailure } from "./room-host"
import { RoomMessageBody } from "./room-message-body"

const loadEarlierAtom = KaiserRpcClient.mutation("ListRoomMessages")

type Pending = {
  requestId: string
  body: string
  failed: boolean
}

export function RoomChat({
  roomId,
  state,
  live,
}: {
  roomId: string
  state: RoomState
  live: RoomLive
}) {
  const askAi = useAtomSet(askRoomAiAtom, { mode: "promiseExit" })
  const stopAi = useAtomSet(stopRoomAiAtom, { mode: "promiseExit" })
  const send = useAtomSet(sendRoomMessageAtom, { mode: "promiseExit" })
  const remove = useAtomSet(deleteRoomMessageAtom, { mode: "promiseExit" })
  const loadEarlier = useAtomSet(loadEarlierAtom, { mode: "promiseExit" })
  const [pending, setPending] = useState<ReadonlyArray<Pending>>([])
  const [earlier, setEarlier] = useState<ReadonlyArray<RoomMessage>>([])
  const [hasEarlier, setHasEarlier] = useState<boolean | null>(null)
  const [loadingEarlier, setLoadingEarlier] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const stickToBottom = useRef(true)

  const messages = mergeMessages(earlier, live.messages)
  const canEarlier = hasEarlier ?? live.hasEarlier
  const closed = state.status === "closed"

  useLayoutEffect(() => {
    const list = listRef.current
    if (list && stickToBottom.current) list.scrollTop = list.scrollHeight
  }, [
    messages.length,
    pending.length,
    state.aiResponse?.text,
    state.aiResponse?.activity,
  ])

  const submit = async (
    body: string,
    requestId: string = crypto.randomUUID()
  ) => {
    const text = body.trim()
    if (!text) return
    setPending((current) => [
      ...current.filter((item) => item.requestId !== requestId),
      { requestId, body: text, failed: false },
    ])
    stickToBottom.current = true
    if (hasAiMention(text)) {
      const exit = await askAi({
        payload: { roomId, requestId, content: text },
        reactivityKeys: [aiReactivityKeys.availability],
      })
      if (Exit.isSuccess(exit))
        setPending((current) =>
          current.filter((item) => item.requestId !== requestId)
        )
      else {
        setPending((current) =>
          current.map((item) =>
            item.requestId === requestId ? { ...item, failed: true } : item
          )
        )
        toastFailure("Unable to ask AI right now.")(exit)
      }
      return
    }
    const exit = await send({ payload: { roomId, requestId, body: text } })
    if (Exit.isSuccess(exit)) {
      setEarlier((current) => mergeMessages(current, [exit.value]))
      setPending((current) =>
        current.filter((item) => item.requestId !== requestId)
      )
      return
    }
    setPending((current) =>
      current.map((item) =>
        item.requestId === requestId ? { ...item, failed: true } : item
      )
    )
    toastRoomFailure(exit)
  }

  const showEarlier = async () => {
    const first = messages[0]
    if (!first) return
    setLoadingEarlier(true)
    const exit = await loadEarlier({
      payload: { roomId, beforeSeq: first.seq },
    })
    setLoadingEarlier(false)
    if (Exit.isSuccess(exit)) {
      setEarlier((current) => mergeMessages(current, exit.value.messages))
      setHasEarlier(exit.value.hasEarlier)
    } else if (roomErrorOf(exit)) toastRoomFailure(exit)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={listRef}
        onScroll={(event) => {
          const list = event.currentTarget
          stickToBottom.current =
            list.scrollHeight - list.scrollTop - list.clientHeight < 48
        }}
        className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-4 py-3"
      >
        {canEarlier ? (
          <Button
            variant="ghost"
            size="sm"
            className="self-center"
            disabled={loadingEarlier}
            onClick={() => void showEarlier()}
          >
            {loadingEarlier ? <Loader2 className="animate-spin" /> : null}
            Show earlier messages
          </Button>
        ) : null}
        {messages.length === 0 && pending.length === 0 ? (
          <p className="m-auto max-w-56 text-center text-sm text-muted-foreground">
            Chat is saved for everyone admitted to this room, including people
            who join later.
          </p>
        ) : null}
        {messages.map((message) => (
          <ChatMessage
            key={message.id}
            message={message}
            own={message.participantId === state.you.participantId}
            canDelete={
              !closed &&
              !message.deleted &&
              message.kind !== "system" &&
              (state.you.isHost ||
                message.participantId === state.you.participantId)
            }
            onDelete={() =>
              void remove({
                payload: { roomId, messageId: message.id },
              }).then(toastRoomFailure)
            }
          />
        ))}
        {state.aiResponse ? (
          <div className="flex max-w-[90%] flex-col gap-2 self-start rounded-2xl bg-muted px-3 py-2 text-sm">
            <span className="font-medium">
              AI · answering {state.aiPendingBy}
            </span>
            {state.aiResponse.text ? (
              <AssistantMarkdown>{state.aiResponse.text}</AssistantMarkdown>
            ) : (
              <span aria-hidden="true" className="flex gap-1 py-2">
                {[0, 1, 2].map((dot) => (
                  <span
                    key={dot}
                    className="size-1.5 animate-bounce rounded-full bg-muted-foreground motion-reduce:animate-none"
                    style={{ animationDelay: `${dot * 150}ms` }}
                  />
                ))}
              </span>
            )}
            <div
              role="status"
              className="flex items-center gap-2 text-xs text-muted-foreground"
            >
              <Loader2 className="size-3 animate-spin" />
              {state.aiResponse.activity ??
                (state.aiResponse.text ? "Writing…" : "Thinking…")}
              {state.you.isHost ||
              state.you.participantId === state.aiResponse.participantId ? (
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() =>
                    void stopAi({ payload: { roomId } }).then(
                      toastFailure("Unable to stop AI.")
                    )
                  }
                >
                  <Square data-icon="inline-start" />
                  Stop
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
        {pending.map((item) => (
          <div
            key={item.requestId}
            className="flex flex-col items-end gap-1 self-end"
          >
            <p
              className={cn(
                "max-w-[85%] rounded-2xl rounded-br-md bg-primary/70 px-3 py-2 text-sm whitespace-pre-wrap break-words text-primary-foreground",
                item.failed && "bg-destructive/20 text-foreground"
              )}
            >
              {item.body}
            </p>
            {item.failed ? (
              <span className="flex items-center gap-2 text-xs text-destructive">
                Not sent
                <Button
                  variant="link"
                  size="xs"
                  className="h-auto p-0"
                  onClick={() => void submit(item.body, item.requestId)}
                >
                  Retry
                </Button>
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">Sending…</span>
            )}
          </div>
        ))}
      </div>
      {closed ? (
        <p className="border-t px-4 py-3 text-center text-sm text-muted-foreground">
          This room is closed. Its history stays readable for 30 days.
        </p>
      ) : (
        <RoomComposer
          state={state}
          onSend={(body) => {
            stickToBottom.current = true
            void submit(body)
          }}
        />
      )}
    </div>
  )
}

function ChatMessage({
  message,
  own,
  canDelete,
  onDelete,
}: {
  message: RoomMessage
  own: boolean
  canDelete: boolean
  onDelete: () => void
}) {
  if (message.kind === "system")
    return (
      <p className="self-center px-2 text-center text-xs text-muted-foreground">
        {message.body}
      </p>
    )

  return (
    <div
      className={cn(
        "group/message flex max-w-[85%] flex-col gap-0.5",
        own ? "items-end self-end" : "items-start self-start"
      )}
    >
      {own ? null : (
        <span className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            {message.authorName}
          </span>
          {message.authorKind === "guest" ? <span>Guest</span> : null}
          {message.authorKind === "ai" ? <span>AI</span> : null}
        </span>
      )}
      <div className="flex items-center gap-1">
        {canDelete && own ? <DeleteButton onDelete={onDelete} /> : null}
        <div
          className={cn(
            "rounded-2xl px-3 py-2 text-sm break-words whitespace-pre-wrap",
            message.deleted && "italic text-muted-foreground",
            !message.deleted &&
              (own
                ? "rounded-br-md bg-primary text-primary-foreground"
                : "rounded-bl-md bg-muted")
          )}
        >
          {message.deleted ? (
            "Message removed"
          ) : (
            <RoomMessageBody message={message} />
          )}
        </div>
        {canDelete && !own ? <DeleteButton onDelete={onDelete} /> : null}
      </div>
    </div>
  )
}

function DeleteButton({ onDelete }: { onDelete: () => void }) {
  return (
    <Button
      variant="ghost"
      size="icon-xs"
      className="opacity-0 group-hover/message:opacity-100 focus-visible:opacity-100"
      aria-label="Remove message"
      onClick={onDelete}
    >
      <Trash2 />
    </Button>
  )
}
