import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
test.use({ trace: "off", screenshot: "off", video: "off" });
test("household layout and profile tabs match the workspace structure", async ({ page }, testInfo) => {
  test.skip(!process.env.PETS_TEST_CREDENTIALS, "Read-only review needs a test account");
  const credentials = JSON.parse(await readFile(process.env.PETS_TEST_CREDENTIALS!, "utf8"));
  await page.goto("/pl/login");
  await page.getByLabel("Adres e-mail").fill(credentials.email);
  await page.getByLabel("Hasło", { exact: true }).fill(credentials.password);
  await page.getByRole("button", { name: "Zaloguj się", exact: true }).click();
  await expect(page).toHaveURL(/\/pl\/app$/);
  await page.getByRole("button", { name: "Rozumiem", exact: true }).click();
  await expect(page.locator(".household-account")).toContainText(credentials.email);
  await expect(page.getByRole("heading", { name: "Wspólny terminarz i przypomnienia domowe" })).toBeVisible();
  if (await page.locator(".empty-household").count()) {
    await expect(page.getByRole("heading", { name: "Twoje domostwo nie ma jeszcze żadnego podopiecznego" })).toBeVisible();
    await expect(page.locator(".empty-household-features > div")).toHaveCount(3);
    await expect(page.locator(".pet-card--add")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Utwórz kartotekę pupila" })).toHaveAttribute("href", "/pl/app/zwierzeta/nowe");
    await expect(page.getByRole("link", { name: /demonstracyjny profil Luny/ })).toHaveAttribute("href", "/pl/demo/luna");
  }
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: `tmp/stitch-review-list-${testInfo.project.name}.png`, fullPage: true });
  const record = page.locator(".household-card-link").first();
  if (await record.count()) {
    await record.click();
    await expect(page.locator(".household-cover")).toBeVisible();
    await page.getByRole("tab", { name: "Podsumowanie", exact: true }).focus();
    await page.keyboard.press("End");
    await expect(page.getByRole("tab", { name: "Dokumenty", exact: true })).toBeFocused();
    await expect(page.getByRole("tabpanel", { name: "Dokumenty" })).toBeVisible();
    await page.keyboard.press("Home");
    await expect(page.getByRole("tabpanel", { name: "Podsumowanie" })).toBeVisible();
    await page.screenshot({ path: `tmp/stitch-review-profile-${testInfo.project.name}.png`, fullPage: true });
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
  await page.setViewportSize({ width: 320, height: 780 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
