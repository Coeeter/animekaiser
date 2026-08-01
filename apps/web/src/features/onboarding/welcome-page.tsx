import type { ExternalListProvider } from "@animekaiser/domain"
import { Badge } from "@animekaiser/ui/components/badge"
import { Button } from "@animekaiser/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@animekaiser/ui/components/card"
import { Field, FieldError, FieldLabel } from "@animekaiser/ui/components/field"
import { Input } from "@animekaiser/ui/components/input"
import { Skeleton } from "@animekaiser/ui/components/skeleton"
import { cn } from "@animekaiser/ui/lib/utils"
import {
  Result,
  useAtomRefresh,
  useAtomSet,
  useAtomValue,
} from "@effect-atom/atom-react"
import { Link } from "@tanstack/react-router"
import {
  ArrowRight,
  Check,
  CircleCheck,
  Link2,
  Loader2,
  PartyPopper,
  Sparkles,
} from "lucide-react"
import { useEffect, useState } from "react"
import { apiUrl, authClient } from "../../services/api-clients"
import { errorMessage } from "../../utils/error"
import { sessionAtom } from "../auth/atoms"
import { accountHealthAtom } from "../integrations/atoms"
import {
  beginOnboardingAtom,
  checkUsernameAtom,
  completeOnboardingAtom,
  ownProfileAtom,
  suggestUsernamesAtom,
} from "../profile/atoms"
import { Confetti } from "./confetti"
import { ImportProgress } from "./import-progress"
import type { OnboardingStep } from "./steps"
import { onboardingSteps, stepIndex } from "./steps"

const providerLabels: Record<ExternalListProvider, string> = {
  mal: "MyAnimeList",
  anilist: "AniList",
}

export function WelcomePage({
  step,
  onStepChange,
}: {
  step: OnboardingStep
  onStepChange: (step: OnboardingStep) => void
}) {
  const beginOnboarding = useAtomSet(beginOnboardingAtom, { mode: "promise" })

  useEffect(() => {
    void beginOnboarding({ payload: void 0 }).catch(() => undefined)
  }, [beginOnboarding])

  return (
    <main className="flex min-h-svh flex-col items-center gap-8 p-4 py-10 md:p-6">
      <Link
        to="/"
        className="flex items-center gap-2 font-medium text-foreground"
      >
        <img src="/logo.svg" alt="AnimeKaiser" className="size-8 rounded-md" />
        animekaiser
      </Link>
      <div className="flex w-full max-w-xl flex-col gap-6">
        <StepIndicator current={step} />
        {step === "username" ? (
          <UsernameStep onDone={() => onStepChange("connect")} />
        ) : null}
        {step === "connect" ? (
          <ConnectStep
            onDone={() => onStepChange("import")}
            onSkip={() => onStepChange("done")}
          />
        ) : null}
        {step === "import" ? (
          <ImportStep onDone={() => onStepChange("done")} />
        ) : null}
        {step === "done" ? <DoneStep /> : null}
      </div>
    </main>
  )
}

