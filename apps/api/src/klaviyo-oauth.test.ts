import assert from "node:assert/strict";
import test from "node:test";
import {
  buildKlaviyoAuthorizeUrl,
  createKlaviyoCodeChallenge,
  createKlaviyoCodeVerifier,
  resolveKlaviyoOAuthEnv,
  missingKlaviyoScopes,
  parseKlaviyoScopes,
  exchangeKlaviyoCodeForTokens,
} from "./klaviyo-oauth.js";
import type { LoadedApiEnv } from "@e-nora/config";

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
  assert.equal(url.searchParams.get("scope"), "accounts:read flows:read");
});

test("Klaviyo normaliza scopes heredados con comas y detecta permisos ausentes", () => {
  assert.deepEqual(
    parseKlaviyoScopes("accounts:read, flows:read metrics:read"),
    ["accounts:read", "flows:read", "metrics:read"],
  );
  assert.deepEqual(
    missingKlaviyoScopes(
      ["accounts:read", "flows:read", "metrics:read"],
      ["accounts:read", "flows:read"],
    ),
    ["metrics:read"],
  );
});

test("Klaviyo OAuth reintenta un fallo transitorio y propaga AbortSignal", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  let gotSignal = false;
  globalThis.fetch = (async (_input, init) => {
    calls += 1;
    gotSignal = init?.signal instanceof AbortSignal;
    if (calls === 1) return new Response("temporarily unavailable", { status: 503 });
    return new Response(JSON.stringify({
      access_token: "access",
      refresh_token: "refresh",
      expires_in: 3600,
      token_type: "bearer",
    }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;

  try {
    const result = await exchangeKlaviyoCodeForTokens(
      resolveKlaviyoOAuthEnv(env)!,
      "code",
      "verifier",
    );
    assert.equal(result.access_token, "access");
    assert.equal(calls, 2);
    assert.equal(gotSignal, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
