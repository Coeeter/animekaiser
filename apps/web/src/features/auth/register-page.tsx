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
import { useForm } from "@tanstack/react-form"
import { Mail } from "lucide-react"
import { useState } from "react"
import { IconInput } from "../../components/icon-input"
import { PasswordInput } from "../../components/password-input"
import { authClient, navigateAfterAuthChange } from "../../services/api-clients"
import { errorMessage } from "../../utils/error"
import { AuthFooter, SubmitButton } from "./auth-shared"
import { provisionalUsername } from "./username"

export function RegisterPage() {
  const [error, setError] = useState<string | null>(null)
  const form = useForm({
    defaultValues: { email: "", password: "" },
    onSubmit: async ({ value }) => {
      setError(null)
      const email = value.email.trim()
      const username = provisionalUsername(email)

      try {
        const result = await authClient.signUp.email({
          name: username,
          username,
          email,
          password: value.password,
        })
        if (result.error) throw result.error

        navigateAfterAuthChange("/welcome")
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
          <CardDescription>
            Email and password to start. We will set up the rest next.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <form.Field name="email">
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
            </form.Field>
            <form.Field name="password">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Password</FieldLabel>
                  <PasswordInput
                    autoComplete="new-password"
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
        </CardContent>
        <CardFooter className="flex-col gap-6">
          {error ? <FieldError>{error}</FieldError> : null}
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(pending) => (
              <SubmitButton pending={pending}>
                {pending ? "Creating account…" : "Continue"}
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
