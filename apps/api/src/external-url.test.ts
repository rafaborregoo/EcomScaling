import assert from "node:assert/strict";
import test from "node:test";
import { parseSafeExternalHttpUrl } from "./external-url.js";

test("acepta enlaces HTTP(S) públicos y normaliza el valor", () => {
  assert.equal(
    parseSafeExternalHttpUrl(" https://loom.com/share/demo "),
    "https://loom.com/share/demo",
  );
});

test("rechaza esquemas peligrosos, credenciales y destinos locales", () => {
  for (const value of [
    "javascript:alert(1)",
    "data:text/html,hello",
    "https://user:pass@example.com/video",
    "http://localhost:3000/admin",
    "https://127.0.0.1/internal",
    "https://10.0.0.5/internal",
    "https://[::1]/internal",
    "https://service.internal/callback",
  ]) {
    assert.equal(parseSafeExternalHttpUrl(value), null, value);
  }
});
