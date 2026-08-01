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
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@animekaiser/ui/components/field"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@animekaiser/ui/components/input-otp"
import { useForm } from "@tanstack/react-form"
import { useNavigate } from "@tanstack/react-router"
import { Mail } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { IconInput } from "../../components/icon-input"
import { PasswordInput } from "../../components/password-input"
import { authClient } from "../../services/api-clients"
import { errorMessage } from "../../utils/error"
import { AuthFooter, SubmitButton } from "./auth-shared"

export function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState<string | null>(null)
  const [requestError, setRequestError] = useState<string | null>(null)
  const [resetError, setResetError] = useState<string | null>(null)
  const [confirmationError, setConfirmationError] = useState<string | null>(
    null
  )
  const requestForm = useForm({
    defaultValues: { email: "" },
    onSubmit: async ({ value }) => {
      setRequestError(null)
      const targetEmail = value.email.trim()
      try {
        const result = await authClient.emailOtp.requestPasswordReset({
          email: targetEmail,
        })
        if (result.error) throw result.error
        setEmail(targetEmail)
      } catch (cause) {
        setRequestError(errorMessage(cause, "Unable to send reset code"))
      }
    },
  })
  const resetForm = useForm({
    defaultValues: { otp: "", password: "", confirmation: "" },
    onSubmit: async ({ value }) => {
      if (!email) return
      setResetError(null)
      setConfirmationError(null)
      if (value.password !== value.confirmation) {
        setConfirmationError("Passwords do not match")
        return
      }
      try {
        const result = await authClient.emailOtp.resetPassword({
          email,
          otp: value.otp,
          password: value.password,
        })
        if (result.error) throw result.error
        toast.success("Password reset. You can log in now.")
        await navigate({ to: "/login", search: { redirect: undefined } })
      } catch (cause) {
        setResetError(errorMessage(cause, "Unable to reset password"))
      }
    },
  })

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <CardTitle>
          <h1 className="text-2xl font-bold">Reset your password</h1>
        </CardTitle>
        <CardDescription>
          {email
            ? `Enter the code sent to ${email}.`
            : "We’ll email you a reset code."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!email ? (
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
                </Field>
              )}
            </requestForm.Field>
            {requestError ? <FieldError>{requestError}</FieldError> : null}
            <requestForm.Subscribe selector={(state) => state.isSubmitting}>
              {(pending) => (
                <SubmitButton pending={pending}>
                  {pending ? "Working…" : "Send reset code"}
                </SubmitButton>
              )}
            </requestForm.Subscribe>
          </form>
        ) : (
          <form
            className="flex flex-col gap-6"
            onSubmit={(event) => {
              event.preventDefault()
              void resetForm.handleSubmit()
            }}
          >
            <FieldGroup>
              <resetForm.Field name="otp">
                {(field) => (
                  <Field data-invalid={Boolean(resetError)}>
                    <FieldLabel htmlFor={field.name}>Reset code</FieldLabel>
                    <InputOTP
                      autoComplete="one-time-code"
                      autoFocus
                      aria-invalid={Boolean(resetError)}
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
                  </Field>
                )}
              </resetForm.Field>
              <resetForm.Field name="password">
                {(field) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>New password</FieldLabel>
                    <PasswordInput
                      autoComplete="new-password"
                      id={field.name}
                      minLength={8}
                      name={field.name}
                      required
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                    />
                  </Field>
                )}
              </resetForm.Field>
              <resetForm.Field name="confirmation">
                {(field) => (
                  <Field data-invalid={Boolean(confirmationError)}>
                    <FieldLabel htmlFor={field.name}>
                      Confirm password
                    </FieldLabel>
                    <PasswordInput
                      autoComplete="new-password"
                      aria-invalid={Boolean(confirmationError)}
                      id={field.name}
                      minLength={8}
                      name={field.name}
                      required
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) => {
                        setConfirmationError(null)
                        field.handleChange(event.target.value)
                      }}
                    />
                    {confirmationError ? (
                      <FieldError>{confirmationError}</FieldError>
                    ) : null}
                  </Field>
                )}
              </resetForm.Field>
            </FieldGroup>
            {resetError ? <FieldError>{resetError}</FieldError> : null}
            <resetForm.Subscribe selector={(state) => state.isSubmitting}>
              {(pending) => (
                <SubmitButton pending={pending}>
                  {pending ? "Working…" : "Reset password"}
                </SubmitButton>
              )}
            </resetForm.Subscribe>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setEmail(null)
                setResetError(null)
                setConfirmationError(null)
                resetForm.reset()
              }}
            >
              Use another email
            </Button>
          </form>
        )}
      </CardContent>
      <CardFooter className="justify-center">
        <AuthFooter prompt="Back to" action="login" to="/login" />
      </CardFooter>
    </Card>
  )
}
