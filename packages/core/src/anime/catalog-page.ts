import { AnimePage } from "@animekaiser/domain"
import * as Schema from "effect/Schema"
import type { AnimeCatalogRequest } from "./anilist"

export const catalogPageSchema = (request: AnimeCatalogRequest) => {
  const unfilteredFirstPage =
    request.page === 1 &&
    !request.query?.trim() &&
    !request.status &&
    !request.format &&
    !request.genres?.length &&
    !request.season &&
    request.seasonYear === undefined &&
    !request.rating &&
    request.minScore === undefined &&
    request.maxScore === undefined &&
    !request.studio?.trim()

  // The complete catalog cannot be empty. Treat this as a provider failure,
  // including when reading old cache entries, while preserving real no-matches.
  return AnimePage.check(
    Schema.makeFilter(
      (page) =>
        !unfilteredFirstPage ||
        page.items.length > 0 ||
        "The unfiltered anime catalog returned no titles."
    )
  )
}
