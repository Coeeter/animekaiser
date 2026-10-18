import { Button } from "@animekaiser/ui/components/button"
import { Input } from "@animekaiser/ui/components/input"
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@animekaiser/ui/components/sheet"
import { Textarea } from "@animekaiser/ui/components/textarea"
import { useIsMobile } from "@animekaiser/ui/hooks/use-mobile"
import { cn } from "@animekaiser/ui/lib/utils"
import { useAtomSet, useAtomValue } from "@effect/atom-react"
import { useNavigate } from "@tanstack/react-router"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import {
  History,
  MessageSquareHeart,
  Pencil,
  Plus,
  Settings2,
  Trash2,
} from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import {
  aiPreferencesAtom,
  aiReactivityKeys,
  aiThreadsAtom,
  deleteAiThreadAtom,
  renameAiThreadAtom,
  saveAiPreferencesAtom,
} from "./atoms"
import { Conversation } from "./conversation"

export function RecommendationsPage({
  threadId,
  seedMalId,
}: {
  threadId: string | null
  seedMalId?: number
}) {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [listOpen, setListOpen] = useState(false)
  const [preferencesOpen, setPreferencesOpen] = useState(false)
  const select = (id: string | null) => {
    setListOpen(false)
    void navigate({
      to: "/recommendations",
      search: id ? { thread: id } : {},
    })
  }

  const list = <ThreadList activeId={threadId} onSelect={select} />

  return (
    <div className="mx-auto flex h-[calc(100dvh-4.5rem-env(safe-area-inset-bottom))] w-full max-w-6xl gap-4 md:h-dvh md:p-6">
      <title>Recommendations | AnimeKaiser</title>
      {isMobile ? null : (
        <aside className="flex w-72 shrink-0 flex-col gap-2 overflow-y-auto rounded-3xl border p-3">
          {list}
        </aside>
      )}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden md:rounded-3xl md:border">
        <Conversation
          key={threadId ?? `new-${seedMalId ?? ""}`}
          threadId={threadId}
          seedMalId={seedMalId}
          onThreadId={(id) => select(id)}
          header={
            <header className="flex items-center gap-2 border-b px-4 py-3">
              <MessageSquareHeart className="size-5 text-primary" />
              <h1 className="flex-1 font-heading text-lg font-semibold">
                Recommendations
              </h1>
              {isMobile ? (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Saved conversations"
                  onClick={() => setListOpen(true)}
                >
                  <History />
                </Button>
              ) : null}
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Recommendation settings"
                onClick={() => setPreferencesOpen(true)}
              >
                <Settings2 />
              </Button>
              <Button size="sm" variant="outline" onClick={() => select(null)}>
                <Plus data-icon="inline-start" />
                New
              </Button>
            </header>
          }
        />
      </main>
      <Sheet open={listOpen} onOpenChange={setListOpen}>
        <SheetContent side="left" className="w-[min(90vw,22rem)]">
          <SheetHeader>
            <SheetTitle>Saved conversations</SheetTitle>
          </SheetHeader>
          <SheetBody className="flex flex-col gap-2">{list}</SheetBody>
        </SheetContent>
      </Sheet>
      <PreferencesSheet
        open={preferencesOpen}
        onOpenChange={setPreferencesOpen}
      />
    </div>
  )
}

function ThreadList({
  activeId,
  onSelect,
}: {
  activeId: string | null
  onSelect: (id: string | null) => void
}) {
  const threads = AsyncResult.getOrElse(useAtomValue(aiThreadsAtom), () => [])
  const rename = useAtomSet(renameAiThreadAtom, { mode: "promise" })
  const remove = useAtomSet(deleteAiThreadAtom, { mode: "promise" })
  const [editing, setEditing] = useState<string | null>(null)
  const [title, setTitle] = useState("")
  if (threads.length === 0)
    return (
      <p className="p-2 text-sm text-muted-foreground">
        No saved conversations yet.
      </p>
    )
  return (
    <ul className="flex flex-col gap-1">
      {threads.map((thread) => (
        <li
          key={thread.id}
          className={cn(
            "group flex items-center gap-1 rounded-xl px-2 py-1.5 hover:bg-muted",
            thread.id === activeId && "bg-muted"
          )}
        >
          {editing === thread.id ? (
            <form
              className="flex-1"
              onSubmit={(event) => {
                event.preventDefault()
                setEditing(null)
                void rename({
                  payload: {
                    threadId: thread.id,
                    title: title.trim() || thread.title,
                  },
                  reactivityKeys: [aiReactivityKeys.threads],
                })
              }}
            >
              <Input
                autoFocus
                aria-label="Conversation name"
                value={title}
                maxLength={80}
                onChange={(event) => setTitle(event.currentTarget.value)}
                onBlur={() => setEditing(null)}
              />
            </form>
          ) : (
            <button
              type="button"
              className="min-w-0 flex-1 truncate text-left text-sm"
              onClick={() => onSelect(thread.id)}
            >
              {thread.title}
            </button>
          )}
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label={`Rename ${thread.title}`}
            onClick={() => {
              setEditing(thread.id)
              setTitle(thread.title)
            }}
          >
            <Pencil />
          </Button>
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label={`Delete ${thread.title}`}
            onClick={() =>
              void remove({
                payload: { threadId: thread.id },
                reactivityKeys: [aiReactivityKeys.threads],
              }).then(() => {
                if (thread.id === activeId) onSelect(null)
                toast.success("Conversation deleted")
              })
            }
          >
            <Trash2 />
          </Button>
        </li>
      ))}
    </ul>
  )
}

function PreferencesSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const saved = AsyncResult.getOrElse(useAtomValue(aiPreferencesAtom), () => [])
  const save = useAtomSet(saveAiPreferencesAtom, { mode: "promise" })
  const [text, setText] = useState<string | null>(null)
  const value = text ?? saved.join("\n")
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) setText(null)
        onOpenChange(next)
      }}
    >
      <SheetContent className="w-[min(92vw,26rem)]">
        <SheetHeader>
          <SheetTitle>Lasting preferences</SheetTitle>
        </SheetHeader>
        <SheetBody className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            One per line, like "no horror" or "prefers subbed". These apply to
            every conversation. Things you say in a chat stay in that chat.
          </p>
          <Textarea
            aria-label="Lasting preferences"
            rows={8}
            value={value}
            onChange={(event) => setText(event.currentTarget.value)}
          />
          <Button
            onClick={() =>
              void save({
                payload: {
                  notes: value
                    .split("\n")
                    .map((line) => line.trim())
                    .filter(Boolean)
                    .slice(0, 20),
                },
                reactivityKeys: [aiReactivityKeys.preferences],
              }).then(() => {
                toast.success("Preferences saved")
                onOpenChange(false)
              })
            }
          >
            Save preferences
          </Button>
        </SheetBody>
      </SheetContent>
    </Sheet>
  )
}
