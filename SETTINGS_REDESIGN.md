# Settings Dialog Redesign — Implementation Plan

This document is a step-by-step spec for redesigning the settings dialog in
`apps/web/src/features/settings/`. Follow the steps in order. Every step lists
the exact files to touch and the shape of the code to write.

## Goals

1. **Consolidate sections** — 12 sidebar entries (2 of which are unimplemented
   placeholders) collapse to 6 real sections.
2. **Add search** — one input in the dialog header filters *both* the sidebar
   and the individual setting cards inside the active panel.
3. **Redesign the sessions list** — it currently renders a raw `userAgent`
   string and looks unfinished.
4. **Align the header buttons** — "Sign out" and the dialog close button
   currently sit at different heights on different rows.
5. **Fix the settings trigger icon** — the sidebar and mobile nav use lucide's
   `Settings2` (sliders); it should be `Settings` (gear).

## Ground rules

- Project rule (`CLAUDE.md`): **do not add comments** unless they explain
  something non-obvious. Nothing in this plan needs a comment.
- Project rule (`AGENTS.md`): never hand-fix formatting/lint. Run `bun format`,
  then `bun lint:fix`, then verify with `bun typecheck` and `bun lint` **from
  the repo root**.
- Memory rule: prefer deriving state with atoms over `useState`/`useMemo`/
  `useEffect`. The search query is UI-local and belongs in an atom
  (`settingsQueryAtom`) so the sidebar and panels can both read it without prop
  drilling.
- Do not invent new UI primitives. Everything needed already exists in
  `packages/ui/src/components/`: `alert-dialog`, `badge`, `button`, `dialog`,
  `empty`, `field`, `input`, `input-group`, `separator`, `switch`, `tooltip`,
  `toggle-group`.

---

## Current state (read this before editing)

Files in `apps/web/src/features/settings/`:

| File | Role |
| --- | --- |
| `settings-dialog.tsx` | Dialog shell, `sections` array, sidebar, mobile chip row, panel switch |
| `atoms.ts` | `SettingsSection` schema, `settingsOpenAtom`, `settingsSectionAtom`, `oauthResultAtom` |
| `settings-shared.tsx` | `PanelCard`, `AuthRequired` |
| `account-panel.tsx` | Identity + Access cards, change password, delete account |
| `profile-panel.tsx` | Banner, avatar, username, bio |
| `privacy-panel.tsx` | Private profile toggle + 3 sharing toggles |
| `appearance-panel.tsx` | Theme toggle group (single card) |
| `site-panel.tsx` | Anime title language toggle group (single card) |
| `player-panel.tsx` | 5 switch cards + subtitle appearance card |
| `history-panel.tsx` | View history card + clear history card |
| `sessions-panel.tsx` | Session list + revoke |
| `passkeys-panel.tsx` | Add passkey form + passkey rows |

External callers of `settingsSectionAtom` (these must keep working):

- `apps/web/src/features/layout/app-sidebar.tsx:181` → `setSettingsSection("Account")`
- `apps/web/src/features/layout/mobile-nav.tsx:215` → `setSettingsSection("Account")`
- `apps/web/src/features/profile/profile-page.tsx:138` → `openSettings("Profile")`
- `apps/web/src/features/profile/profile-page.tsx:142` → `openSettings("Privacy")`

---

## Step 1 — Decide the new section map

New sections (6). `Subtitles` and `Notifications` are **deleted** — they only
ever rendered `PlaceholderPanel`, which is also deleted.

| New section | Absorbs | Panel component |
| --- | --- | --- |
| `Account` | old Account + Sessions + Passkeys | `account-panel.tsx` |
| `Profile` | old Profile + Privacy | `profile-panel.tsx` |
| `Appearance` | old Appearance + Site | `appearance-panel.tsx` |
| `Playback` | old Player + Subtitles | `playback-panel.tsx` (renamed from `player-panel.tsx`) |
| `Integrations` | old Integrations (trimmed) | `integrations-panel.tsx` |
| `History` | old History | `history-panel.tsx` |

Section metadata to use verbatim:

```ts
Account       Settings2  "Identity, password, sessions, and passkeys."
Profile       User       "Public profile, avatar, bio, and visibility."
Appearance    Palette    "Theme and site-wide display preferences."
Playback      Play       "Player defaults and subtitle appearance."
Integrations  Link2      "MyAnimeList and AniList connections."
History       History    "Watch history and resume positions."
```

