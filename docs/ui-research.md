# UI research: what other anime sites do well

Research notes from 2026-09-27 on anime.nexus, 0neko, KickAssAnime (kaa.lt),
AniKoto, 4Animo and 123AnimeHub. Written as input for AnimeKaiser UI work,
not as a spec.

## AnimeKaiser today (self-review)

Strengths: consistent dark palette with one accent, good type hierarchy,
strong series header, polished login page, searchable sectioned settings.

Problems found:

- Logged-in home puts a ~400px hero above everything personal; continue
  watching and new episodes sit below the fold.
- "Continue watching" (history) and "Up next in your list" (library) can show
  the same show twice.
- "Up next" cards link to the series page instead of playing.
- Airing countdown data exists (`anime_airing_state`, AniList
  `nextAiringEpisode`) but is shown nowhere.
- Episode titles are "Episode N" from AniKoto even though ani.zip has real
  titles and synopses.
- Schedule on home renders ~89 rows for one day.
- Player episodes button truncates ("KickAssAnime epi…").
- Watched episode rows at 60% opacity look washed out.
- Provider dropdown gives no hint of which provider has the episode or dub.
- Title language toggle exists but only inside settings.

Fixed already (local): watching row scoped to airing shows only; schedule
showed "TBA" for every time.

## Cross-site patterns

1. **Next-episode countdown** wherever it matters. anime.nexus: sidebar card
   on series page ("NEXT EPISODE 10h 13m"). AniKoto / 4Animo: banner under the
   player ("next episode estimated 19:00, 6h 10m").
2. **Watch page is a page around the player** (HiAnime pattern on AniKoto /
   4Animo, variant on anime.nexus): player, compact episode rail beside it,
   quick toggle bar under it (Expand/Theatre, Auto Play, Auto Next,
   Auto Skip, Light, Prev/Next, Add to list), then show info, franchise
   seasons rail, comments.
3. **Sub/dub availability visible before choosing.** AniKoto: sub/dub counts
   on every poster. anime.nexus: SUB n / AUD n on every episode card. 0neko:
   per source ("inu · 13 SUB · 11 DUB").
4. **One-click EN/JP title toggle** in the header (KickAssAnime, AniKoto).
5. **Schedule as a real schedule.** anime.nexus: card grid per day with local
   time, countdown, synopsis. KickAssAnime: sticky "Today Releases" rail with
   times and a check on aired episodes.

## Site notes

### anime.nexus

- Home: full-bleed fanart hero with the show's logo art (clearlogo) instead
  of text; "Latest Episodes" grid of episode stills (duration, comment count,
  SUB/AUD counts) with All/Sub/Dub + category filters; ranked "Popular Shows"
  sidebar (1–10, Today/Week toggle); This Season; Recently Updated.
- Series: logo art top-right, two ratings (average / weighted), Add to
  Collection, favourite, notify bell, AniList/MAL links, next-episode
  countdown card, 6-column episode grid with thumbnails, duration badge and a
  thin watched-progress bar, per-page size (24) and sort.
- Watch: player + right sidebar (episode switcher, comments behind a spoiler
  guard). Controls: chapters, episode list, subtitles, audio track picker,
  settings, theatre, fullscreen; "You're watching" overlay when paused.
  Playback is behind Cloudflare Turnstile.
- Schedule: week tabs, card grid with time, countdown, synopsis, genres.

#### anime.nexus logged in

- Sidebar gains a "Personal" group: Profile, Collection, Lists, Updates,
  Watch History.
- Watch History is grouped per show: "N episodes watched", a "▶ Next: EP 2 ·
  Howl, Mad Dog" button (or "Caught up! Latest episode"), last episode with
  progress bar, "show N more episodes", "View series". This is the merged
  continue-watching card we want.
- Collection = our My List: status tabs (Watching, Completed, On-Hold, Plan to
  Watch, Dropped), status chip on each poster, filters and sort.
- Updates: feed of new episodes from followed shows.
- "English" title-language pill in page headers.
- Command palette (⌘K).
- Settings: Account (email blurred until hover), Profile, Privacy, Appearance,
  Site, Player, Subtitles, Notifications, Integrations, Sessions, Passkeys.
  - Site: title language (English/Romaji), show filler episodes, show recap
    episodes, thumbnail style per section (continue watching, latest,
    popular, recently updated, seasonal, history, updates, series), blur
    thumbnails toggle (spoiler protection, on for this account).
  - Player: view mode (Immersive vs Theater), fullscreen target (player vs
    document), auto landscape on mobile fullscreen, auto start, auto
    fullscreen.
  - Subtitles: local fonts, prescale factor / limits (ASS rendering).
  - Notifications: browser push for new content.

