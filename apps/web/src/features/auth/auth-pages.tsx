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
import type { FormEvent, ReactNode } from "react"
import { useState } from "react"
import { toast } from "sonner"
import { authClient, safeRedirect } from "../../auth"

type LoginMethod = "password" | "otp" | "passkey"

const errorMessage = (error: unknown, fallback: string) =>
  error && typeof error === "object" && "message" in error
    ? String(error.message)
    : fallback

function SubmitButton({
  pending,
  children,
}: {
  pending: boolean
  children: ReactNode
}) {
  return (
    <Button className="w-full" disabled={pending} type="submit">
      {pending ? <Spinner data-icon="inline-start" /> : null}
      {children}
    </Button>
  )
}

function AuthFooter({
  prompt,
  action,
  to,
}: {
  prompt: string
  action: string
  to: string
}) {
  return (
    <p className="text-center text-sm text-muted-foreground">
      {prompt}{" "}
      <Link
        className="font-medium text-foreground underline-offset-4 hover:underline"
        to={to}
      >
        {action}
      </Link>
    </p>
  )
}

export function AuthPageLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <Link
          className="flex w-fit items-center gap-3 font-heading font-semibold"
          to="/"
        >
          <img className="size-9 rounded-xl" src="/logo.svg" alt="" />
          <span>animekaiser</span>
        </Link>
        <div className="flex flex-1 items-center justify-center">
          {children}
        </div>
      </div>
      <div className="relative hidden overflow-hidden bg-zinc-950 lg:block">
        <img
          className="absolute inset-0 size-full object-cover opacity-80"
          src="/auth.png"
          alt="Anime character artwork"
        />
        <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/10 to-black/20" />
        <p className="absolute bottom-10 left-10 max-w-md font-heading text-3xl font-semibold text-white">
          Your anime life, all in one place.
        </p>
      </div>
    </div>
  )
}

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
    } catch (reason) {
      setError(errorMessage(reason, "Unable to sign in"))
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
    } catch (reason) {
      setError(errorMessage(reason, "Unable to send sign-in code"))
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
    } catch (reason) {
      setError(errorMessage(reason, "Unable to verify sign-in code"))
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
    } catch (reason) {
      toast.error(errorMessage(reason, "Unable to sign in with passkey"))
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

export function LoginPage({ redirect }: { redirect?: string }) {
  const router = useRouter()
  const navigate = useNavigate()
  const [method, setMethod] = useState<LoginMethod>("password")
  const complete = async () => {
    await router.invalidate()
    await navigate({ href: safeRedirect(redirect) })
  }
  const methods = [
    { value: "password" as const, label: "Password", icon: KeyRound },
    { value: "otp" as const, label: "Email code", icon: Mail },
    { value: "passkey" as const, label: "Passkey", icon: Fingerprint },
  ]

  return (
    <div className="flex w-full max-w-sm flex-col gap-5">
      <div className="grid grid-cols-3 gap-2 rounded-2xl border bg-card/70 p-2">
        {methods.map((item) => (
          <Button
            key={item.value}
            type="button"
            variant={method === item.value ? "secondary" : "ghost"}
            onClick={() => setMethod(item.value)}
          >
            <item.icon data-icon="inline-start" />
            <span className="hidden sm:inline">{item.label}</span>
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

export function RegisterPage() {
  const router = useRouter()
  const navigate = useNavigate()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const username = String(form.get("username") ?? "").trim()
    const email = String(form.get("email") ?? "").trim()
    const password = String(form.get("password") ?? "")
    const confirmation = String(form.get("confirmation") ?? "")
    if (password !== confirmation) {
      setError("Passwords do not match")
      return
    }
    setPending(true)
    setError(null)
    try {
      const result = await authClient.signUp.email({
        name: username,
        username,
        email,
        password,
      })
      if (result.error) throw result.error
      await router.invalidate()
      await navigate({ to: "/" })
    } catch (reason) {
      setError(errorMessage(reason, "Unable to create account"))
    } finally {
      setPending(false)
    }
  }

  return (
    <form
      className="flex w-full max-w-sm flex-col gap-6 rounded-3xl border bg-card p-6 shadow-sm"
      onSubmit={submit}
    >
      <div className="text-center">
        <h1 className="font-heading text-2xl font-bold">Create your account</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Start building your anime library.
        </p>
      </div>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="register-username">Username</FieldLabel>
          <Input
            id="register-username"
            name="username"
            autoComplete="username"
            minLength={3}
            maxLength={30}
            pattern="[A-Za-z0-9_]+"
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="register-email">Email</FieldLabel>
          <Input
            id="register-email"
            name="email"
            type="email"
            autoComplete="email"
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="register-password">Password</FieldLabel>
          <Input
            id="register-password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="register-confirmation">
            Confirm password
          </FieldLabel>
          <Input
            id="register-confirmation"
            name="confirmation"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </Field>
      </FieldGroup>
      {error ? <FieldError>{error}</FieldError> : null}
      <SubmitButton pending={pending}>
        {pending ? "Creating account…" : "Create account"}
      </SubmitButton>
      <AuthFooter
        prompt="Already have an account?"
        action="Login"
        to="/login"
      />
    </form>
  )
}

export function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState<string | null>(null)
  const [otp, setOtp] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const request = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const value = String(
      new FormData(event.currentTarget).get("email") ?? ""
    ).trim()
    setPending(true)
    setError(null)
    try {
      const result = await authClient.emailOtp.requestPasswordReset({
        email: value,
      })
      if (result.error) throw result.error
      setEmail(value)
    } catch (reason) {
      setError(errorMessage(reason, "Unable to send reset code"))
    } finally {
      setPending(false)
    }
  }

  const reset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!email) return
    const data = new FormData(event.currentTarget)
    const password = String(data.get("password") ?? "")
    const confirmation = String(data.get("confirmation") ?? "")
    if (password !== confirmation) {
      setError("Passwords do not match")
      return
    }
    setPending(true)
    setError(null)
    try {
      const result = await authClient.emailOtp.resetPassword({
        email,
        otp,
        password,
      })
      if (result.error) throw result.error
      toast.success("Password reset. You can log in now.")
      await navigate({ to: "/login", search: { redirect: undefined } })
    } catch (reason) {
      setError(errorMessage(reason, "Unable to reset password"))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="w-full max-w-sm rounded-3xl border bg-card p-6 shadow-sm">
      <form className="flex flex-col gap-6" onSubmit={email ? reset : request}>
        <div className="text-center">
          <h1 className="font-heading text-2xl font-bold">
            Reset your password
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {email
              ? `Enter the code sent to ${email}.`
              : "We’ll email you a reset code."}
          </p>
        </div>
        {!email ? (
          <Field>
            <FieldLabel htmlFor="reset-email">Email</FieldLabel>
            <Input
              id="reset-email"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </Field>
        ) : (
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="reset-code">Reset code</FieldLabel>
              <InputOTP
                id="reset-code"
                maxLength={6}
                value={otp}
                onChange={setOtp}
              >
                <InputOTPGroup>
                  {Array.from({ length: 6 }, (_, index) => (
                    <InputOTPSlot key={index} index={index} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </Field>
            <Field>
              <FieldLabel htmlFor="reset-password">New password</FieldLabel>
              <Input
                id="reset-password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="reset-confirmation">
                Confirm password
              </FieldLabel>
              <Input
                id="reset-confirmation"
                name="confirmation"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </Field>
          </FieldGroup>
        )}
        {error ? <FieldError>{error}</FieldError> : null}
        <SubmitButton pending={pending}>
          {pending ? "Working…" : email ? "Reset password" : "Send reset code"}
        </SubmitButton>
        {email ? (
          <Button type="button" variant="ghost" onClick={() => setEmail(null)}>
            Use another email
          </Button>
        ) : null}
        <AuthFooter prompt="Back to" action="login" to="/login" />
      </form>
    </div>
  )
}