`Privacy` must keep working as an entry point. Handle it with an alias map, not
by keeping the section (Step 3).

---

## Step 2 — Build the search registry

**New file: `apps/web/src/features/settings/settings-registry.ts`**

This is the single source of truth for what is searchable. Every card rendered
in any panel gets an entry here. The sidebar uses it to decide which sections
survive a query; the panels use it to decide which cards survive.

```ts
import type { LucideIcon } from "lucide-react"
import {
  History,
  KeyRound,
  Link2,
  Palette,
  Play,
  Settings2,
  User,
} from "lucide-react"
import type { SettingsSection } from "./atoms"

export type SettingEntry = {
  id: string
  section: SettingsSection
  title: string
  keywords: ReadonlyArray<string>
}

export type SettingsSectionDef = {
  title: SettingsSection
  icon: LucideIcon
  description: string
}

export const settingsSections: ReadonlyArray<SettingsSectionDef> = [ /* Step 1 table */ ]

export const settingEntries: ReadonlyArray<SettingEntry> = [ /* below */ ]
```

Entries to register (`id` values are used as the `id` prop on each card, so
they must match exactly):

**Account**
- `account.identity` — "Identity" — `["username", "email", "handle"]`
- `account.access` — "Access" — `["login method", "session expires", "last used"]`
- `account.password` — "Change password" — `["password", "credentials", "security"]`
- `account.sessions` — "Active sessions" — `["devices", "sign out everywhere", "revoke", "logout"]`
- `account.passkeys` — "Passkeys" — `["webauthn", "biometric", "touch id", "face id", "passwordless"]`
- `account.delete` — "Delete account" — `["remove", "danger", "permanent", "close account"]`

**Profile**
- `profile.banner` — "Profile banner" — `["cover", "header", "image"]`
- `profile.avatar` — "Profile picture" — `["avatar", "photo", "image"]`
- `profile.username` — "Username" — `["handle", "display name"]`
- `profile.bio` — "Bio" — `["about", "description"]`
- `profile.visibility` — "Profile visibility" — `["private", "public", "hidden"]`
- `profile.sharing` — "What visitors can see" — `["statistics", "activity", "anime list", "share"]`

**Appearance**
- `appearance.theme` — "Theme" — `["dark", "light", "system", "colour", "color"]`
- `appearance.titleLanguage` — "Anime title language" — `["romaji", "english", "naming"]`

**Playback**
- `playback.autoplay` — "Autoplay episodes" — `["auto play", "start"]`
- `playback.autoNext` — "Auto next episode" — `["next", "continue", "queue"]`
- `playback.autoSkipIntro` — "Auto skip intro" — `["opening", "op", "skip"]`
- `playback.autoSkipOutro` — "Auto skip outro" — `["ending", "ed", "skip"]`
- `playback.syncOnFinish` — "External list sync" — `["mal", "anilist", "sync", "progress"]`
- `playback.subtitles` — "Subtitle appearance" — `["captions", "font", "size", "cc", "text"]`

**Integrations**
- `integrations.mal` — "MyAnimeList" — `["mal", "myanimelist", "connect", "import", "sync"]`
- `integrations.anilist` — "AniList" — `["anilist", "al", "connect", "import", "sync"]`

**History**
- `history.watch` — "Watch history" — `["episodes", "resume", "continue watching"]`
- `history.clear` — "Clear watch history" — `["delete", "wipe", "reset"]`

Add two helpers in the same file:

```ts
export const matchesQuery = (entry: SettingEntry, query: string): boolean => { ... }
export const sectionMatchesQuery = (section: SettingsSectionDef, query: string): boolean => { ... }
```

Matching rules:
- Normalize with `.trim().toLowerCase()`. An empty query matches everything.
- Split the query on whitespace into terms; **every** term must hit.
- A term hits an entry if it is a substring of `entry.title.toLowerCase()`, of
  any keyword, or of `entry.section.toLowerCase()`.
- A term hits a section if it is a substring of the section title or
  description, **or** if any entry in that section matches the full query.

---

## Step 3 — Update `atoms.ts`

