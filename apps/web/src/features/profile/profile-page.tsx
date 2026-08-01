import type {
  OwnProfile,
  ProfileActivityStats,
  ProfileLibraryStats,
} from "@animekaiser/domain"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@animekaiser/ui/components/avatar"
import { Badge } from "@animekaiser/ui/components/badge"
import { Button } from "@animekaiser/ui/components/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@animekaiser/ui/components/empty"
import { Skeleton } from "@animekaiser/ui/components/skeleton"
import {
  Result,
  useAtomRefresh,
  useAtomSet,
  useAtomValue,
} from "@effect-atom/atom-react"
import { Link, Navigate } from "@tanstack/react-router"
import {
  Bookmark,
  Eye,
  EyeOff,
  History,
  LockKeyhole,
  LogOut,
  Settings2,
  UserRoundX,
} from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { DataError } from "../../components/data-error"
import { authClient, navigateAfterAuthChange } from "../../services/api-clients"
import { errorMessage } from "../../utils/error"
import { sessionAtom } from "../auth/atoms"
import { displayUsername } from "../auth/user"
import { settingsOpenAtom, settingsSectionAtom } from "../settings/atoms"
import {
  ownProfileAtom,
  ownProfileStatsAtom,
  publicProfileAtom,
  publicProfileStatsAtom,
} from "./atoms"
import { ProfileStatsSections } from "./profile-stats"

const initials = (username: string | null) =>
  (username || "?").slice(0, 2).toUpperCase()

