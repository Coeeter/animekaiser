import { createKaiserAuthClient } from "@animekaiser/auth/web"
import { KaiserRpcs } from "@animekaiser/domain"
import * as Socket from "@effect/platform/Socket"
import { RpcClient, RpcSerialization } from "@effect/rpc"
import { Atom, AtomRpc } from "@effect-atom/atom-react"
import * as Layer from "effect/Layer"

export const apiUrl = import.meta.env.VITE_API_URL

if (!apiUrl) throw new Error("Missing VITE_API_URL")

const rpcSockets = new Set<WebSocket>()
const authEvents = new EventTarget()

const TrackedWebSocketConstructor = Layer.succeed(
  Socket.WebSocketConstructor,
  (url: string, protocols?: string | Array<string>) => {
    const socket = new WebSocket(url, protocols)

    rpcSockets.add(socket)
    socket.addEventListener("close", () => rpcSockets.delete(socket))

    return socket
  }
)

const RpcSocketLive = Socket.layerWebSocket(
  new URL("/rpc", apiUrl).toString()
).pipe(Layer.provide(TrackedWebSocketConstructor))

const closeRpcSocket = (socket: WebSocket) =>
  new Promise<void>((resolve) => {
    if (socket.readyState === WebSocket.CLOSED) {
      resolve()
      return
    }

    socket.addEventListener("close", () => resolve(), { once: true })
    socket.close(4001, "Authentication changed")
  })

export async function reconnectKaiserRpc() {
  await Promise.all(Array.from(rpcSockets, closeRpcSocket))
  authEvents.dispatchEvent(new Event("change"))
}

function onAuthChange(listener: () => void) {
  authEvents.addEventListener("change", listener)

  return () => authEvents.removeEventListener("change", listener)
}

/**
 * The refresh argument is essential: `registry.refresh` invalidates only the
 * atom it is given, so without forwarding, refreshing this wrapper re-runs the
 * read and hands back the wrapped atom's cached value.
 */
export const refreshOnAuthChange = Atom.family(<A>(atom: Atom.Atom<A>) =>
  Atom.readable(
    (get) => {
      get.addFinalizer(onAuthChange(() => get.refresh(atom)))
      get.subscribe(atom, (value) => get.setSelf(value))

      return get(atom)
    },
    (refresh) => refresh(atom)
  )
)

export class KaiserRpcClient extends AtomRpc.Tag<KaiserRpcClient>()(
  "KaiserRpcClient",
  {
    group: KaiserRpcs,
    protocol: RpcClient.layerProtocolSocket({
      retryTransientErrors: true,
    }).pipe(
      Layer.provide(RpcSocketLive),
      Layer.provide(RpcSerialization.layerNdjson)
    ),
  }
) {}

export const authClient = createKaiserAuthClient({
  baseURL: apiUrl,
})
