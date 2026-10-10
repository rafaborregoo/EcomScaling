import assert from "node:assert/strict";
import test from "node:test";
import { decryptCredential, encryptCredential, needsReencryption } from "./credential-crypto.js";
import { internalSecretMatches } from "./internal-auth.js";
import { isOAuthStateExpired, issuedStateMetadata, OAUTH_STATE_TTL_MS } from "./oauth-state.js";
import { encryptShopifyCredential, verifyShopifyHmac } from "./shopify-oauth.js";

const legacyEnv = { SUPABASE_JWT_SECRET: "jwt-secret-de-prueba", SHOPIFY_API_SECRET: "x" };
const keyA = "a".repeat(40);
const keyB = "b".repeat(40);
const CONN = "11111111-1111-4111-8111-111111111111";

test("sin clave propia se sigue cifrando y leyendo como antes (v1)", () => {
  const payload = encryptCredential('{"t":1}', legacyEnv, CONN);
  assert.ok(!payload.startsWith("v2:"));
  assert.equal(decryptCredential(payload, legacyEnv, CONN), '{"t":1}');
});

test("con clave propia cifra en v2 y sigue leyendo lo heredado", () => {
  const env = { ...legacyEnv, CREDENTIALS_ENCRYPTION_KEY: keyA };
  const old = encryptShopifyCredential('{"t":"viejo"}', legacyEnv.SUPABASE_JWT_SECRET);
  assert.equal(decryptCredential(old, env, CONN), '{"t":"viejo"}');
  assert.ok(needsReencryption(old, env));
  const fresh = encryptCredential('{"t":"nuevo"}', env, CONN);
  assert.ok(fresh.startsWith("v2:"));
  assert.ok(!needsReencryption(fresh, env));
  assert.equal(decryptCredential(fresh, env, CONN), '{"t":"nuevo"}');
});

test("un payload v2 copiado a otra conexion no se descifra", () => {
  const env = { ...legacyEnv, CREDENTIALS_ENCRYPTION_KEY: keyA };
  const payload = encryptCredential("secreto", env, CONN);
  assert.throws(() => decryptCredential(payload, env, "22222222-2222-4222-8222-222222222222"));
});

test("rotacion: con la clave anterior en _PREVIOUS se lee lo cifrado antes", () => {
  const before = encryptCredential("secreto", { ...legacyEnv, CREDENTIALS_ENCRYPTION_KEY: keyA }, CONN);
  const rotated = { ...legacyEnv, CREDENTIALS_ENCRYPTION_KEY: keyB, CREDENTIALS_ENCRYPTION_KEY_PREVIOUS: keyA };
  assert.equal(decryptCredential(before, rotated, CONN), "secreto");
  assert.throws(() => decryptCredential(before, { ...legacyEnv, CREDENTIALS_ENCRYPTION_KEY: keyB }, CONN));
});

test("el state caduca a los 30 minutos y los antiguos sin fecha se aceptan", () => {
  const issued = issuedStateMetadata("s", new Date("2026-10-09T10:00:00Z"));
  const at = Date.parse("2026-10-09T10:00:00Z");
  assert.equal(isOAuthStateExpired(issued, at + OAUTH_STATE_TTL_MS - 1), false);
  assert.equal(isOAuthStateExpired(issued, at + OAUTH_STATE_TTL_MS + 1), true);
  assert.equal(isOAuthStateExpired({ state: "s" }, at + 10 * OAUTH_STATE_TTL_MS), false);
});

test("el secreto interno se compara en tiempo constante y exige valor", () => {
  assert.equal(internalSecretMatches("abc", "abc"), true);
  assert.equal(internalSecretMatches("abd", "abc"), false);
  assert.equal(internalSecretMatches(undefined, "abc"), false);
  assert.equal(internalSecretMatches("abc", undefined), false);
});

test("un hmac no hexadecimal devuelve false en vez de lanzar", () => {
  const query = { shop: "x.myshopify.com", code: "c", hmac: "z".repeat(64) };
  assert.equal(verifyShopifyHmac(query, "secret"), false);
});
