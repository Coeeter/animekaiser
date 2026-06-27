import { useNavigate } from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"
import { FieldError, FieldGroup } from "@workspace/ui/components/field"
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
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { authClient } from "../../lib/auth-client"
import { errorMessage } from "../../lib/error"
import { AuthFooter, SubmitButton } from "./auth-shared"

type ResetRequestValues = {
  email: string
}

type ResetPasswordValues = {
  otp: string
  password: string
  confirmation: string
}

export function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState<string | null>(null)
  const requestForm = useForm<ResetRequestValues>({
    defaultValues: { email: "" },
  })
  const resetForm = useForm<ResetPasswordValues>({
    defaultValues: { otp: "", password: "", confirmation: "" },
  })

  const request = async (values: ResetRequestValues) => {
    const value = values.email.trim()
    try {
      const result = await authClient.emailOtp.requestPasswordReset({
        email: value,
      })
      if (result.error) throw result.error
      setEmail(value)
    } catch (cause) {
      requestForm.setError("root", {
        message: errorMessage(cause, "Unable to send reset code"),
      })
    }
  }

  const reset = async (values: ResetPasswordValues) => {
    if (!email) return
    if (values.password !== values.confirmation) {
      resetForm.setError("confirmation", { message: "Passwords do not match" })
      return
    }
    try {
      const result = await authClient.emailOtp.resetPassword({
        email,
        otp: values.otp,
        password: values.password,
      })
      if (result.error) throw result.error
      toast.success("Password reset. You can log in now.")
      await navigate({ to: "/login", search: { redirect: undefined } })
    } catch (cause) {
      resetForm.setError("root", {
        message: errorMessage(cause, "Unable to reset password"),
      })
    }
  }

  return (
    <div className="w-full max-w-sm rounded-3xl border bg-card p-6 shadow-sm">
      <div className="text-center">
        <h1 className="font-heading text-2xl font-bold">Reset your password</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {email
            ? `Enter the code sent to ${email}.`
            : "We’ll email you a reset code."}
        </p>
      </div>
      {!email ? (
        <Form {...requestForm}>
          <form
            className="mt-6 flex flex-col gap-6"
            onSubmit={requestForm.handleSubmit(request)}
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
                  <FormMessage />
                </FormItem>
              )}
            />
            {requestForm.formState.errors.root?.message ? (
              <FieldError>
                {requestForm.formState.errors.root.message}
              </FieldError>
            ) : null}
            <SubmitButton pending={requestForm.formState.isSubmitting}>
              {requestForm.formState.isSubmitting
                ? "Working…"
                : "Send reset code"}
            </SubmitButton>
            <AuthFooter prompt="Back to" action="login" to="/login" />
          </form>
        </Form>
      ) : (
        <Form {...resetForm}>
          <form
            className="mt-6 flex flex-col gap-6"
            onSubmit={resetForm.handleSubmit(reset)}
          >
            <FieldGroup>
              <FormField
                control={resetForm.control}
                name="otp"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reset code</FormLabel>
                    <FormControl>
                      <InputOTP maxLength={6} {...field}>
                        <InputOTPGroup>
                          {Array.from({ length: 6 }, (_, index) => (
                            <InputOTPSlot key={index} index={index} />
                          ))}
                        </InputOTPGroup>
                      </InputOTP>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={resetForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="new-password"
                        minLength={8}
                        required
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={resetForm.control}
                name="confirmation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="new-password"
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
            {resetForm.formState.errors.root?.message ? (
              <FieldError>{resetForm.formState.errors.root.message}</FieldError>
            ) : null}
            <SubmitButton pending={resetForm.formState.isSubmitting}>
              {resetForm.formState.isSubmitting ? "Working…" : "Reset password"}
            </SubmitButton>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setEmail(null)
                resetForm.reset()
              }}
            >
              Use another email
            </Button>
            <AuthFooter prompt="Back to" action="login" to="/login" />
          </form>
        </Form>
      )}
    </div>
  )
}
