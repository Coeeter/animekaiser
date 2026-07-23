import { expect, test } from "@playwright/test"

test.beforeEach(async ({ request }) => {
  const response = await request
    .get("http://localhost:8080/api/auth/get-session")
    .catch((cause: unknown) => {
      throw new Error(`[Kaiser API] unreachable: ${String(cause)}`)
    })
  expect(
    response.ok(),
    `[Kaiser API] session endpoint returned HTTP ${response.status()}`
  ).toBe(true)
})

test("user can navigate the sign-in methods and auth pages", async ({
  page,
}) => {
  await page.goto("/login")
  await expect(page).toHaveTitle(/Sign in.*AnimeKaiser/)
  await expect(
    page.getByRole("heading", { name: "Welcome back" })
  ).toBeVisible()

  await page.getByRole("radio", { name: "Email code" }).click()
  await expect(page.getByLabel("Email")).toBeVisible()
  await page.getByRole("radio", { name: "Passkey" }).click()
  await expect(
    page.getByRole("button", { name: "Sign in with passkey" })
  ).toBeVisible()

  await page.getByRole("link", { name: "Sign up" }).click()
  await expect(page).toHaveURL(/\/register$/)
  await expect(
    page.getByRole("heading", { name: "Create your account" })
  ).toBeVisible()
  await expect(page.getByLabel("Username")).toBeVisible()
  await expect(page.getByLabel("Email")).toBeVisible()
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible()
  await expect(page.getByLabel("Confirm password")).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Create account" })
  ).toBeVisible()
})

test("unknown routes render the application 404", async ({ page }) => {
  await page.goto("/definitely-not-a-route")
  await expect(page.getByRole("heading", { name: "404" })).toBeVisible()
  await expect(
    page.getByText("The requested page could not be found.")
  ).toBeVisible()
})
