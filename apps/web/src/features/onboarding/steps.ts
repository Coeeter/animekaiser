import * as Schema from "effect/Schema"

export const OnboardingStep = Schema.Literal(
  "username",
  "connect",
  "import",
  "done"
)
export type OnboardingStep = typeof OnboardingStep.Type

export const onboardingSteps: ReadonlyArray<{
  id: OnboardingStep
  label: string
}> = [
  { id: "username", label: "Username" },
  { id: "connect", label: "Connect" },
  { id: "import", label: "Import" },
  { id: "done", label: "Done" },
]

export const stepIndex = (step: OnboardingStep) =>
  Math.max(
    0,
    onboardingSteps.findIndex((item) => item.id === step)
  )

export const WelcomeSearch = Schema.Struct({
  step: Schema.optionalWith(OnboardingStep, { default: () => "username" }),
})
export type WelcomeSearch = typeof WelcomeSearch.Type

export const decodeWelcomeSearch = Schema.decodeUnknownSync(WelcomeSearch)