function ProfileHeader({
  data,
  own,
  viewingAsPublic,
  stats,
}: {
  data: OwnProfile
  own: boolean
  viewingAsPublic: boolean
  stats: ProfileLibraryStats | null
}) {
  const setSettingsSection = useAtomSet(settingsSectionAtom)
  const setSettingsOpen = useAtomSet(settingsOpenAtom)
  const username = data.user.username ?? "Unknown user"

  const openSettings = (section: "Profile" | "Privacy") => {
    setSettingsSection(section)
    setSettingsOpen(true)
  }

  return (
    <header className="relative isolate overflow-hidden rounded-3xl bg-black ring-1 ring-white/10">
      <div className="relative h-40 w-full overflow-hidden md:h-56">
        {data.profile.bannerUrl ? (
          <img
            src={data.profile.bannerUrl}
            alt=""
            className="size-full object-cover"
          />
        ) : (
          <div className="size-full bg-[radial-gradient(circle_at_15%_0%,var(--color-primary)/25,transparent_45%),radial-gradient(circle_at_85%_10%,var(--color-chart-2)/25,transparent_45%),linear-gradient(135deg,#18181b,#09090b_60%,#27272a)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-transparent" />
      </div>

      <div className="relative -mt-14 flex flex-col gap-4 p-4 md:-mt-16 md:flex-row md:items-end md:justify-between md:p-6">
        <div className="flex min-w-0 items-end gap-4">
          <Avatar className="size-24 shrink-0 ring-4 ring-black md:size-28">
            <AvatarImage src={data.user.image ?? undefined} alt={username} />
            <AvatarFallback className="text-xl">
              {initials(username)}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 pb-1">
            <h1 className="truncate font-heading text-2xl font-black tracking-tight text-white md:text-4xl">
              {username}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {data.profile.private ? (
                <Badge variant="secondary">
                  <LockKeyhole data-icon="inline-start" />
                  Private
                </Badge>
              ) : null}
              {own && !viewingAsPublic && username !== "Unknown user" ? (
                <Link
                  to="/u/$username"
                  params={{ username }}
                  search={{ as: "public" }}
                  className="text-xs font-medium text-primary underline-offset-4 hover:underline"
                >
                  View as public
                </Link>
              ) : null}
              {stats ? (
                <>
                  <Badge variant="secondary">
                    {stats.totalTitles.toLocaleString()} titles
                  </Badge>
                  <Badge variant="secondary">
                    {stats.episodesWatched.toLocaleString()} episodes
                  </Badge>
                </>
              ) : null}
            </div>
          </div>
        </div>

        {own ? (
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button variant="secondary" onClick={() => openSettings("Profile")}>
              <Settings2 data-icon="inline-start" />
              Edit profile
            </Button>
            <Button variant="outline" onClick={() => openSettings("Privacy")}>
              <EyeOff data-icon="inline-start" />
              Sharing
            </Button>
            <SignOutButton />
          </div>
        ) : null}
      </div>

      {data.profile.description ? (
        <div className="px-4 pb-5 md:px-6 md:pb-6">
          <p className="max-w-3xl text-sm leading-7 text-white/70">
            {data.profile.description}
          </p>
        </div>
      ) : null}
    </header>
  )
}

function ProfileLayout({
  data,
  own,
  viewingAsPublic = false,
  stats,
  activity,
  statsHidden,
}: {
  data: OwnProfile
  own: boolean
  viewingAsPublic?: boolean
  stats: ProfileLibraryStats | null
  activity: ProfileActivityStats | null
  statsHidden: boolean
}) {
  const username = data.user.username ?? "Unknown user"

  return (
    <>
      <title>{`${username} | AnimeKaiser`}</title>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 pb-10 md:p-6">
        {viewingAsPublic ? <PublicPreviewBanner username={username} /> : null}
        <ProfileHeader
          data={data}
          own={own}
          viewingAsPublic={viewingAsPublic}
          stats={stats}
        />

        <div className="flex flex-wrap gap-2">
          {own && !viewingAsPublic ? (
            <>
              <Button asChild variant="outline" size="sm">
                <Link
                  to="/my-list"
                  search={{ status: "all", sort: "updated_desc", page: 1 }}
                >
                  <Bookmark data-icon="inline-start" />
                  My list
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/watch-history" search={{ page: 1 }}>
                  <History data-icon="inline-start" />
                  Watch history
                </Link>
              </Button>
            </>
          ) : null}
          {username !== "Unknown user" && data.profile.shareList ? (
            <Button asChild variant="outline" size="sm">
              <Link
                to="/list/$username"
                params={{ username }}
                search={{ status: "all", sort: "updated_desc", page: 1 }}
              >
                <Bookmark data-icon="inline-start" />
                {own && !viewingAsPublic ? "Shared list" : "View list"}
              </Link>
            </Button>
          ) : null}
        </div>

        {stats || activity ? (
          <ProfileStatsSections stats={stats} activity={activity} />
        ) : statsHidden ? (
          <Empty className="border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <EyeOff />
              </EmptyMedia>
              <EmptyTitle>Statistics are not shared</EmptyTitle>
              <EmptyDescription>
                This user has chosen to keep their statistics private.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <StatsPending />
        )}
      </div>
    </>
  )
}

export function OwnProfilePage() {
  const result = useAtomValue(ownProfileAtom)
  const refresh = useAtomRefresh(ownProfileAtom)
  const statsResult = useAtomValue(ownProfileStatsAtom)

  const stats = Result.builder(statsResult)
    .onSuccess((value) => value)
    .orNull()

  return Result.builder(result)
    .onInitialOrWaiting(() => <ProfilePendingPage />)
    .onFailure(() => (
      <div className="mx-auto w-full max-w-7xl p-4 md:p-6">
        <DataError onRetry={refresh} />
      </div>
    ))
    .onSuccess((data) => (
      <ProfileLayout
        data={data}
        own
        stats={stats}
        activity={stats}
        statsHidden={false}
      />
    ))
    .render()
}

export function PublicProfilePage({
  username,
  asPublic = false,
}: {
  username: string
  asPublic?: boolean
}) {
  const atom = publicProfileAtom({ username, asPublic })
  const result = useAtomValue(atom)
  const refresh = useAtomRefresh(atom)
  const statsResult = useAtomValue(
    publicProfileStatsAtom({ username, asPublic })
  )
  const sessionResult = useAtomValue(sessionAtom)

  const viewerUsername = Result.builder(sessionResult)
    .onSuccess((session) =>
      session?.user ? displayUsername(session.user) : null
    )
    .orNull()

  const isSelf =
    viewerUsername !== null &&
    viewerUsername.toLowerCase() === username.toLowerCase()

  if (isSelf && !asPublic) return <Navigate to="/profile" replace />

  const stats = Result.builder(statsResult)
    .onSuccess((value) => value)
    .orNull()

  const statsResolved = Result.builder(statsResult)
    .onSuccess(() => true)
    .orElse(() => false)

  return Result.builder(result)
    .onInitialOrWaiting(() => <ProfilePendingPage />)
    .onFailure(() => (
      <div className="mx-auto w-full max-w-7xl p-4 md:p-6">
        <DataError onRetry={refresh} />
      </div>
    ))
    .onSuccess((data) => {
      if (data.type !== "public") {
        return <ProfileUnavailable type={data.type} username={username} />
      }

      return (
        <ProfileLayout
          data={data}
          own={false}
          viewingAsPublic={asPublic}
          stats={stats?.stats ?? null}
          activity={stats?.activity ?? null}
          statsHidden={statsResolved && stats === null}
        />
      )
    })
    .render()
}

function SignOutButton() {
  const [pending, setPending] = useState(false)

  const signOut = async () => {
    setPending(true)

    try {
      const result = await authClient.signOut()
      if (result.error) throw result.error

      navigateAfterAuthChange("/")
    } catch (reason) {
      setPending(false)
      toast.error(errorMessage(reason, "Unable to sign out"))
    }
  }

  return (
    <Button variant="outline" disabled={pending} onClick={() => void signOut()}>
      <LogOut data-icon="inline-start" />
      {pending ? "Signing out…" : "Sign out"}
    </Button>
  )
}

function PublicPreviewBanner({ username }: { username: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed bg-card/60 px-4 py-3">
      <p className="text-sm text-muted-foreground">
        You are viewing your profile as another user sees it.
      </p>
      <Button asChild variant="outline" size="sm">
        <Link to="/u/$username" params={{ username }} search={{}}>
          <Eye data-icon="inline-start" />
          Back to my view
        </Link>
      </Button>
    </div>
  )
}

function ProfileUnavailable({
  type,
  username,
}: {
  type: "private" | "not_found"
  username: string
}) {
  const isPrivate = type === "private"

  return (
    <>
      <title>{`${username} | AnimeKaiser`}</title>
      <main className="flex min-h-[70svh] items-center justify-center p-6">
        <Empty className="max-w-lg border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              {isPrivate ? <LockKeyhole /> : <UserRoundX />}
            </EmptyMedia>
            <EmptyTitle>
              {isPrivate ? "This profile is private" : "Profile not found"}
            </EmptyTitle>
            <EmptyDescription>
              {isPrivate
                ? "This user has chosen not to share their profile."
                : "The username may have changed or the account no longer exists."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </main>
    </>
  )
}

function StatsPending() {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Skeleton className="h-56 rounded-2xl" />
        <Skeleton className="h-56 rounded-2xl" />
      </div>
    </div>
  )
}

function ProfilePendingPage() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 md:p-6">
      <Skeleton className="h-72 w-full rounded-3xl" />
      <StatsPending />
    </div>
  )
}
