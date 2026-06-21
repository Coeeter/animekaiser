import { Link, useNavigate, useRouter } from "@tanstack/react-router"
import { useAtom } from "@effect-atom/atom-react"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { Separator } from "@workspace/ui/components/separator"
import { Spinner } from "@workspace/ui/components/spinner"
import { Switch } from "@workspace/ui/components/switch"
import { Textarea } from "@workspace/ui/components/textarea"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/toggle-group"
import { cn } from "@workspace/ui/lib/utils"
import {
  Bell,
  Captions,
  Download,
  Fingerprint,
  Globe,
  KeyRound,
  Link2,
  LogIn,
  Monitor,
  Palette,
  Play,
  Settings2,
  Shield,
  Trash2,
  Unlink,
  User,
} from "lucide-react"
import type { FormEvent, ReactNode } from "react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import {
  disconnectExternalAccount,
  deleteAccount as deleteKaiserAccount,
  loadExternalAccounts,
  loadOwnProfile,
  removeProfileImage,
  savePrivacy,
  saveProfile,
  startLibraryImport,
  uploadProfileImage,
} from "../../api"
import { apiUrl, authClient, displayUsername, userInitials } from "../../auth"
import type { AppUser } from "../../auth"
import { animeTitlePreferenceAtom } from "../anime/title"

const sections = [
  {
    title: "Account",
    icon: Settings2,
    description: "Identity, password, and account access.",
  },
  {
    title: "Profile",
    icon: User,
    description: "Public profile, avatar, banner, and bio.",
  },
  {
    title: "Privacy",
    icon: Shield,
    description: "Profile visibility controls.",
  },
  {
    title: "Appearance",
    icon: Palette,
    description: "Theme and interface settings.",
  },
  { title: "Site", icon: Globe, description: "Site-wide preferences." },
  { title: "Player", icon: Play, description: "Player defaults." },
  { title: "Subtitles", icon: Captions, description: "Subtitle settings." },
  {
    title: "Notifications",
    icon: Bell,
    description: "Notification preferences.",
  },
  {
    title: "Integrations",
    icon: Link2,
    description: "External anime list connections.",
  },
  {
    title: "Sessions",
    icon: Monitor,
    description: "Active devices and session revocation.",
  },
  {
    title: "Passkeys",
    icon: KeyRound,
    description: "Passwordless sign-in credentials.",
  },
] as const

export type SettingsSection = (typeof sections)[number]["title"]

const message = <T,>(reason: T, fallback: string) =>
  reason instanceof Error ? reason.message : fallback

function PanelCard({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border bg-background/60 p-4 md:p-5",
        className
      )}
    >
      {children}
    </section>
  )
}

function AuthRequired() {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <LogIn />
        </EmptyMedia>
        <EmptyTitle>Login required</EmptyTitle>
        <EmptyDescription>
          Sign in to manage this part of your account.
        </EmptyDescription>
      </EmptyHeader>
      <Button asChild>
        <Link to="/login" search={{ redirect: undefined }}>
          Login
        </Link>
      </Button>
    </Empty>
  )
}