1. Narrow the `SettingsSection` literal to the 6 new names:

```ts
export const SettingsSection = Schema.Literal(
  "Account",
  "Profile",
  "Appearance",
  "Playback",
  "Integrations",
  "History"
)
```

2. Add an alias map + resolver so old entry points keep working:

```ts
const sectionAliases: Record<string, SettingsSection> = {
  Privacy: "Profile",
  Site: "Appearance",
  Player: "Playback",
  Subtitles: "Playback",
  Sessions: "Account",
  Passkeys: "Account",
  Notifications: "Account",
}

export const resolveSettingsSection = (value: string): SettingsSection => ...
```

3. Make `settingsSectionAtom` a writable atom that runs incoming writes through
   `resolveSettingsSection`, so `setSettingsSection("Privacy")` from
   `profile-page.tsx` lands on `Profile` without touching that file. Use
   `Atom.writable` over a base `Atom.make<SettingsSection>("Account")`; the
   write function coerces the value before `ctx.setSelf`.

4. Add the query atom:

```ts
export const settingsQueryAtom = Atom.make("")
```

5. In `oauthResultAtom`, keep `get.set(settingsSectionAtom, "Integrations")` —
   still a valid section.

6. Selecting a section from the sidebar must clear the query
   (`settingsQueryAtom` → `""`) so the user isn't left staring at a filtered
   panel. Do this in the click handler in `settings-dialog.tsx`, not in the atom.

---

## Step 4 — Rework `settings-shared.tsx`

Replace `PanelCard` with a search-aware `SettingCard`. Keep `PanelCard`
exported as-is only if some other feature imports it — check with
`grep -rn "PanelCard" apps packages` first; if nothing outside
`features/settings` uses it, delete it and migrate all call sites.

```tsx
export function SettingCard({
  id,
  className,
  children,
}: {
  id: string
  className?: string
  children: ReactNode
}) {
  const query = useAtomValue(settingsQueryAtom)
  const entry = settingEntries.find((candidate) => candidate.id === id)

  if (entry && !matchesQuery(entry, query)) return null

  return (
    <section
      data-setting-id={id}
      className={cn("rounded-2xl border bg-background/60 p-4 md:p-5", className)}
    >
      {children}
    </section>
  )
}
```

Also add, in the same file:

```tsx
export function SettingHeading({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) { ... }
```

Renders `<h3 className="font-semibold">` + optional muted description, with
`action` right-aligned via `flex flex-wrap items-start justify-between gap-4`.
Every panel should use this instead of hand-rolling the same markup — this is
where most of the "looks nicer" consistency comes from.

And an empty state for when a query filters everything out of a panel:

```tsx
export function NoSettingsMatch({ query }: { query: string }) { ... }
```

Uses `Empty` / `EmptyHeader` / `EmptyMedia variant="icon"` with a `SearchX`
icon, title `No settings match "{query}"`.

Keep `AuthRequired` unchanged.

---

## Step 5 — Rebuild `settings-dialog.tsx`

### 5a. Header layout (fixes the alignment complaint)

The problem today: `DialogContent` has `showCloseButton` (absolutely positioned
at `top-4 right-4`, `size="icon-sm"` = `h-8`) while "Sign out" is a default
`h-9` button inside the header flex row, padded away by `pr-16`. They never
line up.

Fix: turn the built-in close button off and render both buttons in the same
flex row.

```tsx
<DialogContent
  showCloseButton={false}
  className="h-[calc(100svh-1rem)] max-w-[calc(100%-1rem)] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden rounded-2xl p-0 md:h-[calc(100svh-4rem)] md:max-h-192 md:max-w-6xl"
>
  <DialogHeader className="gap-0 border-b p-4">
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <DialogTitle className="text-lg">Settings</DialogTitle>
        <DialogDescription className="mt-1">
          Manage your AnimeKaiser experience.
        </DialogDescription>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {user ? (
          <Button size="sm" variant="destructive" disabled={logoutPending} onClick={() => void logout()}>
            <LogOut data-icon="inline-start" />
            Sign out
          </Button>
        ) : (
          <Button asChild size="sm" variant="outline">
            <Link to="/login" search={{ redirect: undefined }}>Login</Link>
          </Button>
        )}
        <DialogClose asChild>
          <Button size="icon-sm" variant="ghost" className="bg-secondary">
            <XIcon />
            <span className="sr-only">Close</span>
          </Button>
        </DialogClose>
      </div>
    </div>
    {/* search input, Step 5b */}
  </DialogHeader>
```

