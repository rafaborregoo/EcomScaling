import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAppSecretProof,
  buildMetaAuthUrl,
  debugMetaAccessToken,
  exchangeMetaCodeForLongLivedToken,
  missingMetaScopes,
  parseMetaScopes,
} from "./meta-oauth.js";
import { metaGraphGet, metaGraphGetAll, metaGraphPost } from "./meta-client.js";

test("normaliza scopes Meta y detecta permisos ausentes", () => {
  assert.deepEqual(parseMetaScopes("ads_read, business_management, ads_read"), [
    "ads_read",
    "business_management",
  ]);
  assert.deepEqual(
    missingMetaScopes(
      ["ads_read", "business_management", "pages_show_list"],
      ["ads_read"],
    ),
    ["business_management", "pages_show_list"],
  );
});

test("debugMetaAccessToken usa debug_token y devuelve scopes concedidos", async () => {
  const originalFetch = globalThis.fetch;
  let requestUrl = "";
  globalThis.fetch = async (input) => {
    requestUrl = String(input);
    return new Response(
      JSON.stringify({
        data: {
          is_valid: true,
          app_id: "app-id",
          user_id: "user-id",
          scopes: ["ads_read", "business_management"],
          expires_at: 1_900_000_000,
        },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  try {
    const result = await debugMetaAccessToken(
      {
        META_APP_ID: "app-id",
        META_APP_SECRET: "app-secret",
        META_REDIRECT_URI: "https://example.com/meta/callback",
        META_SCOPES: "ads_read",
      },
      "user-token",
    );
    assert.deepEqual(result.scopes, ["ads_read", "business_management"]);
    assert.equal(result.userId, "user-id");
    assert.match(requestUrl, /debug_token/);
    assert.match(requestUrl, /input_token=user-token/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("con config_id el diálogo va por code + override y sin scope; sin él, por scope", () => {
  const base = {
    META_APP_ID: "app-id",
    META_APP_SECRET: "app-secret",
    META_REDIRECT_URI: "https://example.com/meta/callback",
    META_SCOPES: "ads_read",
  };
  const withConfig = new URL(buildMetaAuthUrl({ ...base, META_LOGIN_CONFIG_ID: "123" }, "s")).searchParams;
  assert.equal(withConfig.get("config_id"), "123");
  assert.equal(withConfig.get("response_type"), "code");
  assert.equal(withConfig.get("override_default_response_type"), "true");
  assert.equal(withConfig.get("scope"), null);
  const classic = new URL(buildMetaAuthUrl(base, "s")).searchParams;
  assert.equal(classic.get("scope"), "ads_read");
  assert.equal(classic.get("config_id"), null);
});

test("token de usuario de sistema: sin caducidad y sin fb_exchange_token", async () => {
  const originalFetch = globalThis.fetch;
  const requestUrls: string[] = [];
  globalThis.fetch = async (input) => {
    const url = String(input);
    requestUrls.push(url);
    const body = url.includes("debug_token")
      ? { data: { is_valid: true, app_id: "app-id", scopes: ["ads_read"], expires_at: 0 } }
      : { access_token: "system-user-token" };
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  const appEnv = {
    META_APP_ID: "app-id",
    META_APP_SECRET: "app-secret",
    META_REDIRECT_URI: "https://example.com/meta/callback",
    META_SCOPES: "ads_read",
  };

  try {
    const token = await exchangeMetaCodeForLongLivedToken(appEnv, "code");
    assert.deepEqual(token, { accessToken: "system-user-token", expiresAt: null });
    assert.ok(!requestUrls.some((url) => url.includes("fb_exchange_token")));
    // expires_at: 0 es «no caduca», no 1970.
    assert.equal((await debugMetaAccessToken(appEnv, "system-user-token")).expiresAt, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("las llamadas Graph server-to-server incluyen appsecret_proof cuando hay secreto", async () => {
  const originalFetch = globalThis.fetch;
  let requestUrl = "";
  globalThis.fetch = async (input) => {
    requestUrl = String(input);
    return new Response(JSON.stringify({ id: "account-id" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    await metaGraphGet("act_123", "user-token", {}, "app-secret");
    const url = new URL(requestUrl);
    assert.equal(
      url.searchParams.get("appsecret_proof"),
      buildAppSecretProof("user-token", "app-secret"),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("la paginaciÃ³n Graph conserva appsecret_proof en paging.next", async () => {
  const originalFetch = globalThis.fetch;
  const requestUrls: string[] = [];
  let page = 0;
  globalThis.fetch = async (input) => {
    requestUrls.push(String(input));
    page += 1;
    return new Response(
      JSON.stringify(
        page === 1
          ? {
              data: [{ id: "first" }],
              paging: {
                next: "https://graph.facebook.com/v23.0/me/accounts?after=cursor",
              },
            }
          : { data: [{ id: "second" }] },
      ),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  try {
    const result = await metaGraphGetAll(
      "me/accounts",
      "user-token",
      { fields: "id" },
      "app-secret",
    );
    assert.deepEqual(result, [{ id: "first" }, { id: "second" }]);
    assert.equal(requestUrls.length, 2);
    for (const requestUrl of requestUrls) {
      assert.equal(
        new URL(requestUrl).searchParams.get("appsecret_proof"),
        buildAppSecretProof("user-token", "app-secret"),
      );
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("las futuras escrituras Graph reutilizan POST, appsecret_proof y body form", async () => {
  const originalFetch = globalThis.fetch;
  let request: Request | undefined;
  globalThis.fetch = async (input, init) => {
    request = new Request(input, init);
    return new Response(JSON.stringify({ id: "campaign-1" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const result = await metaGraphPost(
      "act_123/campaigns",
      "user-token",
      { name: "Draft campaign", status: "PAUSED" },
      "app-secret",
    );
    assert.deepEqual(result, { id: "campaign-1" });
    assert.equal(request?.method, "POST");
    assert.equal(
      new URL(request?.url ?? "https://invalid").searchParams.get(
        "appsecret_proof",
      )?.length,
      64,
    );
    assert.equal(
      await request?.text(),
      "name=Draft+campaign&status=PAUSED",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
