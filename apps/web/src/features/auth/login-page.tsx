import { Link, useNavigate, useRouter } from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"
import {
  FieldDescription,
  FieldError,
  FieldGroup,
} from "@workspace/ui/components/field"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@workspace/ui/components/form"
import { Input } from "@workspace/ui/components/input"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@workspace/ui/components/input-otp"
import { Spinner } from "@workspace/ui/components/spinner"
import { Fingerprint, KeyRound, Mail } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { authClient, safeRedirect } from "../../lib/auth-client"
import { errorMessage } from "../../lib/error"
import { AuthFooter, SubmitButton } from "./auth-shared"

type LoginMethod = "password" | "otp" | "passkey"

type PasswordLoginValues = {
  identifier: string
  password: string
}

function PasswordLogin({ onSuccess }: { onSuccess: () => Promise<void> }) {
  const form = useForm<PasswordLoginValues>({
    defaultValues: { identifier: "", password: "" },
  })

  const submit = async (values: PasswordLoginValues) => {
    const identifier = values.identifier.trim()
    try {
      const result = identifier.includes("@")
        ? await authClient.signIn.email({
            email: identifier,
            password: values.password,
          })
        : await authClient.signIn.username({
            username: identifier,
            password: values.password,
          })
      if (result.error) throw result.error
      await onSuccess()
    } catch (cause) {
      form.setError("root", {
        message: errorMessage(cause, "Unable to sign in"),
      })
    }
  }

  return (
    <Form {...form}>
      <form
        className="flex flex-col gap-6"
        onSubmit={form.handleSubmit(submit)}
      >
        <FieldGroup>
          <FormField
            control={form.control}
            name="identifier"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email or username</FormLabel>
                <FormControl>
                  <Input autoComplete="username" required {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center">
                  <FormLabel>Password</FormLabel>
                  <Link
                    className="ml-auto text-sm underline-offset-4 hover:underline"
                    to="/forgot-password"
                  >
                    Forgot password?
                  </Link>
                </div>
                <FormControl>
                  <Input
                    type="password"
                    autoComplete="current-password"
                    minLength={8}
                    required
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </FieldGroup>
        {form.formState.errors.root?.message ? (
          <FieldError>{form.formState.errors.root.message}</FieldError>
        ) : null}
        <SubmitButton pending={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Logging in…" : "Login"}
        </SubmitButton>
      </form>
    </Form>
  )
}

type EmailCodeRequestValues = {
  email: string
}

type EmailCodeVerifyValues = {
  otp: string
}

function EmailCodeLogin({ onSuccess }: { onSuccess: () => Promise<void> }) {
  const [email, setEmail] = useState<string | null>(null)
  const requestForm = useForm<EmailCodeRequestValues>({
    defaultValues: { email: "" },
  })
  const verifyForm = useForm<EmailCodeVerifyValues>({
    defaultValues: { otp: "" },
  })

  const requestCode = async (values: EmailCodeRequestValues) => {
    const value = values.email.trim()
    try {
      const result = await authClient.emailOtp.sendVerificationOtp({
        email: value,
        type: "sign-in",
      })
      if (result.error) throw result.error
      setEmail(value)
    } catch (cause) {
      requestForm.setError("root", {
        message: errorMessage(cause, "Unable to send sign-in code"),
      })
    }
  }

  const verifyCode = async (values: EmailCodeVerifyValues) => {
    if (!email) return
    try {
      const result = await authClient.signIn.emailOtp({
        email,
        otp: values.otp,
      })
      if (result.error) throw result.error
      await onSuccess()
    } catch (cause) {
      verifyForm.setError("root", {
        message: errorMessage(cause, "Unable to verify sign-in code"),
      })
    }
  }

  if (!email) {
    return (
      <Form {...requestForm}>
        <form
          className="flex flex-col gap-6"
          onSubmit={requestForm.handleSubmit(requestCode)}
        >
          <FormField
            control={requestForm.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    autoComplete="email"
                    required
                    {...field}
                  />
                </FormControl>
                <FieldDescription>
                  We’ll send a one-time code to this address.
                </FieldDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          {requestForm.formState.errors.root?.message ? (
            <FieldError>{requestForm.formState.errors.root.message}</FieldError>
          ) : null}
          <SubmitButton pending={requestForm.formState.isSubmitting}>
            {requestForm.formState.isSubmitting ? "Sending…" : "Send code"}
          </SubmitButton>
        </form>
      </Form>
    )
  }

  return (
    <Form {...verifyForm}>
      <form
        className="flex flex-col gap-6"
        onSubmit={verifyForm.handleSubmit(verifyCode)}
      >
        <FormField
          control={verifyForm.control}
          name="otp"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Sign-in code</FormLabel>
              <FormControl>
                <InputOTP maxLength={6} {...field}>
                  <InputOTPGroup>
                    {Array.from({ length: 6 }, (_, index) => (
                      <InputOTPSlot key={index} index={index} />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </FormControl>
              <FieldDescription>Code sent to {email}.</FieldDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        {verifyForm.formState.errors.root?.message ? (
          <FieldError>{verifyForm.formState.errors.root.message}</FieldError>
        ) : null}
        <SubmitButton pending={verifyForm.formState.isSubmitting}>
          {verifyForm.formState.isSubmitting ? "Verifying…" : "Verify code"}
        </SubmitButton>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setEmail(null)
            verifyForm.reset()
          }}
        >
          Use another email
        </Button>
      </form>
    </Form>
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
