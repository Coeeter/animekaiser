import { Result, useAtomValue } from "@effect-atom/atom-react"
import type { AnimeDetail } from "@workspace/domain"
import { useState } from "react"
import { AddToLibraryDialog } from "../library/add-to-library-dialog"
import { AnimeScrollRow } from "./anime-scroll-row"
import { detailAtom, recommendationsAtom } from "./atoms"
import { DetailHero } from "./detail-hero"
import { DetailOverview } from "./detail-overview"

export function AnimeDetailPage({
  id,
  initial,
}: {
  id: number
  initial: AnimeDetail
}) {
  const result = useAtomValue(detailAtom({ malId: id, initialValue: initial }))
  const anime = Result.match(result, {
    onInitial: () => initial,
    onFailure: () => initial,
    onSuccess: ({ value }) => value,
  })
  const recommendations = useAtomValue(recommendationsAtom(id))
  const [libraryOpen, setLibraryOpen] = useState(false)

  return (
    <main className="pb-12">
      <DetailHero anime={anime} onAddToLibrary={() => setLibraryOpen(true)} />
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-9 p-4 md:p-6">
        <DetailOverview anime={anime} />
        {Result.match(recommendations, {
          onInitial: () => null,
          onFailure: () => null,
          onSuccess: ({ value: page }) => (
            <AnimeScrollRow title="Recommendations" items={page.items} />
          ),
        })}
      </div>
      <AddToLibraryDialog
        anime={anime}
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
      />
    </main>
  )
}
