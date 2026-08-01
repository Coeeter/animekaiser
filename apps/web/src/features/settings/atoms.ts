import { Atom } from "@effect-atom/atom-react"
import * as Schema from "effect/Schema"
import { toast } from "sonner"

export const SettingsSection = Schema.Literal(
  "Account",
  "Profile",
  "Appearance",
  "Playback",
  "Integrations",
  "History"
)
export type SettingsSection = typeof SettingsSection.Type

export const settingsOpenAtom = Atom.make(false)

const sectionAliases: Record<string, SettingsSection> = {
  Privacy: "Profile",
  Site: "Appearance",
  Player: "Playback",
  Subtitles: "Playback",
  Sessions: "Account",
  Passkeys: "Account",
  Notifications: "Account",
}

export const resolveSettingsSection = (value: string): SettingsSection =>
  Schema.is(SettingsSection)(value)
    ? value
    : (sectionAliases[value] ?? "Account")

const selectedSettingsSectionAtom = Atom.make<SettingsSection>("Account")

export const settingsSectionAtom = Atom.writable<SettingsSection, string>(
  (get) => get(selectedSettingsSectionAtom),
  (ctx, value) =>
    ctx.set(selectedSettingsSectionAtom, resolveSettingsSection(value))
)

export const settingsQueryAtom = Atom.make("")

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
