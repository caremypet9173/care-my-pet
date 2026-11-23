import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeRelativePath } from "../src/lib/safe-redirect.ts";

test("sanitizeRelativePath allows safe relative paths and strips leading locale prefixes", () => {
  assert.equal(sanitizeRelativePath("/app"), "/app");
  assert.equal(sanitizeRelativePath("/app/pets/123?tab=labs"), "/app/pets/123?tab=labs");
  assert.equal(sanitizeRelativePath("/pl/app/pets/123"), "/app/pets/123");
  assert.equal(sanitizeRelativePath("/en/invite/abc"), "/invite/abc");
  assert.equal(sanitizeRelativePath("/pl"), "/");
  assert.equal(sanitizeRelativePath("/en/"), "/");
  assert.equal(sanitizeRelativePath("  /app/schedule  "), "/app/schedule");
});

test("sanitizeRelativePath rejects open redirects, schemes, backslashes, and control chars", () => {
  assert.equal(sanitizeRelativePath(null), "/app");
  assert.equal(sanitizeRelativePath(undefined), "/app");
  assert.equal(sanitizeRelativePath(""), "/app");
  assert.equal(sanitizeRelativePath("https://evil.com"), "/app");
  assert.equal(sanitizeRelativePath("http://evil.com/app"), "/app");
  assert.equal(sanitizeRelativePath("//evil.com"), "/app");
  assert.equal(sanitizeRelativePath("//evil.com/path"), "/app");
  assert.equal(sanitizeRelativePath("/pl//evil.com"), "/app");
  assert.equal(sanitizeRelativePath("/\\evil.com"), "/app");
  assert.equal(sanitizeRelativePath("/app\\evil"), "/app");
  assert.equal(sanitizeRelativePath("/javascript:alert(1)"), "/app");
  assert.equal(sanitizeRelativePath("/pl/https://evil.com"), "/app");
  assert.equal(sanitizeRelativePath("/app\r\nSet-Cookie: x=1"), "/app");
  assert.equal(sanitizeRelativePath("app/no-leading-slash", "/custom"), "/custom");
});
