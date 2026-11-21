import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeFeedbackPayload } from "../src/lib/feedback-shared.ts";

test("sanitizeFeedbackPayload normalizes route, breadcrumbs, errors and screenshot metadata", () => {
  const result = sanitizeFeedbackPayload(
    {
      category: "bug",
      message: "  Przycisk dodawania badania nie przewija do góry na telefonie.  ",
      pathname: "/pl/app/pets/0e1966e5-ef2a-4c35-8b5c-a3f1f03d4fd7?tab=results",
      active_tab: "results",
      locale: "pl",
      device_class: "mobile",
      is_pwa: true,
      viewport: "390x844",
      breadcrumbs: [
        {
          at: "2026-11-21T11:30:00.000Z",
          type: "tab_view",
          name: "results",
          route: "/pl/app/pets/0e1966e5-ef2a-4c35-8b5c-a3f1f03d4fd7",
        },
      ],
      recent_errors: [
        {
          at: "2026-11-21T11:30:05.000Z",
          source: "window_error",
          route: "/pl/app/pets/0e1966e5-ef2a-4c35-8b5c-a3f1f03d4fd7",
          error_name: "TypeError",
          msg: "Cannot read user jan@example.com from 0e1966e5-ef2a-4c35-8b5c-a3f1f03d4fd7",
        },
      ],
      screenshot_path:
        "11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222.jpg",
      screenshot_mime: "image/jpeg",
    },
    "Mozilla/5.0 TestAgent",
  );

  assert.ok(result);
  assert.equal(result.category, "bug");
  assert.equal(
    result.message,
    "Przycisk dodawania badania nie przewija do góry na telefonie.",
  );
  assert.equal(result.route_template, "/app/pets/[id]");
  assert.equal(result.active_tab, "results");
  assert.equal(result.device_class, "mobile");
  assert.equal(result.is_pwa, true);
  assert.equal(result.viewport, "390x844");
  assert.equal(result.breadcrumbs.length, 1);
  assert.equal(result.breadcrumbs[0]?.route, "/app/pets/[id]");
  assert.equal(result.recent_errors.length, 1);
  assert.ok(!result.recent_errors[0]?.msg.includes("jan@example.com"));
  assert.ok(
    !result.recent_errors[0]?.msg.includes("0e1966e5-ef2a-4c35-8b5c-a3f1f03d4fd7"),
  );
  assert.equal(result.screenshot_mime, "image/jpeg");
});

test("sanitizeFeedbackPayload rejects invalid category, short/long message, or malformed screenshot path", () => {
  assert.equal(
    sanitizeFeedbackPayload({ category: "other", message: "Testowa treść" }),
    null,
  );
  assert.equal(
    sanitizeFeedbackPayload({ category: "suggestion", message: "ab" }),
    null,
  );
  assert.equal(
    sanitizeFeedbackPayload({
      category: "ux",
      message: "x".repeat(4001),
    }),
    null,
  );
  assert.equal(
    sanitizeFeedbackPayload({
      category: "bug",
      message: "Błąd z niepoprawną ścieżką",
      screenshot_path: "../etc/passwd",
      screenshot_mime: "image/png",
    }),
    null,
  );
  assert.equal(
    sanitizeFeedbackPayload({
      category: "bug",
      message: "Błąd ze złym MIME",
      screenshot_path:
        "11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222.jpg",
      screenshot_mime: "image/svg+xml",
    }),
    null,
  );
});