function AccountPanel({ user }: { user: AppUser | null }) {
  const router = useRouter()
  const navigate = useNavigate()
  const session = authClient.useSession()
  const [passwordPending, setPasswordPending] = useState(false)
  const [deletePending, setDeletePending] = useState(false)
  if (!user) return <AuthRequired />

  const changePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const currentPassword = String(form.get("currentPassword") ?? "")
    const newPassword = String(form.get("newPassword") ?? "")
    const confirmation = String(form.get("confirmation") ?? "")
    if (newPassword !== confirmation)
      return toast.error("Passwords do not match.")
    setPasswordPending(true)
    try {
      const result = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: false,
      })
      if (result.error) throw result.error
      event.currentTarget.reset()
      toast.success("Password updated.")
    } catch (reason) {
      toast.error(message(reason, "Unable to change password"))
    } finally {
      setPasswordPending(false)
    }
  }

  const deleteAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (
      !window.confirm(
        "Delete your AnimeKaiser account permanently? This cannot be undone."
      )
    )
      return
    const password = String(
      new FormData(event.currentTarget).get("deletePassword") ?? ""
    )
    setDeletePending(true)
    try {
      await deleteKaiserAccount(password)
      await authClient.signOut()
      await router.invalidate()
      await navigate({ to: "/" })
    } catch (reason) {
      toast.error(message(reason, "Unable to delete account"))
    } finally {
      setDeletePending(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 xl:grid-cols-2">
        <PanelCard>
          <h3 className="font-semibold">Identity</h3>
          <dl className="mt-4 flex flex-col gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Username</dt>
              <dd className="mt-1 font-medium">@{displayUsername(user)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="mt-1 font-medium">{user.email}</dd>
            </div>
          </dl>
        </PanelCard>
        <PanelCard>
          <h3 className="font-semibold">Access</h3>
          <dl className="mt-4 flex flex-col gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Last login method</dt>
              <dd className="mt-1 font-medium">
                {authClient.getLastUsedLoginMethod() ?? "Unknown"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Session expires</dt>
              <dd className="mt-1 font-medium">
                {session.data?.session.expiresAt
                  ? new Date(session.data.session.expiresAt).toLocaleString()
                  : "Unknown"}
              </dd>
            </div>
          </dl>
        </PanelCard>
      </div>
      <PanelCard>
        <form className="flex flex-col gap-4" onSubmit={changePassword}>
          <div>
            <h3 className="font-semibold">Change password</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Use at least eight characters.
            </p>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <Field>
              <FieldLabel htmlFor="current-password">
                Current password
              </FieldLabel>
              <Input
                id="current-password"
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="new-password">New password</FieldLabel>
              <Input
                id="new-password"
                name="newPassword"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="confirm-password">
                Confirm password
              </FieldLabel>
              <Input
                id="confirm-password"
                name="confirmation"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </Field>
          </div>
          <Button className="w-fit" disabled={passwordPending} type="submit">
            {passwordPending ? <Spinner data-icon="inline-start" /> : null}
            Update password
          </Button>
        </form>
      </PanelCard>
      <PanelCard className="border-destructive/30">
        <form className="flex flex-col gap-4" onSubmit={deleteAccount}>
          <div>
            <h3 className="font-semibold text-destructive">Delete account</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Permanently remove your account and profile.
            </p>
          </div>
          <Field>
            <FieldLabel htmlFor="delete-password">
              Confirm with your password
            </FieldLabel>
            <Input
              className="max-w-sm"
              id="delete-password"
              name="deletePassword"
              type="password"
              autoComplete="current-password"
              required
            />
          </Field>
          <Button
            className="w-fit"
            variant="destructive"
            disabled={deletePending}
            type="submit"
          >
            {deletePending ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <Trash2 data-icon="inline-start" />
            )}
            Delete account
          </Button>
        </form>
      </PanelCard>
    </div>
  )
}

function ProfilePanel({ open, user }: { open: boolean; user: AppUser | null }) {
  const router = useRouter()
  const session = authClient.useSession()
  const avatarInput = useRef<HTMLInputElement>(null)
  const bannerInput = useRef<HTMLInputElement>(null)
  const [profile, setProfile] = useState<Awaited<
    ReturnType<typeof loadOwnProfile>
  > | null>(null)
  const [pending, setPending] = useState<string | null>(null)

  const refresh = async () => {
    const next = await loadOwnProfile()
    setProfile(next)
    return next
  }
  useEffect(() => {
    if (open && user) void refresh()
  }, [open, user])
  if (!user) return <AuthRequired />

  const upload = async (kind: "avatar" | "banner", file: File) => {
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      toast.error("Upload a JPEG, PNG, or WebP image up to 5 MB.")
      return
    }
    setPending(kind)
    try {
      await uploadProfileImage(kind, file)
      await session.refetch()
      await refresh()
      await router.invalidate()
      toast.success(
        `${kind === "avatar" ? "Profile picture" : "Banner"} updated.`
      )
    } catch (reason) {
      toast.error(message(reason, `Unable to update ${kind}`))
    } finally {
      setPending(null)
    }
  }

  const remove = async (kind: "avatar" | "banner") => {
    setPending(kind)
    try {
      await removeProfileImage(kind)
      await session.refetch()
      await refresh()
      await router.invalidate()
      toast.success(
        `${kind === "avatar" ? "Profile picture" : "Banner"} removed.`
      )
    } catch (reason) {
      toast.error(message(reason, `Unable to remove ${kind}`))
    } finally {
      setPending(null)
    }
  }

  const updateUsername = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const username = String(
      new FormData(event.currentTarget).get("username") ?? ""
    ).trim()
    setPending("username")
    try {
      const result = await authClient.updateUser({ username, name: username })
      if (result.error) throw result.error
      await session.refetch()
      await router.invalidate()
      toast.success("Username updated.")
    } catch (reason) {
      toast.error(message(reason, "Unable to update username"))
    } finally {
      setPending(null)
    }
  }

  const updateBio = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const description = String(
      new FormData(event.currentTarget).get("description") ?? ""
    ).trim()
    setPending("bio")
    try {
      setProfile(await saveProfile(description || null))
      await router.invalidate()
      toast.success("Bio updated.")
    } catch (reason) {
      toast.error(message(reason, "Unable to update bio"))
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PanelCard>
        <div
          className="h-32 rounded-2xl border bg-linear-to-br from-primary/25 via-muted to-background bg-cover bg-center md:h-40"
          style={
            profile?.profile.bannerUrl
              ? { backgroundImage: `url(${profile.profile.bannerUrl})` }
              : undefined
          }
        />
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold">Profile banner</h3>
            <p className="text-sm text-muted-foreground">
              Wide JPEG, PNG, or WebP; maximum 5 MB.
            </p>
          </div>
          <div className="flex gap-2">
            <input
              ref={bannerInput}
              className="hidden"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void upload("banner", file)
              }}
            />
            <Button
              type="button"
              variant="outline"
              disabled={pending === "banner"}
              onClick={() => bannerInput.current?.click()}
            >
              Upload
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={pending === "banner" || !profile?.profile.bannerUrl}
              onClick={() => void remove("banner")}
            >
              Remove
            </Button>
          </div>
        </div>
      </PanelCard>
      <PanelCard>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar className="size-20">
              <AvatarImage src={user.image ?? undefined} />
              <AvatarFallback>{userInitials(user)}</AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold">Profile picture</h3>
              <p className="text-sm text-muted-foreground">
                Square images work best.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <input
              ref={avatarInput}
              className="hidden"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void upload("avatar", file)
              }}
            />
            <Button
              type="button"
              variant="outline"
              disabled={pending === "avatar"}
              onClick={() => avatarInput.current?.click()}
            >
              Upload
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={pending === "avatar" || !user.image}
              onClick={() => void remove("avatar")}
            >
              Remove
            </Button>
          </div>
        </div>
      </PanelCard>
      <PanelCard>
        <form className="flex flex-col gap-4" onSubmit={updateUsername}>
          <div>
            <h3 className="font-semibold">Username</h3>
            <p className="text-sm text-muted-foreground">
              Used across the app and in your profile URL.
            </p>
          </div>
          <Field>
            <FieldLabel htmlFor="settings-username">Username</FieldLabel>
            <Input
              className="max-w-sm"
              id="settings-username"
              name="username"
              defaultValue={displayUsername(user)}
              minLength={3}
              maxLength={30}
              pattern="[A-Za-z0-9_]+"
              required
            />
            <FieldDescription>
              Letters, numbers, and underscores only.
            </FieldDescription>
          </Field>
          <Button className="w-fit" disabled={pending === "username"}>
            Save username
          </Button>
        </form>
      </PanelCard>
      <PanelCard>
        <form className="flex flex-col gap-4" onSubmit={updateBio}>
          <div>
            <h3 className="font-semibold">Bio</h3>
            <p className="text-sm text-muted-foreground">
              A short description shown on your profile.
            </p>
          </div>
          <Field>
            <FieldLabel htmlFor="profile-bio">Description</FieldLabel>
            <Textarea
              key={profile?.profile.description}
              id="profile-bio"
              name="description"
              defaultValue={profile?.profile.description ?? ""}
              maxLength={300}
              rows={5}
            />
          </Field>
          <Button className="w-fit" disabled={pending === "bio"}>
            Save bio
          </Button>
        </form>
      </PanelCard>
    </div>
  )
}

