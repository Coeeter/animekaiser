import type { OwnProfile, PublicProfile } from "@workspace/domain"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import { Button } from "@workspace/ui/components/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { Separator } from "@workspace/ui/components/separator"
import { LockKeyhole, Settings2, UserRoundX } from "lucide-react"

const initials = (username: string | null) =>
  (username || "?").slice(0, 2).toUpperCase()

function ProfileCard({ data, own }: { data: OwnProfile; own?: boolean }) {
  const username = data.user.username ?? "Unknown user"
  return (
    <main className="mx-auto w-full max-w-5xl p-4 py-8 md:p-8">
      <article className="overflow-hidden rounded-3xl border bg-card/70 shadow-2xl shadow-primary/5">
        <div className="relative h-48 overflow-hidden bg-zinc-950 md:h-72">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,color-mix(in_oklch,var(--primary)_35%,transparent),transparent_35%),radial-gradient(circle_at_90%_10%,color-mix(in_oklch,var(--chart-2)_25%,transparent),transparent_35%)]" />
          {data.profile.bannerUrl ? (
            <img
              className="absolute inset-0 size-full object-cover opacity-90"
              src={data.profile.bannerUrl}
              alt=""
            />
          ) : null}
          <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/15 to-black/10" />
          <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-4 p-5 md:p-8">
            <div className="flex min-w-0 items-center gap-4">
              <Avatar className="size-20 ring-4 ring-white md:size-24">
                <AvatarImage
                  src={data.user.image ?? undefined}
                  alt={username}
                />
                <AvatarFallback>{initials(username)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 rounded-2xl border border-white/15 bg-black/40 px-4 py-3 text-white backdrop-blur-md">
                <h1 className="truncate font-heading text-2xl font-black md:text-4xl">
                  {username}
                </h1>
                <p className="mt-1 text-sm text-white/70">@{username}</p>
              </div>
            </div>
            {own ? (
              <Button
                variant="secondary"
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent("kaiser:settings", { detail: "Profile" })
                  )
                }
              >
                <Settings2 data-icon="inline-start" />
                Edit profile
              </Button>
            ) : null}
          </div>
        </div>
        <div className="p-5 md:p-8">
          <h2 className="font-heading text-lg font-semibold">About</h2>
          <Separator className="my-4" />
          <p className="max-w-3xl text-sm leading-7 text-muted-foreground">
            {data.profile.description || "No profile description yet."}
          </p>
        </div>
      </article>
    </main>
  )
}

export function OwnProfilePage({ data }: { data: OwnProfile }) {
  return <ProfileCard data={data} own />
}

export function PublicProfilePage({ data }: { data: PublicProfile }) {
  if (data.type === "public") return <ProfileCard data={data} />
  const isPrivate = data.type === "private"
  return (
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
  )
}
