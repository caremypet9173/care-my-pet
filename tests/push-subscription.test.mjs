import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  PUSH_SYNC_TTL_MS,
  buildPushFingerprint,
  detectPushEnvironment,
  getPushGuidance,
  parsePushSyncState,
  shouldSyncPushSubscription,
} from "../src/features/schedule/push-helpers.ts";

test("detectPushEnvironment identifies Android, iOS, iPadOS and standalone PWA", () => {
  assert.deepEqual(
    detectPushEnvironment({
      userAgent: "Mozilla/5.0 (Linux; Android 14; motorola edge 40) AppleWebKit/537.36 Chrome/131.0.0.0 Mobile Safari/537.36",
      isStandalone: true,
    }),
    { isStandalone: true, isAndroid: true, isIos: false },
  );

  assert.deepEqual(
    detectPushEnvironment({
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
      isStandalone: false,
    }),
    { isStandalone: false, isAndroid: false, isIos: true },
  );

  assert.deepEqual(
    detectPushEnvironment({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15",
      platform: "MacIntel",
      maxTouchPoints: 5,
      isStandalone: true,
    }),
    { isStandalone: true, isAndroid: false, isIos: true },
  );

  assert.deepEqual(
    detectPushEnvironment({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
      platform: "Win32",
      maxTouchPoints: 0,
      isStandalone: false,
    }),
    { isStandalone: false, isAndroid: false, isIos: false },
  );
});

test("parsePushSyncState validates JSON payload and rejects malformed input", () => {
  assert.equal(parsePushSyncState(null), null);
  assert.equal(parsePushSyncState("not-json"), null);
  assert.equal(parsePushSyncState(JSON.stringify({ endpoint: "https://fcm.example/1" })), null);

  const valid = parsePushSyncState(
    JSON.stringify({
      endpoint: "https://fcm.googleapis.com/fcm/send/abc",
      fingerprint: "fp-1",
      householdId: "11111111-1111-1111-1111-111111111111",
      syncedAt: 1_700_000_000_000,
    }),
  );
  assert.deepEqual(valid, {
    endpoint: "https://fcm.googleapis.com/fcm/send/abc",
    fingerprint: "fp-1",
    householdId: "11111111-1111-1111-1111-111111111111",
    syncedAt: 1_700_000_000_000,
  });
});

test("shouldSyncPushSubscription handles TTL, force and rotated endpoints", () => {
  const endpointA = "https://fcm.googleapis.com/fcm/send/token-a";
  const endpointB = "https://fcm.googleapis.com/fcm/send/token-b";
  const fpA = buildPushFingerprint({
    endpoint: endpointA,
    p256dh: "k1",
    auth: "a1",
    householdId: "hh-1",
  });
  const fpB = buildPushFingerprint({
    endpoint: endpointB,
    p256dh: "k2",
    auth: "a2",
    householdId: "hh-1",
  });
  const now = 1_800_000_000_000;

  assert.deepEqual(
    shouldSyncPushSubscription({
      prev: null,
      nextEndpoint: endpointA,
      nextFingerprint: fpA,
      nowMs: now,
    }),
    { shouldSync: true, staleEndpoint: null },
  );

  const recentPrev = {
    endpoint: endpointA,
    fingerprint: fpA,
    householdId: "hh-1",
    syncedAt: now - 1000,
  };
  assert.deepEqual(
    shouldSyncPushSubscription({
      prev: recentPrev,
      nextEndpoint: endpointA,
      nextFingerprint: fpA,
      nowMs: now,
    }),
    { shouldSync: false, staleEndpoint: null },
  );

  assert.deepEqual(
    shouldSyncPushSubscription({
      prev: recentPrev,
      nextEndpoint: endpointA,
      nextFingerprint: fpA,
      nowMs: now,
      force: true,
    }),
    { shouldSync: true, staleEndpoint: null },
  );

  assert.deepEqual(
    shouldSyncPushSubscription({
      prev: { ...recentPrev, syncedAt: now - PUSH_SYNC_TTL_MS },
      nextEndpoint: endpointA,
      nextFingerprint: fpA,
      nowMs: now,
    }),
    { shouldSync: true, staleEndpoint: null },
  );

  assert.deepEqual(
    shouldSyncPushSubscription({
      prev: recentPrev,
      nextEndpoint: endpointB,
      nextFingerprint: fpB,
      nowMs: now,
    }),
    { shouldSync: true, staleEndpoint: endpointA },
  );
});

test("getPushGuidance returns platform-specific instructions for iOS, Android PWA and subscribed states", () => {
  const iosInstall = getPushGuidance({
    supported: false,
    permission: "default",
    subscribed: false,
    env: { isStandalone: false, isAndroid: false, isIos: true },
    locale: "pl",
  });
  assert.equal(iosInstall?.kind, "info");
  assert.match(iosInstall?.text ?? "", /Do ekranu początkowego/);

  const androidPwaDenied = getPushGuidance({
    supported: true,
    permission: "denied",
    subscribed: false,
    env: { isStandalone: true, isAndroid: true, isIos: false },
    locale: "pl",
  });
  assert.equal(androidPwaDenied?.kind, "warning");
  assert.match(androidPwaDenied?.text ?? "", /Informacje o aplikacji/);

  const androidSubscribed = getPushGuidance({
    supported: true,
    permission: "granted",
    subscribed: true,
    env: { isStandalone: true, isAndroid: true, isIos: false },
    locale: "pl",
  });
  assert.equal(androidSubscribed?.kind, "info");
  assert.match(androidSubscribed?.text ?? "", /Wstrzymaj aktywność aplikacji/);

  const desktopSubscribedEn = getPushGuidance({
    supported: true,
    permission: "granted",
    subscribed: true,
    env: { isStandalone: false, isAndroid: false, isIos: false },
    locale: "en",
  });
  assert.equal(desktopSubscribedEn?.kind, "info");
  assert.match(desktopSubscribedEn?.text ?? "", /Send test Push/);

  const defaultIdle = getPushGuidance({
    supported: true,
    permission: "default",
    subscribed: false,
    env: { isStandalone: true, isAndroid: true, isIos: false },
    locale: "pl",
  });
  assert.equal(defaultIdle, null);
});

test("service worker registers pushsubscriptionchange handler", () => {
  const swSource = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
  assert.match(swSource, /addEventListener\(["']pushsubscriptionchange["']/);
  assert.match(swSource, /CMP_PUSH_SUBSCRIPTION_CHANGED/);
});