function PrivacyPanel({ open, user }: { open: boolean; user: AppUser | null }) {
  const router = useRouter()
  const [isPrivate, setPrivate] = useState(false)
  const [pending, setPending] = useState(false)
  useEffect(() => {
    if (open && user)
      void loadOwnProfile().then((value) => setPrivate(value.profile.private))
  }, [open, user])
  if (!user) return <AuthRequired />
  const update = async (checked: boolean) => {
    const previous = isPrivate
    setPrivate(checked)
    setPending(true)
    try {
      await savePrivacy(checked)
      await router.invalidate()
    } catch (reason) {
      setPrivate(previous)
      toast.error(message(reason, "Unable to update privacy"))
    } finally {
      setPending(false)
    }
  }
  return (
    <PanelCard>
      <Field orientation="horizontal">
        <div className="flex-1">
          <p className="font-semibold">Private profile</p>
          <FieldDescription>
            Hide your profile details from everyone except you.
          </FieldDescription>
        </div>
        <Switch
          aria-label="Private profile"
          checked={isPrivate}
          disabled={pending}
          onCheckedChange={(value) => void update(value)}
        />
      </Field>
    </PanelCard>
  )
}

function SitePanel() {
  const [title, setTitle] = useAtom(animeTitlePreferenceAtom)
  const update = (value: "english" | "romaji") => {
    setTitle(value)
    window.localStorage.setItem("anime-title-preference", value)
  }
  return (
    <PanelCard>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold">Anime title language</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose your preferred title when both are available.
          </p>
        </div>
        <ToggleGroup
          type="single"
          variant="outline"
          spacing={0}
          value={title}
          onValueChange={(value) => {
            if (value === "english" || value === "romaji") update(value)
          }}
        >
          <ToggleGroupItem value="romaji">Romaji</ToggleGroupItem>
          <ToggleGroupItem value="english">English</ToggleGroupItem>
        </ToggleGroup>
      </div>
    </PanelCard>
  )
}

