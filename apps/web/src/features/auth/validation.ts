export const passwordConfirmationError = (
  password: string,
  confirmation: string
) => (password === confirmation ? null : "Passwords do not match")

export const signInErrorMessage = (_cause: unknown) =>
  "Unable to sign in. Check your details or create an account."
