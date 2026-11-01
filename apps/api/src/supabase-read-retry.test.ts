import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync, readFileSync } from "node:fs";
import { READ_ONLY_RPCS } from "./supabase-read-rpcs.js";
import { wrapSupabaseReads } from "./supabase-read-retry.js";

const URL_BASE = "https://x.supabase.co";
const hang: typeof fetch = (_input, init) =>
  new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(init.signal?.reason)));

test("una lectura colgada se corta y el reintento responde", async () => {
  let calls = 0;
  const base: typeof fetch = (input, init) => (++calls === 1 ? hang(input, init) : Promise.resolve(new Response("ok")));
  const wrapped = wrapSupabaseReads(URL_BASE, base, 30);
  const response = await wrapped(`${URL_BASE}/rest/v1/tasks?select=id`);
  assert.equal(await response.text(), "ok");
  assert.equal(calls, 2);
});

test("si el reintento también se cuelga, falla (no espera sin fin)", async () => {
  const wrapped = wrapSupabaseReads(URL_BASE, hang, 20);
  await assert.rejects(wrapped(`${URL_BASE}/rest/v1/tasks`));
});

test("escrituras y otras URLs pasan tal cual, sin reintento", async () => {
  let calls = 0;
  const base: typeof fetch = async () => {
    calls += 1;
    throw new Error("boom");
  };
  const wrapped = wrapSupabaseReads(URL_BASE, base, 20);
  await assert.rejects(wrapped(`${URL_BASE}/rest/v1/tasks`, { method: "POST" }));
  await assert.rejects(wrapped("https://otra.com/x"));
  assert.equal(calls, 2);
});

test("un timeout de 0 lo desactiva", async () => {
  let calls = 0;
  const base: typeof fetch = async () => (calls++, new Response("ok"));
  await wrapSupabaseReads(URL_BASE, base, 0)(`${URL_BASE}/rest/v1/tasks`);
  assert.equal(calls, 1);
});

test("un rpc de solo lectura se reintenta; uno que escribe, no", async () => {
  let calls = 0;
  const flaky: typeof fetch = (input, init) => (++calls === 1 ? hang(input, init) : Promise.resolve(new Response("ok")));
  const reads = new Set(["shopify_sales_summary"]);
  const wrapped = wrapSupabaseReads(URL_BASE, flaky, 30, reads);
  assert.equal(await (await wrapped(`${URL_BASE}/rest/v1/rpc/shopify_sales_summary`, { method: "POST", body: "{}" })).text(), "ok");
  assert.equal(calls, 2);

  let writes = 0;
  const failing: typeof fetch = async () => (writes++, Promise.reject(new Error("boom")));
  await assert.rejects(wrapSupabaseReads(URL_BASE, failing, 30, reads)(`${URL_BASE}/rest/v1/rpc/reserve_agent_daily_budget`, { method: "POST", body: "{}" }));
  assert.equal(writes, 1);
});

test("todo rpc de la lista sigue siendo stable en las migraciones", () => {
  const dir = new URL("../../../supabase/migrations/", import.meta.url);
  const volatility = new Map<string, string>();
  for (const file of readdirSync(dir).sort()) {
    const sql = readFileSync(new URL(file, dir), "utf8");
    for (const match of sql.matchAll(/create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?([a-z0-9_]+)\s*\(([\s\S]*?)\)\s*returns[\s\S]*?\bas\s+(?:\$|')/gi)) {
      volatility.set(match[1]!.toLowerCase(), /\b(stable|immutable)\b/i.test(match[0]) ? "stable" : "volatile");
    }
  }
  const notStable = [...READ_ONLY_RPCS].filter((name) => volatility.get(name) !== "stable");
  assert.deepEqual(notStable, []);
});

test("validar el token (GET auth/v1/user) también se corta y reintenta", async () => {
  let calls = 0;
  const base: typeof fetch = (input, init) => (++calls === 1 ? hang(input, init) : Promise.resolve(new Response("ok")));
  const response = await wrapSupabaseReads(URL_BASE, base, 30)(`${URL_BASE}/auth/v1/user`);
  assert.equal(await response.text(), "ok");
  assert.equal(calls, 2);
});
