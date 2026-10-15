import type { RecapResult, RecapSource } from "@animekaiser/domain"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@animekaiser/ui/components/alert-dialog"
import { Badge } from "@animekaiser/ui/components/badge"
import { ExternalLink, TriangleAlert } from "lucide-react"
import { useState } from "react"

export function RecapView({
  recap,
}: {
  recap: Pick<
    RecapResult,
    "contains" | "excludes" | "sections" | "gaps" | "sources"
  > & {
    limitation?: string | null
  }
}) {
  const [opening, setOpening] = useState<RecapSource | null>(null)
  const sources = new Map(recap.sources.map((source) => [source.id, source]))

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5">
        <Badge variant="destructive">{recap.contains}</Badge>
        <Badge variant="outline">{recap.excludes}</Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        {recap.sections.length} section(s) sourced
        {recap.gaps.length > 0 ? ` · ${recap.gaps.length} gap(s)` : ""}
      </p>
      {recap.sections.map((section) => (
        <section
          key={`${section.malId}-${section.fromEpisode}-${section.label}`}
          className="flex flex-col gap-1"
        >
          <h4 className="text-sm font-semibold">{section.label}</h4>
          <p className="text-sm">{section.summary}</p>
          {section.interpretation ? (
            <p className="text-xs text-muted-foreground italic">
              Interpretation: {section.interpretation}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-1">
            {section.sourceIds.map((id) => {
              const source = sources.get(id)
              return source ? (
                <button
                  key={id}
                  type="button"
                  className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
                  onClick={() => setOpening(source)}
                >
                  {source.domain}
                  <ExternalLink className="size-3" />
                </button>
              ) : null
            })}
          </div>
        </section>
      ))}
      {recap.gaps.length > 0 ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <p className="flex items-center gap-1.5 font-medium">
            <TriangleAlert className="size-4" />
            Not covered
          </p>
          <ul className="mt-1 list-disc pl-5 text-xs text-muted-foreground">
            {recap.gaps.map((gap) => (
              <li key={`${gap.label}-${gap.reason}`}>
                {gap.label}: {gap.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {recap.sources.length > 0 ? (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">
            Sources ({recap.sources.length})
          </summary>
          <ul className="mt-1 flex flex-col gap-1">
            {recap.sources.map((source) => (
              <li key={source.id}>
                <button
                  type="button"
                  className="underline underline-offset-2"
                  onClick={() => setOpening(source)}
                >
                  {source.domain} · {source.label}
                </button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      {recap.limitation ? (
        <p className="text-xs text-muted-foreground">{recap.limitation}</p>
      ) : null}
      <AlertDialog
        open={opening !== null}
        onOpenChange={(open) => {
          if (!open) setOpening(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Open {opening?.domain}?</AlertDialogTitle>
            <AlertDialogDescription>
              External pages can include spoilers beyond this recap, including
              in their titles and sidebars.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (opening?.url.startsWith("http"))
                  window.open(opening.url, "_blank", "noopener,noreferrer")
                setOpening(null)
              }}
            >
              Open source
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
