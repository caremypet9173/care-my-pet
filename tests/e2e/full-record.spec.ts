import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("full profile navigation supports direct links, history and source document", async ({
  page,
}) => {
  await page.goto("/demo/luna");
  await expect(
    page.getByRole("heading", { level: 1, name: "Luna", exact: true }),
  ).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Kartoteka Luny" });
  await nav.getByRole("link", { name: "Historia", exact: true }).click();
  await expect(page).toHaveURL(/\/historia$/);
  await page.getByRole("button", { name: "Badania", exact: true }).click();
  await expect(page.locator(".timeline-item")).toHaveCount(1);
  await page.getByText("Szczegóły wpisu", { exact: true }).click();
  await expect(
    page.getByText(/Wyniki zostały omówione podczas wizyty/),
  ).toBeVisible();
  await page.getByRole("link", { name: "Zobacz pełne wyniki" }).click();
  await expect(page).toHaveURL(/\/wyniki$/);
  await page
    .getByRole("button", { name: "Profil nerkowy", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("2");
  await page
    .getByRole("link", { name: /Podgląd dokumentu źródłowego/ })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText("1,7 mg/dl");
  await expect(page.getByRole("dialog")).toContainText("Przykładowy opiekun");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page).toHaveURL(/\/dokumenty$/);
  await page.reload();
  await expect(
    nav.getByRole("link", { name: "Dokumenty", exact: true }),
  ).toHaveAttribute("aria-current", "page");
});

test("document filters, modal keyboard focus and empty states work", async ({
  page,
}) => {
  await page.goto("/demo/luna/dokumenty");
  await page.getByRole("button", { name: "Rachunki (1)", exact: true }).click();
  await expect(page.locator(".document-list .document-row")).toHaveCount(1);
  const trigger = page.getByRole("link", { name: /Podgląd: Rachunek/ });
  await trigger.click();
  await expect(page.getByRole("dialog")).toContainText("245,00 zł");
  await page.keyboard.press("Tab");
  expect(
    await page.evaluate(() => !!document.activeElement?.closest("dialog")),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await page
    .getByRole("searchbox", { name: "Szukaj dokumentów" })
    .fill("nieistniejący dokument");
  await expect(
    page.getByRole("heading", { name: "Brak pasujących dokumentów" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Wyczyść filtry" }).click();
  await expect(page.locator(".document-list .document-row")).toHaveCount(5);
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /Dodaj|Usuń|Zapisz/ }),
  ).toHaveCount(0);
});

test("all record screens and open document pass automated accessibility", async ({
  page,
}) => {
  for (const path of [
    "/demo/luna",
    "/demo/luna/historia",
    "/demo/luna/wyniki",
    "/demo/luna/dokumenty",
    "/demo/luna/dokumenty?plik=badania",
  ]) {
    await page.goto(path);
    if (path.includes("?"))
      await expect(page.getByRole("dialog")).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(result.violations, path).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      path,
    ).toBe(true);
  }
});

test("record remains readable at 320px and document links share stable URLs", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  for (const path of [
    "/demo/luna",
    "/demo/luna/wyniki",
    "/demo/luna/dokumenty?plik=wizyta",
  ]) {
    await page.goto(path);
    if (path.includes("?")) {
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.getByRole("link", { name: "Następny dokument" }).click();
      await expect(page).toHaveURL(/plik=szczepienie$/);
      await expect(page.getByRole("dialog")).toContainText("12 kwietnia 2027");
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      path,
    ).toBe(true);
  }
});
