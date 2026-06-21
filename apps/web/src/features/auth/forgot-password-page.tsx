import { useNavigate } from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"
import {
  Field,
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
import type { FormEvent } from "react"
import { useState } from "react"
import { toast } from "sonner"
import { authClient } from "../../lib/auth-client"
import { errorMessage } from "../../lib/error"
import { AuthFooter, SubmitButton } from "./auth-shared"

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
    } catch (cause) {
      setError(errorMessage(cause, "Unable to send reset code"))
    } finally {
      setPending(false)
    }
  }

  const reset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!email) return
    const data = new FormData(event.currentTarget)
    const password = String(data.get("password") ?? "")
    if (password !== String(data.get("confirmation") ?? "")) {
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
    } catch (cause) {
      setError(errorMessage(cause, "Unable to reset password"))
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
