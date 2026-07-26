import { KaiserRpcClient } from "../../../services/api-clients"
import {
  type CatalogSearch,
  catalogInput,
  DEFAULT_CATALOG_PER_PAGE,
} from "../common/search"

export const catalogAtom = (
  search: CatalogSearch,
  perPage = DEFAULT_CATALOG_PER_PAGE
) =>
  KaiserRpcClient.query("ListAnimeCatalog", catalogInput(search, perPage), {
    timeToLive: "1 minute",
  })
