import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("registration validates repeated password without contacting Auth", async ({ page }) => {
  let calls = 0;
  await page.route("**/auth/v1/**", async route => { calls++; await route.abort(); });
  await page.goto("/pl/register");
  await page.getByLabel("Adres e-mail").fill("test@example.com");
  await page.getByLabel("Hasło", { exact: true }).fill("long-test-password");
  await page.getByLabel("Powtórz hasło").fill("different-password");
  await page.getByRole("button", { name: "Utwórz konto", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Hasła muszą być takie same");
  expect(calls).toBe(0);
});

test("email registration requests confirmation and never creates a session in the UI", async ({ page }) => {
  await page.route("**/auth/v1/signup**", async route => {
    const body = route.request().postDataJSON();
    expect(body.email).toBe("test@example.com");
    expect(body.code_challenge_method).toBe("s256");
    expect(new URL(route.request().url()).searchParams.get("redirect_to")).toMatch(/\/en\/auth\/confirm$/);
    await route.fulfill({ json: { id: "test-user", email: "test@example.com", identities: [], aud: "authenticated", created_at: new Date().toISOString() } });
  });
  await page.goto("/en/register");
  await page.getByLabel("Email address").fill("test@example.com");
  await page.getByLabel("Password", { exact: true }).fill("long-test-password");
  await page.getByLabel("Repeat password").fill("long-test-password");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Check your inbox" })).toBeVisible();
  await expect(page).toHaveURL(/\/en\/register$/);
});

test("failed login allows retry", async ({ page }) => {
  await page.route("**/auth/v1/token**", route => route.fulfill({ status: 400, json: { code: "invalid_credentials", msg: "Invalid login credentials" } }));
  await page.goto("/pl/login");
  await page.getByLabel("Adres e-mail").fill("test@example.com");
  await page.getByLabel("Hasło", { exact: true }).fill("incorrect-password");
  await page.getByRole("button", { name: "Zaloguj się", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Nie udało się zalogować");
  await expect(page.getByRole("button", { name: "Zaloguj się", exact: true })).toBeEnabled();
});

test("Google uses PKCE and a localized callback", async ({ page }) => {
  let authUrl = "";
  await page.route("**/auth/v1/authorize**", async route => {
    authUrl = route.request().url();
    await route.fulfill({ contentType: "text/html", body: "OAuth test endpoint" });
  });
  await page.goto("/en/register");
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await expect.poll(() => authUrl).not.toBe("");
  const url = new URL(authUrl);
  expect(url.searchParams.get("provider")).toBe("google");
  expect(url.searchParams.get("redirect_to")).toMatch(/\/en\/auth\/callback$/);
  expect(url.searchParams.get("code_challenge_method")).toBe("s256");
  expect(url.searchParams.get("code_challenge")).toBeTruthy();
});

test("auth redirects preserve the browser origin", async ({ request }) => {
  for (const [path, destination] of [
    ["/pl/auth/confirm?type=recovery", "/pl/login?error=confirmation"],
    ["/en/auth/callback?error=access_denied&next=https://example.com", "/en/login?error=callback"],
  ]) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers().location).toBe(destination);
    expect(response.headers()["cache-control"]).toContain("no-store");
  }
});

test("invalid callbacks stay local and private routes require a verified session", async ({ page }) => {
  await page.goto("/en/auth/callback?error=access_denied&next=https://example.com");
  await expect(page).toHaveURL(/\/en\/login\?error=callback$/);
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Could not complete sign-in");
  await page.goto("/pl/auth/confirm?type=recovery&next=https://example.com");
  await expect(page).toHaveURL(/\/pl\/login\?error=confirmation$/);
  await page.goto("/en/app");
  await expect(page).toHaveURL(/\/en\/login$/);
});

test("registration is accessible and fits a narrow screen", async ({ page }, testInfo) => {
  await page.goto("/pl/register");
  await page.getByRole("button", { name: "Rozumiem", exact: true }).click();
  await expect(page.locator(".auth-mode-switch a[aria-current]")).toHaveAttribute("href", "/pl/register");
  await page.getByLabel("Hasło", { exact: true }).fill("example-password-only");
  await page.getByRole("button", { name: "Pokaż hasło", exact: true }).click();
  await expect(page.getByLabel("Hasło", { exact: true })).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Ukryj hasło", exact: true }).click();
  await page.getByLabel("Hasło", { exact: true }).fill("");
  await page.screenshot({ path: `tmp/auth-register-${testInfo.project.name}.png`, fullPage: true });
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
  await page.locator(".auth-mode-switch").getByRole("link", { name: "Zaloguj się" }).click();
  await expect(page.getByRole("heading", { name: "Witaj z powrotem" })).toBeVisible();
  await page.screenshot({ path: `tmp/auth-login-${testInfo.project.name}.png`, fullPage: true });
  await page.setViewportSize({ width: 320, height: 740 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
