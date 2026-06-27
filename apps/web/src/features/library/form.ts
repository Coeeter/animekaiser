import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import type { LibraryEntry, LibraryStatus } from "@workspace/domain"

const ProgressInput = Schema.NumberFromString.pipe(
  Schema.int(),
  Schema.nonNegative()
)

export const decodeLibraryProgress = (value: string) =>
  Schema.decodeUnknownOption(ProgressInput)(value.trim() || "0").pipe(
    Option.getOrElse(() => 0)
  )

const ScoreInput = Schema.NumberFromString.pipe(
  Schema.int(),
  Schema.between(0, 100)
)

export const decodeLibraryScore = (value: string) =>
  value.trim()
    ? Schema.decodeUnknownOption(ScoreInput)(value.trim()).pipe(
        Option.getOrElse(() => null)
      )
    : null

export type LibraryEntryFormValues = {
  status: LibraryStatus
  progress: string
  score: string
  notes: string
}

export type LibraryDeleteFormValues = {
  mal: boolean
  anilist: boolean
}

export const libraryEntryFormDefaults = (
  entry: LibraryEntry | null | undefined,
  fallbackStatus: LibraryStatus = "planning"
): LibraryEntryFormValues => ({
  status: entry?.status ?? fallbackStatus,
  progress: String(entry?.progress ?? 0),
  score: entry?.score?.toString() ?? "",
  notes: entry?.notes ?? "",
})

export const libraryDeleteFormDefaults = (): LibraryDeleteFormValues => ({
  mal: false,
  anilist: false,
})
