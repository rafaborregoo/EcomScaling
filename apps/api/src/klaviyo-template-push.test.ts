import assert from "node:assert/strict";
import test from "node:test";
import { klaviyoTemplateWriteRequest } from "./klaviyo.js";
import { createKlaviyoClient } from "./klaviyo-client.js";
import { KLAVIYO_API_REVISION } from "./klaviyo-oauth.js";

const attributes = {
  name: "Newsletter de agosto",
  editor_type: "CODE" as const,
  html: "<p>Hola</p>",
  text: "Hola",
};

test("sin id previo crea la plantilla: POST y data sin id", () => {
  const { path, init } = klaviyoTemplateWriteRequest(null, attributes);
  assert.equal(path, "/templates/");
  assert.equal(init.method, "POST");
  const body = JSON.parse(String(init.body)) as {
    data: { type: string; id?: string; attributes: typeof attributes };
  };
  assert.equal(body.data.type, "template");
  assert.equal(body.data.id, undefined);
  assert.equal(body.data.attributes.editor_type, "CODE");
});

test("con id previo actualiza la misma plantilla: PATCH y data.id", () => {
  const { path, init } = klaviyoTemplateWriteRequest("TPL 1", attributes);
  assert.equal(path, "/templates/TPL%201/");
  assert.equal(init.method, "PATCH");
  const body = JSON.parse(String(init.body)) as { data: { id: string } };
  assert.equal(body.data.id, "TPL 1");
});

test("la peticion sale con revision y auth de clave privada", async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const client = createKlaviyoClient("pk_test", {
    fetchImpl: (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ data: { id: "TPL2" } }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    }) as unknown as typeof fetch,
  });

  const { path, init } = klaviyoTemplateWriteRequest(null, attributes);
  const response = await client.request<{ data?: { id?: string } }>(path, init);

  assert.equal(response.data?.id, "TPL2");
  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.url, "https://a.klaviyo.com/api/templates/");
  const headers = calls[0]!.init.headers as Record<string, string>;
  assert.equal(headers.Authorization, "Klaviyo-API-Key pk_test");
  assert.equal(headers.revision, KLAVIYO_API_REVISION);
});
