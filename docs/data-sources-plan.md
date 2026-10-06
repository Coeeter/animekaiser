# Anime data sources and caching

Status: implemented locally (2026-10-06), not committed. See "Progress".

## Problem

AniList serves almost everything, and Jikan is the only fallback.

- AniList has been in a "degraded" state at **30 req/min** (nominally 90), and
  its headers don't show it: you get blocked while `X-RateLimit-Remaining`
  still reads ~60. Our `budgetReserve` check in `anilist.ts` therefore never
  trips early. We only stop after a 429 and its 1-minute timeout.
- A cold start spends that budget at once. `getHome` makes 5 discovery calls,
  plus one `getDetail` per trending item just to get a hero synopsis (10
  calls). Anything else in that minute (watch order, detail pages) fails over.
- Jikan, the fallback, is a MAL scraper limited to 3/s and 60/min. It timed
  out from this machine (curl 000 after 8s). When AniList is blocked, we have
  effectively no source.
- Cache lifetimes are short and expire hard, so popular keys go cold together
  and refetch together.

## Who serves what

AniList stays the primary source: it's fast, and one GraphQL request can carry
many lists or many IDs. The trouble is how we call it. We send one request per
item and per list, in parallel, instead of batching.

| Data | Source | Fallback |
| --- | --- | --- |
| Home (trending + synopsis, seasonal, top, popular, upcoming) | **one** AniList query with aliases | MAL API |
| Detail, catalog, search, recommendations | AniList | **MAL API v2** (replaces Jikan) |
| Card data for many IDs (watch order, library rows) | **one** AniList `media(idMal_in: [...])` query | MAL API |
| Franchise graph (watch order) | **Shikimori** `/api/animes/{malId}/franchise` | Walk AniList relations |
| Airing schedule | AniList `airingSchedule` (already in use) | MAL `broadcast` weekly slot |
| Episode titles, thumbnails, fanart | ani.zip | — |
| Rating filter | Jikan | — |

### Why the MAL API and not Jikan or scraping, as the fallback

- From this machine `api.jikan.moe` timed out; the MAL API returned in
  ~0.3s, and MAL HTML pages took 0.6–0.85s for 170 KB. (Your experience in
  aniways may differ by network; there, MAL HTML was only scraped for
  trailers.)
- `MAL_CLIENT_ID` is already in Doppler, and the API returns typed JSON,
  including `related_anime` with `prequel`/`sequel`.
- Scraping MAL ourselves is reimplementing Jikan. It is fragile against
  markup changes and MAL's anti-bot measures, and it is against MAL's terms.
  Self-hosting Jikan (`jikan-rest`, Docker) would fix reachability, but it's
  another service to run, for data the MAL API already gives us.
- Keep scraping as an option only for fields neither API has.

### Schedule APIs

- We already use one: AniList's `airingSchedule` (per-episode air times by MAL
  ID), cached 1h.
- AnimeSchedule.net has an API (v3) with sub, dub and streaming-platform
  release times. It needs an app token, credit to AnimeSchedule, and
  permission for commercial use. Worth it only if we want dub or "on
  Crunchyroll at" times, not to replace AniList's raw air times.
- LiveChart has no public API.

### Shikimori notes

- `shikimori.one` is geoblocked from here (a DDoS-Guard page); `shikimori.io`
  works. Make the base URL configurable.
- Limits are 5 rps and 90 rpm, and a `User-Agent` naming the app is required.
- Node names come back in Russian: use only the IDs and edge types, and get
  card data from the batched AniList query.
- Follow only `prequel`/`sequel` edges. When there are several sequels, prefer
  TV > ONA > TV_SHORT > MOVIE > OVA > SPECIAL (aniways took the last link).
- Cache the graph per franchise, plus `malId → franchise root` for every node.

## Caching

### Lifetimes now

Today's lifetimes in kaiser, against aniways (written by hand):

| Data | kaiser | aniways |
| --- | --- | --- |
| Detail | 12h | 30d (Postgres, refreshed by worker) |
| Relations / franchise | 24h (watch order) | 7d |
| Seasonal | 12h | 30d |
| Trending | 2h | 24h |
| Popular / top | 12h | 24h |
| Recommendations | 7d | — |
| Episodes metadata | 24h | 7d |
| Banner | (in detail, 12h) | 30d |
| Any fallback result | 5m | — |

### Proposed lifetimes

Base them on how often the data actually changes, not one number per endpoint:

- **Detail:** 30d for `FINISHED` shows; 12h for `RELEASING` (episode count and
  score move); 24h for `NOT_YET_RELEASED` (dates and staff firm up).
- **Franchise / watch order:** 7d; 24h if any entry is airing or upcoming,
  since new sequels get announced.
- **Seasonal, top, popular:** 24h. **Trending:** 6h. **Schedule:** 1h, unchanged.
- **Banner, fanart, ani.zip:** 30d.

### Serve stale data while refreshing

Store `{ value, fetchedAt, source }` and keep two clocks:

- a **soft TTL** (the lifetimes above): after it, serve the cached value and
  refresh in the background through the existing single-flight;
