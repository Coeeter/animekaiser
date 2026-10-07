import type { LucideIcon } from "lucide-react"
import {
  Link2,
  Play,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
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

export const settingsSections: ReadonlyArray<SettingsSectionDef> = [
  {
    title: "Account",
    icon: Settings2,
    description: "Identity, password, sessions, and passkeys.",
  },
  {
    title: "Profile",
    icon: User,
    description: "Public profile, avatar, bio, and visibility.",
  },
  {
    title: "General",
    icon: SlidersHorizontal,
    description: "Site-wide display preferences.",
  },
  {
    title: "Playback",
    icon: Play,
    description: "Player defaults and subtitle appearance.",
  },
  {
    title: "Integrations",
    icon: Link2,
    description: "MyAnimeList and AniList connections.",
  },
  {
    title: "Privacy & data",
    icon: ShieldCheck,
    description: "Your watch history and a copy of your list.",
  },
]

export const settingEntries: ReadonlyArray<SettingEntry> = [
  {
    id: "account.identity",
    section: "Account",
    title: "Identity",
    keywords: ["username", "email", "handle"],
  },
  {
    id: "account.access",
    section: "Account",
    title: "Access",
    keywords: ["login method", "session expires", "last used"],
  },
  {
    id: "account.password",
    section: "Account",
    title: "Change password",
    keywords: ["password", "credentials", "security"],
  },
  {
    id: "account.sessions",
    section: "Account",
    title: "Active sessions",
    keywords: ["devices", "sign out everywhere", "revoke", "logout"],
  },
  {
    id: "account.passkeys",
    section: "Account",
    title: "Passkeys",
    keywords: ["webauthn", "biometric", "touch id", "face id", "passwordless"],
  },
  {
    id: "account.delete",
    section: "Account",
    title: "Delete account",
    keywords: ["remove", "danger", "permanent", "close account"],
  },
  {
    id: "profile.banner",
    section: "Profile",
    title: "Profile banner",
    keywords: ["cover", "header", "image"],
  },
  {
    id: "profile.avatar",
    section: "Profile",
    title: "Profile picture",
    keywords: ["avatar", "photo", "image"],
  },
  {
    id: "profile.username",
    section: "Profile",
    title: "Username",
    keywords: ["handle", "display name"],
  },
  {
    id: "profile.bio",
    section: "Profile",
    title: "Bio",
    keywords: ["about", "description"],
  },
  {
    id: "profile.visibility",
    section: "Profile",
    title: "Profile visibility",
    keywords: ["private", "public", "hidden"],
  },
  {
    id: "profile.sharing",
    section: "Profile",
    title: "What visitors can see",
    keywords: ["statistics", "activity", "anime list", "share"],
  },
  {
    id: "general.titleLanguage",
    section: "General",
    title: "Anime title language",
    keywords: ["romaji", "english", "naming"],
  },
  {
    id: "playback.viewMode",
    section: "Playback",
    title: "Theater mode",
    keywords: ["immersive", "layout", "episodes", "sidebar", "view"],
  },
  {
    id: "playback.audio",
    section: "Playback",
    title: "Default audio",
    keywords: ["sub", "dub", "dubbed", "subbed", "language"],
  },
  {
    id: "playback.provider",
    section: "Playback",
    title: "Preferred provider",
    keywords: ["server", "source", "provider"],
  },
  {
    id: "playback.subtitleLanguage",
    section: "Playback",
    title: "Subtitle language",
    keywords: ["captions", "cc", "language", "subtitles"],
  },
  {
    id: "playback.blurUnwatched",
    section: "Playback",
    title: "Hide spoilers",
    keywords: ["blur", "spoiler", "thumbnail", "synopsis"],
  },
  {
    id: "playback.autoLandscape",
    section: "Playback",
    title: "Landscape in fullscreen",
    keywords: ["rotate", "orientation", "mobile", "fullscreen"],
  },
  {
    id: "playback.autoplay",
    section: "Playback",
    title: "Autoplay episodes",
    keywords: ["auto play", "start"],
  },
  {
    id: "playback.autoNext",
    section: "Playback",
    title: "Auto next episode",
    keywords: ["next", "continue", "queue"],
  },
  {
    id: "playback.autoSkipIntro",
    section: "Playback",
    title: "Auto skip intro",
    keywords: ["opening", "op", "skip"],
  },
  {
    id: "playback.autoSkipOutro",
    section: "Playback",
    title: "Auto skip outro",
    keywords: ["ending", "ed", "skip"],
  },
  {
    id: "integrations.syncOnFinish",
    section: "Integrations",
    title: "Update your lists when you finish an episode",
    keywords: ["mal", "anilist", "sync", "progress", "external list"],
  },
  {
    id: "playback.subtitles",
    section: "Playback",
    title: "Subtitle appearance",
    keywords: ["captions", "font", "size", "cc", "text"],
  },
  {
    id: "integrations.mal",
    section: "Integrations",
    title: "MyAnimeList",
    keywords: ["mal", "myanimelist", "connect", "import", "sync"],
  },
  {
    id: "integrations.anilist",
    section: "Integrations",
    title: "AniList",
    keywords: ["anilist", "al", "connect", "import", "sync"],
  },
  {
    id: "privacy.export",
    section: "Privacy & data",
    title: "Export your list",
    keywords: ["download", "backup", "xml", "json", "myanimelist", "anilist"],
  },
  {
    id: "privacy.history",
    section: "Privacy & data",
    title: "Watch history",
    keywords: ["episodes", "resume", "continue watching"],
  },
  {
    id: "privacy.clearHistory",
    section: "Privacy & data",
    title: "Clear watch history",
    keywords: ["delete", "wipe", "reset"],
  },
]

const terms = (query: string) =>
  query.trim().toLowerCase().split(/\s+/).filter(Boolean)

export const matchesQuery = (entry: SettingEntry, query: string): boolean => {
  const queryTerms = terms(query)
  if (queryTerms.length === 0) return true
  const values = [entry.title, entry.section, ...entry.keywords].map((value) =>
    value.toLowerCase()
  )
  return queryTerms.every((term) =>
    values.some((value) => value.includes(term))
  )
}

export const sectionMatchesQuery = (
  section: SettingsSectionDef,
  query: string
): boolean => {
  const queryTerms = terms(query)
  if (queryTerms.length === 0) return true
  const values = [section.title, section.description].map((value) =>
    value.toLowerCase()
  )
  return (
    queryTerms.every((term) => values.some((value) => value.includes(term))) ||
    settingEntries.some(
      (entry) => entry.section === section.title && matchesQuery(entry, query)
    )
  )
}
