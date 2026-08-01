import type { AppSession } from "@animekaiser/domain"
import { Button } from "@animekaiser/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@animekaiser/ui/components/dialog"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@animekaiser/ui/components/empty"
import { Separator } from "@animekaiser/ui/components/separator"
import { cn } from "@animekaiser/ui/lib/utils"
import {
  Result,
  useAtom,
  useAtomMount,
  useAtomValue,
} from "@effect-atom/atom-react"
import { Link } from "@tanstack/react-router"
import {
  Bell,
  Captions,
  Globe,
  History,
  KeyRound,
  Link2,
  Monitor,
  Palette,
  Play,
  Settings2,
  Shield,
  User,
} from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { authClient, navigateAfterAuthChange } from "../../services/api-clients"
import { errorMessage } from "../../utils/error"
import { sessionAtom } from "../auth/atoms"
import type { AppUser } from "../auth/user"
import { AccountPanel } from "./account-panel"
import { AppearancePanel } from "./appearance-panel"
import type { SettingsSection } from "./atoms"
import { oauthResultAtom, settingsOpenAtom, settingsSectionAtom } from "./atoms"
import { HistoryPanel } from "./history-panel"
import { IntegrationsPanel } from "./integrations-panel"
import { PasskeysPanel } from "./passkeys-panel"
import { PlayerPanel } from "./player-panel"
import { PrivacyPanel } from "./privacy-panel"
import { ProfilePanel } from "./profile-panel"
import { SessionsPanel } from "./sessions-panel"
import { SitePanel } from "./site-panel"

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
    title: "History",
    icon: History,
    description: "Watch history and resume positions.",
  },
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
  session,
}: {
  section: SettingsSection
  session: AppSession | null
}) {
  const user = session?.user ?? null

  if (section === "Account")
    return (
      <AccountPanel
        user={user}
        sessionExpiresAt={session?.session.expiresAt ?? null}
      />
    )
  if (section === "Profile") return <ProfilePanel user={user} />
  if (section === "Privacy") return <PrivacyPanel user={user} />
  if (section === "Appearance") return <AppearancePanel />
  if (section === "Site") return <SitePanel />
  if (section === "Player") return <PlayerPanel />
  if (section === "History") return <HistoryPanel />
  if (section === "Integrations") return <IntegrationsPanel user={user} />
  if (section === "Sessions") return <SessionsPanel user={user} />
  if (section === "Passkeys") return <PasskeysPanel user={user} />

  return <PlaceholderPanel title={section} />
}

export function SettingsDialog() {
  const [open, setOpen] = useAtom(settingsOpenAtom)
  const [active, setActive] = useAtom(settingsSectionAtom)
  const sessionResult = useAtomValue(sessionAtom)
  const [logoutPending, setLogoutPending] = useState(false)

  const session = Result.builder(sessionResult)
    .onSuccess((value) => value)
    .orNull()

  const user: AppUser | null = session?.user ?? null

  useAtomMount(oauthResultAtom)

  const logout = async () => {
    setLogoutPending(true)

    try {
      const result = await authClient.signOut()

      if (result.error) {
        toast.error(errorMessage(result.error, "Unable to sign out"))
        return
      }

      navigateAfterAuthChange("/")
    } catch (cause) {
      toast.error(errorMessage(cause, "Unable to sign out"))
    } finally {
      setLogoutPending(false)
    }
  }

  const selected =
    sections.find((section) => section.title === active) ?? sections[0]

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
                onClick={() => void logout()}
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
        <div className="flex min-h-0 min-w-0 flex-col md:grid md:grid-cols-[17rem_minmax(0,1fr)]">
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
          <main className="min-h-0 w-full min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain p-4 md:p-6">
            <div className="no-scrollbar -mx-4 mb-4 flex max-w-full gap-2 overflow-x-auto px-4 pb-2 md:hidden">
              {sections.map((section) => {
                const isActive = active === section.title

                return (
                  <button
                    key={section.title}
                    type="button"
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3 text-sm font-medium whitespace-nowrap transition",
                      isActive
                        ? "border-primary/60 bg-primary/15 text-primary"
                        : "bg-card/60 text-muted-foreground"
                    )}
                    onClick={() => setActive(section.title)}
                  >
                    <section.icon className="size-4" />
                    {section.title}
                  </button>
                )
              })}
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
            <SectionContent section={active} session={session} />
          </main>
        </div>
      </DialogContent>
    </Dialog>
  )
}
