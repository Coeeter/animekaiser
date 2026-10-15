# Friends, watch rooms, and conversational recommendations

Status: approved for implementation by Nas on 2026-10-14 via the instruction to
start a new Kaiser thread with Opus 5.5 and execute-approved-plan. Implementation
has not started at handoff.

## Goal

Make AnimeKaiser useful for choosing anime alone and watching with other people.
Users can build friendships, open a room directly from an anime or episode,
choose an anime manually, or discuss recommendations with AI. AI is optional.
Personal recommendation conversations are saved independently of rooms.

## Confirmed product decisions

- Rooms include synchronized video playback and text chat. Voice stays in Discord.
- The host makes final decisions about the anime, episode, and room settings.
- A room can start with a selected anime or as an empty space to choose together.
- Public, friends-only, and invite-only rooms are supported.
- Invite links can admit temporary guests without a Kaiser account.
- Room AI access is configurable. Personal AI chats work outside rooms.
- Searching and selecting an anime manually remains a complete first-class flow.
- The UX must work on desktop and mobile and fit the existing Kaiser interface.
- AI uses OpenRouter with the fixed GPT-6 Luna model; no automatic switch to a
  different model. It can search the web and read public sources when needed.
- AI supports sourced season/episode catch-up summaries, including preparing a
  viewer who missed season one to join friends watching season two.

The concrete defaults and lifecycle rules below are the approved baseline.
Review alternatives remain recommendations rather than approved changes.

## Scope

Include friendships and requests, room discovery and invitations, temporary
guests, shared playback, text chat, a shared shortlist and votes, saved personal
AI chats, configurable shared room AI, and host moderation.

Exclude voice/video chat, direct messages, an activity feed, subscriptions or
payment plans, cross-provider timeline alignment, and an autonomous AI agent.
The existing catalogue, library, external-list sync, and solo player retain their
current behavior.

## UX and entry points

### Navigation

- Add a Social group in the desktop sidebar with Rooms and Friends.
- Add Recommendations to the personal navigation, separate from Discover's
  existing catalogue categories and the series page's provider recommendations.
- Keep the mobile bottom tabs. Put Rooms, Friends, and Recommendations in More.
- Add a compact signed-in home section showing the user's active room and room
  invitations. It must not displace Continue watching or create a second hero.
- Expose these destinations in the existing command palette.

### Watch together without setup work

Series pages gain a secondary Watch together action. The solo Watch action stays
primary. The player exposes Watch together in its secondary actions.

From a series page, the user chooses an episode and opens a room. From the player,
the room starts with the current anime, episode, source selection, and timestamp,
paused until the host starts it. A user can create a room with nobody else present.
Creation requires a signed-in account; joining can use an account or guest access.

Show a small creation sheet with a room name, access choice, and Create room.
Default to Invite-only. Put playback and AI permissions under More settings.
After creation, expose Invite and Copy invite link immediately. Creation and
invitations never require AI.

### Choose together

Rooms has My rooms, Friends, Invitations, and Public tabs, plus Create room.
Friends lists eligible rooms hosted by accepted friends; this is a proposed
discovery placement for approval with the draft. An empty room
offers two equally clear actions: Search anime and Ask AI. The latter is absent
when AI is disabled and disabled with an explanation when AI is unavailable.

Any member can add a real anime to the shared shortlist and cast one toggleable
vote per anime. Votes are advisory; the host can select any title regardless of
the vote count. Only the host can remove shortlist items or choose the current
anime and episode. Duplicate shortlist additions create one item.

Search opens the existing catalogue search experience, scoped to Add to room.
Opening a result for inspection does not change the room's selection. The host
uses Choose this anime, then selects an episode and starts playback. A member's
suggestion or an AI reply never starts video or changes someone else's library.

### Watching layout

On desktop, show the existing player as the main surface with a right-hand panel
containing Chat, Picks, and People tabs. Keep the room name, access badge, host,
Invite, and connection state visible. Room settings stay in a host-only menu.

On mobile, put the player first and the same three tabs below it. The text composer
stays reachable above the software keyboard and safe area, including iOS visual
viewport changes. It must not cover the
video or obscure the active tab. Show unread counts without forcing scroll.

Room membership continues while browsing elsewhere until Leave room, disconnection
expiry, or closure. Desktop uses one persistent mini-player with Return to room.
On mobile, navigating away stops local video as the solo player does today, while
chat membership can remain active; a persistent In room · Return chip above the
bottom navigation restores current room playback. Native iPhone fullscreen hides
chat; explain this once and keep room actions available in the inline player.
Starting solo playback while in a room asks the user to leave the room first.

### Personal recommendations

Recommendations opens a private conversation workspace with New conversation,
saved conversations, a composer, and anime recommendation cards. On mobile, saved
conversations are a sheet rather than a permanent column.

