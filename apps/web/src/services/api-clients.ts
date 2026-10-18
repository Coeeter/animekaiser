import { createKaiserAuthClient } from "@animekaiser/auth/web"
import { KaiserRpcs } from "@animekaiser/domain"
import * as Cause from "effect/Cause"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import * as Atom from "effect/reactivity/Atom"
import type * as AtomRegistry from "effect/reactivity/AtomRegistry"
import * as AtomRpc from "effect/reactivity/AtomRpc"
import { RpcClient, RpcSerialization } from "effect/rpc"
import * as RpcClientError from "effect/rpc/RpcClientError"
import * as Schema from "effect/Schema"
import * as Socket from "effect/socket/Socket"

export const apiUrl = import.meta.env.VITE_API_URL

if (!apiUrl) throw new Error("Missing VITE_API_URL")

export type RpcConnectionStatus = "connecting" | "connected" | "disconnected"

const rpcConnectionEvents = new EventTarget()
let rpcConnectionStatus: RpcConnectionStatus = "connecting"

function setRpcConnectionStatus(status: RpcConnectionStatus) {
  if (rpcConnectionStatus === status) return

  rpcConnectionStatus = status
  rpcConnectionEvents.dispatchEvent(new Event("change"))
}

const TrackedWebSocketConstructor = Layer.succeed(
  Socket.WebSocketConstructor,
  (url, options) => {
    setRpcConnectionStatus("connecting")

    // Browsers take only subprotocols; header options are for server runtimes.
    const socket = new WebSocket(
      url,
      typeof options === "string" || Array.isArray(options)
        ? options
        : undefined
    )

    socket.addEventListener("open", () => {
      setTimeout(() => {
        if (socket.readyState === WebSocket.OPEN)
          setRpcConnectionStatus("connected")
      }, 0)
    })
    socket.addEventListener("close", () =>
      setRpcConnectionStatus("disconnected")
    )
    socket.addEventListener("error", () =>
      setRpcConnectionStatus("disconnected")
    )

    return socket
  }
)

const RpcSocketLive = Socket.layerWebSocket(
  new URL("/rpc", apiUrl).toString()
).pipe(Layer.provide(TrackedWebSocketConstructor))

export const rpcConnectionStatusAtom = Atom.make((get) => {
  const update = () => get.setSelf(rpcConnectionStatus)

  rpcConnectionEvents.addEventListener("change", update)
  get.addFinalizer(() =>
    rpcConnectionEvents.removeEventListener("change", update)
  )

  return rpcConnectionStatus
}).pipe(Atom.keepAlive)

const isRpcClientError = Schema.is(RpcClientError.RpcClientError)

// Transport failures (socket, HTTP, worker) recover on reconnect; client
// defects do not.
export function isRpcProtocolFailure(value: unknown) {
  if (!AsyncResult.isAsyncResult(value) || !AsyncResult.isFailure(value))
    return false

  const failure = Cause.findErrorOption(value.cause)

  return (
    Option.isSome(failure) &&
    isRpcClientError(failure.value) &&
    failure.value.reason._tag !== "RpcClientDefect"
  )
}

// Queries that ran while the socket was down cache a failure nothing else retries.
export const rpcConnectionRecoveryAtom = Atom.family(
  (registry: AtomRegistry.AtomRegistry) =>
    Atom.make((get) => {
      let reconnecting = rpcConnectionStatus !== "connected"

      const recover = () => {
        if (rpcConnectionStatus !== "connected") {
          reconnecting = true
          return
        }

        if (!reconnecting) return

        reconnecting = false

        for (const node of registry.getNodes().values()) {
          if (isRpcProtocolFailure(node.value())) registry.refresh(node.atom)
        }
      }

      rpcConnectionEvents.addEventListener("change", recover)
      get.addFinalizer(() =>
        rpcConnectionEvents.removeEventListener("change", recover)
      )
    })
)

// Cookies are attached during the WebSocket handshake, so a session change needs
// a new socket; a document load also drops every atom cached against the old one.
export function navigateAfterAuthChange(href: string) {
  window.location.assign(href)
}

export class KaiserRpcClient extends AtomRpc.Service<KaiserRpcClient>()(
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
