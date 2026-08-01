import { createKaiserAuthClient } from "@animekaiser/auth/web"
import { KaiserRpcs } from "@animekaiser/domain"
import * as Socket from "@effect/platform/Socket"
import { RpcClient, RpcSerialization } from "@effect/rpc"
import * as RpcClientError from "@effect/rpc/RpcClientError"
import { Atom, AtomRpc, type Registry } from "@effect-atom/atom-react"
import * as Cause from "effect/Cause"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"

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
  (url: string, protocols?: string | Array<string>) => {
    setRpcConnectionStatus("connecting")

    const socket = new WebSocket(url, protocols)

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

const RpcFailure = Schema.TaggedStruct("Failure", { cause: Schema.Unknown })
const decodeRpcFailure = Schema.decodeUnknownOption(RpcFailure)
const isRpcClientError = Schema.is(RpcClientError.RpcClientError)

export function isRpcProtocolFailure(value: unknown) {
  const result = decodeRpcFailure(value)

  if (Option.isNone(result) || !Cause.isCause(result.value.cause)) return false

  const failure = Cause.failureOption(result.value.cause)

  return (
    Option.isSome(failure) &&
    isRpcClientError(failure.value) &&
    failure.value.reason === "Protocol"
  )
}

// Queries that ran while the socket was down cache a failure nothing else retries.
export const rpcConnectionRecoveryAtom = Atom.family(
  (registry: Registry.Registry) =>
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
