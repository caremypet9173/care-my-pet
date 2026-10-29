import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("Signature loads with local assets and no browser errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Więcej wspólnych chwil. Mniej szukania wyników.",
  );
  await page.evaluate(() => document.fonts.ready);
  await expect(page.getByRole("img", { name: /Pies i kot/ })).toBeVisible();
  for (const image of await page.locator("img").all()) {
    await image.scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        image.evaluate(
          (node) =>
            node instanceof HTMLImageElement &&
            node.complete &&
            node.naturalWidth > 0,
        ),
      )
      .toBe(true);
  }
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await expect(page.getByText("Załóż bezpłatne konto")).toHaveCount(0);
});

test("demo tabs work with keyboard and expose source ranges", async ({
  page,
  isMobile,
}) => {
  await page.goto("/");
  const history = page.getByRole("tab", { name: "Historia Luny" });
  await history.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Wyniki badań" })).toBeFocused();
  await expect(page.getByRole("tabpanel")).toContainText("Powyżej zakresu");
  await expect(
    page.locator(isMobile ? ".results-mobile" : ".results-table"),
  ).toBeVisible();
  await expect(
    page.locator(isMobile ? ".results-table" : ".results-mobile"),
  ).not.toBeVisible();
  await page.keyboard.press("Home");
  await expect(history).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: "Zobacz wyniki" }).click();
  await expect(page.getByRole("tab", { name: "Wyniki badań" })).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("navigation works and the private app stays closed", async ({
  page,
  isMobile,
}) => {
  await page.goto("/");
  if (isMobile) {
    await page.getByRole("button", { name: "Otwórz menu" }).click();
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "Otwórz menu" }),
    ).toBeFocused();
    await page.getByRole("button", { name: "Otwórz menu" }).click();
  }
  await page.getByRole("link", { name: "Jak to działa", exact: true }).click();
  await expect(page).toHaveURL(/jak-to-dziala$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Ty decydujesz, co zapisujesz.",
  );
  await page
    .getByText("Czy odczyt może zawierać błędy?", { exact: true })
    .click();
  await expect(page.getByText(/Tak. Dlatego przed zapisaniem/)).toBeVisible();
  await page.goto("/app");
  await expect(page).toHaveURL(/login$/);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /Witaj z powrotem|Zaloguj się/,
    }),
  ).toBeVisible();
  await expect(page.getByLabel("Adres e-mail")).toBeVisible();
});

test("public routes have no broken destination", async ({ page }) => {
  for (const path of [
    "/mozliwosci",
    "/prywatnosc",
    "/regulamin",
    "/login",
    "/demo/luna",
  ]) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
  expect((await page.goto("/nie-ma-takiej-strony"))?.status()).toBe(404);
});

test("home and results pass automated accessibility checks", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.getByRole("tab", { name: "Wyniki badań" }).click();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});

test("small screens retain every section without horizontal scrolling", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Od zdjęcia badania do uporządkowanej kartoteki",
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("waitlist modal opens from Hero, submits successfully and closes", async ({
  page,
}) => {
  await page.goto("/");
  const ctaBtn = page
    .getByRole("button", { name: "Jestem zainteresowany" })
    .first();
  await expect(ctaBtn).toBeVisible();
  await ctaBtn.click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Zadbaj o zdrowie pupili bez chaosu" }),
  ).toBeVisible();

  await page
    .getByLabel("Twój adres e-mail *")
    .fill("tester-waitlist@example.com");
  await page.getByLabel("Ile pupili masz pod opieką?").fill("3");
  await page.getByRole("button", { name: "Zapisz mnie na start!" }).click();

  await expect(
    page.getByRole("heading", { name: "Dziękujemy! Jesteś na liście!" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Super, zamknij okno" }).click();
  await expect(dialog).toHaveCount(0);
});
