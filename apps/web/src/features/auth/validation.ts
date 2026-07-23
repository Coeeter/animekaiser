export const passwordConfirmationError = (
  password: string,
  confirmation: string
) => (password === confirmation ? null : "Passwords do not match")
