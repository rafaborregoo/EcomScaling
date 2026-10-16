import assert from "node:assert/strict";
import { test } from "node:test";
import { buildPushMessages } from "./mobile-push.js";

const row = (id: string, user_id: string, type: string) => ({ id, user_id, type, title: `t-${id}`, message: null, created_at: "2026-10-15T10:00:00Z" });

test("un push por dispositivo; sin dispositivo no hay push", () => {
  const tokens = new Map([["u1", ["ExponentPushToken[a]", "ExponentPushToken[b]"]]]);
  const out = buildPushMessages([row("1", "u1", "alert"), row("2", "u2", "alert")], tokens, new Set());
  assert.deepEqual(out.map((m) => m.to), ["ExponentPushToken[a]", "ExponentPushToken[b]"]);
  assert.equal(out[0]?.body, "");
});

test("en silencio solo pasan las alertas críticas", () => {
  const tokens = new Map([["u1", ["ExponentPushToken[a]"]]]);
  const out = buildPushMessages([row("1", "u1", "alert"), row("2", "u1", "alert_critical")], tokens, new Set(["u1"]));
  assert.deepEqual(out.map((m) => m.data.notificationId), ["2"]);
});
