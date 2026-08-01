import type { AppSession } from "@animekaiser/domain"
import { Button } from "@animekaiser/ui/components/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@animekaiser/ui/components/dialog"
import { Separator } from "@animekaiser/ui/components/separator"
import { cn } from "@animekaiser/ui/lib/utils"
import {
  Result,
  useAtom,
  useAtomMount,
  useAtomValue,
} from "@effect-atom/atom-react"
import { Link } from "@tanstack/react-router"
import { LogOut, Search, XIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { IconInput } from "../../components/icon-input"
import { authClient, navigateAfterAuthChange } from "../../services/api-clients"
import { errorMessage } from "../../utils/error"
import { sessionAtom } from "../auth/atoms"
import type { AppUser } from "../auth/user"
import { AccountPanel } from "./account-panel"
import { AppearancePanel } from "./appearance-panel"
import type { SettingsSection } from "./atoms"
import {
  oauthResultAtom,
  settingsOpenAtom,
  settingsQueryAtom,
  settingsSectionAtom,
} from "./atoms"
import { HistoryPanel } from "./history-panel"
import { IntegrationsPanel } from "./integrations-panel"
import { PlaybackPanel } from "./playback-panel"
import { ProfilePanel } from "./profile-panel"
import {
  matchesQuery,
  sectionMatchesQuery,
  settingEntries,
  settingsSections,
} from "./settings-registry"
import { NoSettingsMatch } from "./settings-shared"

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
        currentSessionToken={session?.session.token ?? null}
      />
    )
  if (section === "Profile") return <ProfilePanel user={user} />
  if (section === "Appearance") return <AppearancePanel />
  if (section === "Playback") return <PlaybackPanel />
  if (section === "Integrations") return <IntegrationsPanel user={user} />
  return <HistoryPanel />
}

export function SettingsDialog() {
  const [open, setOpen] = useAtom(settingsOpenAtom)
  const [active, setActive] = useAtom(settingsSectionAtom)
  const [query, setQuery] = useAtom(settingsQueryAtom)
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

  const visibleSections = settingsSections.filter((section) =>
    sectionMatchesQuery(section, query)
  )
  const selected =
    visibleSections.find((section) => section.title === active) ??
    visibleSections[0] ??
    settingsSections[0]
  const sectionHasMatch = settingEntries.some(
    (entry) => entry.section === selected.title && matchesQuery(entry, query)
  )
  const select = (section: SettingsSection) => {
    setActive(section)
    setQuery("")
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={logoutPending}
                  onClick={() => void logout()}
                >
                  <LogOut data-icon="inline-start" />
                  Sign out
                </Button>
              ) : (
                <Button asChild size="sm" variant="outline">
                  <Link to="/login" search={{ redirect: undefined }}>
                    Login
                  </Link>
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
          <div className="relative mt-4">
            <IconInput
              icon={Search}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search settings…"
              className="h-9"
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
        </DialogHeader>
        <div className="flex min-h-0 min-w-0 flex-col md:grid md:grid-cols-[17rem_minmax(0,1fr)]">
          {visibleSections.length ? (
            <aside className="hidden overflow-y-auto border-r bg-muted/20 p-3 md:block">
              <nav className="flex flex-col gap-1">
                {visibleSections.map((section) => (
                  <button
                    type="button"
                    key={section.title}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground",
                      selected.title === section.title &&
                        "bg-muted text-foreground"
                    )}
                    onClick={() => select(section.title)}
                  >
                    <section.icon className="size-4" />
                    {section.title}
                  </button>
                ))}
              </nav>
            </aside>
          ) : null}
          <main
            className={cn(
              "min-h-0 w-full min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain p-4 md:p-6",
              !visibleSections.length && "md:col-span-2"
            )}
          >
            {visibleSections.length ? (
              <>
                <div className="no-scrollbar -mx-4 mb-4 flex max-w-full gap-2 overflow-x-auto px-4 pb-2 md:hidden">
                  {visibleSections.map((section) => (
                    <button
                      key={section.title}
                      type="button"
                      aria-current={
                        selected.title === section.title ? "page" : undefined
                      }
                      className={cn(
                        "inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3 text-sm font-medium whitespace-nowrap transition",
                        selected.title === section.title
                          ? "border-primary/60 bg-primary/15 text-primary"
                          : "bg-card/60 text-muted-foreground"
                      )}
                      onClick={() => select(section.title)}
                    >
                      <section.icon className="size-4" />
                      {section.title}
                    </button>
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
                {query && !sectionHasMatch ? (
                  <NoSettingsMatch query={query} />
                ) : (
                  <SectionContent section={selected.title} session={session} />
                )}
              </>
            ) : (
              <NoSettingsMatch query={query} />
            )}
          </main>
        </div>
      </DialogContent>
    </Dialog>
  )
}
