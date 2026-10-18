import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@animekaiser/ui/components/sheet"
import { useAtom } from "@effect/atom-react"
import { useState } from "react"
import { assistantLaunchAtom } from "./atoms"
import { Conversation } from "./conversation"

// A side sheet (full screen on mobile) so whatever the person was doing, such
// as a room, stays visibly in the background and nothing is posted there.
export function AssistantSheet() {
  const [launch, setLaunch] = useAtom(assistantLaunchAtom)
  const [threadId, setThreadId] = useState<string | null>(null)
  const recap = launch?.recapMalId
  return (
    <Sheet
      open={launch !== null}
      onOpenChange={(open) => {
        if (!open) {
          setLaunch(null)
          setThreadId(null)
        }
      }}
    >
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="border-b">
          <SheetTitle>{recap ? "Catch me up" : "Ask AI"}</SheetTitle>
          <SheetDescription>
            Private · only you can see this conversation.
          </SheetDescription>
        </SheetHeader>
        {launch ? (
          <Conversation
            threadId={threadId}
            onThreadId={setThreadId}
            seedMalId={launch.seedMalId}
            roomId={launch.roomId}
            recap={
              recap
                ? { malId: recap, episode: launch.recapEpisode ?? null }
                : undefined
            }
          />
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
