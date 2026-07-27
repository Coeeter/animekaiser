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
import { Input } from "@animekaiser/ui/components/input"
import { useForm } from "@tanstack/react-form"
import { useNavigate, useRouter } from "@tanstack/react-router"
import { useState } from "react"
import { authClient, reconnectKaiserRpc } from "../../services/api-clients"
import { errorMessage } from "../../utils/error"
import { AuthFooter, SubmitButton } from "./auth-shared"
import { passwordConfirmationError } from "./validation"

export function RegisterPage() {
  const router = useRouter()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [confirmationError, setConfirmationError] = useState<string | null>(
    null
  )
  const form = useForm({
    defaultValues: {
      username: "",
      email: "",
      password: "",
      confirmation: "",
    },
    onSubmit: async ({ value }) => {
      setError(null)
      setConfirmationError(null)
      const passwordError = passwordConfirmationError(
        value.password,
        value.confirmation
      )
      if (passwordError) {
        setConfirmationError(passwordError)
        return
      }
      const username = value.username.trim()
      try {
        const result = await authClient.signUp.email({
          name: username,
          username,
          email: value.email.trim(),
          password: value.password,
        })
        if (result.error) throw result.error

        await reconnectKaiserRpc()
        await router.invalidate()
        await navigate({ to: "/" })
      } catch (cause) {
        setError(errorMessage(cause, "Unable to create account"))
      }
    },
  })

  return (
    <form
      className="w-full max-w-sm"
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit()
      }}
    >
      <Card>
        <CardHeader className="text-center">
          <CardTitle>
            <h1 className="text-2xl font-bold">Create your account</h1>
          </CardTitle>
          <CardDescription>Start building your anime library.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <form.Field name="username">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Username</FieldLabel>
                  <Input
                    autoComplete="username"
                    id={field.name}
                    maxLength={30}
                    minLength={3}
                    name={field.name}
                    pattern="[A-Za-z0-9_]+"
                    required
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                  />
                </Field>
              )}
            </form.Field>
            <form.Field name="email">
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
                </Field>
              )}
            </form.Field>
            <form.Field name="password">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Password</FieldLabel>
                  <Input
                    autoComplete="new-password"
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
            <form.Field name="confirmation">
              {(field) => (
                <Field data-invalid={Boolean(confirmationError)}>
                  <FieldLabel htmlFor={field.name}>Confirm password</FieldLabel>
                  <Input
                    autoComplete="new-password"
                    aria-invalid={Boolean(confirmationError)}
                    id={field.name}
                    minLength={8}
                    name={field.name}
                    required
                    type="password"
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
            </form.Field>
          </FieldGroup>
        </CardContent>
        <CardFooter className="flex-col gap-6">
          {error ? <FieldError>{error}</FieldError> : null}
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(pending) => (
              <SubmitButton pending={pending}>
                {pending ? "Creating account…" : "Create account"}
              </SubmitButton>
            )}
          </form.Subscribe>
          <AuthFooter
            prompt="Already have an account?"
            action="Login"
            to="/login"
          />
        </CardFooter>
      </Card>
    </form>
  )
}
