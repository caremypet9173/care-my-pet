import { test } from "node:test";
import assert from "node:assert/strict";
import { formatMemberDisplayNames } from "../src/features/household/member-names.ts";

test("formatMemberDisplayNames shortens dotted emails to clean first names", () => {
  const map = formatMemberDisplayNames([
    {
      user_id: "u1",
      email: "wojciech.krzysztof.dobrowolski@gmail.com",
      fallback: "Właściciel",
    },
    {
      user_id: "u2",
      email: "kasia99@example.com",
    },
  ]);

  assert.equal(map.u1, "Wojciech");
  assert.equal(map.u2, "Kasia");
});

test("formatMemberDisplayNames disambiguates duplicate first names with last-token initial", () => {
  const map = formatMemberDisplayNames([
    { user_id: "u1", email: "anna.kowalska@example.com" },
    { user_id: "u2", email: "anna.nowak@example.com" },
    { user_id: "u3", email: null, fallback: "Właściciel" },
  ]);

  assert.equal(map.u1, "Anna K.");
  assert.equal(map.u2, "Anna N.");
  assert.equal(map.u3, "Właściciel");
});
