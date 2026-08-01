import type {
  ExternalListProvider,
  LibraryImportJob,
} from "@animekaiser/domain"
import { Button } from "@animekaiser/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@animekaiser/ui/components/card"
import { cn } from "@animekaiser/ui/lib/utils"
import { Result, useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { ArrowRight, Check, CircleAlert, Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import {
  invalidateLibraryAtom,
  libraryReactivityKeys,
  startLibraryImportAtom,
  watchLibraryImportAtom,
} from "../library/atoms"

type Phase = "starting" | "fetching" | "importing" | "done" | "failed"

const phases: ReadonlyArray<{ id: Phase; label: string }> = [
  { id: "fetching", label: "Getting your data" },
  { id: "importing", label: "Importing titles" },
  { id: "done", label: "Done" },
]

const phaseFromJob = (job: LibraryImportJob): Phase => {
  if (job.status === "completed") return "done"
  if (job.status === "failed") return "failed"
  return job.status === "pending" ? "fetching" : "importing"
}

const phaseRank = (phase: Phase) => {
  if (phase === "starting" || phase === "fetching") return 0
  if (phase === "importing") return 1
  return 2
}

export function ImportProgress({
  provider,
  onDone,
}: {
  provider: ExternalListProvider
  onDone: () => void
}) {
  const startImport = useAtomSet(startLibraryImportAtom, { mode: "promise" })
  const [jobId, setJobId] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>("starting")
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<LibraryImportJob["result"]>(null)

  useEffect(() => {
    let cancelled = false

    void startImport({
      payload: { provider },
      reactivityKeys: [libraryReactivityKeys.sync],
    })
      .then((job) => {
        if (cancelled) return
        setJobId(job.id)
        setPhase(phaseFromJob(job))
      })
      .catch(() => {
        if (cancelled) return
        setError("We could not start the import.")
        setPhase("failed")
      })

    return () => {
      cancelled = true
    }
  }, [provider, startImport])

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1 className="text-2xl font-bold">Importing your list</h1>
        </CardTitle>
        <CardDescription>
          This runs in the background, so you can keep going once it finishes.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {jobId ? (
          <ImportWatcher
            id={jobId}
            onPhase={setPhase}
            onResult={setResult}
            onError={setError}
          />
        ) : null}

        {phases.map((item) => {
          const rank = phaseRank(item.id)
          const currentRank = phaseRank(phase)
          const complete = phase === "done" || rank < currentRank
          const active = !complete && rank === currentRank && phase !== "failed"

          return (
            <div
              key={item.id}
              className={cn(
                "flex items-center gap-3 rounded-2xl border bg-card/70 p-3 transition-colors",
                active && "border-primary/50",
                complete && "text-muted-foreground"
              )}
            >
              <span
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded-full border",
                  complete &&
                    "border-primary bg-primary text-primary-foreground"
                )}
              >
                {complete ? (
                  <Check className="size-4" />
                ) : active ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
              </span>
              <span className="text-sm font-medium">{item.label}</span>
            </div>
          )
        })}

        {result ? (
          <p className="text-sm text-muted-foreground">
            {result.insertedCount.toLocaleString()} added ·{" "}
            {result.updatedCount.toLocaleString()} updated ·{" "}
            {result.skippedCount.toLocaleString()} skipped
          </p>
        ) : null}

        {error ? (
          <p className="flex items-center gap-2 text-sm text-destructive">
            <CircleAlert className="size-4" />
            {error}
          </p>
        ) : null}
      </CardContent>
      <CardFooter>
        <Button
          className="w-full"
          variant={phase === "done" ? "default" : "ghost"}
          onClick={onDone}
        >
          {phase === "done" ? "Continue" : "Skip and continue"}
          <ArrowRight data-icon="inline-end" />
        </Button>
      </CardFooter>
    </Card>
  )
}

function ImportWatcher({
  id,
  onPhase,
  onResult,
  onError,
}: {
  id: string
  onPhase: (phase: Phase) => void
  onResult: (result: LibraryImportJob["result"]) => void
  onError: (message: string) => void
}) {
  const atom = watchLibraryImportAtom(id)
  const result = useAtomValue(atom)
  const pull = useAtomSet(atom)
  const invalidateLibrary = useAtomSet(invalidateLibraryAtom)

  useEffect(() => {
    Result.builder(result)
      .onSuccess((value, state) => {
        if (state.waiting) return

        const job = value.items.at(-1)
        if (!job) return

        onPhase(phaseFromJob(job))

        if (job.status === "completed") {
          onResult(job.result)
          invalidateLibrary()
        } else if (job.status === "failed") {
          onError(job.errorMessage ?? "The import failed.")
        } else if (!value.done) {
          pull()
        }
      })
      .orNull()
  }, [invalidateLibrary, onError, onPhase, onResult, pull, result])

  return null
}
