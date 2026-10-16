import assert from "node:assert/strict";
import test from "node:test";
import { isDigestDue, isQuietHour, localClock, planUserEmails } from "./notification-email.js";
import { DEFAULT_EMAIL } from "./notification-settings.js";

const row = (id: string, type: string, status = "unread") => ({
  id,
  user_id: "u",
  type,
  title: id,
  message: null,
  action_url: "/tareas",
  status,
  created_at: "2026-10-12T08:00:00Z",
});

test("hora local y silencio que cruza la medianoche", () => {
  // 2026-10-12 es lunes; 21:30 UTC = 23:30 en Madrid (horario de verano).
  assert.deepEqual(localClock(new Date("2026-10-12T21:30:00Z"), "Europe/Madrid"), { hour: 23, weekday: 1 });
  const quiet = { quiet_enabled: true, quiet_from: 21, quiet_to: 8 };
  assert.equal(isQuietHour(23, quiet), true);
  assert.equal(isQuietHour(7, quiet), true);
  assert.equal(isQuietHour(8, quiet), false);
  assert.equal(isQuietHour(23, { ...quiet, quiet_enabled: false }), false);
});

test("el resumen sale una vez a su hora y su día", () => {
  const now = new Date("2026-10-12T06:10:00Z"); // lunes 8:10 en Madrid
  const weekly = { digest_frequency: "weekly" as const, digest_hour: 8, digest_weekday: 1 };
  assert.equal(isDigestDue(localClock(now, "Europe/Madrid"), weekly, null, now), true);
  assert.equal(isDigestDue(localClock(now, "Europe/Madrid"), weekly, new Date("2026-10-12T06:00:00Z"), now), false);
  assert.equal(isDigestDue(localClock(now, "Europe/Madrid"), { ...weekly, digest_weekday: 5 }, null, now), false);
  assert.equal(isDigestDue(localClock(now, "Europe/Madrid"), { ...weekly, digest_frequency: "never" }, null, now), false);
});

test("al momento, al resumen o descartado; las críticas saltan el silencio", () => {
  const rows = [row("crit", "alert_critical"), row("msg", "message"), row("task", "task_assigned"), row("read", "alert", "read"), row("x", "something_else")];
  const mode = (category: keyof typeof DEFAULT_EMAIL) => DEFAULT_EMAIL[category];

  const quietNoDigest = planUserEmails(rows, mode, true, false);
  assert.deepEqual(quietNoDigest.instant.map((r) => r.id), ["crit"]);
  assert.deepEqual(quietNoDigest.digest, []);
  assert.deepEqual(quietNoDigest.discard.map((r) => r.id), ["x"]);

  const awakeDigest = planUserEmails(rows, mode, false, true);
  assert.deepEqual(awakeDigest.instant.map((r) => r.id), ["crit", "msg"]);
  assert.deepEqual(awakeDigest.digest.map((r) => r.id), ["task"]);
  assert.deepEqual(awakeDigest.discard.map((r) => r.id), ["read", "x"]);
});
