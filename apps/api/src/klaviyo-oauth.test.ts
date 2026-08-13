import assert from "node:assert/strict";
import test from "node:test";
import {
  buildKlaviyoAuthorizeUrl,
  createKlaviyoCodeChallenge,
  createKlaviyoCodeVerifier,
  resolveKlaviyoOAuthEnv,
} from "./klaviyo-oauth.js";
import type { LoadedApiEnv } from "@ecomscaling/config";

const env = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "publishable-key",
  SHOPIFY_API_KEY: "shopify-key",
  SHOPIFY_API_SECRET: "shopify-secret",
  SHOPIFY_SCOPES: "read_products",
  SHOPIFY_REDIRECT_URI: "https://example.com/shopify-callback",
  KLAVIYO_CLIENT_ID: "klaviyo-client",
  KLAVIYO_CLIENT_SECRET: "klaviyo-secret",
  KLAVIYO_REDIRECT_URI: "https://example.com/klaviyo-callback",
  KLAVIYO_SCOPES: "accounts:read,flows:read",
} as LoadedApiEnv;

test("Klaviyo OAuth se mantiene desactivado si faltan credenciales de app", () => {
  const { KLAVIYO_CLIENT_ID: _clientId, ...withoutClientId } = env;
  assert.equal(resolveKlaviyoOAuthEnv(withoutClientId), null);
});

test("Klaviyo OAuth construye PKCE S256 y una URL de autorización completa", () => {
  const oauthEnv = resolveKlaviyoOAuthEnv(env);
  assert.ok(oauthEnv);
  const verifier = createKlaviyoCodeVerifier();
  const challenge = createKlaviyoCodeChallenge(verifier);
  const url = new URL(
    buildKlaviyoAuthorizeUrl(oauthEnv, "state-123", challenge),
  );

  assert.match(verifier, /^[A-Za-z0-9_-]{43,128}$/);
  assert.match(challenge, /^[A-Za-z0-9_-]+$/);
  assert.equal(url.origin, "https://www.klaviyo.com");
  assert.equal(url.pathname, "/oauth/authorize");
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(url.searchParams.get("code_challenge"), challenge);
  assert.equal(url.searchParams.get("state"), "state-123");
  assert.equal(url.searchParams.get("scope"), "accounts:read,flows:read");
});