Offer optional starters such as Something like this anime, From my planning list,
and Help me pick tonight. Users can start with any free-text request. An Ask AI
about similar anime action on a series page preloads that anime into a new thread
but waits for the user to send a message before generating a paid answer.

Save messages and recommended titles after each turn; allow rename and delete.
Persist failed user messages with Retry rather than losing the conversation.
Recommendation cards support View details, Add to my list, and Watch. A signed-in
room member can explicitly send a recommendation card to their active room; this
shares the title, not the private conversation or personalized rationale.

Session preferences stay in that conversation. Lasting preferences change only
when the user explicitly saves them and remain editable in recommendation settings.
Private chats are never automatically copied into room chat.

## Friendships

Friendships are mutual, established by an accepted request. Search by username,
not email. Existing profiles gain Add friend, Pending, Accept, or Friends actions.
Support cancel, decline, accept, and remove. Friends lists are visible only to
their owner in this release; friendship does not grant access to a private profile,
library, activity, or private AI conversation.

Sending requests in both directions establishes a friendship once. Self-requests
and duplicate requests have no effect. Room and friend invitations appear in the
app, with readable pending counts; email and push delivery are outside this scope.

## Room access, invitations, and guests

| Access | Discovery | Who may join |
| --- | --- | --- |
| Public | Listed while open | Any signed-in user; guests with a valid invite link |
| Friends-only | Eligible friends' room lists | The host and the host's accepted friends |
| Invite-only | Host/member lists and addressed invitations | Explicitly invited accounts; guests/accounts with a valid invite link |

Friends-only uses the current host's friendships, not friendships of any member.
Guest links cannot bypass this requirement. Switching to Friends-only removes
ineligible guests and accounts after the host confirms the change.

Invite-only is the creation default. Links expire after seven days and can be
revoked or replaced by the host. Link possession does not permit hosting,
moderation, access to private libraries, or use of personal recommendation chats.
Revoking a link prevents new admissions; Remove member also revokes an admitted
member's access. Changing visibility immediately rechecks existing memberships.

Guest joining asks only for a display name and provides a temporary room-scoped
identity. Guests are visibly labelled Guest, cannot create rooms or friendships,
and cannot become host. Their session lasts up to 24 hours and can reconnect in
the same browser while the room and invitation remain valid. Signing in/up can
upgrade the guest membership without duplicating chat authorship or votes.

Unjoined visitors see an admission screen, not room chat, member lists, or private
room state. Public discovery cards show room name, host display identity, selected
anime if any, and online count. Private room failures do not reveal identities
or content to unauthorized users.

Room chat is shared saved history for admitted members, including later joiners.
Creation/joining makes this explicit. Broadening room visibility requires a host
confirmation explaining that newly admitted people can read the saved room chat.
This applies to shared room AI messages as well. Personal chats remain private.

Hosts can remove and ban a participant for that room, revoke invites, transfer
hosting to another present signed-in member, and close or delete the room.
Guests cannot remove their own ban by refreshing the same session; an invite link
alone is not a reliable way to identify a person using another browser.

## Host controls and room lifecycle

| Setting | Default | Choices |
| --- | --- | --- |
| Access | Invite-only | Public / Friends-only / Invite-only |
| Playback controls | Host only | Host only / Everyone |
| AI recommendations | Host only | Off / Host only / Everyone |

Everyone includes admitted guests. The host always chooses anime, episode, audio
edition, and room settings, even when play/pause/seek is open to everyone. Guests
can chat, suggest titles, and vote even when AI is off.

An explicit host departure requires Transfer host or Close room. If the host
disconnects, show Host reconnecting; pause shared playback after a 30-second
grace period and retain ownership. There is no silent host election. The host can
return to the paused room; members can leave or continue chatting. The proposed
host-away rule also pauses rooms with Everyone controls after the grace period;
controls remain disabled until the host returns. Show Host is away — leave or keep
chatting, with no suggestion that another member can silently become host.

Rooms survive reloads and API restarts. They automatically close after 24 hours
with nobody connected. Closing ends playback and admissions but keeps history
readable by already admitted members for 30 days, then deletes the room's data.
The host can delete it sooner. A guest can read history only while their session
is valid. Personal recommendation threads remain until their owner deletes them.

## Synchronized playback

The room has one authoritative anime, episode, audio edition, play/pause state,
timestamp, and playback speed. Members see who can control playback. Unauthorized
controls cannot change shared playback, including keyboard shortcuts.

- Joining, reconnecting, and returning from a background tab align to the current
  room position instead of resuming an old personal watch-history timestamp.
- A Join playback action handles browsers that require a gesture to start video.
  A member blocked by autoplay is shown as needing to join playback.