- a **hard TTL** (soft × ~4, at least 7d): only past this does a request
  block on the network.

This fixes three things:

1. Users rarely wait on an upstream call for popular pages.
2. When AniList is down, we keep serving the last good AniList data instead of
   overwriting it with a short-lived fallback copy. Fallback data is used only
   when nothing is cached at all.
3. Expiry spreads out over time instead of everything going cold together.

### Durable storage

aniways kept metadata in Postgres with a 30-day refresh and a rate-limited
background refresher. That is why a cold Redis didn't hurt it. Kaiser already
has `anime_metadata` (used by the library) and a Postgres job queue.

Option, in phase 3: store full detail records in Postgres, keyed by MAL ID.
Reads go Redis → Postgres → upstream, and refreshes run as queued jobs under
the shared rate limiter. Losing Redis (as happened today with a fresh
container) then costs nothing. This is a bigger change than the rest, so it's
a separate decision.

## Rate limiting

- AniList has an undocumented burst limiter, and nothing caps how many
  AniList calls run at once. A cold `getHome` has ~10 in flight: 5 lists in
  parallel, plus 5 trending items each fetching detail. "Start next season"
  adds 4 watch-order walks in parallel.
- Batching removes most of this: home becomes 1 request, watch order 2.
- Put one queue in front of AniList for what's left: ≤2 concurrent, spaced
  ~400ms, ~25/min (under the degraded 30). The current check of
  `X-RateLimit-Remaining` is misleading while AniList is degraded.
- Background work (airing refresh, warm-ups) waits its turn; user requests go
  first.

## Phases

1. **Batch AniList calls.** One home query with aliases, including the
   synopsis; one `idMal_in` query for cards; AniList queue.
2. **Caching.** Lifetimes based on status, and serving stale data while
   refreshing in `cachedFor`.
3. **Watch order through Shikimori,** plus the batched card query.
4. **MAL API as the fallback** instead of Jikan (Jikan kept only for the
   rating filter).
5. **Optional:** durable detail records in Postgres, refreshed by the job
   queue.

## Progress

All five phases are implemented, plus one extra found in the audit. Measured
locally against the real APIs, with Redis `anime:*` keys and
`anime_detail_record` cleared:

- **Cold start, background jobs:** 5 AniList requests (recent schedule, 3
  airing-status batches for 105 tracked shows, 1 batched detail query for 42
  shows). Before, it was one detail request per latest episode, about 40 or
  more, and that set off a real 429.
- **Cold home page:** 3 requests (home, latest feed, today's schedule), down
  from about 15.
- **Watch order:** Shikimori graph plus one `idMal_in` query. The orders are
  better than the old walk: Monogatari puts Tsuki before Owari, and AoT runs
  through The Final Chapters.
- **Durable details:** with the Redis key deleted, `GetAnimeDetail` answered
  in 25ms from Postgres with 0 AniList requests.
- **Stale data:** a stale entry was served in 13ms, then one background
  refresh set it fresh again (12h, since the show is airing).
- **MAL fallback:** detail, the 5 discovery lists, search and
  recommendations all returned correctly against the real API; a missing ID
  maps to `null`.

Extra beyond the plan: the availability workers fetched one detail per show
(through `StreamingService`). `AnimeService.prefetchDetails` now fills those
details in batches of 50 first.

Not done, deliberately:
- No user-first priority in the AniList queue. After batching, background
  work is a handful of requests an hour.
- Refreshes run as stale-while-revalidate, not as Postgres jobs.
- User-token AniList calls (list sync, import, OAuth) don't go through the
  queue; they count against the same per-IP limit, but there are few of them.
- The card hover synopsis still fetches one detail per hovered card. It is
  cached for 12h–30d now.
- The MAL fallback's seasonal list includes long-running shows (One Piece)
  that AniList's leaves out.
- The detail-walk fallback for watch order and MAL's 404 → null path were
  exercised only indirectly.

## Open questions

- Fallback data from MAL has different scores, genres and synopses from
  AniList. That's fine for a fallback, but it shows if it is ever cached
  long.
- anime-offline-database (weekly ODbL dump, ~41k entries, cross-provider IDs
  and `relatedAnime` URLs) could seed ID mappings offline. Its relations have
  no type (no prequel/sequel), so it can't replace Shikimori or MAL for watch
  order.

## Sources

- AniList rate limiting: https://docs.anilist.co/guide/rate-limiting
- Jikan limits (3/s, 60/min, 24h cache): https://animedex.readthedocs.io/en/latest/api_doc/api/jikan.html
- Shikimori limits and UA: https://animedex.readthedocs.io/en/latest/_modules/animedex/api/shikimori.html
- Shikimori franchise endpoint: https://shikimori.io/api/doc/1.0/animes/franchise
- MAL API v2: https://myanimelist.net/apiconfig/references/api/v2
- AnimeSchedule API v3: https://animeschedule.net/api/v3/documentation
- anime-offline-database: https://github.com/manami-project/anime-offline-database
- aniways reference: `~/Developer/aniways/internal/service/anime/{franchise,details,metadata_refresher}.go`, `internal/infra/client/shikimori/client.go`
