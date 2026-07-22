import { useLocation, useMatches } from "@tanstack/react-router"

const siteTitle = "AnimeKaiser"

export function DocumentTitle() {
  const pathname = useLocation({ select: (location) => location.pathname })
  const matches = useMatches()
  const watch = matches.find(
    (value) => value.routeId === "/watch/$malId/$provider/$episodeId"
  )
  const series = matches.find((value) => value.routeId === "/series/$id")
  const profile = matches.find((value) => value.routeId === "/u/$username")
  const match = [...matches].reverse().find((value) => value.staticData.title)
  const page = match?.staticData.title

  if (watch?.loaderData) {
    const anime = watch.loaderData.anime.title
    const title = anime.english ?? anime.romaji
    return (
      <title>{`${title} – Episode ${watch.loaderData.episode.number} | ${siteTitle}`}</title>
    )
  }

  if (series?.loaderData) {
    const title = series.loaderData.title
    return <title>{`${title.english ?? title.romaji} | ${siteTitle}`}</title>
  }

  if (profile)
    return <title>{`${profile.params.username} | ${siteTitle}`}</title>

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
