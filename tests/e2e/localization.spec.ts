import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import pl from "../../src/i18n/messages/pl.json";
import en from "../../src/i18n/messages/en.json";

async function chooseLanguage(page: Page, language: "Polski" | "English") {
  const dialog = page.getByRole("dialog");
  if (await dialog.isVisible()) {
    await dialog.getByRole("button", { name: language, exact: true }).click();
  } else {
    const menu = page.getByRole("button", { name: /Otwórz menu|Open menu/ });
    if (await menu.isVisible()) await menu.click();
    await page
      .getByRole("button", { name: language, exact: true })
      .filter({ visible: true })
      .click();
  }
}

test("catalogs cover the same messages and legacy links default to Polish", async ({
  page,
}) => {
  expect(Object.keys(en.copy).sort()).toEqual(Object.keys(pl.copy).sort());
  await page.goto("/demo/luna/dokumenty?plik=badania");
  await expect(page).toHaveURL(/\/pl\/demo\/luna\/dokumenty\?plik=badania$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "pl");
  await page.goto("/en/app");
  await expect(page).toHaveURL(/\/en\/login$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Just a little longer.",
  );
  await page.goto("/");
  await expect(page).toHaveURL(/\/pl$/);
});

test("language switch retains page, fragment and selected document", async ({
  page,
}) => {
  await page.goto("/pl/demo/luna/historia#badania");
  await chooseLanguage(page, "English");
  await expect(page).toHaveURL(/\/en\/demo\/luna\/historia#badania$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(
    page.getByRole("heading", { name: "Luna’s health history" }),
  ).toBeVisible();
  await page.goto("/en/demo/luna/dokumenty?plik=rachunek");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("PLN 245.00");
  await chooseLanguage(page, "Polski");
  await expect(page).toHaveURL(/\/pl\/demo\/luna\/dokumenty\?plik=rachunek$/);
  await expect(dialog).toContainText("245,00 zł");
  await chooseLanguage(page, "English");
  await expect(dialog).toContainText("does not translate original attachments");
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/en\/demo\/luna\/dokumenty$/);
});

test("all public English pages render translated content and titles", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  const pages = [
    ["", "More moments together. Less searching for results."],
    ["/mozliwosci", "Less searching. More peace of mind."],
    ["/jak-to-dziala", "You decide what to save."],
    ["/prywatnosc", "Your data privacy"],
    ["/regulamin", "Terms of use"],
    ["/login", "Just a little longer. We’re preparing Care My Pet."],
  ];
  for (const [path, heading] of pages) {
    expect((await page.goto(`/en${path}`))?.status()).toBe(200);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
    await expect(page.locator("title")).not.toContainText(
      /Możliwości|Prywatność|Regulamin|Logowanie/,
    );
    await expect(page.locator("body")).not.toContainText(
      /Zaloguj|Zobacz|Przykładow|Wyniki badań/,
    );
  }
  expect(errors).toEqual([]);
});

test("English record localises numbers, dates, search and labels without changing units", async ({
  page,
}) => {
  await page.goto("/en/demo/luna/historia");
  await page
    .getByRole("searchbox", { name: "Search history", exact: true })
    .fill("vaccination");
  await expect(page.locator(".timeline-item")).toHaveCount(1);
  await expect(page.locator(".timeline-item")).toContainText("12 April 2026");
  await page
    .getByRole("navigation", { name: "Luna’s pet record" })
    .getByRole("link", { name: "Test results", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Kidney profile", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("2");
  await expect(page.locator(".full-results")).toContainText("1.7");
  await expect(page.locator(".full-results")).toContainText("mg/dl");
  await expect(page.locator(".full-results")).toContainText("Above range");
  await page.getByRole("link", { name: /Preview source document/ }).click();
  await expect(page.getByRole("dialog")).toContainText("15 September 2026");
  await expect(page.getByRole("dialog")).toContainText("tys./µl");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/,
  );
});

test("English layouts remain accessible and fit small screens", async ({
  page,
}) => {
  for (const path of [
    "",
    "/demo/luna",
    "/demo/luna/wyniki",
    "/demo/luna/dokumenty?plik=badania",
  ]) {
    await page.goto(`/en${path}`);
    if (path.includes("?"))
      await expect(page.getByRole("dialog")).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
      path,
    ).toEqual([]);
    await page.setViewportSize({ width: 320, height: 740 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      path,
    ).toBe(true);
  }
});
