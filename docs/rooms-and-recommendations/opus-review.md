# Independent review: friends, rooms, and recommendations

Reviewer: Claude Opus 5.5, 2026-10-14. Read-only review of `spec.md`, `plan.md`, and
`ux.html` against the repository at `aa29af7` and current OpenRouter documentation.
No product code, migrations, paid API calls, or secrets were used. Line references
are `spec.md:N` / `plan.md:N`.

Each finding is labelled **[Technical]** (a correction the implementer can make
without changing approved behavior) or **[Nas]** (a product choice that needs Nas's
decision). Severity: **Blocker** / **High** / **Medium** / **Low**.

## Verdict

The design suits Kaiser and mostly fits its architecture: Effect RPC over WebSocket,
Postgres as truth, MAL-only identity, and one persistent player. Its privacy thinking
is unusually careful. It is buildable, but not in its current shape. There are three
problems:

1. **Several OpenRouter assumptions are wrong or untested** (search limits, fetch
   field names, engine defaults, and whether citations and evidence are visible).
   The catch-up evidence design depends on them.
2. **The repository's WebSocket auth model makes guest admission and guest upgrade
   work differently from the plan.** Cookies are read only at the socket handshake.
3. **The scope is very large for one approval**, and the implementation order puts
   the highest-risk work (shared playback in the real player) second. Some
   sub-features, such as guest private catch-up, interval-based completion, and
   Public rooms with guests, carry high cost for low value. Nas should decide on
   these explicitly.

None of these blocks the direction. All three should be resolved in the docs before
approval.

## Verified external facts (OpenRouter, checked 2026-10-14)

Facts come from the public `GET /api/v1/models` and
`/api/v1/models/openai/gpt-6-luna/endpoints` responses and the server-tools docs. None
of them are tested through a real request.

| Claim in plan | Status |
| --- | --- |
| `openai/gpt-6-luna` exists; USD 0.10/M in, 0.50/M out (`plan.md:257`) | **Confirmed.** Prompts over 272k tokens cost 0.20/0.75. The context window is 1.05M; max output is 128k. |
| Luna supports `tools`, `response_format`, `structured_outputs`, and `reasoning` | **Confirmed** in the model's `supported_parameters`. |
| Routing across providers "serving that same model" (`plan.md:163`) | **Confirmed, with caveats.** Endpoints: OpenAI, `openai/flex` (half price, **72% uptime last day**), `openai/fast` (2× price), Azure, Azure US/EU, and Amazon Bedrock. **Bedrock lists no native tools.** OpenAI endpoints list `max_tokens` but not `max_completion_tokens`; Azure lists the reverse. |
| Search via `openrouter:web_search`, not the deprecated `web` plugin / `:online` | **Confirmed.** Server tools are labelled **beta; "API and behavior may change."** |
| Parallel Fast search costs USD 0.001 per search (10 results included) | **Confirmed.** Each extra result costs USD 0.001. |
| Per-tool `max_uses` bounds searches (`plan.md:193`) | **Wrong for search.** The docs say web search's `max_uses` "is forwarded only to Anthropic native search." With Parallel it is not enforced. |
| `max_characters` bounds fetched pages (`plan.md:193`) | **Wrong field.** `max_characters` belongs to search (per result, 1–100,000). Fetch uses `max_content_tokens` and `max_uses`, which fetch does enforce. |
| "Direct OpenRouter fetch has no tool fee" (`plan.md:258`) | **True only if `engine: "openrouter"` is pinned.** The default `auto` uses native fetch if available, otherwise Exa at USD 1 per 1,000 fetches. |
| Search engine choice | **Luna endpoints advertise native `openrouter:web_search` at USD 0.01 per search.** Unless the engine is pinned, `auto` will likely use native search, which costs 10× Parallel Fast and ignores `max_results`. |
| `max_tool_calls` | **Confirmed** as the shared cap across all server tools. Default and maximum are both 30. When it runs out, the model is told to answer with what it has. |
| Spend-based stop | **Exists, beta and lightly documented.** `stop_server_tools_when` overrides `max_tool_calls`. SDK types include `max_cost` (stops once spend *exceeds* a threshold, so it is not a hard cap) and `step_count_is`. |
| Citations / "returned source annotations" (`plan.md:215`) | **Undocumented for Parallel.** `url_citation` annotations are documented only for Exa. Fetch results (`url`, `title`, `content`, `status`, `retrieved_at`) go to the model, and the docs do not say whether the caller sees them. |
| Streaming events for server tools; `response_format` together with server tools | **Undocumented.** Must be tested. |
| Regional endpoints | Fetch returns **403 on EU/US regional endpoints**. Use the global API. |
| ZDR | Restricts inference endpoints only. Third-party search and fetch backends keep their own retention. |

