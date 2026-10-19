import { Button } from "@animekaiser/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@animekaiser/ui/components/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@animekaiser/ui/components/field"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@animekaiser/ui/components/input-otp"
import { Spinner } from "@animekaiser/ui/components/spinner"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@animekaiser/ui/components/toggle-group"
import { useAtom, useAtomSet } from "@effect/atom-react"
import { useForm } from "@tanstack/react-form"
import { Link } from "@tanstack/react-router"
import * as Exit from "effect/Exit"
import { Fingerprint, KeyRound, Mail, UserRound } from "lucide-react"
import { useState } from "react"
import { IconInput } from "../../components/icon-input"
import { PasswordInput } from "../../components/password-input"
import { navigateAfterAuthChange } from "../../services/api-clients"
import { toastFailure } from "../../utils/error"
import {
  sendVerificationOtpAtom,
  signInEmailAtom,
  signInEmailOtpAtom,
  signInPasskeyAtom,
  signInUsernameAtom,
} from "./atoms"
import { AuthFooter, SubmitButton } from "./auth-shared"
import { safeRedirect } from "./user"
import { signInErrorMessage } from "./validation"

type LoginMethod = "password" | "otp" | "passkey"

function PasswordLogin({ onSuccess }: { onSuccess: () => void }) {
  const [error, setError] = useState<string | null>(null)
  const signInEmail = useAtomSet(signInEmailAtom, { mode: "promiseExit" })
  const signInUsername = useAtomSet(signInUsernameAtom, {
    mode: "promiseExit",
  })
  const form = useForm({
    defaultValues: { identifier: "", password: "" },
    onSubmit: async ({ value }) => {
      setError(null)
      const identifier = value.identifier.trim()
      const exit = identifier.includes("@")
        ? await signInEmail({ email: identifier, password: value.password })
        : await signInUsername({
            username: identifier,
            password: value.password,
          })
      if (Exit.isSuccess(exit)) onSuccess()
      else setError(signInErrorMessage)
    },
  })

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit()
      }}
    >
      <FieldGroup>
        <form.Field name="identifier">
          {(field) => (
            <Field>
              <FieldLabel htmlFor={field.name}>Email or username</FieldLabel>
              <IconInput
                autoComplete="username"
                id={field.name}
                icon={UserRound}
                name={field.name}
                required
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
              />
            </Field>
          )}
        </form.Field>
        <form.Field name="password">
          {(field) => (
            <Field>
              <div className="flex items-center">
                <FieldLabel htmlFor={field.name}>Password</FieldLabel>
                <Link
                  className="ml-auto text-sm underline-offset-4 hover:underline"
                  to="/forgot-password"
                >
                  Forgot password?
                </Link>
              </div>
              <PasswordInput
                autoComplete="current-password"
                id={field.name}
                minLength={8}
                name={field.name}
                required
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
              />
            </Field>
          )}
        </form.Field>
      </FieldGroup>
      {error ? <FieldError>{error}</FieldError> : null}
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(pending) => (
          <SubmitButton pending={pending}>
            {pending ? "Logging in…" : "Login"}
          </SubmitButton>
        )}
      </form.Subscribe>
    </form>
  )
}

