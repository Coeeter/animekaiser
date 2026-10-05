# Plan: franchise watch order and auto-continue

Status: proposed (2026-10-05). Input for implementation, not a spec.

## Goal

1. Show a franchise's main story in order (Season 1 → Season 2 → Movie →
   Season 3) on the series page, so "what do I watch next?" has an answer.
2. When a season ends, continue into the next one: in the player, and on the
   home "Continue watching" row.

## What counts as the main flow

AniList (`relations { edges { relationType(version:2) node } }`) only gives a
show its direct relations, so the order is built by walking the chain.

- Walk `PREQUEL` edges back to the root, then `SEQUEL` edges forward from it.
  The current show is always on the path.
- Keep TV, TV_SHORT, ONA and MOVIE. Leave out SPECIAL, OVA, MUSIC, recaps
  (`SUMMARY`), side stories, spin-offs and alternatives. They stay in the
  Related tab.
- Branches: when a step has several sequels, take the first one by format
  (TV > ONA > TV_SHORT > MOVIE), breaking ties by start season. The others stay
  in Related.
- Drop entries without a MAL ID (domain rule).
- Guards: a visited set (AniList has relation cycles) and a hop limit of 30.

Prequel movies (e.g. JJK 0) may land before Season 1 if AniList links them
that way, which follows release order more than story order. AniList's graph
is the source of truth here, not a hand-curated list. Check real orders during
validation.

## Backend

### Domain (`packages/domain/src/anime`)

```ts
AnimeWatchOrder = Struct({ entries: Array(AnimeItem) })
GetAnimeWatchOrder = Rpc.make("GetAnimeWatchOrder", {
  payload: { malId: MalId },
  success: AnimeWatchOrder,
  error: Union(AnimeUnavailableError, AnimeNotFoundError),
})
```

The client finds the current entry by `malId`. Each entry is a full
`AnimeItem`, so cards render with no extra fetches.

### Core (`packages/core/src/anime`)

- `watch-order.ts`: a pure `buildWatchOrder(startMalId, lookup)` where
  `lookup(malId) => Effect<AnimeDetail>`. This is where all the rules above
  live, so it gets unit tests with a fake relation graph (cycle, branch,
  excluded formats, missing MAL IDs).
- `AnimeService.getWatchOrder(malId)` runs it on top of the cached `getDetail`.
  Each hop reuses `anime:detail:v2:*` (12h), so a 5-season franchise costs 5
  AniList requests the first time and none after that.
- Cache the result as `anime:watch-order:v1:{malId}` for 24h. If any hop came
  from the Jikan fallback, cache it for only 5 minutes. A Jikan detail has no
  relations today, so the chain would be cut short.
- Map Jikan relations too (`/anime/{id}/full` has `relations[].relation`
  "Sequel"/"Prequel" with `mal_id`). That way an AniList rate limit doesn't
  break the chain. Small change in `jikan.ts`'s `getDetail`.
- Rate limit: the walk runs hops one after another and stops cleanly if the
  AniList budget guard trips. It returns what it has so far, with the short TTL.

### History "next season" (`packages/core/src/history`)

Today "Continue watching" = mid-episode history (`status = watching`) plus
library entries with new aired episodes. A finished season shows up in
neither, so it drops off the row.

- In `listContinueWatching`, or in a new `ListNextSeasons` RPC, take shows
  whose latest history episode is the final one (the `nextForShow` →
  `completed` case) and were finished in the last 30 days. Return the next
  watch-order entry when:
  - it has aired (`status` ≠ `NOT_YET_RELEASED`), and
  - it has no history yet, and isn't completed/dropped in the library.
- Shape: `{ _tag: "nextSeason", from: AnimeItem, next: AnimeItem }`. Prefer
  a separate RPC so the existing contract stays untouched.

## Frontend

### Series page: watch-order strip

- Shown above the tabs only when the order has more than one entry. It's a
  horizontal scroll row of compact cards: small poster, "Season 2" / "Movie"
  label, title, year.