Key points:
- `size="sm"` on Sign out (`h-8`) matches `size="icon-sm"` close (`size-8`).
- `items-center` on the shared wrapper puts them on one baseline.
- Drop `pr-16` from the header — nothing is absolutely positioned any more.
- Import `DialogClose` from `@animekaiser/ui/components/dialog` and `XIcon`
  from `lucide-react`.

### 5b. Search input

Directly under the title row, inside `DialogHeader`:

```tsx
<div className="relative mt-4">
  <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
  <Input
    value={query}
    onChange={(event) => setQuery(event.target.value)}
    placeholder="Search settings…"
    className="h-9 pl-9"
    aria-label="Search settings"
  />
  {query ? (
    <Button
      size="icon-xs"
      variant="ghost"
      className="absolute top-1/2 right-2 -translate-y-1/2"
      onClick={() => setQuery("")}
    >
      <XIcon />
      <span className="sr-only">Clear search</span>
    </Button>
  ) : null}
</div>
```

Wire `const [query, setQuery] = useAtom(settingsQueryAtom)`.

If `apps/web/src/components/icon-input.tsx` (currently untracked in git status)
already does icon-prefixed inputs, **use it instead** of the hand-rolled
`relative`/`absolute` markup above. Read it first and match its API.

### 5c. Filtered sidebar

```tsx
const visibleSections = settingsSections.filter((section) =>
  sectionMatchesQuery(section, query)
)
```

- Render `visibleSections` in both the desktop `<aside>` nav and the mobile chip
  row. Keep the existing class names for both — they already look fine.
- When `query` is non-empty and `visibleSections` is non-empty but the active
  section is not in it, auto-select `visibleSections[0]` so the content pane is
  never blank. Derive this at render time; do **not** reach for `useEffect`.
  The simplest correct form:

  ```tsx
  const selected =
    visibleSections.find((section) => section.title === active) ??
    visibleSections[0] ??
    settingsSections[0]
  ```

  and render `<SectionContent section={selected.title} … />` rather than
  `active`. `active` stays untouched so clearing the query restores the user's
  real selection.
- If `visibleSections` is empty, render `<NoSettingsMatch query={query} />` in
  the main pane and hide the nav.
- Sidebar/chip click handler: `setActive(section.title)` **and** `setQuery("")`.

### 5d. Panel switch

Delete `PlaceholderPanel` entirely. The switch becomes exhaustive:

```tsx
if (section === "Account")
  return <AccountPanel user={user} sessionExpiresAt={session?.session.expiresAt ?? null} />
if (section === "Profile") return <ProfilePanel user={user} />
if (section === "Appearance") return <AppearancePanel />
if (section === "Playback") return <PlaybackPanel />
if (section === "Integrations") return <IntegrationsPanel user={user} />
return <HistoryPanel />
```

Delete the now-unused imports (`PrivacyPanel`, `SitePanel`, `SessionsPanel`,
`PasskeysPanel`, `PlayerPanel`) and the unused lucide icons (`Bell`,
`Captions`, `Globe`, `KeyRound`, `Monitor`, `Shield`).

### 5e. Per-panel empty state

Each panel renders a list of `SettingCard`s that self-hide. When a query hides
all of them the panel looks broken. Handle this generically in
`settings-dialog.tsx` rather than in every panel: compute

```tsx
const sectionHasMatch = settingEntries.some(
  (entry) => entry.section === selected.title && matchesQuery(entry, query)
)
```

and render `<NoSettingsMatch query={query} />` instead of `<SectionContent … />`
when `query` is non-empty and `sectionHasMatch` is false.

---

## Step 6 — Merge Sessions + Passkeys into `account-panel.tsx`

`account-panel.tsx` becomes the largest panel. Extract the two absorbed
sections into their own components in their own files so it stays readable, and
have `AccountPanel` compose them:

```
account-panel.tsx      → identity, access, password, <SessionsSection />, <PasskeysSection />, delete
sessions-panel.tsx     → export function SessionsSection() (no `user` prop; it renders inside AccountPanel which already gated on user)
passkeys-panel.tsx     → export function PasskeysSection()
```

