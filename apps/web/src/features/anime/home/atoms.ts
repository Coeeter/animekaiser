import { Atom, Result } from "@effect-atom/atom-react"
import type { AnyRouter } from "@tanstack/react-router"
import { KaiserRpcClient } from "../../../services/api-clients"

export const homeAtom = KaiserRpcClient.query("GetAnimeHome", void 0)
export const randomAnimeAtom = KaiserRpcClient.query("GetRandomAnime", void 0)

export const navigateToRandomAnimeAtom = Atom.family((router: AnyRouter) =>
  Atom.make((get) => {
    const navigate = () => {
      Result.builder(get(randomAnimeAtom))
        .onSuccess((id) => {
          void router.navigate({
            to: "/series/$id",
            params: { id },
            replace: true,
          })
        })
        .orNull()
    }

    get.subscribe(randomAnimeAtom, navigate)

    navigate()
  })
)
