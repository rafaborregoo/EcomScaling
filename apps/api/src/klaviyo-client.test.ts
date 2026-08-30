import assert from "node:assert/strict";
import test from "node:test";
import { createKlaviyoClient, klaviyoRetryDelayMs } from "./klaviyo-client.js";

test("el cliente Klaviyo fija revision, Bearer y sigue links.next por cursor", async () => {
  const calls: Array<{ url: string; revision: string | null }> = [];
  const client = createKlaviyoClient("token-real-no-loguear", {
    fetchImpl: async (input, init) => {
      const url = String(input);
      calls.push({ url, revision: new Headers(init?.headers).get("revision") });
      const page =
        url.includes("page%3D2") || url.includes("page=2")
          ? {
              data: [
                { type: "lists", id: "2", attributes: { name: "Segunda" } },
              ],
              links: { next: null },
            }
          : {
              data: [
                { type: "lists", id: "1", attributes: { name: "Primera" } },
              ],
              links: { next: "https://a.klaviyo.com/api/lists?page=2" },
            };
      return new Response(JSON.stringify(page), { status: 200 });
    },
  });

  const rows = await client.listResources("lists");
  assert.deepEqual(
    rows.map((row) => row.id),
    ["1", "2"],
  );
  assert.equal(calls.length, 2);
  assert.equal(calls[0]?.revision, "2026-07-15");
  assert.equal(new URL(calls[1]!.url).hostname, "a.klaviyo.com");
});

test("el cliente Klaviyo usa el esquema Klaviyo-API-Key con private keys pk_", async () => {
  const seen: Array<string | null> = [];
  const bearer = createKlaviyoClient("oauth-access-token", {
    fetchImpl: async (_input, init) => {
      seen.push(new Headers(init?.headers).get("authorization"));
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    },
  });
  await bearer.listResources("lists");

  const apiKey = createKlaviyoClient("pk_ABC123", {
    fetchImpl: async (_input, init) => {
      seen.push(new Headers(init?.headers).get("authorization"));
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    },
  });
  await apiKey.listResources("lists");

  assert.deepEqual(seen, [
    "Bearer oauth-access-token",
    "Klaviyo-API-Key pk_ABC123",
  ]);
});

test("el cliente Klaviyo rechaza paginacion fuera del host permitido", async () => {
  const client = createKlaviyoClient("token", {
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          data: [],
          links: { next: "https://evil.example/api/lists" },
        }),
        { status: 200 },
      ),
  });

  await assert.rejects(
    () => client.listResources("lists"),
    /klaviyo_pagination_url_invalid/,
  );
});

test("el cliente Klaviyo usa los endpoints de Reporting API por tipo de informe", async () => {
  let requestUrl = "";
  let requestBody: Record<string, unknown> | null = null;
  const client = createKlaviyoClient("token", {
    fetchImpl: async (input, init) => {
      requestUrl = String(input);
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(
        JSON.stringify({ data: { attributes: { results: [] } } }),
        { status: 200 },
      );
    },
  });

  await client.queryReport({
    type: "flow-values-report",
    statistics: ["clicks", "conversion_uniques"],
    conversion_metric_id: "metric-1",
    timeframe: {
      start: "2026-08-01T00:00:00+00:00",
      end: "2026-08-02T23:59:59+00:00",
    },
    group_by: ["flow_id"],
  });
  assert.match(requestUrl, /\/api\/flow-values-reports\/$/);
  const reportBody = requestBody as unknown as {
    data: { type: string; attributes: { conversion_metric_id: string } };
  };
  assert.equal(reportBody.data.type, "flow-values-report");
  assert.equal(reportBody.data.attributes.conversion_metric_id, "metric-1");
});

test("el cliente Klaviyo reintenta un 429 respetando Retry-After", async () => {
  const waits: number[] = [];
  let attempts = 0;
  const client = createKlaviyoClient("token", {
    sleepImpl: async (ms) => {
      waits.push(ms);
    },
    fetchImpl: async () => {
      attempts += 1;
      if (attempts === 1) {
        return new Response("rate limited", {
          status: 429,
          headers: { "Retry-After": "3" },
        });
      }
      return new Response(JSON.stringify({ data: [], links: { next: null } }), {
        status: 200,
      });
    },
  });

  assert.deepEqual(await client.listResources("flows"), []);
  assert.equal(attempts, 2);
  assert.deepEqual(waits, [3000]);
});

test("el cliente Klaviyo no reintenta errores de permisos ni de token", async () => {
  let attempts = 0;
  const client = createKlaviyoClient("token", {
    sleepImpl: async () => {
      throw new Error("no deberia esperar");
    },
    fetchImpl: async () => {
      attempts += 1;
      return new Response("forbidden", { status: 403 });
    },
  });

  await assert.rejects(
    () => client.listResources("campaigns"),
    /PERMISSION_MISSING/,
  );
  assert.equal(attempts, 1);
});

test("el backoff de Klaviyo prefiere Retry-After y limita el crecimiento", () => {
  assert.equal(klaviyoRetryDelayMs(0, "5"), 5000);
  assert.equal(klaviyoRetryDelayMs(0, null, 0), 1000);
  assert.equal(klaviyoRetryDelayMs(3, null, 0), 8000);
  assert.equal(klaviyoRetryDelayMs(0, "9999"), 60_000);
  assert.equal(klaviyoRetryDelayMs(20, null, 0), 60_000);
});
