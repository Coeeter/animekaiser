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
import { Input } from "@animekaiser/ui/components/input"
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
import { useForm } from "@tanstack/react-form"
import { Link } from "@tanstack/react-router"
import { Fingerprint, KeyRound, Mail } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { authClient, navigateAfterAuthChange } from "../../services/api-clients"
import { errorMessage } from "../../utils/error"
import { AuthFooter, SubmitButton } from "./auth-shared"
import { safeRedirect } from "./user"

type LoginMethod = "password" | "otp" | "passkey"

function PasswordLogin({ onSuccess }: { onSuccess: () => void }) {
  const [error, setError] = useState<string | null>(null)
  const form = useForm({
    defaultValues: { identifier: "", password: "" },
    onSubmit: async ({ value }) => {
      setError(null)
      const identifier = value.identifier.trim()
      try {
        const result = identifier.includes("@")
          ? await authClient.signIn.email({
              email: identifier,
              password: value.password,
            })
          : await authClient.signIn.username({
              username: identifier,
              password: value.password,
            })
        if (result.error) throw result.error
        onSuccess()
      } catch (cause) {
        setError(errorMessage(cause, "Unable to sign in"))
      }
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
              <Input
                autoComplete="username"
                id={field.name}
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
              <Input
                autoComplete="current-password"
                id={field.name}
                minLength={8}
                name={field.name}
                required
                type="password"
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
  const requestForm = useForm({
    defaultValues: { email: "" },
    onSubmit: async ({ value }) => {
      setRequestError(null)
      const targetEmail = value.email.trim()
      try {
        const result = await authClient.emailOtp.sendVerificationOtp({
          email: targetEmail,
          type: "sign-in",
        })
        if (result.error) throw result.error
        setEmail(targetEmail)
      } catch (cause) {
        setRequestError(errorMessage(cause, "Unable to send sign-in code"))
      }
    },
  })
  const verifyForm = useForm({
    defaultValues: { otp: "" },
    onSubmit: async ({ value }) => {
      if (!email) return
      setVerifyError(null)
      try {
        const result = await authClient.signIn.emailOtp({
          email,
          otp: value.otp,
        })
        if (result.error) throw result.error
        onSuccess()
      } catch (cause) {
        setVerifyError(errorMessage(cause, "Unable to verify sign-in code"))
      }
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
              <Input
                autoComplete="email"
                id={field.name}
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
  const [pending, setPending] = useState(false)
  const signIn = async () => {
    setPending(true)
    try {
      const result = await authClient.signIn.passkey()
      if (result.error) throw result.error
      onSuccess()
    } catch (cause) {
      toast.error(errorMessage(cause, "Unable to sign in with passkey"))
    } finally {
      setPending(false)
    }
  }
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