- Volume, mute, subtitles, quality, fullscreen, and local audio enhancement are
  personal. Stream resolution is per member; playable URLs are not shared in chat.
- Members use the same provider/episode/audio edition. Independent server fallback
  is allowed only for a verified equivalent timeline. No cross-provider alignment
  is promised in this release. Missing/unplayable media shows an actionable error.
- Local buffering does not pause everyone. Show the member's state and catch them
  up when ready. Controlled pause/seek actions update the whole room.
- Disconnected members pause locally and show Reconnecting. Rejoin using a fresh
  snapshot. An API restart restores rooms paused, not at an invented elapsed time.
- Only host-controlled auto-next and intro/outro skipping may change the shared
  timeline. Followers' solo preferences cannot issue competing changes.
- Watch history and any library/external sync are per signed-in viewer and reflect
  their actual local viewing. Joining, seeking, or a remote episode-ended message
  alone never marks an episode watched. Guest viewing creates no account library.
  Proposed room-mode completion requires actually viewing 92% of the episode's
  timeline across saved sessions; seek gaps, buffering, and repeat segments do not
  count. If duration is unknown, completion stays manual. Solo completion is unchanged.

## AI recommendations and reliability

AI chats can discuss mood, constraints, dislikes, and previous suggestions. Replies
include a short explanation and a small set of real anime cards. Users can refine
the request, reject suggestions, ask follow-ups, or stop generation.
Recap answers use sourced text sections rather than requiring recommendation cards.

### Search and catch-up

Add Catch me up beside the selected anime in a room and on series pages. It opens
the assistant with the relevant anime/season already selected; submitting is still
explicit. This also works in personal AI conversations outside rooms. The assistant
can answer ordinary catalogue-grounded questions without searching, and search for
fresh information, episode details, or recaps that need external evidence.

Resolve the exact anime, season, specials, and requested episode range before
searching. Franchise relations alone are not proof of the correct season numbering.
Represent a confirmed range as explicitly selected MAL-backed entries with episode
ranges, using watch-order data as suggestions rather than authoritative numbering.
Everything before this episode still requires confirmation of the individual
entries and episode cutoff. If numbering is ambiguous, show choices before generating.
Offer Quick catch-up and Episode by episode. Users can request the whole prior
season, a specific range, or Everything before the episode we are watching.

Before generating a recap, show its spoiler boundary, for example Contains season
1 spoilers; excludes season 2. The user confirms the range. Progress can suggest
a boundary but cannot establish consent. A recap covers only the requested range
and never marks those episodes watched or advances a library.

Recaps search for and read supporting public summaries, prefer official episode
synopses and reputable episode recaps, and synthesize short original summaries with
source links per episode/section. Distinguish verified events from interpretation.
Never silently fill missing episodes with model memory. Say which episodes have
insufficient or conflicting evidence; allow a narrower range or explicit Continue
researching within quotas. Search results, titles, and source pages can themselves
contain later spoilers: inspect and isolate evidence for the approved range, and
keep later events out of the answer. Do not claim perfect spoiler protection from
uncontrolled external pages. Warn before opening an external source. Sources are collapsed and use neutral
domain/episode labels; raw page titles may contain later spoilers and are not
shown automatically. Recommendation and shortlist sequel synopses stay behind
a synopsis-may-spoil-earlier-entries disclosure.

Keep catch-up private by default. Signed-in members use their own personal thread
even when entering from a room. Guests may open a temporary private, room-scoped
catch-up conversation when the room's AI setting permits their requests; only that
participant can read it, including against host access. It expires with guest/room
access and follows room retention. Signing in can preserve it as a personal thread.
The host's shared-AI setting does not restrict an account's independent personal AI.
Sharing a recap to room chat is an explicit action and adds a collapsed spoiler
block labelled with the covered season/range. Members reveal it individually; the
room chat feed and notification previews do not display plot text automatically.

Show Searching and Reading sources while research runs, then attach Sources and
the covered range to the saved answer. A failed search can fall back to existing
verified evidence with a limitation label; otherwise offer Retry rather than a
confident unsourced recap. Saved citations remain attached after reload. Expanding
the scope or spoiler boundary requires explicit user action.

### Context and permissions

Personal recommendations may use the owner's library, ratings, and saved explicit
preferences. Room members separately opt in to Use my library for group suggestions,
off by default per room. The consent explains that viewing history and ratings may
inform suggestions sent to the AI provider, without sharing their complete list
with room members. Especially in small rooms, suggestions can let others infer
your tastes even when the response names no member. Guests contribute their stated preferences only.

Private notes and personal chat transcripts are excluded from room AI. Room replies
must not attribute a private rating or viewing status to a named member. Opting out
excludes that member's library from subsequent requests. Already posted messages
are not retroactively private; the host can remove a shared message.

