import { createFileRoute } from "@tanstack/react-router"
import { Result, useAtomValue } from "@effect-atom/atom-react"
import { pingAtom } from "../rpc"

export const Route = createFileRoute("/")({ component: App })

function App() {
  const ping = useAtomValue(pingAtom)

  return (
    <main className="mx-auto flex min-h-[70svh] w-full max-w-6xl items-center px-6 py-16">
      <div className="max-w-2xl">
        <p className="mb-4 text-sm font-medium text-primary">AnimeKaiser</p>
        <h1 className="font-heading text-5xl font-black tracking-tight text-balance md:text-7xl">
          Your anime life, in one place.
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">
          The shell and account experience are ready. Discovery and library
          pages are the next migration slice.
        </p>
        <p className="mt-8 text-sm text-muted-foreground">
          {Result.match(ping, {
            onInitial: () => "Checking API…",
            onFailure: () => "API unavailable",
            onSuccess: () => "API connected",
          })}
        </p>
      </div>
    </main>
  )
}
