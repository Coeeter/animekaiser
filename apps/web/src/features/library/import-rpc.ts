import type { ExternalListProvider, LibraryImportJob } from "@workspace/domain"
import { KaiserRpcClient } from "@workspace/rpc/client"
import * as Effect from "effect/Effect"
import * as Stream from "effect/Stream"
import { runRpc } from "../../lib/rpc-client"

export const startLibraryImport = (provider: ExternalListProvider) =>
  runRpc(
    Effect.gen(function* () {
      const client = yield* KaiserRpcClient
      return yield* client.StartLibraryImport({ provider })
    })
  )

export const watchLibraryImport = (
  id: string,
  onUpdate: (job: LibraryImportJob) => void
) =>
  runRpc(
    Effect.gen(function* () {
      const client = yield* KaiserRpcClient
      yield* client
        .WatchLibraryImport({ id })
        .pipe(Stream.runForEach((job) => Effect.sync(() => onUpdate(job))))
    })
  )
