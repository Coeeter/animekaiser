import { expect, test } from "@playwright/test"

const password = process.env.KAISER_E2E_PASSWORD ?? "kaiser-e2e-pass-1234"

const uniqueEmail = () =>
  `kaiser-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`

test("a new account is walked through the welcome flow", async ({ page }) => {
  await page.goto("/register")

  await expect(page).toHaveTitle(/Create account.*AnimeKaiser/)
  await expect(page.getByLabel("Email")).toBeVisible()
  await expect(page.getByLabel("Password")).toBeVisible()
  await expect(page.getByLabel("Username")).toHaveCount(0)
  await expect(page.getByLabel("Confirm password")).toHaveCount(0)

  await page.getByLabel("Email").fill(uniqueEmail())
  await page.getByLabel("Password").fill(password)
  await page.getByRole("button", { name: "Continue" }).click()

  await page.waitForURL("**/welcome**")

  const username = page.getByLabel("Username")
  await expect(username).toBeVisible()
  await expect(username).not.toHaveValue("")

  const suggestion = page.getByText(/^Suggestions$/)
  await expect(suggestion).toBeVisible()

  await page.getByRole("button", { name: "Continue" }).click()
  await page.waitForURL("**/welcome?step=connect")

  await expect(
    page.getByRole("heading", { name: "Bring your list with you" })
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Import my list" })
  ).toBeDisabled()

  await page.getByRole("button", { name: "Skip for now" }).click()
  await page.waitForURL("**/welcome?step=done")

  await expect(
    page.getByRole("heading", { name: "You are all set" })
  ).toBeVisible()

  await page.getByRole("link", { name: "Ready to watch anime" }).click()
  await page.waitForURL("http://localhost:3000/")

  await page.goto("/my-list?status=all&sort=updated_desc&page=1")
  await expect(page.getByRole("heading", { name: "My list" })).toBeVisible()
})

test("a finished account is not sent back into onboarding", async ({
  page,
}) => {
  await page.goto("/register")

  await page.getByLabel("Email").fill(uniqueEmail())
  await page.getByLabel("Password").fill(password)
  await page.getByRole("button", { name: "Continue" }).click()

  await page.waitForURL("**/welcome**")
  await page.getByRole("button", { name: "Continue" }).click()
  await page.waitForURL("**/welcome?step=connect")
  await page.getByRole("button", { name: "Skip for now" }).click()
  await page.waitForURL("**/welcome?step=done")
  await page.getByRole("link", { name: "Ready to watch anime" }).click()

  await page.goto("/profile")
  await expect(page).not.toHaveURL(/welcome/)
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible()
})
