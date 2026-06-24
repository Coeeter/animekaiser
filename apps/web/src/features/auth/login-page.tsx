import { Link, useNavigate, useRouter } from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@workspace/ui/components/input-otp"
import { Spinner } from "@workspace/ui/components/spinner"
import { Fingerprint, KeyRound, Mail } from "lucide-react"
import type { FormEvent } from "react"
import { useState } from "react"
import { toast } from "sonner"
import { authClient, safeRedirect } from "../../lib/auth-client"
import { errorMessage } from "../../lib/error"
import { AuthFooter, SubmitButton } from "./auth-shared"

type LoginMethod = "password" | "otp" | "passkey"

function PasswordLogin({ onSuccess }: { onSuccess: () => Promise<void> }) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const identifier = String(data.get("identifier") ?? "").trim()
    const password = String(data.get("password") ?? "")
    setPending(true)
    setError(null)
    try {
      const result = identifier.includes("@")
        ? await authClient.signIn.email({ email: identifier, password })
        : await authClient.signIn.username({ username: identifier, password })
      if (result.error) throw result.error
      await onSuccess()
    } catch (cause) {
      setError(errorMessage(cause, "Unable to sign in"))
    } finally {
      setPending(false)
    }
  }

  return (
    <form className="flex flex-col gap-6" onSubmit={submit}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="login-identifier">Email or username</FieldLabel>
          <Input
            id="login-identifier"
            name="identifier"
            autoComplete="username"
            required
          />
        </Field>
        <Field>
          <div className="flex items-center">
            <FieldLabel htmlFor="login-password">Password</FieldLabel>
            <Link
              className="ml-auto text-sm underline-offset-4 hover:underline"
              to="/forgot-password"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            minLength={8}
            required
          />
        </Field>
      </FieldGroup>
      {error ? <FieldError>{error}</FieldError> : null}
      <SubmitButton pending={pending}>
        {pending ? "Logging in…" : "Login"}
      </SubmitButton>
    </form>
  )
}

function EmailCodeLogin({ onSuccess }: { onSuccess: () => Promise<void> }) {
  const [email, setEmail] = useState<string | null>(null)
  const [otp, setOtp] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const requestCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const value = String(
      new FormData(event.currentTarget).get("email") ?? ""
    ).trim()
    setPending(true)
    setError(null)
    try {
      const result = await authClient.emailOtp.sendVerificationOtp({
        email: value,
        type: "sign-in",
      })
      if (result.error) throw result.error
      setEmail(value)
    } catch (cause) {
      setError(errorMessage(cause, "Unable to send sign-in code"))
    } finally {
      setPending(false)
    }
  }

  const verifyCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!email) return
    setPending(true)
    setError(null)
    try {
      const result = await authClient.signIn.emailOtp({ email, otp })
      if (result.error) throw result.error
      await onSuccess()
    } catch (cause) {
      setError(errorMessage(cause, "Unable to verify sign-in code"))
    } finally {
      setPending(false)
    }
  }

  if (!email) {
    return (
      <form className="flex flex-col gap-6" onSubmit={requestCode}>
        <Field>
          <FieldLabel htmlFor="otp-email">Email</FieldLabel>
          <Input
            id="otp-email"
            name="email"
            type="email"
            autoComplete="email"
            required
          />
          <FieldDescription>
            We’ll send a one-time code to this address.
          </FieldDescription>
        </Field>
        {error ? <FieldError>{error}</FieldError> : null}
        <SubmitButton pending={pending}>
          {pending ? "Sending…" : "Send code"}
        </SubmitButton>
      </form>
    )
  }

  return (
    <form className="flex flex-col gap-6" onSubmit={verifyCode}>
      <Field>
        <FieldLabel htmlFor="otp-code">Sign-in code</FieldLabel>
        <InputOTP id="otp-code" maxLength={6} value={otp} onChange={setOtp}>
          <InputOTPGroup>
            {Array.from({ length: 6 }, (_, index) => (
              <InputOTPSlot key={index} index={index} />
            ))}
          </InputOTPGroup>
        </InputOTP>
        <FieldDescription>Code sent to {email}.</FieldDescription>
      </Field>
      {error ? <FieldError>{error}</FieldError> : null}
      <SubmitButton pending={pending}>
        {pending ? "Verifying…" : "Verify code"}
      </SubmitButton>
      <Button type="button" variant="ghost" onClick={() => setEmail(null)}>
        Use another email
      </Button>
    </form>
  )
}

function PasskeyLogin({ onSuccess }: { onSuccess: () => Promise<void> }) {
  const [pending, setPending] = useState(false)
  const signIn = async () => {
    setPending(true)
    try {
      const result = await authClient.signIn.passkey()
      if (result.error) throw result.error
      await onSuccess()
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
  const router = useRouter()
  const navigate = useNavigate()
  const [method, setMethod] = useState<LoginMethod>("password")
  const complete = async () => {
    await router.invalidate()
    await navigate({ href: safeRedirect(redirect) })
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-5">
      <div className="grid grid-cols-3 gap-2">
        {methods.map((item) => (
          <Button
            key={item.value}
            className="h-auto flex-col gap-2 py-3"
            type="button"
            variant={method === item.value ? "default" : "outline"}
            onClick={() => setMethod(item.value)}
          >
            <item.icon className="size-4" />
            <span className="text-xs">{item.title}</span>
          </Button>
        ))}
      </div>
      <div className="flex flex-col gap-6 rounded-3xl border bg-card p-6 shadow-sm">
        <div className="text-center">
          <h1 className="font-heading text-2xl font-bold">Welcome back</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Login to your AnimeKaiser account.
          </p>
        </div>
        {method === "password" ? <PasswordLogin onSuccess={complete} /> : null}
        {method === "otp" ? <EmailCodeLogin onSuccess={complete} /> : null}
        {method === "passkey" ? <PasskeyLogin onSuccess={complete} /> : null}
        <AuthFooter
          prompt="Don’t have an account?"
          action="Sign up"
          to="/register"
        />
      </div>
    </div>
  )
}