Order inside `AccountPanel`:

1. `SettingCard id="account.identity"` and `id="account.access"` — keep the
   existing `xl:grid-cols-2` grid, but note the grid wrapper must not be a
   `SettingCard` (the two children filter independently). Wrap them in a plain
   `<div className="grid gap-4 xl:grid-cols-2">`.
2. `SettingCard id="account.password"` — unchanged content.
3. `SettingCard id="account.sessions"` → `<SessionsSection />`.
4. `SettingCard id="account.passkeys"` → `<PasskeysSection />`.
5. `SettingCard id="account.delete" className="border-destructive/30"` —
   unchanged content.

Both new sections drop their `AuthRequired` guard (the parent already returns
`<AuthRequired />` when `user` is null) and drop their outer
`flex flex-col gap-4` wrapper, since `SettingCard` provides the box.

---

## Step 7 — Redesign the sessions list

This is the "it looks ugly" fix. Current output is a raw UA string like
`Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 …`.

### 7a. Add a user-agent formatter

**New file: `apps/web/src/features/settings/user-agent.ts`**

```ts
import type { LucideIcon } from "lucide-react"
import { Laptop, Smartphone, Tablet } from "lucide-react"

export type DeviceInfo = {
  icon: LucideIcon
  label: string
  detail: string
}

export const describeUserAgent = (userAgent: string | null | undefined): DeviceInfo => ...
```

Implementation notes — plain regex matching, no new dependency:

- **Device kind**: `/iPad|Tablet/i` → `Tablet`; `/Mobi|iPhone|Android/i` →
  `Smartphone`; otherwise `Laptop`.
- **Browser**: check in this order (order matters, UAs lie):
  `Edg/` → "Edge", `OPR/|Opera` → "Opera", `Chrome/` → "Chrome",
  `Safari/` → "Safari", `Firefox/` → "Firefox". Fall back to "Unknown browser".
- **OS**: `Windows NT` → "Windows", `Mac OS X` → "macOS" (but if the device is
  a phone/tablet on an Apple UA → "iOS"/"iPadOS"), `Android` → "Android",
  `Linux` → "Linux". Fall back to "Unknown OS".
- `label` = `"{browser} on {os}"`, `detail` = the OS family alone. If
  `userAgent` is null/empty return
  `{ icon: Laptop, label: "Unknown device", detail: "" }`.

### 7b. Mark the current session

`authClient.listSessions()` returns every session including the current one.
The current session token is available from the session result already loaded
in `settings-dialog.tsx` (`session.session.token`). Thread it in: `AccountPanel`
already receives `sessionExpiresAt`; add a `currentSessionToken: string | null`
prop alongside it (source it in `settings-dialog.tsx` from
`session?.session.token ?? null`) and pass it to `<SessionsSection />`.

Sort so the current session is first, then by `createdAt` descending.

### 7c. New row markup

```tsx
<div className="flex items-center gap-3 rounded-xl border bg-card/40 p-3">
  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
    <device.icon className="size-5" />
  </div>
  <div className="min-w-0 flex-1">
    <div className="flex flex-wrap items-center gap-2">
      <p className="truncate font-medium">{device.label}</p>
      {isCurrent ? <Badge variant="secondary">This device</Badge> : null}
    </div>
    <p className="mt-0.5 truncate text-sm text-muted-foreground">
      {item.ipAddress || "Unknown IP"} · Signed in {relative(item.createdAt)}
    </p>
  </div>
  {isCurrent ? null : (
    <Button size="icon-sm" variant="ghost" className="shrink-0 text-muted-foreground hover:text-destructive" disabled={pending === item.token} onClick={() => void revoke(item.token)}>
      <LogOut />
      <span className="sr-only">Revoke session</span>
    </Button>
  )}
</div>
```

- Container: `<div className="flex flex-col gap-2">` — separate rounded cards
  with gaps, **not** the current `divide-y` slab. That is the single biggest
  visual improvement.
- Wrap the revoke button in a `Tooltip` with content "Revoke session".
- `relative(date)` — a small local helper using `Intl.RelativeTimeFormat`,
  falling back to `toLocaleDateString()` for anything older than ~30 days.
  Put it in `apps/web/src/utils/` if a date helper module already exists there
  (check with `ls apps/web/src/utils`); otherwise keep it local to
  `sessions-panel.tsx`.
