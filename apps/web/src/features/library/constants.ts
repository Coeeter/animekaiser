import type { LibrarySort, LibraryStatus } from "@workspace/domain"

export const libraryStatuses: ReadonlyArray<{
  value: "all" | LibraryStatus
  label: string
}> = [
  { value: "all", label: "All" },
  { value: "watching", label: "Watching" },
  { value: "completed", label: "Completed" },
  { value: "planning", label: "Planning" },
  { value: "paused", label: "Paused" },
  { value: "dropped", label: "Dropped" },
  { value: "rewatching", label: "Rewatching" },
]

export const librarySorts: ReadonlyArray<LibrarySort> = [
  "updated_desc",
  "updated_asc",
  "title_asc",
  "score_desc",
  "progress_desc",
]
