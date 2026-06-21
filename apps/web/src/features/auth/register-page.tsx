import { useNavigate, useRouter } from "@tanstack/react-router"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import type { FormEvent } from "react"
import { useState } from "react"
import { authClient } from "../../lib/auth-client"
import { errorMessage } from "../../lib/error"
import { AuthFooter, SubmitButton } from "./auth-shared"

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
    } catch (cause) {
      setError(errorMessage(cause, "Unable to create account"))
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
