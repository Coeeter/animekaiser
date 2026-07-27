import { Button } from "@animekaiser/ui/components/button"
import { Link } from "@tanstack/react-router"
import { AlertTriangle } from "lucide-react"

export function RouteErrorPage({
  error,
  reset,
}: {
  error: unknown
  reset: () => void
}) {
  const invalidUrl = error instanceof Error && error.name === "SearchParamError"

  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-2xl items-center justify-center p-4 md:p-6">
      <div
        role="alert"
        className="flex w-full flex-col items-center gap-5 rounded-2xl border border-dashed bg-card/50 p-8 text-center"
      >
        <div className="grid size-12 place-items-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="size-6" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">
            {invalidUrl ? "This URL is not valid" : "This page could not open"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {invalidUrl
              ? "One or more URL parameters could not be understood. Check the link or return to a known page."
              : "An unexpected error prevented this page from loading. Try again or return home."}
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="outline" onClick={reset}>
            Try again
          </Button>
          <Button asChild>
            <Link to="/">Go home</Link>
          </Button>
        </div>
      </div>
    </main>
  )
}
