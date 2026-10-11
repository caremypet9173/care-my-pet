import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("cookie information is accessible, localized and dismissal persists", async ({ page }) => {
  await page.goto("/pl");
  const notice = page.getByRole("complementary", { name: "Cookies i Twoja prywatność" });
  await expect(notice).toBeVisible();
  expect((await new AxeBuilder({ page }).include(".cookie-notice").analyze()).violations).toEqual([]);
  await page.screenshot({ path: `tmp/cookies-${test.info().project.name}.png` });
  await notice.getByRole("link", { name: "Informacje o cookies" }).click();
  await expect(page).toHaveURL(/\/pl\/prywatnosc#cookies$/);
  await expect(page.locator("#cookies")).toContainText("Pliki cookies");
  await notice.getByRole("button", { name: "Rozumiem" }).click();
  await expect(notice).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".cookie-notice")).toHaveCount(0);
  await page.goto("/en");
  await expect(page.locator(".cookie-notice")).toHaveCount(0);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByRole("complementary", { name: "Cookies and your privacy" })).toBeVisible();
  await page.getByRole("button", { name: "Got it" }).click();
  await page.getByRole("contentinfo").getByRole("link", { name: "Cookie information" }).click();
  await expect(page).toHaveURL(/\/en\/prywatnosc#cookies$/);
});

test("cookie notice can close when browser storage is blocked", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() { throw new DOMException("Blocked", "SecurityError"); },
    });
  });
  await page.goto("/pl");
  await page.getByRole("button", { name: "Rozumiem" }).click();
  await expect(page.locator(".cookie-notice")).toHaveCount(0);
});