- Header: use `SettingHeading` with title "Active sessions", description
  "Devices currently signed in to your account.", and `action` = a
  "Sign out everywhere else" button (`size="sm"`, `variant="outline"`).
  Disable it when there is only one session.
- Wrap "Sign out everywhere else" in an `AlertDialog` confirm instead of firing
  immediately — it is destructive and currently has no confirmation.
- Empty state: `Empty` component with a `MonitorOff` icon rather than the
  current bare `<p>`.

### 7d. Passkey rows

Apply the same treatment in `PasskeysSection`, so the two lists look like
siblings:

- Same `flex flex-col gap-2` + individual `rounded-xl border bg-card/40 p-3`
  rows, `KeyRound` in a `size-10 rounded-lg bg-muted` tile.
- Replace the inline always-editable rename form with: name as static text, and
  a two-button trailing group — `Pencil` (icon-sm ghost) toggling an inline
  `Input`, and `Trash2` (icon-sm ghost, destructive on hover).
- Replace `window.confirm("Remove this passkey?")` with an `AlertDialog`.
- Keep the "Add passkey" form, but move it above the list inside the same
  `SettingCard`, separated by a `Separator`.

---

## Step 8 — Merge Privacy into `profile-panel.tsx`

- Add `id` props to the four existing cards: `profile.banner`, `profile.avatar`,
  `profile.username`, `profile.bio` (converting `PanelCard` → `SettingCard`).
- Move the whole body of `privacy-panel.tsx` in as two more cards at the bottom:
  `profile.visibility` (the private-profile switch) and `profile.sharing` (the
  three sharing switches).
- `ProfilePanel` keeps its `user` prop; the privacy body needs `ownProfileAtom`,
  `updatePrivacyAtom`, `profileReactivityKeys`, `useRouter` — copy those imports
  across.
- The privacy body also renders `<DataError onRetry={refreshProfile} />` on
  failure. Do **not** early-return the whole panel on profile-load failure any
  more — that would blank out the avatar/username cards too. Render the
  `DataError` inside the `profile.visibility` card only.
- Delete `privacy-panel.tsx`.

---

## Step 9 — Merge Site into `appearance-panel.tsx`

- `AppearancePanel` returns `<div className="flex flex-col gap-4">` with two
  `SettingCard`s: `appearance.theme` (existing theme toggle group) and
  `appearance.titleLanguage` (the entire body of `site-panel.tsx`).
- Both use `SettingHeading` with the toggle group passed as `action`.
- Delete `site-panel.tsx`.

---

## Step 10 — Rename Player → Playback

- `git mv apps/web/src/features/settings/player-panel.tsx apps/web/src/features/settings/playback-panel.tsx`
- Rename the export `PlayerPanel` → `PlaybackPanel`.
- The 5 switch rows currently render as 5 separate full-width cards, which is
  noisy. Collapse them into **one** card per row is wrong for search (each row
  has its own registry id), so instead: keep one `SettingCard` per row but
  tighten them to `p-4` and use a compact two-line layout. Register ids exactly
  as listed in Step 2 (`playback.autoplay`, `playback.autoNext`,
  `playback.autoSkipIntro`, `playback.autoSkipOutro`, `playback.syncOnFinish`).
  Map the existing `preferenceRows[].key` → registry id with a lookup on the
  row definition (add an `id` field to each `preferenceRows` entry).
- Subtitle card gets `id="playback.subtitles"`.

---

## Step 11 — Trim the Integrations panel

Requested: "remove some sections, combine small sections into one".

- **Remove** the standalone "View sync activity" button at the top. Move it
  into each provider card's action row (next to Import/Disconnect) — or, if
  you prefer one link, put it in the panel footer as a plain text link. Prefer
  the footer link; the top-left orphan button is the ugly part.
- **Collapse the token-expiry block.** Today `account.expiresAt` renders a
  `Separator` plus a full-width paragraph. Instead surface it as muted text
  appended to the status line, e.g. `Connected · expires 12 Mar 2026`. Delete
  the `Separator` and the redundant nested `account.expiresAt ?` check on
  line 160 (it is already inside a truthy check on line 157).
