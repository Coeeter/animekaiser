import { createFileRoute } from "@tanstack/react-router"
import { Result, useAtomValue } from "@effect-atom/atom-react"
import { pingAtom } from "../rpc"

export const Route = createFileRoute("/")({ component: App })

function App() {
  const ping = useAtomValue(pingAtom)

  return (
    <div className="flex min-h-svh p-6">
      <div className="flex max-w-md min-w-0 flex-col gap-4 text-sm leading-loose">
        <h1 className="font-medium">Effect RPC</h1>
        <p>
          {Result.match(ping, {
            onInitial: () => "Connecting…",
            onFailure: () => "RPC failed",
            onSuccess: ({ value }) => `RPC says: ${value}`,
          })}
        </p>
      </div>
    </div>
  )
}
