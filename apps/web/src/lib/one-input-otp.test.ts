import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

// Todo código de un solo uso (2FA, verificación) va en InputOTP de
// components/ui/input-otp.tsx: casillas, pegar sin espacios y autorrelleno.
// Un Input suelto con autocomplete="one-time-code" es el campo a mano de antes.
const SRC = join(import.meta.dirname, "..");
const OWN = join("components", "ui", "input-otp.tsx");

test("ningún campo de código hecho a mano: se usa InputOTP", () => {
  const offenders = readdirSync(SRC, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".tsx"))
    .map((entry) => join(entry.parentPath, entry.name).slice(SRC.length + 1))
    .filter((path) => path !== OWN && /one-time-code/.test(readFileSync(join(SRC, path), "utf8")));
  assert.deepEqual(offenders, [], "Usa InputOTP de @/components/ui");
});
