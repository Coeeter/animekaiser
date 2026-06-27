import { Link } from "@tanstack/react-router"
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
import { Separator } from "@workspace/ui/components/separator"
import { cn } from "@workspace/ui/lib/utils"
import {
  Bell,
  Captions,
  Globe,
  KeyRound,
  Link2,
  Monitor,
  Palette,
  Play,
  Settings2,
  Shield,
  User,
} from "lucide-react"
import { useEffect, useState } from "react"
import * as Schema from "effect/Schema"
import type { AppUser } from "../../lib/auth-client"
import type { AppSession } from "../../lib/session"
import { AccountPanel } from "./account-panel"
import { AppearancePanel } from "./appearance-panel"
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

export const SettingsSection = Schema.Literal(
  "Account",
  "Profile",
  "Privacy",
  "Appearance",
  "Site",
  "Player",
  "Subtitles",
  "Notifications",
  "Integrations",
  "Sessions",
  "Passkeys"
)
export type SettingsSection = typeof SettingsSection.Type

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
  session,
  onClose,
}: {
  section: SettingsSection
  open: boolean
  session: AppSession | null
  onClose: () => void
}) {
  const user = session?.user ?? null
  if (section === "Account")
    return (
      <AccountPanel
        user={user}
        sessionExpiresAt={session?.session.expiresAt ?? null}
      />
    )
  if (section === "Profile") return <ProfilePanel open={open} user={user} />
  if (section === "Privacy") return <PrivacyPanel open={open} user={user} />
  if (section === "Appearance") return <AppearancePanel />
  if (section === "Site") return <SitePanel />
  if (section === "Player") return <PlayerPanel />
  if (section === "Integrations")
    return <IntegrationsPanel user={user} onClose={onClose} />
  if (section === "Sessions") return <SessionsPanel open={open} user={user} />
  if (section === "Passkeys") return <PasskeysPanel user={user} />
  return <PlaceholderPanel title={section} />
}

export function SettingsDialog({
  open,
  onOpenChange,
  requestedSection,
  session,
  onLogout,
  logoutPending,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  requestedSection?: SettingsSection | null
  session: AppSession | null
  onLogout: () => void
  logoutPending: boolean
}) {
  const [active, setActive] = useState<SettingsSection>("Account")
  const user: AppUser | null = session?.user ?? null
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
            <SectionContent
              section={active}
              open={open}
              session={session}
              onClose={() => onOpenChange(false)}
            />
          </main>
        </div>
      </DialogContent>
    </Dialog>
  )
}