function IntegrationsPanel({ user }: { user: AppUser | null }) {
  const [accounts, setAccounts] = useState<
    Awaited<ReturnType<typeof loadExternalAccounts>>
  >([])
  const [pending, setPending] = useState<string | null>(null)
  const refresh = async () => setAccounts(await loadExternalAccounts())
  useEffect(() => {
    if (user) void refresh().catch(() => setAccounts([]))
  }, [user])
  if (!user) return <AuthRequired />
  const connect = (provider: "mal" | "anilist") => {
    const callbackURL = new URL(window.location.href)
    callbackURL.searchParams.set("oauth_result", "connected")
    callbackURL.searchParams.set("oauth_provider", provider)
    window.location.href = `${apiUrl}/api/link/${provider}?callbackURL=${encodeURIComponent(callbackURL.toString())}`
  }
  const disconnect = async (provider: "mal" | "anilist") => {
    setPending(provider)
    try {
      await disconnectExternalAccount(provider)
      await refresh()
      toast.success("Integration disconnected.")
    } catch (reason) {
      toast.error(message(reason, "Unable to disconnect"))
    } finally {
      setPending(null)
    }
  }
  const runImport = async (provider: "mal" | "anilist") => {
    setPending(`${provider}:import`)
    try {
      const job = await startLibraryImport(provider)
      toast.success(`Import queued: ${job.id}`)
    } catch (reason) {
      toast.error(message(reason, "Unable to start import"))
    } finally {
      setPending(null)
    }
  }
  return (
    <div className="flex flex-col gap-3">
      <Button asChild variant="outline" className="self-start">
        <Link to="/sync-activity" search={{ page: 1 }}>
          View sync activity
        </Link>
      </Button>
      {accounts.map((account) => (
        <PanelCard key={account.provider}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">
                  {account.provider === "mal" ? "MyAnimeList" : "AniList"}
                </h3>
                <Badge variant={account.connected ? "default" : "secondary"}>
                  {account.state === "expiring"
                    ? "Expiring soon"
                    : account.state === "relink_required" ||
                        account.state === "expired"
                      ? "Reconnect required"
                      : account.connected
                        ? "Connected"
                        : "Disconnected"}
                </Badge>
              </div>
              {account.expiresAt ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Token expires {new Date(account.expiresAt).toLocaleString()}
                </p>
              ) : null}
            </div>
            {account.connected ? (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  disabled={pending === `${account.provider}:import`}
                  onClick={() => void runImport(account.provider)}
                >
                  <Download data-icon="inline-start" />
                  Import
                </Button>
                <Button
                  variant="ghost"
                  disabled={pending === account.provider}
                  onClick={() => void disconnect(account.provider)}
                >
                  <Unlink data-icon="inline-start" />
                  Disconnect
                </Button>
              </div>
            ) : (
              <Button onClick={() => connect(account.provider)}>
                <Link2 data-icon="inline-start" />
                Connect
              </Button>
            )}
          </div>
        </PanelCard>
      ))}
    </div>
  )
}