function EmailCodeLogin({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState<string | null>(null)
  const [requestError, setRequestError] = useState<string | null>(null)
  const [verifyError, setVerifyError] = useState<string | null>(null)
  const sendCode = useAtomSet(sendVerificationOtpAtom, { mode: "promiseExit" })
  const signInWithCode = useAtomSet(signInEmailOtpAtom, {
    mode: "promiseExit",
  })
  const requestForm = useForm({
    defaultValues: { email: "" },
    onSubmit: async ({ value }) => {
      setRequestError(null)
      const targetEmail = value.email.trim()
      const exit = await sendCode({ email: targetEmail, type: "sign-in" })
      if (Exit.isSuccess(exit)) setEmail(targetEmail)
      else setRequestError(signInErrorMessage)
    },
  })
  const verifyForm = useForm({
    defaultValues: { otp: "" },
    onSubmit: async ({ value }) => {
      if (!email) return
      setVerifyError(null)
      const exit = await signInWithCode({ email, otp: value.otp })
      if (Exit.isSuccess(exit)) onSuccess()
      else setVerifyError(signInErrorMessage)
    },
  })

  if (!email) {
    return (
      <form
        className="flex flex-col gap-6"
        onSubmit={(event) => {
          event.preventDefault()
          void requestForm.handleSubmit()
        }}
      >
        <requestForm.Field name="email">
          {(field) => (
            <Field>
              <FieldLabel htmlFor={field.name}>Email</FieldLabel>
              <IconInput
                autoComplete="email"
                id={field.name}
                icon={Mail}
                name={field.name}
                required
                type="email"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
              />
              <FieldDescription>
                We’ll send a one-time code to this address.
              </FieldDescription>
            </Field>
          )}
        </requestForm.Field>
        {requestError ? <FieldError>{requestError}</FieldError> : null}
        <requestForm.Subscribe selector={(state) => state.isSubmitting}>
          {(pending) => (
            <SubmitButton pending={pending}>
              {pending ? "Sending…" : "Send code"}
            </SubmitButton>
          )}
        </requestForm.Subscribe>
      </form>
    )
  }

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault()
        void verifyForm.handleSubmit()
      }}
    >
      <verifyForm.Field name="otp">
        {(field) => (
          <Field data-invalid={Boolean(verifyError)}>
            <FieldLabel htmlFor={field.name}>Sign-in code</FieldLabel>
            <InputOTP
              autoComplete="one-time-code"
              autoFocus
              aria-invalid={Boolean(verifyError)}
              id={field.name}
              inputMode="numeric"
              maxLength={6}
              name={field.name}
              required
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={field.handleChange}
            >
              <InputOTPGroup className="mx-auto">
                {Array.from({ length: 6 }, (_, index) => (
                  <InputOTPSlot key={index} index={index} />
                ))}
              </InputOTPGroup>
            </InputOTP>
            <FieldDescription>Code sent to {email}.</FieldDescription>
          </Field>
        )}
      </verifyForm.Field>
      {verifyError ? <FieldError>{verifyError}</FieldError> : null}
      <verifyForm.Subscribe selector={(state) => state.isSubmitting}>
        {(pending) => (
          <SubmitButton pending={pending}>
            {pending ? "Verifying…" : "Verify code"}
          </SubmitButton>
        )}
      </verifyForm.Subscribe>
      <Button
        type="button"
        variant="ghost"
        onClick={() => {
          setEmail(null)
          setVerifyError(null)
          verifyForm.reset()
        }}
      >
        Use another email
      </Button>
    </form>
  )
}

function PasskeyLogin({ onSuccess }: { onSuccess: () => void }) {
  const [result, signInWithPasskey] = useAtom(signInPasskeyAtom, {
    mode: "promiseExit",
  })
  const pending = result.waiting
  const signIn = () =>
    signInWithPasskey().then((exit) => {
      if (toastFailure("Unable to sign in with passkey")(exit)) onSuccess()
    })
  return (
    <div className="flex flex-col gap-6 text-center">
      <Fingerprint className="mx-auto size-12 text-primary" />
      <p className="text-sm text-muted-foreground">
        Use your device biometrics or security key to continue without a
        password.
      </p>
      <Button disabled={pending} onClick={() => void signIn()}>
        {pending ? (
          <Spinner data-icon="inline-start" />
        ) : (
          <Fingerprint data-icon="inline-start" />
        )}
        {pending ? "Signing in…" : "Sign in with passkey"}
      </Button>
    </div>
  )
}

const methods = [
  { value: "password" as const, title: "Password", icon: KeyRound },
  { value: "otp" as const, title: "Email code", icon: Mail },
  { value: "passkey" as const, title: "Passkey", icon: Fingerprint },
]

export function LoginPage({ redirect }: { redirect?: string }) {
  const [method, setMethod] = useState<LoginMethod>("password")

  const complete = () => {
    navigateAfterAuthChange(safeRedirect(redirect))
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-5">
      <ToggleGroup
        className="grid w-full grid-cols-3"
        type="single"
        value={method}
        variant="outline"
        onValueChange={(value) => {
          if (value) setMethod(value as LoginMethod)
        }}
      >
        {methods.map((item) => (
          <ToggleGroupItem
            key={item.value}
            className="h-auto flex-col gap-2 py-3"
            value={item.value}
          >
            <item.icon />
            <span className="text-xs">{item.title}</span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <Card>
        <CardHeader className="text-center">
          <CardTitle>
            <h1 className="text-2xl font-bold">Welcome back</h1>
          </CardTitle>
          <CardDescription>Login to your AnimeKaiser account.</CardDescription>
        </CardHeader>
        <CardContent>
          {method === "password" ? (
            <PasswordLogin onSuccess={complete} />
          ) : null}
          {method === "otp" ? <EmailCodeLogin onSuccess={complete} /> : null}
          {method === "passkey" ? <PasskeyLogin onSuccess={complete} /> : null}
        </CardContent>
        <CardFooter className="justify-center">
          <AuthFooter
            prompt="Don’t have an account?"
            action="Sign up"
            to="/register"
          />
        </CardFooter>
      </Card>
    </div>
  )
}
