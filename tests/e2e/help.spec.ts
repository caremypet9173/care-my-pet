import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("help index and all 3 guides load cleanly in PL and EN with valid images and no a11y violations", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  const routes: [string, string][] = [
    ["/pl/help", "Poradniki krok po kroku"],
    ["/pl/help/notifications", "Powiadomienia Push i instalacja aplikacji"],
    ["/pl/help/medical-reports", "Skanowanie i zatwierdzanie wyników badań"],
    [
      "/pl/help/sharing-and-recovery",
      "Udostępnianie weterynarzowi i Klucz Odzyskiwania",
    ],
    ["/en/help", "Step-by-step guides"],
    ["/en/help/notifications", "Push notifications & app installation"],
    ["/en/help/medical-reports", "Scanning & reviewing lab results"],
    ["/en/help/sharing-and-recovery", "Vet sharing & Recovery Key"],
  ];

  for (const [url, heading] of routes) {
    const res = await page.goto(url, { waitUntil: "networkidle" });
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);

    // Every visible image loads properly
    for (const img of await page.locator("img:visible").all()) {
      await img.scrollIntoViewIfNeeded();
      await expect
        .poll(() =>
          img.evaluate(
            (node) =>
              node instanceof HTMLImageElement &&
              node.complete &&
              node.naturalWidth > 0,
          ),
        )
        .toBe(true);
    }

    // No horizontal overflow
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);

    // Accessibility check on Polish routes + English index
    if (url.startsWith("/pl/") || url === "/en/help") {
      const a11y = await new AxeBuilder({ page }).include("main").analyze();
      expect(a11y.violations).toEqual([]);
    }
  }

  expect(errors).toEqual([]);
});

test("notifications guide platform tabs support keyboard navigation and hash deep links", async ({
  page,
}) => {
  await page.goto("/pl/help/notifications#ios", { waitUntil: "networkidle" });
  const iosTab = page.getByRole("tab", { name: /iPhone/ });
  await expect(iosTab).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#panel-ios")).toBeVisible();
  await expect(page.locator("#panel-android")).toBeHidden();

  await iosTab.focus();
  await page.keyboard.press("ArrowRight");
  const desktopTab = page.getByRole("tab", { name: /Komputer/ });
  await expect(desktopTab).toBeFocused();
  await expect(desktopTab).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#panel-desktop")).toBeVisible();

  await page.keyboard.press("Home");
  const androidTab = page.getByRole("tab", { name: /Android/ });
  await expect(androidTab).toBeFocused();
  await expect(androidTab).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#panel-android")).toBeVisible();
});
