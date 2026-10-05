import { Result, useAtomValue } from "@effect-atom/atom-react"
import { Link } from "@tanstack/react-router"
import { sessionAtom } from "../auth/atoms"
import { mainLinks, personalLinks } from "./nav-links"

const repositoryUrl = "https://github.com/Coeeter/animekaiser"

const projectLinks = [
  { title: "GitHub", href: repositoryUrl },
  { title: "Report a bug", href: `${repositoryUrl}/issues/new` },
  { title: "Contribute", href: `${repositoryUrl}#local-setup` },
]

const credits = [
  { label: "AniList", href: "https://anilist.co" },
  { label: "MyAnimeList", href: "https://myanimelist.net" },
  { label: "Jikan", href: "https://jikan.moe" },
  { label: "ani.zip", href: "https://ani.zip" },
]

const linkClassName =
  "w-fit text-sm text-muted-foreground transition-colors hover:text-foreground"

export function SiteFooter() {
  const signedIn = Result.builder(useAtomValue(sessionAtom))
    .onSuccess((session) => session !== null)
    .orElse(() => false)

  return (
    <footer className="border-t bg-surface-sunken">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-12 md:px-6">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="flex flex-col items-start gap-4">
            <Link to="/" className="flex items-center gap-2.5">
              <img className="size-9 rounded-xl" src="/logo.svg" alt="" />
              <span className="font-heading text-base font-semibold tracking-wide lowercase">
                animekaiser
              </span>
            </Link>
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              Find, track and watch anime, with your list kept in sync with
              MyAnimeList and AniList.
            </p>
          </div>

          <FooterColumn title="Discover">
            {mainLinks.map((link) => (
              <Link key={link.href} to={link.href} className={linkClassName}>
                {link.title}
              </Link>
            ))}
          </FooterColumn>

          {signedIn ? (
            <FooterColumn title="Your library">
              {personalLinks.map((link) => (
                <Link key={link.href} to={link.href} className={linkClassName}>
                  {link.title}
                </Link>
              ))}
            </FooterColumn>
          ) : (
            <FooterColumn title="Account">
              <Link
                to="/login"
                search={{ redirect: undefined }}
                className={linkClassName}
              >
                Log in
              </Link>
              <Link to="/register" className={linkClassName}>
                Create an account
              </Link>
            </FooterColumn>
          )}

          <FooterColumn title="Open source">
            {projectLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className={linkClassName}
              >
                {link.title}
              </a>
            ))}
          </FooterColumn>
        </div>

        <div className="flex flex-col gap-2 border-t pt-6 text-xs text-muted-foreground/80 md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} AnimeKaiser</p>
          <p className="max-w-2xl md:text-right">
            No video is hosted here; streams come from third-party providers.
            Anime data from{" "}
            {credits.map((credit, index) => (
              <span key={credit.href}>
                <a
                  href={credit.href}
                  target="_blank"
                  rel="noreferrer"
                  className="underline-offset-4 hover:text-foreground hover:underline"
                >
                  {credit.label}
                </a>
                {index < credits.length - 2
                  ? ", "
                  : index === credits.length - 2
                    ? " and "
                    : "."}
              </span>
            ))}
          </p>
        </div>
      </div>
    </footer>
  )
}

function FooterColumn({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <nav className="flex flex-col gap-2.5" aria-label={title}>
      <p className="mb-1 text-xs font-semibold tracking-wider text-foreground/80 uppercase">
        {title}
      </p>
      {children}
    </nav>
  )
}
