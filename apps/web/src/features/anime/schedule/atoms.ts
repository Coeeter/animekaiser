import { KaiserRpcClient } from "../../../services/api-clients"

export const scheduleAtom = (
  from: number,
  to: number,
  page: number,
  perPage: number
) => KaiserRpcClient.query("ListAnimeSchedule", { from, to, page, perPage })
