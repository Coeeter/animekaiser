import { Atom } from "@effect-atom/atom-react"
import * as Schema from "effect/Schema"
import { toast } from "sonner"

export const SettingsSection = Schema.Literal(
  "Account",
  "Profile",
  "Privacy",
  "Appearance",
  "Site",
  "Player",
  "Subtitles",
  "History",
  "Notifications",
  "Integrations",
  "Sessions",
  "Passkeys"
)
export type SettingsSection = typeof SettingsSection.Type

export const settingsOpenAtom = Atom.make(false)

export const settingsSectionAtom = Atom.make<SettingsSection>("Account")

export const oauthResultAtom = Atom.make((get) => {
  const params = new URLSearchParams(window.location.search)
  if (params.get("oauth_result") !== "connected") return

  const provider =
    params.get("oauth_provider") === "mal" ? "MyAnimeList" : "AniList"

  toast.success(`${provider} connected.`)
  get.set(settingsSectionAtom, "Integrations")
  get.set(settingsOpenAtom, true)

  params.delete("oauth_result")
  params.delete("oauth_provider")

  const query = params.toString()

  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}${query ? `?${query}` : ""}`
  )
})