- Give each provider card `id={`integrations.${account.provider}`}` so it maps
  to `integrations.mal` / `integrations.anilist`.
- Keep the avatar + badge header — that part already looks good.
- Replace `toast.success(\`Import queued: ${job.id}\`)` with
  `toast.success("Import queued.")`. Surfacing a raw job id to users is noise.

---

## Step 12 — History panel

Minimal changes: `PanelCard` → `SettingCard` with ids `history.watch` and
`history.clear`, and swap the hand-rolled headings for `SettingHeading`.

---

## Step 13 — Swap the settings trigger icon to a gear

Both settings entry points currently use lucide's `Settings2`, which renders as
**sliders**, not a gear. Switch them to `Settings` (the gear/cog).

`Settings` and `Settings2` are both lucide exports with confusingly similar
names — make sure the import is `Settings`, not `Settings2` or `Cog`.

**`apps/web/src/features/layout/app-sidebar.tsx`**

- Line ~41: change the import `Settings2,` → `Settings,` in the `lucide-react`
  import block. Keep the block alphabetically sorted — `Settings` sorts before
  `Shuffle`/`Sparkles`, so the position is unchanged.
- Line ~290: inside the `FooterTooltip label="Settings"` button, change
  `<Settings2 />` → `<Settings />`.

**`apps/web/src/features/layout/mobile-nav.tsx`**

- Line ~30: same import swap.
- Line ~306: `<Settings2 data-icon="inline-start" />` →
  `<Settings data-icon="inline-start" />`. Keep the `data-icon` attribute — it
  drives the button's asymmetric padding.

**`apps/web/src/features/settings/settings-registry.ts`**

The Account section's icon (Step 1 table) is also `Settings2`. Leave it as
`Settings2` there — that is a *section* icon inside the dialog, not the trigger,
and keeping it distinct from the gear that opened the dialog avoids showing the
same icon twice on screen. If you would rather they match, changing it is
harmless; just change it in one place.

**`apps/web/src/features/settings/settings-dialog.tsx`**

`Settings2` was also imported for `PlaceholderPanel`, which Step 5d deletes.
Drop the import entirely from this file unless the section header still uses it.

Verify nothing else references the old icon:

```
grep -rn "Settings2" apps packages
```

---

## Step 14 — Clean up

Delete these files once nothing imports them:

- `apps/web/src/features/settings/privacy-panel.tsx`
- `apps/web/src/features/settings/site-panel.tsx`

Verify with `grep -rn "privacy-panel\|site-panel\|PlaceholderPanel\|PanelCard" apps packages`.

---

## Step 15 — Verify

From the **repo root**:

```
bun format
bun lint:fix
bun typecheck
bun lint
```

Then check `tests/e2e/` for anything that drives the settings dialog:

```
grep -rn "Settings\|Sessions\|Passkeys\|Privacy" tests/e2e
```

Update any selector that targets a removed sidebar entry (`Privacy`, `Site`,
`Player`, `Subtitles`, `Notifications`, `Sessions`, `Passkeys`).

### Manual QA checklist

- [ ] Sidebar shows exactly 6 entries; no placeholder panels remain.
- [ ] Typing `passkey` filters the sidebar to Account and shows only the
      passkeys card.
- [ ] Typing `dark` jumps to Appearance and shows only the Theme card.
- [ ] Typing `zzzz` shows the "no settings match" empty state, not a blank pane.
- [ ] Clicking a sidebar entry clears the query.
- [ ] Clearing the query restores the previously selected section.
- [ ] "Sign out" and the close button are the same height and vertically
      centered, on desktop and mobile widths.
- [ ] Sessions list shows friendly device names, a "This device" badge, and no
      revoke button on the current session.
- [ ] "Sign out everywhere else" asks for confirmation.
- [ ] Profile page "Privacy" button still opens settings on the Profile section
      (alias resolution works).
- [ ] OAuth callback still deep-links to Integrations.
- [ ] Mobile chip row filters alongside the sidebar.
- [ ] Sidebar footer settings button shows a gear, not sliders.
- [ ] Mobile nav settings button shows a gear, and its icon spacing is
      unchanged (the `data-icon="inline-start"` attribute survived).
