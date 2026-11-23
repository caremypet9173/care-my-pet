import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeRouteTemplate,
  sanitizeTelemetryEvent,
  sanitizeTelemetryMeta,
  scrubTelemetryString,
} from "../src/lib/telemetry-shared.ts";

test("normalizeRouteTemplate strips locale, UUIDs, tokens, queries and hashes", () => {
  assert.deepEqual(
    normalizeRouteTemplate(
      "/pl/app/pets/07a2c9fd-28cc-4ed3-a3fa-315d04ff899c?tab=results&report=6814fb8f-4768-4d2b-b5d3-19a16c137386#top",
    ),
    {
      routeTemplate: "/app/pets/[id]",
      routeName: "pet_record",
      locale: "pl",
    },
  );

  assert.deepEqual(
    normalizeRouteTemplate(
      "/en/app/pets/07a2c9fd-28cc-4ed3-a3fa-315d04ff899c/fluid-therapy/6814fb8f-4768-4d2b-b5d3-19a16c137386/edit",
    ),
    {
      routeTemplate: "/app/pets/[id]/fluid-therapy/[id]/edit",
      routeName: "fluid_edit",
      locale: "en",
    },
  );

  assert.deepEqual(
    normalizeRouteTemplate("/pl/shared/abc123secretTokenXYZ"),
    {
      routeTemplate: "/shared/[token]",
      routeName: "shared_record",
      locale: "pl",
    },
  );

  assert.deepEqual(
    normalizeRouteTemplate("/pl/recover/confirm/secret-confirm-token"),
    {
      routeTemplate: "/recover/confirm/[token]",
      routeName: "recovery",
      locale: "pl",
    },
  );
});

test("scrubTelemetryString and sanitizeTelemetryMeta strip PII and enforce allowlists", () => {
  assert.equal(
    scrubTelemetryString(
      "Failed for jan.kowalski@example.com on 07a2c9fd-28cc-4ed3-a3fa-315d04ff899c https://secret.example/x",
      80,
    ),
    "Failed for [email] on [id] [url]",
  );

  const clean = sanitizeTelemetryMeta({
    via: "pill",
    ttl_hours: 48,
    cached: true,
    "bad-key!": "dropped",
    nested: { disallowed: true },
    email_leak: "owner@example.com",
  });

  assert.deepEqual(clean, {
    via: "pill",
    ttl_hours: 48,
    cached: true,
    email_leak: "[email]",
  });
});

test("sanitizeTelemetryEvent accepts valid events and rejects malformed or unknown types", () => {
  const valid = sanitizeTelemetryEvent({
    event_type: "tab_view",
    route_template: "/pl/app/pets/07a2c9fd-28cc-4ed3-a3fa-315d04ff899c?tab=results",
    name: "Results",
    locale: "pl",
    device_class: "mobile",
    is_pwa: true,
    meta: { source: "click" },
  });

  assert.deepEqual(valid, {
    event_type: "tab_view",
    route_template: "/app/pets/[id]",
    name: "results",
    locale: "pl",
    device_class: "mobile",
    is_pwa: true,
    meta: { source: "click" },
  });

  assert.equal(
    sanitizeTelemetryEvent({
      event_type: "unknown_type",
      route_template: "/app",
      name: "test",
    }),
    null,
  );

  assert.equal(
    sanitizeTelemetryEvent({
      event_type: "action",
      route_template: "no-leading-slash",
      name: "pet_switch",
    }),
    null,
  );

  assert.equal(
    sanitizeTelemetryEvent({
      event_type: "action",
      route_template: "/app",
      name: "invalid name with spaces!",
    }),
    null,
  );
});