Permission-scoped catalogue/taste data and retrieved public sources inform the model.
Search queries contain anime names and the requested range, never private library
contents, personal notes, account identities, invite links, or unrelated room chat.
Retrieved content is evidence, not instructions or permission to take actions. Verify anime
identities and hard constraints before displaying cards. Unknown or inconsistent
metadata is reported honestly. Do not invent availability, dub support, episode
counts, prerequisite completion, or reasons supposedly stated by a user. Responses
avoid spoilers and use premise-level descriptions except within an explicitly
confirmed recap range. AI cannot mutate libraries,
friendships, votes, room selection, or playback.

Room AI is invoked explicitly through Ask AI; normal human chat never generates
paid replies automatically. The Ask AI composer is clearly distinguished from
Send to room. Label AI composers Private · only you or Shared · visible to room.
Player shortcuts must ignore focused inputs and editable content. Announce meaningful
room changes in one throttled polite live region, and expose vote toggle state and
spoiler expansion accessibly. Allow one AI generation per conversation at a time; other members
see who requested it and can continue ordinary chat. Host permission changes apply
immediately to shared-room and guest catch-up requests, including canceling them
when AI is switched off. Account-owned personal AI remains independent of room settings.

AI failure, quota exhaustion, or missing configuration leaves rooms, manual search,
chat, voting, and playback usable. Show a specific recovery action, retain input,
and avoid duplicate answers or silent paid retries. Quotas apply to initiating
people/guest sessions as well as rooms and the whole app.

Proposed initial limits for approval: 20 AI turns per signed-in user per day, five
per guest session per day, 100 per room per day, and a USD 10 monthly app-wide AI
budget including search/fetch charges and model usage. Limits are deployment-configurable;
the model is pinned to GPT-6 Luna, without a model picker or alternative-model fallback. Credentials
remain server-side. Reaching a limit explains when access returns and offers manual
search. Long conversations remain saved but do not require resending all history.

## Important invariants and failure cases

- Every anime entering this feature has a MAL ID, including AI results and picks.
- Friend, room, guest, and personal-chat permissions are enforced server-side on
  reads, writes, and live updates; guessed IDs and expired credentials grant nothing.
- Mutations are retry-safe. Reconnection cannot duplicate chat, votes, friend
  requests, guest conversion, or paid AI generations.
- Selection changes invalidate stale playback commands and late AI results cannot
  overwrite newer room decisions. Simultaneous commands have one ordered outcome.
- Removal, session expiry, closure, and narrower access stop live subscriptions
  and remove inaccessible cached content, not just hide a button.
- Concurrent tabs for one participant have one playback-controller connection;
  a room must not play audio twice or create competing host heartbeats.
- A full room, revoked/expired link, lost friendship, removed member, absent host,
  rejected autoplay, unavailable source, and AI failure each have a dedicated state.
- Proposed room size is 20 connected participants. Capacity is enforced on admission
  and shown before joining; guests count toward it.

## Examples

1. Nas is already watching episode three. Watch together opens an invite-only room
   paused at Nas's current position. A guest joins by link, clicks Join playback,
   and follows the host’s controls. Both can text chat; only Nas can initially ask AI.
2. Friends open an empty room. One manually adds a movie; another requests AI after
   the host enables Everyone. Votes favor a series, but the host chooses the movie.
3. A user discusses recommendations privately, returns tomorrow, and continues the
   saved conversation. They send one anime card to a room without sharing their chat.
4. A host switches a public room to Friends-only. Nonfriends and guests lose access;
   the host sees who will be removed before confirming. Friends gain no access to
   any private library merely because they can join the room.
5. Friends choose season two. A member selects Catch me up, confirms a full-season-one
   recap, and receives a private sourced summary excluding season two. They can ask
   for individual episode explanations and explicitly share a collapsed recap with
   the group. A guest uses the same private flow if the host allows Everyone to ask AI.

## Review alternatives and implementation gates

The [Opus review and response](./opus-review.md) recommends manual room completion
instead of the 92% coverage subsystem, and potentially deferring Public rooms,
Everyone playback control, or guest-private catch-up. These are alternatives only; implement the approved scope and completion rule
above unless Nas explicitly selects a change.
The USD 10/month budget is the approved initial safety cap, not a promise of
capacity for 20 turns per user per day. Confirm it against measured turn costs.

Before implementation, settle private-profile username discoverability, declined
friend-request cooldown/block behavior, and any research-domain policy. Requests
need sender throttles regardless of those product choices. Friends discovery and
host-away control behavior above are explicit proposed defaults.

## Approval and implementation boundary

Approval of this draft authorizes implementation of this feature only. It does not
authorize commits, pushes, production deployment, production migrations, or enabling
public rooms/paid AI in production. UX walkthrough: [ux.html](./ux.html).
