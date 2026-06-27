import { useNavigate, useRouter } from "@tanstack/react-router"
import {
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
import { useForm } from "react-hook-form"
import { authClient } from "../../lib/auth-client"
import { errorMessage } from "../../lib/error"
import { AuthFooter, SubmitButton } from "./auth-shared"

type RegisterFormValues = {
  username: string
  email: string
  password: string
  confirmation: string
}

export function RegisterPage() {
  const router = useRouter()
  const navigate = useNavigate()
  const form = useForm<RegisterFormValues>({
    defaultValues: {
      username: "",
      email: "",
      password: "",
      confirmation: "",
    },
  })

  const submit = async (values: RegisterFormValues) => {
    if (values.password !== values.confirmation) {
      form.setError("confirmation", { message: "Passwords do not match" })
      return
    }
    const username = values.username.trim()
    try {
      const result = await authClient.signUp.email({
        name: username,
        username,
        email: values.email.trim(),
        password: values.password,
      })
      if (result.error) throw result.error
      await router.invalidate()
      await navigate({ to: "/" })
    } catch (cause) {
      form.setError("root", {
        message: errorMessage(cause, "Unable to create account"),
      })
    }
  }

  return (
    <Form {...form}>
      <form
        className="flex w-full max-w-sm flex-col gap-6 rounded-3xl border bg-card p-6 shadow-sm"
        onSubmit={form.handleSubmit(submit)}
      >
        <div className="text-center">
          <h1 className="font-heading text-2xl font-bold">
            Create your account
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Start building your anime library.
          </p>
        </div>
        <FieldGroup>
          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Username</FormLabel>
                <FormControl>
                  <Input
                    autoComplete="username"
                    minLength={3}
                    maxLength={30}
                    pattern="[A-Za-z0-9_]+"
                    required
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" autoComplete="email" required {...field} />
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
                <FormLabel>Password</FormLabel>
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
            control={form.control}
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
        {form.formState.errors.root?.message ? (
          <FieldError>{form.formState.errors.root.message}</FieldError>
        ) : null}
        <SubmitButton pending={form.formState.isSubmitting}>
          {form.formState.isSubmitting
            ? "Creating account…"
            : "Create account"}
        </SubmitButton>
        <AuthFooter
          prompt="Already have an account?"
          action="Login"
          to="/login"
        />
      </form>
    </Form>
  )
}
