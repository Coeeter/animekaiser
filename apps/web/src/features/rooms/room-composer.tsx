import type { RoomState } from "@animekaiser/domain"
import { Button } from "@animekaiser/ui/components/button"
import { Textarea } from "@animekaiser/ui/components/textarea"
import { useAtomSet, useAtomValue } from "@effect/atom-react"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { SendHorizontal, Sparkles, UserRound } from "lucide-react"
import type { KeyboardEvent } from "react"
import { useEffect, useRef, useState } from "react"
import { aiAvailabilityAtom } from "../recommendations/atoms"
import { roomComposerIntentAtom } from "./atoms"
import { hasAiMention, memberMention, mentionQueryAt } from "./mentions"

export function RoomComposer({
  state,
  onSend,
}: {
  state: RoomState
  onSend: (body: string) => void
}) {
  const [draft, setDraft] = useState("")
  const [query, setQuery] = useState<ReturnType<typeof mentionQueryAt>>(null)
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const intent = useAtomValue(roomComposerIntentAtom(state.id))
  const setIntent = useAtomSet(roomComposerIntentAtom(state.id))
  const availability = useAtomValue(aiAvailabilityAtom(state.id))
  const aiExists =
    state.aiAccess !== "off" &&
    AsyncResult.isSuccess(availability) &&
    availability.value.reason !== "not_configured"
  const askingAi = hasAiMention(draft)
  const canAsk =
    state.you.canAskAi &&
    AsyncResult.isSuccess(availability) &&
    availability.value.available
  const keyboardOffset = useKeyboardOffset()
  const listId = `room-mentions-${state.id}`
  const suggestions = [
    ...(aiExists
      ? [
          {
            id: "ai",
            tag: "AI",
            label: "AI",
            detail: state.you.canAskAi
              ? "Ask for recommendations"
              : "Only the host can ask AI",
            ai: true,
            disabled: !state.you.canAskAi,
          },
        ]
      : []),
    ...state.members.map((member) => ({
      id: member.id,
      tag: memberMention(member),
      label: member.displayName,
      detail: `@${memberMention(member)}`,
      ai: false,
      disabled: false,
    })),
  ].filter(
    (item) =>
      !query ||
      `${item.tag} ${item.label}`
        .toLowerCase()
        .includes(query.query.toLowerCase())
  )
  const activeIndex = Math.min(selected, Math.max(0, suggestions.length - 1))
  const active = suggestions[activeIndex]
  const aiBusy = state.aiResponse !== null
  const onlyAiTag = /^\s*@ai[\s.,!?]*$/i.test(draft)
  const canSend =
    draft.trim().length > 0 && !onlyAiTag && (!askingAi || (canAsk && !aiBusy))

  useEffect(() => {
    if (!intent) return
    setDraft((current) =>
      hasAiMention(current) ? current : `@${intent.mention} ${current}`
    )
    setQuery(null)
    setIntent(null)
    requestAnimationFrame(() => {
      const input = inputRef.current
      input?.focus({ preventScroll: true })
      input?.setSelectionRange(input.value.length, input.value.length)
      input?.scrollIntoView({ block: "nearest" })
    })
  }, [intent, setIntent])

  const chooseMention = (tag: string) => {
    if (!query) return
    const text = `${draft.slice(0, query.start)}@${tag} ${draft.slice(query.end)}`
    const caret = query.start + tag.length + 2
    setDraft(text)
    setQuery(null)
    requestAnimationFrame(() => {
      inputRef.current?.focus({ preventScroll: true })
      inputRef.current?.setSelectionRange(caret, caret)
    })
  }

  const submit = () => {
    if (!canSend) return
    onSend(draft.trim())
    setDraft("")
    setQuery(null)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing) return
    if (query) {
      if (event.key === "Escape") {
        event.preventDefault()
        setQuery(null)
        return
      }
      if (
        suggestions.length &&
        (event.key === "ArrowDown" || event.key === "ArrowUp")
      ) {
        event.preventDefault()
        setSelected(
          (activeIndex +
            (event.key === "ArrowDown" ? 1 : -1) +
            suggestions.length) %
            suggestions.length
        )
        return
      }
      if (
        active &&
        !active.disabled &&
        (event.key === "Tab" || (event.key === "Enter" && !event.shiftKey))
      ) {
        event.preventDefault()
        chooseMention(active.tag)
        return
      }
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      submit()
    }
  }

  return (
    <form
      className="relative flex shrink-0 flex-col gap-2 border-t bg-background px-3 py-2"
      style={{ marginBottom: keyboardOffset }}
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      {query ? (
        <div
          id={listId}
          role="listbox"
          aria-label="Mention someone"
          className="absolute inset-x-3 bottom-full mb-2 flex max-h-48 flex-col gap-1 overflow-y-auto rounded-xl border bg-popover p-1.5 shadow-lg"
        >
          {suggestions.length ? (
            suggestions.map((item, index) => (
              <Button
                key={item.id}
                id={`${listId}-${item.id}`}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                variant={index === activeIndex ? "secondary" : "ghost"}
                className="h-auto min-h-11 justify-start text-left"
                disabled={item.disabled}
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => chooseMention(item.tag)}
              >
                {item.ai ? (
                  <Sparkles data-icon="inline-start" />
                ) : (
                  <UserRound data-icon="inline-start" />
                )}
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">{item.label}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {item.detail}
                  </span>
                </span>
              </Button>
            ))
          ) : (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              No matching members.
            </p>
          )}
        </div>
      ) : null}
      <p
        id={`room-chat-help-${state.id}`}
        className="text-xs text-muted-foreground"
      >
        {askingAi && !canAsk
          ? "AI isn't available to you right now. Remove @AI to send a regular message."
          : askingAi && aiBusy
            ? "AI is answering another question. You can still chat without @AI."
            : onlyAiTag
              ? "Write a question after @AI."
              : aiExists
                ? "Type @ to mention someone, or @AI to ask AI."
                : "Chat with everyone here. Type @ to mention someone."}
      </p>
      <div className="flex items-end gap-2">
        <label className="sr-only" htmlFor={`room-chat-${state.id}`}>
          Message the room
        </label>
        <Textarea
          ref={inputRef}
          id={`room-chat-${state.id}`}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={query !== null}
          aria-controls={query ? listId : undefined}
          aria-activedescendant={
            query && active ? `${listId}-${active.id}` : undefined
          }
          aria-describedby={`room-chat-help-${state.id}`}
          value={draft}
          maxLength={1000}
          rows={1}
          placeholder="Message the room…"
          className="max-h-32 min-h-10 flex-1 resize-none"
          onChange={(event) => {
            const text = event.currentTarget.value
            setDraft(text)
            setQuery(mentionQueryAt(text, event.currentTarget.selectionStart))
            setSelected(0)
          }}
          onClick={(event) => {
            setQuery(mentionQueryAt(draft, event.currentTarget.selectionStart))
            setSelected(0)
          }}
          onKeyDown={onKeyDown}
        />
        <Button
          type="submit"
          size="icon"
          aria-label={askingAi ? "Send to AI" : "Send to room"}
          disabled={!canSend}
        >
          {askingAi ? <Sparkles /> : <SendHorizontal />}
        </Button>
      </div>
    </form>
  )
}

// iOS can keep the layout viewport behind the software keyboard.
function useKeyboardOffset() {
  const [offset, setOffset] = useState(0)
  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    const update = () => {
      const covered = window.innerHeight - viewport.height - viewport.offsetTop
      setOffset(covered > 80 ? covered : 0)
    }
    viewport.addEventListener("resize", update)
    viewport.addEventListener("scroll", update)
    update()
    return () => {
      viewport.removeEventListener("resize", update)
      viewport.removeEventListener("scroll", update)
    }
  }, [])
  return offset
}
