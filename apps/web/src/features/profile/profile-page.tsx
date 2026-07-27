import type { OwnProfile, PublicProfile } from "@animekaiser/domain"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@animekaiser/ui/components/avatar"
import { Button } from "@animekaiser/ui/components/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@animekaiser/ui/components/empty"
import { Separator } from "@animekaiser/ui/components/separator"
import { Skeleton } from "@animekaiser/ui/components/skeleton"
import {
  Result,
  useAtomRefresh,
  useAtomSet,
  useAtomValue,
} from "@effect-atom/atom-react"
import { LockKeyhole, Settings2, UserRoundX } from "lucide-react"
import { DataError } from "../../components/data-error"
import { settingsOpenAtom, settingsSectionAtom } from "../settings/atoms"
import { ownProfileAtom, publicProfileAtom } from "./atoms"

const initials = (username: string | null) =>
  (username || "?").slice(0, 2).toUpperCase()

function ProfileCard({ data, own }: { data: OwnProfile; own?: boolean }) {
  const setSettingsSection = useAtomSet(settingsSectionAtom)
  const setSettingsOpen = useAtomSet(settingsOpenAtom)
  const username = data.user.username ?? "Unknown user"

  return (
    <>
      <title>{`${username} | AnimeKaiser`}</title>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:p-6">
        <div className="overflow-hidden rounded-3xl border border-border/70 bg-card/70 shadow-[0_28px_90px_-66px_rgba(0,0,0,0.85)]">
          <div className="relative h-44 w-full overflow-hidden bg-zinc-950 md:h-64">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(250,204,21,0.2),transparent_34%),radial-gradient(circle_at_88%_12%,rgba(244,63,94,0.22),transparent_34%),linear-gradient(135deg,#18181b,#09090b_60%,#27272a)]" />
            {data.profile.bannerUrl ? (
              <>
                <div
                  className="absolute inset-0 bg-cover bg-center opacity-90"
                  style={{ backgroundImage: `url(${data.profile.bannerUrl})` }}
                />
                <div className="absolute inset-0 bg-linear-to-t from-black/78 via-black/25 to-black/15" />
              </>
            ) : null}

            <div className="absolute inset-x-0 bottom-0 p-4 md:p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div className="flex items-center gap-4">
                  <Avatar className="size-20 ring-4 ring-white/85 md:size-24">
                    <AvatarImage
                      src={data.user.image ?? undefined}
                      alt={username}
                    />
                    <AvatarFallback>{initials(username)}</AvatarFallback>
                  </Avatar>
                  <div className="max-w-full rounded-2xl border border-white/15 bg-black/35 px-4 py-3 text-white backdrop-blur-md">
                    <h1 className="truncate font-heading text-2xl font-black tracking-normal drop-shadow-sm md:text-4xl">
                      {username}
                    </h1>
                  </div>
                </div>
                {own ? (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setSettingsSection("Profile")
                      setSettingsOpen(true)
                    }}
                  >
                    <Settings2 data-icon="inline-start" />
                    Edit profile
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
          <div className="space-y-6 p-4 md:p-6">
            <h2 className="font-heading text-lg font-semibold">About</h2>
            <Separator />
            <p className="max-w-3xl text-sm leading-7 text-muted-foreground">
              {data.profile.description || "No profile description yet."}
            </p>
          </div>
        </div>
      </div>
    </>
  )
}

export function OwnProfilePage() {
  const result = useAtomValue(ownProfileAtom)
  const refresh = useAtomRefresh(ownProfileAtom)

  return Result.builder(result)
    .onInitialOrWaiting(() => <ProfilePendingPage />)
    .onFailure(() => <DataError onRetry={refresh} />)
    .onSuccess((data) => <ProfileCard data={data} own />)
    .render()
}

export function PublicProfilePage({ username }: { username: string }) {
  const atom = publicProfileAtom(username)
  const result = useAtomValue(atom)
  const refresh = useAtomRefresh(atom)

  return Result.builder(result)
    .onInitialOrWaiting(() => <ProfilePendingPage />)
    .onFailure(() => <DataError onRetry={refresh} />)
    .onSuccess((data) => (
      <PublicProfileContent data={data} username={username} />
    ))
    .render()
}

function PublicProfileContent({
  data,
  username,
}: {
  data: PublicProfile
  username: string
}) {
  if (data.type === "public") return <ProfileCard data={data} />

  const isPrivate = data.type === "private"

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

function ProfilePendingPage() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 p-4 md:p-6">
      <Skeleton className="h-64 w-full rounded-3xl" />
      <Skeleton className="h-32 w-full rounded-3xl" />
    </div>
  )
}