- The current entry is highlighted ("You're here") and scrolled into view on
  load.
- Logged in: ✓ on completed entries and a progress hint on watching ones,
  read from the user's library. Uses one batch library query for the franchise
  IDs, not one `libraryEntryAtom` per card. If no batch read exists, add
  `ListLibraryEntries({ malIds })`.
- Loading state: no skeleton. The strip appears when it's ready, because it's
  optional and shouldn't shift layout every time. Reserve space only if
  testing shows a visible jump.

Labels: AniList has no season numbers, so number entries by format: TV
entries become "Season 1, 2, 3…" in order, movies "Movie", ONAs "ONA".

### Player: continue into the next season

- Next-season target = the entry after the current one in the watch order,
  but only when the current episode is the last one (`episode === anime.episodes`
  and the show is FINISHED). Never mid-season or at the end of a show that's
  still airing.
- Resolve it with the existing `watchTargetAtom({ malId: next.malId })`, which
  already picks provider, episode 1 and audio.
- **Auto next on:** `finishEpisode` goes to the next-season target when
  `nextEpisode` is null.
- **Auto next off:** the end of the episode shows a "Continue to Season 2"
  card with the poster, over the paused frame.
- The Next button and keyboard shortcut on the last episode go to the next
  season too, with a label so it's clear.
- Library: finishing the last episode already marks S1 completed
  (`usePlayerSync`). S2 gets added as Watching when its first episode finishes,
  through the same path. No new library writes.

### Home: "Start Season 2" card

- `continueRowAtom` gains a third kind, `nextSeason`, from the new RPC. It's
  the same card style with the S2 poster and "Start Season 2 · after <S1>", and
  it links to `/play/$malId` (already resolves the first episode).
- Deduped by `malId` against resume/next items, like today.

## Edge cases

- Franchises with long or tangled graphs (Gintama, Monogatari, Fate) may
  produce orders people disagree with. Check them during validation. If one is
  clearly wrong, prefer tweaking the rules (e.g. drop MOVIE when it sits
  between TV entries that are each other's direct sequel) over special cases.
- Split cours (AoT Final Season parts) are separate MAL entries. They appear as
  separate seasons, which is correct for tracking.
- A sequel the user's provider doesn't carry: `watchTargetAtom` returns null,
  so hide the auto-continue card and let the strip link to the series page.
- Logged out: the strip and player continue still work. The home card needs
  history, so it's logged-in only (as today).

## Validation

- **Unit:** `buildWatchOrder` against fixture graphs (cycle, branch, excluded
  formats, no MAL ID, hop limit).
- **Real API:** call `GetAnimeWatchOrder` on the running API for JJK, Frieren,
  AoT, Mushoku Tensei, Monogatari and Gintama. Inspect the orders, and check
  the API log for AniList request counts on a cold cache.
- **Browser:**
  - The strip on a franchise middle entry (JJK S2) and a standalone show (no
    strip).
  - Player: play the last episode of a finished season, seek to the end with
    Auto next on, and confirm it lands on the sequel's episode 1. With Auto
    next off, confirm the card.
  - Home: logged in with a test account, finish a season's last episode, and
    confirm the "Start Season 2" card.
- `bun typecheck`, `bun lint`, `bun test`.

## Order of work (one commit each)

1. Core + domain + RPC: watch order (with Jikan relations), with unit tests,
   checked against the real API.
2. Series page strip, plus the library batch read if needed.
3. Player next-season continue: auto next, end card, Next button.
4. History `ListNextSeasons` and the home card.

## Open questions

1. Movies in the main flow: include movies that AniList links as
   sequels/prequels (e.g. Mugen Train, JJK 0) as proposed, or TV/ONA only?
2. Should the home "Start Season 2" card also appear for shows finished
   before this ships (any completed library entry), or only for seasons
   finished through our player in the last 30 days?
