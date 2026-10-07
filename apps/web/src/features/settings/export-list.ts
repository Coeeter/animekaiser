import type { LibraryEntry, LibraryStatus } from "@animekaiser/domain"

const malStatus: Record<LibraryStatus, string> = {
  watching: "Watching",
  rewatching: "Watching",
  completed: "Completed",
  paused: "On-Hold",
  dropped: "Dropped",
  planning: "Plan to Watch",
}

const cdata = (value: string) =>
  `<![CDATA[${value.replaceAll("]]>", "]]]]><![CDATA[>")}]]>`

// The same shape MyAnimeList's own export produces, which both MyAnimeList
// and AniList accept as an import file.
export const toMalXml = (entries: ReadonlyArray<LibraryEntry>) => {
  const anime = entries.map(
    (entry) => `  <anime>
    <series_animedb_id>${entry.malId}</series_animedb_id>
    <series_title>${cdata(entry.anime.title.romaji)}</series_title>
    <my_watched_episodes>${entry.progress}</my_watched_episodes>
    <my_score>${entry.score === null ? 0 : Math.round(entry.score / 10)}</my_score>
    <my_status>${malStatus[entry.status]}</my_status>
    <my_comments>${cdata(entry.notes ?? "")}</my_comments>
    <update_on_import>1</update_on_import>
  </anime>`
  )
  return [
    `<?xml version="1.0" encoding="UTF-8" ?>`,
    "<myanimelist>",
    "  <myinfo>",
    "    <user_export_type>1</user_export_type>",
    `    <user_total_anime>${entries.length}</user_total_anime>`,
    "  </myinfo>",
    ...anime,
    "</myanimelist>",
    "",
  ].join("\n")
}

export const toExportJson = (
  entries: ReadonlyArray<LibraryEntry>,
  exportedAt: Date
) =>
  JSON.stringify(
    {
      exportedAt: exportedAt.toISOString(),
      entries: entries.map((entry) => ({
        malId: entry.malId,
        title: entry.anime.title.english ?? entry.anime.title.romaji,
        status: entry.status,
        score: entry.score,
        progress: entry.progress,
        episodes: entry.anime.episodes,
        notes: entry.notes,
        updatedAt: entry.updatedAt.toISOString(),
      })),
    },
    null,
    2
  )