Sources: [Luna](https://openrouter.ai/openai/gpt-6-luna),
[server tools](https://openrouter.ai/docs/guides/features/server-tools),
[web search](https://openrouter.ai/docs/guides/features/server-tools/web-search),
[web fetch](https://openrouter.ai/docs/guides/features/server-tools/web-fetch),
[StopServerToolsWhenMaxCost](https://openrouter.ai/docs/sdks/typescript/api-reference/models/stopservertoolswhenmaxcost).

## Blockers

### B1. The catch-up evidence pipeline assumes visibility the API may not give. [Technical] Blocker

`plan.md:199-215` and `spec.md:249-257` require a per-episode coverage record built
from retrieved evidence, plus a check of each section against source text
(`plan.md:319-320`). With server tools, OpenRouter runs search and fetch inside the
request, and the documented caller-visible output is only the final message plus
`url_citation` annotations (Exa only) and `usage.server_tool_use` counts. If the raw
fetched text never reaches Kaiser, the app cannot build or check coverage. It can
only trust the model's own claims.

**Amend plan.md "Recommendation pipeline":**
- Add **Stage 0: provider spike.** One small script, run once against the real API,
  needs Nas to authorize a key and a spend of a few cents. It should establish:
  (a) whether streamed and non-streamed responses expose tool results or only
  annotations; (b) whether `response_format` (JSON schema) works with server tools on
  Luna; (c) annotation shape with `engine: "parallel"`; (d) whether `max_tool_calls`
  and fetch `max_uses` are enforced; (e) the `usage` cost fields; (f) which endpoint
  served the request. Record the results in plan.md. The catch-up design is not final
  until the spike passes.
- Make the research request return **structured evidence** (episode → claim → source
  URL → short supporting excerpt) via `response_format`. The app then accepts a
  citation only if its URL appears in the request's annotations or tool results.
  Keep synthesis a separate request with tools disabled, which matches the existing
  privacy split at `plan.md:209-213`. If (b) fails, fall back to a plain-text evidence
  format parsed by code. State that coverage checks then rest on model-reported
  excerpts, not on independently retrieved text.
- Treat the validation line "check each section against retrieved source text"
  (`plan.md:319`) as a test-time manual review, not a runtime guarantee, unless the
  spike shows tool results are visible.

### B2. The research limits as written cannot be enforced. [Technical] Blocker

`plan.md:189-197` budgets "four searches, six page fetches, ten total" via
`max_uses`. Search `max_uses` is ignored for Parallel (see the table above).

**Amend:** Search count is bounded only by `max_tool_calls` minus fetches used. Set
`max_tool_calls: 10` and fetch `max_uses: 6`. Pin the search engine with
`engine: "parallel"`, `mode: "fast"`, `max_results: 5`, `max_total_results: 20`, and
`max_characters: ~1500`. Pin fetch with `engine: "openrouter"` and
`max_content_tokens: ~6000`. Do not rely on a search count of exactly four. Reserve
spend for the worst case of 10 searches. Also add these routing rules:
- `provider.require_parameters: true` so routing never silently drops a limit.
- Send `max_tokens`, not `max_completion_tokens`. The latter would exclude the
  OpenAI endpoints under `require_parameters`.
- Exclude `openai/flex` (low uptime) and `openai/fast` (2× price).
- Exclude Bedrock while it lists no native tools. Server tools don't need native
  support, so this is caution, not a requirement. Re-test after the spike.

Replace "No implicit model/engine fallback may weaken limits"
(`plan.md:197`) with these concrete request settings so the implementer cannot
miss them.

### B3. Guest admission and upgrade conflict with how the RPC socket authenticates. [Technical] Blocker

`apps/web/src/services/api-clients.ts:139-143` says it directly: "Cookies are
attached during the WebSocket handshake, so a session change needs a new socket."
`navigateAfterAuthChange` does a full reload. All RPC auth (`packages/rpc/src/server/authentication.ts`)
reads Better Auth sessions from the handshake headers. The API runs on a separate
origin (`VITE_API_URL`, CORS `allowedOrigins: [env.app.url]`, optional
`AUTH_COOKIE_DOMAIN` / `crossSubDomainCookies`).

Consequences the plan does not state (`plan.md:82-93`):
- After the HTTP admission endpoint sets the guest cookie, the client must open a new
  socket (reuse `navigateAfterAuthChange` to the room route). Guest → account upgrade
  and any sign-in from an admission screen need the same.
- The guest cookie must use the same domain/SameSite/Secure policy as Better Auth's
  cookies, or the cross-origin WS handshake will not send it in production. Local dev
  may be same-site and hide this. List it as a validation gap unless tested against a
  prod-like domain.
- Add a new `RoomActor` RPC middleware that resolves *account session or guest cookie*.
  Existing `Authentication` / `OptionalAuthentication` must keep rejecting guest-only
  sockets, which matches `plan.md:93`.
- Long-lived streams authenticate once at the handshake. Session expiry or revocation
  during a room stream is caught only by the plan's periodic reconcile
  (`plan.md:116`). That reconcile must also recheck the guest session's expiry and
  the account session's validity, not just room membership.

## High

### H1. Do shared playback first; it is the riskiest work. [Technical] High

The plan's stages (`plan.md:267-283`) build all of social and admission first. That
covers friends, three access modes, guests, conversion, and lifecycle. Only then
does it prove that two browsers can watch in sync through `StreamPlayerPage`. The
player is tightly tied to its route:
- `PlaybackSessionHost` treats only `/watch/*` as "expanded"
  (`playback-session.tsx:23`) and on mobile clears input when not expanded.
- `StreamPlaybackInput` comes from route params.
- Episode navigation, failure recovery, and Default server all link to `/watch/...`
  (`player/page.tsx:117-130`).
- Completion runs on `onEnded={finishEpisode}`.

Room mode needs the room state, not the URL, to own the episode. That seam decides
whether the design works at all.

**Recommended order** is under [Implementation order](#recommended-implementation-order).
Prove one account-only invite-link room with shared playback and chat in two real
browsers before adding friends, guests, or access modes.

### H2. Room-mode completion via merged viewing intervals is costly. [Nas] High

`spec.md:219-221` and `plan.md:149-158` add server-side interval merging, validation
against elapsed time and speed, and exclusion of buffering and hidden time. This is a
small subsystem, and it also feeds outbound MAL/AniList sync. The problem it solves
is real: today's solo rule (92% position, `history/service.ts:32-41`, plus
`onEnded`) would mark late joiners complete.

Options for Nas:
- **(a) Keep as specified.** Highest fidelity, highest cost.
- **(b) Recommended for v1.** In room mode, save resume position only. Never
  auto-complete. When an episode ends or the host moves on, show signed-in members
  who were playing locally a one-tap "Mark episode N watched". That uses the existing
  local-first library write and sync. It is honest, simple, and keeps solo behavior
  unchanged.
- **(c)** Auto-complete only if the member was present and playing locally at both
  the start and the end of the episode. This is a cheap approximation.

### H3. The scope is very large; name the cut candidates. [Nas] High

Approval currently covers: friendships, three access modes, guests and upgrade, sync
playback, chat, shortlist and votes, saved personal AI, configurable room AI, sourced
web catch-up, *guest-private* catch-up, bans, host transfer, retention, and account
deletion. Each item is reasonable alone. Together they mean a long period before
anything ships. Candidates Nas could defer without breaking the core idea:
1. **Guest private catch-up** (`spec.md:260-263`). This needs a third conversation
   ownership type, host-proof privacy, and conversion into personal threads. Instead,
   guests see "Create an account to get a private catch-up" and keep everything else.
2. **Public rooms.** A public listing that admits any signed-in user, with chat and no
   report flow, adds abuse surface. Invite-only plus friends-only already cover
   "watch with people I know". Public rooms can return once moderation exists.
3. **"Everyone" playback control.** It adds conflict and ordering cases. Host-only is
   the default anyway.
4. **Room AI as a separate pipeline.** Room "Ask AI" can reuse the personal pipeline
   with room-scoped context. The plan already mostly does this; confirm it is one
   code path.

### H4. Presence via heartbeat RPCs is heavier than needed. [Technical] High

`plan.md:96-101` uses per-connection leases with heartbeat writes. Each RPC call also
runs Better Auth `getSession` (`authentication.ts:14-24`; no cookie cache configured
in `packages/auth/src/init-auth.ts`). Twenty participants each sending heartbeats
means steady auth and DB load for no product gain.

**Simplify:** an open room `watch` stream *is* the presence lease. Track live
subscribers in-process (one API instance today). Write `last_seen_at` to Postgres on
connect, on disconnect, and every ~30 s from the per-process sweep, not per client.
Use the same subscription to decide which tab controls playback. Keep the multi-instance
note (`plan.md:124-126`) as future work rather than designing leases for it now.

Note that the existing `Database.listen` uses `Queue.unbounded`
(`packages/db/src/db.ts`). That is fine for the single process-wide LISTEN the plan
proposes. Per-subscriber fan-out must use bounded or sliding PubSub, as the plan
already says.

## Medium

### M1. Spec contradictions and gaps. [Technical, unless marked]
- **Friends-only discovery has no surface.** The table says "Eligible friends' room
  lists" (`spec.md:138`), but Rooms has only My rooms / Invitations / Public tabs
  (`spec.md:70`). Add a "Friends" tab, or fold friends' rooms into Invitations. [Nas,
  minor]
- **Unclear guest AI sentence.** "Guests can chat, suggest titles, and vote without AI
  access" (`spec.md:181-182`) reads as "guests never have AI". The intent is "these
  work even when AI is off". Rephrase.
- **Host disconnect with Everyone controls** (`spec.md:184-187`): does playback still
  pause after 30 s? Say so explicitly. [Nas]
- **A host who closes the tab** (rather than leaving explicitly) leaves the room paused
  until the 24 h idle close, and nobody else can resume. That is acceptable given "no
  silent host election", but members should see "Host is away — you can leave or keep
  chatting". [Nas, confirm]
- **Seasons vs MAL identity.** Spec catch-up speaks of "season 1/season 2"
  (`spec.md:238-246`). In Kaiser each season is its own MAL ID. Define the catch-up
  range as *a list of MAL entries plus an optional episode range within the last one*,
  chosen from the existing `GetAnimeWatchOrder` service. This removes most "ambiguous
  numbering" cases by construction and keeps the domain rule "Anime identity is
  always MAL-backed". Search queries still use the titles.
- **Migration wording.** `plan.md:79-80` says "Generate migration SQL through the
  supported db script". AGENTS.md says "Generate and commit migration SQL manually".
  Files like `0012_public_library_sharing.sql` are hand-named. Align with AGENTS.md:
  `db:generate` is fine for a draft, then review, rename, and commit by hand.
- **Pronoun.** `spec.md:338-340` refers to Nas as "his". Use neutral wording
  ("Nas's current position", "follows the host's controls").

### M2. Privacy edges. [Nas unless marked]
- **Small-room inference.** In a two-person room, an "anonymized" aggregate rationale
  reveals the other member's library (`spec.md:277-286`). The consent copy should
  say other members may infer your tastes from group suggestions. [Technical copy fix]
- **Private profiles and username search.** `profile.private` exists. Should Find
  someone return private profiles, and can they receive requests? Recommendation:
  exact-username match only for private profiles, with no partial search.
- **No block or rate limit on friend requests.** Decline alone allows repeat
  requests. Minimum: rate-limit requests per sender and suppress re-requests after a
  decline for a period. Block can wait. [Technical rate limit; Nas for block]
- **Fetch scope.** The `openrouter` fetch engine retrieves any URL the model chooses.
  Consider `blocked_domains` for known spoiler-dense or low-quality sources, or start
  with an `allowed_domains` list (official sites, MAL, AniList, Wikipedia, a few recap
  sites) and widen after evaluation. Fan wikis are often the most spoiler-heavy
  sources.
- Guest chat display names need length and character bounds and server-side
  escaping. The plan covers escaping links but not names. [Technical]

### M3. Spoiler leakage through UI rather than model output. [Technical] Medium
- **Source titles leak.** A Sources list showing raw page titles ("X's death
  explained — Season 2 Episode 20") breaks the boundary even if the summary is clean.
  Show sources as `domain · episode label` and reveal full titles on demand inside the
  same spoiler block.
- **Card synopses leak.** Recommendation and shortlist cards hydrate MAL synopses. A
  sequel's synopsis spoils earlier seasons. When a card's MAL entry has a prequel,
  collapse its synopsis behind "Sequel — synopsis may spoil earlier seasons".
- **Notification previews and unread badges for shared recaps** must show only
  "Recap shared (Season 1 spoilers)". The spec already says this (`spec.md:266-267`);
  carry it into the plan's message content type.

### M4. Cost and quotas: right idea, accounting is heavier than needed. [Technical + Nas]
- Rough cost at verified prices: a plain recommendation turn is about 10–30k input
  and about 1–2k output, so roughly USD 0.002–0.004. A worst-case research turn is
  10 tool steps that each re-send the growing context. Bounded fetch and search sizes
  keep it under about 150k cumulative input, so roughly USD 0.02, plus up to USD 0.01
  in Parallel searches. **Native search would add up to USD 0.10 per turn**, which
  is why B2's engine pinning matters.
- So a USD 10/month budget covers roughly 300–500 worst-case recaps, or thousands of
  ordinary turns. At 20 turns per user per day, it lasts days with a few active users,
  and when it runs out, AI is off for everyone. **[Nas]** Confirm whether USD 10 is a
  safety cap for the beta (fine) or meant to support real usage.
- Simplify reservation: use one fixed worst-case reservation per turn type
  (recommendation vs research), held in one atomic budget-row update. Settle from the
  response `usage` (OpenRouter returns cost in usage accounting; the spike confirms the
  exact fields). Optionally add `stop_server_tools_when: [{type: "max_cost", …}]` as a
  second guard, but don't depend on it since it is beta and soft. A month-keyed budget
  row plus per-actor and per-room daily counters is enough. Avoid a per-token ledger.
- **[Nas]** Is the USD 10 budget meant to be a *hard* cap? A provider charge can
  arrive after cancellation (`plan.md:241-242`). An OpenRouter key credit limit is
  the reliable hard cap. Recommend setting one on the key itself.

### M5. Adapter choice. [Technical] Medium
Use `@effect/platform` `HttpClient` (already a dependency of `apps/api`) for the
OpenRouter adapter rather than adding the beta OpenRouter SDK. Server-tool request
fields are plain JSON, and the SDK's types are the part most likely to change.
`OPENROUTER_API_KEY` must be `Config.option`/`Config.redacted` in `apps/api/src/env.ts`
so the API still starts without it (`plan.md:167-168`). No `doppler.yaml` exists in
the repository. Confirm where production secrets live before adding the key.

## Low
- `ux.html` shows a top tab bar (Rooms / Friends / Recommendations) rather than the
  existing sidebar and mobile bottom nav. It also lacks the My rooms / Invitations /
  Public tabs and the narrowing-confirmation dialog the spec requires. Label it
  explicitly as "layout of room surfaces only; navigation per spec", or update it.
- `plan.md:21-24`: the "Postgres LISTEN" description is correct, and the warning not to
  copy the per-subscription LISTEN pattern is right. Keep it.
- `spec.md:333`: a 20-participant cap is fine. Guests counting toward it is correct.

## UI/UX advice

**Navigation**
- The Social sidebar group (Rooms, Friends) and Recommendations under personal links
  fit `nav-links.ts`. Add all three to the command palette's existing "Pages" group
  (`search-dialog.tsx:219`). That is a direct extension.
- Mobile: Rooms lives in More, so **an active room needs a persistent "In room ·
  Return" chip** above the bottom nav, especially because mobile stops local video
  when you navigate away (`spec.md:96-97`, and `PlaybackSessionHost` clears input).
  Without it, mobile members lose the room.

**Choosing vs watching**
- Make room phase explicit in the header: *Choosing* or *Watching EP 3*. The host's
  "Back to picks" should not stop members' video until the host picks a new episode.
- Keep Picks reachable while watching (it already is, as a tab). Adding a pick during
  playback should show a quiet toast, never a modal.
- "Choose this anime" → episode picker → room paused at 0 with "Start for everyone".
  The walkthrough has this; keep it.

**Guests**
- The admission screen should show room name, host display name, selected anime,
  online count, the chat-history notice, and two buttons: *Join as guest* and *Sign
  in*. Sign-in must return to the room via a full navigation (B3).
- Show "Guest · expires in 23 h" in People and the guest's own header. On expiry,
  show a dedicated state with "Create account to keep this room", not a generic error.

**Manual flows**
- Search scoped to "Add to room" should reuse the existing search dialog with a
  room-mode action row, not a separate search page. Opening a result inspects it only,
  as the spec says.

**Personal vs room AI**
- Give every AI surface a scope label next to the composer: *Private · only you* or
  *Shared · visible to room*. Keep room "Ask AI" as a separate sheet, as the
  walkthrough does, rather than a composer toggle. A toggle invites accidental paid
  or shared sends.
- When a signed-in member taps Catch me up in a room, it opens *their personal*
  assistant (a side sheet on desktop, full-screen sheet on mobile). The room must stay
  visibly in the background so members don't think the recap went to chat.

**Catch-up**
- Build the range picker from watch-order MAL entries (M1): checkboxes for prior
  entries, plus "through episode N" on the current entry. Show the boundary sentence
  live: *Contains: Frieren S1 (ep 1–28). Excludes: everything after.*
- Coverage summary first ("26 of 28 episodes sourced · 2 gaps"), then sections. Gaps
  are listed with *Continue researching* (counts toward quota).
- Sources are collapsed by default (M3).

**Mobile**
- Watch out for iPhone native fullscreen (`webkitEnterFullscreen`): chat and the room
  overlay are invisible there. Tell members once ("Chat isn't visible in fullscreen").
  Keep room controls in the inline player.
- Position the composer from `visualViewport`, not just safe-area insets. The spec's
  keyboard requirement (`spec.md:91-92`) needs this on iOS Safari.

**Accessibility**
- One polite live region for room events ("Nas paused at 08:32", "Host changed
  episode"), throttled. Do not announce every chat message.
- Player shortcuts must not fire while the chat composer has focus. Check
  `use-keyboard.ts` handles this for the new inputs. Blocked control attempts announce
  "Host controls playback".
- Spoiler blocks are native `<details>` or a button with `aria-expanded`. Collapsed
  content must not be in the accessibility tree.
- Votes: the toggle button exposes `aria-pressed` and an accessible count.

## Recommended implementation order

0. **Provider spike** (B1/B2). Needs Nas to authorize a key and a few cents. It can
   run in parallel and gates stage 5's design, not stages 1–4.
1. **Thin room slice, accounts only.** Room table, invite link for accounts,
   `RoomActor` middleware, room watch stream as presence (H4), process-level LISTEN +
   PubSub, chat. Then **room-mode player**: room route as an "expanded" playback host,
   room state owning the episode, controller seam, drift correction, Join playback,
   and room-mode history per H2's decision. **Validate with two real browsers on real
   media before continuing.**
2. **Friends + friends-only + addressed invitations.**
3. **Guests**: HTTP admission with fragment token, cookie, full-navigation socket
   reset, expiry, upgrade. Validate against a prod-like cookie domain if possible.
4. **Shortlist/votes, host moderation, lifecycle sweep, retention, account deletion.**
5. **AI**: saved personal recommendations (no web tools), then room Ask AI on the same
   pipeline, then sourced catch-up per the spike's findings, then guest catch-up (if
   kept, H3).
6. **Finish**: accessibility pass, multi-tab, failure states, root `bun typecheck`,
   `bun lint`, `bun test`, `bun build`, and targeted `bun test:e2e`.

## What should be updated

**spec.md**
- Friends-only discovery surface (M1). Guest-AI sentence. Host-away and Everyone-control
  pause behavior. Pronoun in Example 1.
- Catch-up range defined as MAL entries plus an episode range (M1).
- The H2 decision on room-mode completion.
- The H3 decision on cut candidates (guest catch-up, Public rooms, Everyone control).
- Spoiler rules for source titles and sequel synopses (M3). Small-room consent wording (M2).

**plan.md**
- Replace the server-tool limits with concrete request settings (B2). Correct
  `max_characters` → fetch `max_content_tokens`. Pin both engines. Add
  `require_parameters`, `max_tokens`, and endpoint exclusions.
- Add Stage 0 spike and the structured-evidence research output (B1).
- State guest and upgrade socket reset, cookie-domain parity, the `RoomActor`
  middleware, and session recheck in reconcile (B3).
- Presence via stream subscription (H4). Reorder stages (H1).
- Simplified budget accounting and an OpenRouter key credit limit as the hard cap (M4).
- `HttpClient` adapter and optional config (M5). Migration wording (M1).

**ux.html**
- Mobile "Return to room" chip. Room phase label. Scope labels on AI composers.
- Catch-up picker built from MAL entries. Collapsed Sources.
- Either adopt the real navigation or label the top tabs as illustrative.

## Decisions needing Nas

1. H2: room-mode completion approach (a / **b recommended** / c).
2. H3: defer guest private catch-up, Public rooms, and/or Everyone playback control?
3. M4: whether the USD 10/month AI budget is a beta safety cap or a usage target, and
   whether to set an OpenRouter key credit limit.
4. Authorize the Stage 0 spike: an OpenRouter key via `request_secret` or Doppler, and
   a spend of about USD 0.10.
5. M2: private-profile searchability, friend-request block, fetch domain allow/deny policy.
6. M1: friends-only rooms discovery placement and host-away behavior.

## Integration response (Codex, 2026-10-14)

Integrated guest cookie/socket-reset requirements and session revalidation, subscription
presence with server leases, transactional notifications, the existing Effect HttpClient
adapter, conservative budget reservations, MAL-entry recap boundaries, UI spoiler handling,
private/shared labels, and a thin playback-first implementation order. The prototype now
shows room phase, Return to room, dynamic episode boundaries, and collapsed sources.
Provider evidence visibility, schemas with tools, events, and cost accounting are explicit
real-request gates. The proposed full scope and coverage-completion rule remain intact;
manual completion and scope deferrals are review alternatives awaiting Nas's decision.

Two external-fact findings need qualification after rereading the official docs:

- **B2 search limits:** search `max_uses` is documented for non-native engines.
  Only its forwarding to *native* providers is Anthropic-only. Parallel still uses
  `max_uses: 4`, backed by `max_tool_calls: 10` and conservative spend reservation.
  This is documented support, pending a real enforcement check.
- **B1 annotations:** the search docs describe caller-visible excerpts for Exa and
  Parallel, rather than guaranteeing Exa alone. Full fetched-page visibility remains
  uncertain. Verify actual annotations/tool results and never equate model-reported
  excerpts with independent evidence.

[Search limits and annotation documentation](https://openrouter.ai/docs/guides/features/server-tools/web-search)
support those qualifications. Native tool absence alone does not disqualify an
endpoint because OpenRouter executes server tools; initial routing uses an endpoint
that passes the spike rather than freezing an uptime observation into architecture.
No paid spike, secret retrieval, or product implementation was performed for this review.