function SessionsPanel({
  open,
  user,
}: {
  open: boolean
  user: AppUser | null
}) {
  const [sessions, setSessions] = useState<
    Array<{
      id: string
      token: string
      userAgent?: string | null
      ipAddress?: string | null
      createdAt: Date | string
      expiresAt: Date | string
    }>
  >([])
  const [pending, setPending] = useState<string | null>(null)
  const refresh = async () => {
    const result = await authClient.listSessions()
    if (result.error) throw result.error
    setSessions(result.data)
  }
  useEffect(() => {
    if (open && user) void refresh().catch(() => setSessions([]))
  }, [open, user])
  if (!user) return <AuthRequired />
  const revoke = async (token: string) => {
    setPending(token)
    try {
      const result = await authClient.revokeSession({ token })
      if (result.error) throw result.error
      await refresh()
      toast.success("Session revoked.")
    } catch (reason) {
      toast.error(message(reason, "Unable to revoke session"))
    } finally {
      setPending(null)
    }
  }
  const revokeOthers = async () => {
    setPending("others")
    try {
      const result = await authClient.revokeOtherSessions()
      if (result.error) throw result.error
      await refresh()
      toast.success("Other sessions revoked.")
    } catch (reason) {
      toast.error(message(reason, "Unable to revoke sessions"))
    } finally {
      setPending(null)
    }
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button
          variant="outline"
          disabled={pending === "others"}
          onClick={() => void revokeOthers()}
        >
          Revoke other sessions
        </Button>
      </div>
      <div className="divide-y rounded-2xl border bg-background/60">
        {sessions.length ? (
          sessions.map((item) => (
            <div
              className="flex flex-wrap items-start justify-between gap-4 p-4"
              key={item.id}
            >
              <div>
                <p className="font-medium">
                  {item.userAgent || "Unknown device"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {item.ipAddress || "Unknown IP"} · started{" "}
                  {new Date(item.createdAt).toLocaleString()}
                </p>
              </div>
              <Button
                variant="outline"
                disabled={pending === item.token}
                onClick={() => void revoke(item.token)}
              >
                Revoke
              </Button>
            </div>
          ))
        ) : (
          <p className="p-5 text-sm text-muted-foreground">
            No active sessions found.
          </p>
        )}
      </div>
    </div>
  )
}

function PasskeysPanel({ user }: { user: AppUser | null }) {
  const query = authClient.useListPasskeys()
  const [pending, setPending] = useState<string | null>(null)
  if (!user) return <AuthRequired />
  const add = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const name = String(
      new FormData(event.currentTarget).get("name") ?? ""
    ).trim()
    setPending("add")
    try {
      const result = await authClient.passkey.addPasskey({
        name: name || undefined,
      })
      if (result.error) throw result.error
      event.currentTarget.reset()
      await query.refetch()
      toast.success("Passkey added.")
    } catch (reason) {
      toast.error(message(reason, "Unable to add passkey"))
    } finally {
      setPending(null)
    }
  }
  const rename = async (id: string, name: string) => {
    setPending(id)
    try {
      const result = await authClient.passkey.updatePasskey({ id, name })
      if (result.error) throw result.error
      await query.refetch()
      toast.success("Passkey renamed.")
    } catch (reason) {
      toast.error(message(reason, "Unable to rename passkey"))
    } finally {
      setPending(null)
    }
  }
  const remove = async (id: string) => {
    if (!window.confirm("Remove this passkey?")) return
    setPending(id)
    try {
      const result = await authClient.passkey.deletePasskey({ id })
      if (result.error) throw result.error
      await query.refetch()
      toast.success("Passkey removed.")
    } catch (reason) {
      toast.error(message(reason, "Unable to remove passkey"))
    } finally {
      setPending(null)
    }
  }
  return (
    <div className="flex flex-col gap-4">
      <PanelCard>
        <form
          className="flex flex-col gap-4 sm:flex-row sm:items-end"
          onSubmit={add}
        >
          <Field className="flex-1">
            <FieldLabel htmlFor="passkey-name">New passkey name</FieldLabel>
            <Input
              id="passkey-name"
              name="name"
              placeholder="MacBook Touch ID"
            />
          </Field>
          <Button disabled={pending === "add"}>
            <Fingerprint data-icon="inline-start" />
            Add passkey
          </Button>
        </form>
      </PanelCard>
      <div className="divide-y rounded-2xl border bg-background/60">
        {query.data?.length ? (
          query.data.map((passkey) => (
            <form
              className="flex flex-wrap items-end justify-between gap-4 p-4"
              key={passkey.id}
              onSubmit={(event) => {
                event.preventDefault()
                void rename(
                  passkey.id,
                  String(
                    new FormData(event.currentTarget).get("name") ?? ""
                  ).trim()
                )
              }}
            >
              <Field className="max-w-sm">
                <FieldLabel htmlFor={`passkey-${passkey.id}`}>
                  Passkey name
                </FieldLabel>
                <Input
                  id={`passkey-${passkey.id}`}
                  name="name"
                  defaultValue={passkey.name ?? "Passkey"}
                  required
                />
              </Field>
              <div className="flex gap-2">
                <Button variant="outline" disabled={pending === passkey.id}>
                  Rename
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={pending === passkey.id}
                  onClick={() => void remove(passkey.id)}
                >
                  Remove
                </Button>
              </div>
            </form>
          ))
        ) : (
          <p className="p-5 text-sm text-muted-foreground">
            No passkeys registered.
          </p>
        )}
      </div>
    </div>
  )
}