### 0neko

- Minimal SPA. Source switcher with availability counts, one primary
  "▶ Watch EP n" CTA, episode rows with stills and real titles, local-only
  history.

### KickAssAnime (kaa.lt)

- EN/JP title toggle in header, notification bell, Sub/Dub/Chinese filter on
  "Latest Update", sticky "Today Releases" rail with times and aired checks.
- Series page is sparse; lots of ads.

### AniKoto (HiAnime clone)

- Poster cards with sub/dub counts; Top anime Day/Week/Month ranking;
  Watch2gether; community.
- Watch: numbered episode rail with range picker and "find episode",
  quick-toggle bar, server matrix (SUB/HSUB/DUB × servers), next-episode
  banner, franchise "Related" seasons rail, rating widget, per-episode
  reactions and comments.

### 4Animo

- Same HiAnime layout, cleaner: thumbnail episode rail, pill toggles
  (Auto Play/Next/Skip), "you are watching EP n" panel, next-episode estimate,
  ⌘K search.

### 123AnimeHub

- Dated; nothing to borrow beyond a same-franchise suggestions sidebar.

## Mobile (390px, iPhone emulation; anime.nexus also checked logged in)

No site, including AnimeKaiser, overflows horizontally.

- **AnimeKaiser**
  - Good: bottom tab bar (Home, Browse, Search, My list, More) beats every
    competitor's hamburger/top bar; the mobile watch page (player, then
    Prev/Next, Episodes, Stream server, Series details, Up next rows) is solid.
  - Home: the hero fills the whole first screen; "Up next" starts at the
    very bottom.
  - Series: a large centred poster and Trailer button fill screen one; the
    title and "Continue Watching" sit below the fold.
  - My List: four stat cards take a full screen before the first entry.
- **anime.nexus**
  - Home: logo hero with a full-width "Watch Now", then "New Episodes"
    carousel.
  - Series: logo, tags, Add to Collection, ratings, and the next-episode
    card on screen one; then Overview/Episodes/Relations tabs and a 2-column
    episode still grid.
  - Schedule: horizontal day chips plus cards.
  - History (logged in): the per-show "Next: EP 2" / "Caught up!" cards
    read well on a phone.
  - Collection: status dropdown, sort, 2-column posters with a status
    button each.
- **0neko** series: most efficient first screen of all. Small poster left;
  title, meta, per-source availability chips, and "▶ Watch EP 1" right, all
  above the fold, with episodes directly after.
- **4Animo** watch: player, compact toggle row (Auto Play/Next/Skip,
  Prev/Next, Add to list), server matrix, next-episode banner, then an
  episode list with stills.
- **KickAssAnime**: announcement block, then a 2-column Latest Update grid
  with Sub/Dub/Chinese filter.
- **AniKoto**: mobile serves its SEO landing page, even for watch URLs.

Mobile takeaways for AnimeKaiser:

1. Series page: 0neko-style header (small poster beside title, availability
   chips, primary "Watch EP n" / "Continue EP n" above the fold); move the
   trailer into the header actions.
2. Home: a much shorter hero on mobile (or none for logged-in users), with
   personal rows first.
3. Episodes on mobile: 2-column still grid or compact rows with stills.
4. My List: collapse stats into one compact row above the list.
5. Watch page: add a toggle row and the next-episode banner (4Animo).
6. Keep the bottom tab bar.

## Not worth copying

Comments/reactions, Watch2gether, ads, request-series, download buttons.

## Prioritised changes

1. Logged-in home: short hero (none on mobile), and one merged
   "Continue watching" row first. Use anime.nexus-style per-show cards: resume
   mid-episode, "Next: EP n · title", or "Caught up"; cards start playback.
2. Next-episode countdown on the series page, cards, and player banner.
3. Series page header: 0neko-style compact header on mobile, primary CTA
   above the fold, availability chips per provider (sub/dub counts), logo
   art when ani.zip has one.
4. Episode list: real titles from ani.zip, still grid (6 columns desktop,
   2 on mobile), thin progress bar, filler/recap flags if available.
5. Watch page: Immersive vs Theater view mode (setting, like anime.nexus);
   theater = player + episode rail + toggle row (Auto next/skip, Prev/Next,
   Add to list) + seasons rail.
6. Schedule: compact "Airing today" strip on home; full page with day chips
   and cards.
7. Watch history grouped per show with "Next episode" / "Caught up" states.
8. Settings: blur unwatched thumbnails (spoilers), show filler/recap,
   default audio, preferred provider, subtitle language, view mode, auto
   landscape on mobile fullscreen, push notifications for new episodes.
9. Header quick toggle for title language; ⌘K command palette.
10. Mobile My List: compact stats row.
