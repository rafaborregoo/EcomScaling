import assert from "node:assert/strict";
import test from "node:test";
import { fetchMetaAccountProfile } from "./meta-account-profile.js";

test("billing denial falls back to the readable profile without inventing financial values", async () => {
  const original = globalThis.fetch; const fields: string[] = [];
  globalThis.fetch = async (input) => {
    const requested = new URL(String(input)).searchParams.get("fields")!; fields.push(requested);
    return fields.length === 1
      ? new Response(JSON.stringify({ error: { code: 10, message: "Permission Denied" } }), { status: 403 })
      : new Response(JSON.stringify({ id: "act_test", name: "TEST", account_status: 1 }), { status: 200 });
  };
  try {
    const result = await fetchMetaAccountProfile("act_test", "test-only-token");
    assert.equal(fields.length, 2); assert.equal(fields[1], "id,name,account_status");
    assert.equal(result.account_status, 1); assert.equal(result.balance, undefined); assert.equal(result.funding_source_details, undefined);
  } finally { globalThis.fetch = original; }
});

test("a denied account remains denied after the basic profile request", async () => {
  const original = globalThis.fetch; let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response(JSON.stringify({ error: { code: 200, message: "Account permission denied" } }), { status: 403 }); };
  try { await assert.rejects(fetchMetaAccountProfile("act_test", "test-only-token"), /Account permission denied/); assert.equal(calls, 2); }
  finally { globalThis.fetch = original; }
});

test("an unrelated request error does not cause a profile fallback", async () => {
  const original = globalThis.fetch; let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response(JSON.stringify({ error: { code: 100, message: "Invalid request" } }), { status: 400 }); };
  try { await assert.rejects(fetchMetaAccountProfile("act_test", "test-only-token"), /Invalid request/); assert.equal(calls, 1); }
  finally { globalThis.fetch = original; }
});