function PlaceholderPanel({ title }: { title: SettingsSection }) {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Settings2 />
        </EmptyMedia>
        <EmptyTitle>{title} settings are coming later</EmptyTitle>
        <EmptyDescription>
          This section is present for UI parity, but it is not wired up yet.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

function SectionContent({
  section,
  open,
  user,
}: {
  section: SettingsSection
  open: boolean
  user: AppUser | null
}) {
  if (section === "Account") return <AccountPanel user={user} />
  if (section === "Profile") return <ProfilePanel open={open} user={user} />
  if (section === "Privacy") return <PrivacyPanel open={open} user={user} />
  if (section === "Site") return <SitePanel />
  if (section === "Integrations") return <IntegrationsPanel user={user} />
  if (section === "Sessions") return <SessionsPanel open={open} user={user} />
  if (section === "Passkeys") return <PasskeysPanel user={user} />
  return <PlaceholderPanel title={section} />
}

export function SettingsDialog({
  open,
  onOpenChange,
  requestedSection,
  user,
  onLogout,
  logoutPending,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  requestedSection?: SettingsSection | null
  user: AppUser | null
  onLogout: () => void
  logoutPending: boolean
}) {
  const [active, setActive] = useState<SettingsSection>("Account")
  useEffect(() => {
    if (open) setActive(requestedSection ?? "Account")
  }, [open, requestedSection])
  const selected =
    sections.find((section) => section.title === active) ?? sections[0]
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="h-[calc(100svh-1rem)] max-w-[calc(100%-1rem)] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden rounded-2xl p-0 md:h-[calc(100svh-4rem)] md:max-h-192 md:max-w-6xl"
      >
        <DialogHeader className="border-b p-4 pr-16">
          <div className="flex items-center justify-between gap-4">
            <div>
              <DialogTitle className="text-lg">Settings</DialogTitle>
              <DialogDescription className="mt-1">
                Manage your AnimeKaiser experience.
              </DialogDescription>
            </div>
            {user ? (
              <Button
                variant="destructive"
                disabled={logoutPending}
                onClick={onLogout}
              >
                Sign out
              </Button>
            ) : (
              <Button asChild variant="outline">
                <Link to="/login" search={{ redirect: undefined }}>
                  Login
                </Link>
              </Button>
            )}
          </div>
        </DialogHeader>
        <div className="min-h-0 md:grid md:grid-cols-[17rem_minmax(0,1fr)]">
          <aside className="hidden overflow-y-auto border-r bg-muted/20 p-3 md:block">
            <nav className="flex flex-col gap-1">
              {sections.map((section) => (
                <button
                  type="button"
                  key={section.title}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground",
                    active === section.title && "bg-muted text-foreground"
                  )}
                  onClick={() => setActive(section.title)}
                >
                  <section.icon className="size-4" />
                  {section.title}
                </button>
              ))}
            </nav>
          </aside>
          <main className="min-h-0 overflow-y-auto p-4 md:p-6">
            <div className="mb-4 flex gap-2 overflow-x-auto pb-2 md:hidden">
              {sections.map((section) => (
                <Button
                  key={section.title}
                  size="icon"
                  variant={active === section.title ? "secondary" : "outline"}
                  aria-label={section.title}
                  onClick={() => setActive(section.title)}
                >
                  <section.icon />
                </Button>
              ))}
            </div>
            <div className="flex items-start gap-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted">
                <selected.icon className="size-5" />
              </div>
              <div>
                <h2 className="font-heading text-xl font-semibold">
                  {selected.title}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selected.description}
                </p>
              </div>
            </div>
            <Separator className="my-5" />
            <SectionContent section={active} open={open} user={user} />
          </main>
        </div>
      </DialogContent>
    </Dialog>
  )
}
