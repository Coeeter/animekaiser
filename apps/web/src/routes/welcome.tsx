import { createFileRoute, useNavigate } from "@tanstack/react-router"
import type { OnboardingStep } from "../features/onboarding/steps"
import { decodeWelcomeSearch } from "../features/onboarding/steps"
import { WelcomePage } from "../features/onboarding/welcome-page"

export const Route = createFileRoute("/welcome")({
  staticData: { title: "Welcome" },
  validateSearch: decodeWelcomeSearch,
  component: WelcomeRoute,
})

function WelcomeRoute() {
  const navigate = useNavigate()
  const { step } = Route.useSearch()

  return (
    <WelcomePage
      step={step}
      onStepChange={(next: OnboardingStep) =>
        void navigate({ to: "/welcome", search: { step: next }, replace: true })
      }
    />
  )
}
