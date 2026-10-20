# Source selection and room chat

Status: complete locally. Changes are recorded as separate conventional commits. No production push or deployment in this follow-up.

## Approved behavior

- One Source sheet contains providers and servers. Switching preserves the episode number, audio edition, and position. Load other providers on demand. Recover through servers, then providers, without looping through previously failed providers.
- Room source choices affect only the current viewer; the host still owns the shared episode and timeline.
- Chat remains ordinary chat unless a message contains a standalone, case-insensitive @AI mention. Typing @ suggests admitted members and AI when configured. Member tags remain chat messages. Ask AI entry points insert @AI and focus chat; there is no dialog.
- A shared AI bubble shows waiting dots and activity, then growing Markdown. The requester and host can stop it. Persist the final reply once, and enforce room permissions throughout generation.
- Host commands apply locally until acknowledged with a newer server playback anchor, preventing play/pause flicker.
- The mobile composer remains above bottom navigation, including while choosing an anime and in short viewports.

## Implementation

- Added source matching and recovery atoms, a unified source sheet, viewer-local source overrides, and source position restoration.
- Added migration 0021_room_ai_progress.sql. The API applies it on startup. Only in-flight text and activity are exposed in RoomState; completion clears them and saves a room message.
- Added the inline room composer, mention suggestions, explicit AI routing, and help text.
- Bounded mobile room layouts above navigation, let messages shrink and scroll, reduced the waiting-room introduction on mobile, and capped mobile room video height for short viewports.
- Added host playback intent reconciliation without changing the RPC contracts.

## Runtime evidence

- Real streaming service: AniKoto to KickAssAnime kept episode 1, Sub audio, and the 37-second position. A viewer changed sources while the host stayed on AniKoto. A media error injected at the video boundary recovered from KickAssAnime to AniKoto.
- Real OpenRouter, Postgres, and live room subscriptions: host and viewer both received activity and distinct partial text updates before one completed message. Stopping persisted a stopped generation and removed its pending state.
- Inline mention flow: selecting a member sent normal chat and did not add an AI generation. Selecting @AI showed three waiting dots and streamed a single completed generation to host and viewer without opening a dialog. Transient progress was cleared afterward.
- Mobile at 390x844: input bottom 780px, navigation top 787px. At 390x500: input bottom 436px, navigation top 443px. Both playing rooms and rooms with no selected anime passed. The waiting-room Ask AI button focused @AI in chat.
- Flicker reproduction delayed CommandRoomPlayback by 1.4 seconds on the real WebSocket connection. Before: play/pause/play for one Play click and pause/play/pause for one Pause click. After: exactly one corresponding event for each click, repeated twice.
- Parser regression tests cover exact episode/audio matching, unavailable sources, standalone AI tags, caret-local suggestions, email addresses, and member handles.

## Completion checks

- Root `bun typecheck`, `bun lint`, `bun run test` (128 passing tests), and `bun run build` passed after the final changes.
- Temporary local validation accounts, their rooms, and generation records were removed. Only the API and web processes started for this follow-up were stopped; pre-existing services were left running.
- Source selection, inline room AI/mobile chat, and playback flicker are recorded in separate conventional commits.
- Nothing remains for local implementation. Push/deployment requires a separate instruction.

## Limits

- Browser viewport and keyboard-height checks use Chromium; an actual iOS keyboard was not exercised.
- No production validation or deployment has been performed for these changes.
