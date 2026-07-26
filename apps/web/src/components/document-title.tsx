import { useLocation, useMatches } from "@tanstack/react-router"

const siteTitle = "AnimeKaiser"

export function DocumentTitle() {
  const pathname = useLocation({ select: (location) => location.pathname })
  const matches = useMatches()

  const match = [...matches].reverse().find((value) => value.staticData.title)
  const page = match?.staticData.title

  return (
    <title>
      {page
        ? `${page} | ${siteTitle}`
        : pathname === "/"
          ? siteTitle
          : `Not Found | ${siteTitle}`}
    </title>
  )
}
