import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import { NOTIFICATION_TYPES, notificationCategory } from "./notification-catalog.js";

test("un tipo desconocido cae en «Otros»", () => {
  assert.equal(notificationCategory("xyz"), "other");
  assert.equal(notificationCategory("daily_today"), "task_assigned");
});

test("la función SQL de categorías nombra todos los tipos del catálogo", () => {
  const dir = new URL("../../../supabase/migrations/", import.meta.url);
  // La última migración que redefine la función es la que manda.
  const latest = readdirSync(dir)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .reverse()
    .map((file) => readFileSync(new URL(file, dir), "utf8"))
    .find((sql) => sql.includes("function private.notification_category"));
  assert.ok(latest, "hay una migración que define private.notification_category");
  const body = latest.slice(latest.indexOf("function private.notification_category"));
  for (const type of Object.keys(NOTIFICATION_TYPES)) {
    assert.ok(body.includes(`'${type}'`), `falta '${type}' en private.notification_category`);
  }
});
