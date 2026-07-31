import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@animekaiser/ui/components/alert-dialog"
import { Button } from "@animekaiser/ui/components/button"
import { useAtom } from "@effect-atom/atom-react"
import { Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { clearWatchHistoryAtom, watchHistoryReactivityKeys } from "./atoms"

export function ClearWatchHistoryButton({
  onCleared,
  variant = "outline",
  className,
}: {
  onCleared?: () => void
  variant?: "outline" | "destructive"
  className?: string
}) {
  const [clearResult, clearHistory] = useAtom(clearWatchHistoryAtom, {
    mode: "promise",
  })
  const [open, setOpen] = useState(false)
  const pending = clearResult.waiting

  const clear = async () => {
    try {
      await clearHistory({
        payload: void 0,
        reactivityKeys: [watchHistoryReactivityKeys.all],
      })
      setOpen(false)
      onCleared?.()
      toast.success("Watch history cleared")
    } catch {
      toast.error("Unable to clear your watch history")
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant={variant} className={className}>
          <Trash2 data-icon="inline-start" />
          Clear history
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <Trash2 />
          </AlertDialogMedia>
          <AlertDialogTitle>Clear your watch history?</AlertDialogTitle>
          <AlertDialogDescription>
            Every recorded episode and resume position is deleted. This cannot
            be undone, and it does not change your list or external providers.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending}
            onClick={(event) => {
              event.preventDefault()
              void clear()
            }}
          >
            {pending ? "Clearing…" : "Clear history"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