function StepIndicator({ current }: { current: OnboardingStep }) {
  const activeIndex = stepIndex(current)

  return (
    <ol className="flex items-center gap-2">
      {onboardingSteps.map((item, index) => {
        const done = index < activeIndex
        const active = index === activeIndex

        return (
          <li key={item.id} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                "grid size-7 shrink-0 place-items-center rounded-full border text-xs font-semibold transition-colors",
                done && "border-primary bg-primary text-primary-foreground",
                active && !done && "border-primary text-primary",
                !done && !active && "text-muted-foreground"
              )}
            >
              {done ? <Check className="size-3.5" /> : index + 1}
            </span>
            <span
              className={cn(
                "hidden text-xs font-medium sm:block",
                active ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {item.label}
            </span>
            {index < onboardingSteps.length - 1 ? (
              <span
                className={cn("h-px flex-1 bg-border", done && "bg-primary/60")}
              />
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}

function UsernameStep({ onDone }: { onDone: () => void }) {
  const suggestionsResult = useAtomValue(suggestUsernamesAtom)
  const checkUsername = useAtomSet(checkUsernameAtom, { mode: "promise" })
  const refreshSession = useAtomRefresh(sessionAtom)
  const refreshProfile = useAtomRefresh(ownProfileAtom)

  const [username, setUsername] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const suggestions = Result.builder(suggestionsResult)
    .onSuccess((suggested) => suggested)
    .orNull()

  const value = username ?? suggestions?.primary ?? ""

  const save = async () => {
    const next = value.trim()
    setError(null)

    if (next.length < 3) {
      setError("Usernames need at least 3 characters.")
      return
    }

    setPending(true)
    try {
      const { available } = await checkUsername({
        payload: { username: next },
      })

      if (!available) {
        setError("That username is taken.")
        return
      }

      const result = await authClient.updateUser({
        username: next,
        displayUsername: next,
        name: next,
      })
      if (result.error) throw result.error

      refreshSession()
      refreshProfile()
      onDone()
    } catch (cause) {
      setError(errorMessage(cause, "Unable to save that username"))
    } finally {
      setPending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1 className="text-2xl font-bold">Pick your username</h1>
        </CardTitle>
        <CardDescription>
          This is how other people will find you. You can change it later.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {suggestions === null ? (
          <Skeleton className="h-9 w-full" />
        ) : (
          <Field data-invalid={Boolean(error)}>
            <FieldLabel htmlFor="onboarding-username">Username</FieldLabel>
            <Input
              id="onboarding-username"
              autoComplete="username"
              maxLength={20}
              minLength={3}
              pattern="[A-Za-z0-9_]+"
              value={value}
              aria-invalid={Boolean(error)}
              onChange={(event) => {
                setError(null)
                setUsername(event.target.value)
              }}
            />
            {error ? <FieldError>{error}</FieldError> : null}
          </Field>
        )}

        {suggestions && suggestions.suggestions.length > 0 ? (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Suggestions
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestions.suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => {
                    setError(null)
                    setUsername(suggestion)
                  }}
                >
                  <Badge
                    variant={value === suggestion ? "default" : "outline"}
                    className="cursor-pointer px-3 py-1 text-sm"
                  >
                    <Sparkles data-icon="inline-start" />
                    {suggestion}
                  </Badge>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
      <CardFooter>
        <Button
          className="w-full"
          disabled={pending}
          onClick={() => void save()}
        >
          {pending ? <Loader2 className="animate-spin" /> : null}
          {pending ? "Saving…" : "Continue"}
          {pending ? null : <ArrowRight data-icon="inline-end" />}
        </Button>
      </CardFooter>
    </Card>
  )
}

function ConnectStep({
  onDone,
  onSkip,
}: {
  onDone: () => void
  onSkip: () => void
}) {
  const accountsResult = useAtomValue(accountHealthAtom)

  const accounts = Result.builder(accountsResult)
    .onSuccess((value) => value)
    .orElse(() => [])

  const connected = accounts.filter((account) => account.connected)

  const connectHref = (provider: ExternalListProvider) => {
    const callbackURL = new URL(window.location.href)
    callbackURL.searchParams.set("step", "connect")
    return `${apiUrl}/api/link/${provider}?callbackURL=${encodeURIComponent(callbackURL.toString())}`
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1 className="text-2xl font-bold">Bring your list with you</h1>
        </CardTitle>
        <CardDescription>
          Connect MyAnimeList or AniList to import what you have already
          watched. You can always do this later in settings.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {accounts.map((account) => (
          <div
            key={account.provider}
            className="flex items-center justify-between gap-3 rounded-2xl border bg-card/70 p-3"
          >
            <div className="min-w-0">
              <p className="font-medium">{providerLabels[account.provider]}</p>
              <p className="text-xs text-muted-foreground">
                {account.connected ? "Connected" : "Not connected"}
              </p>
            </div>
            {account.connected ? (
              <Badge variant="secondary">
                <CircleCheck data-icon="inline-start" />
                Ready
              </Badge>
            ) : (
              <Button asChild variant="outline" size="sm">
                <a href={connectHref(account.provider)}>
                  <Link2 data-icon="inline-start" />
                  Connect
                </a>
              </Button>
            )}
          </div>
        ))}
      </CardContent>
      <CardFooter className="flex-col gap-2">
        <Button
          className="w-full"
          disabled={connected.length === 0}
          onClick={onDone}
        >
          Import my list
          <ArrowRight data-icon="inline-end" />
        </Button>
        <Button variant="ghost" className="w-full" onClick={onSkip}>
          Skip for now
        </Button>
      </CardFooter>
    </Card>
  )
}

function ImportStep({ onDone }: { onDone: () => void }) {
  const accountsResult = useAtomValue(accountHealthAtom)
  const [provider, setProvider] = useState<ExternalListProvider | null>(null)

  const connected = Result.builder(accountsResult)
    .onSuccess((value) => value.filter((account) => account.connected))
    .orElse(() => [])

  if (provider) {
    return <ImportProgress provider={provider} onDone={onDone} />
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1 className="text-2xl font-bold">Choose where to import from</h1>
        </CardTitle>
        <CardDescription>
          We will copy your entries across. Nothing is sent back until you
          change something.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {connected.map((account) => (
          <Button
            key={account.provider}
            variant="outline"
            className="h-14 justify-between"
            onClick={() => setProvider(account.provider)}
          >
            {providerLabels[account.provider]}
            <ArrowRight data-icon="inline-end" />
          </Button>
        ))}
      </CardContent>
      <CardFooter>
        <Button variant="ghost" className="w-full" onClick={onDone}>
          Skip for now
        </Button>
      </CardFooter>
    </Card>
  )
}

function DoneStep() {
  const completeOnboarding = useAtomSet(completeOnboardingAtom, {
    mode: "promise",
  })

  useEffect(() => {
    void completeOnboarding({ payload: void 0 }).catch(() => undefined)
  }, [completeOnboarding])

  return (
    <>
      <Confetti />
      <Card>
        <CardHeader className="items-center text-center">
          <div className="grid size-14 place-items-center rounded-2xl bg-primary/15 text-primary">
            <PartyPopper className="size-7" />
          </div>
          <CardTitle>
            <h1 className="text-2xl font-bold">You are all set</h1>
          </CardTitle>
          <CardDescription>
            Your library is ready. Time to find something to watch.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button asChild className="w-full" size="lg">
            <Link to="/">
              Ready to watch anime
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </>
  )
}
