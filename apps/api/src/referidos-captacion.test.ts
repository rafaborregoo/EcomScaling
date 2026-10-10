import assert from "node:assert/strict";
import test from "node:test";
import type { AuthContext } from "./auth-context.js";
import { setMyReferralCodeActive, setReferralContacted, upsertReferralCodeAdmin } from "./referidos.js";

// Estas validaciones contestan antes de tocar la base: el env no necesita
// credenciales reales.
const env = { SUPABASE_URL: "http://127.0.0.1:1", SUPABASE_SERVICE_ROLE_KEY: "x" };

function contextOf(platformRole: string): AuthContext {
  return {
    user: { id: "11111111-1111-4111-8111-111111111111" },
    profile: { platform_role: platformRole },
    memberships: [],
  } as unknown as AuthContext;
}

test("pausar el codigo exige un booleano", async () => {
  const result = await setMyReferralCodeActive(env, contextOf("consultant"), { is_active: "no" });
  assert.equal(result.ok, false);
  assert.equal((result as { statusCode: number }).statusCode, 400);
});

test("un cliente no puede pausar ni marcar leads", async () => {
  const client = contextOf("client");
  const pause = await setMyReferralCodeActive(env, client, { is_active: false });
  const contacted = await setReferralContacted(env, client, "22222222-2222-4222-8222-222222222222", { contacted: true });
  assert.equal((pause as { statusCode: number }).statusCode, 403);
  assert.equal((contacted as { statusCode: number }).statusCode, 403);
});

test("marcar contactado valida el booleano y el id sin sondear la base", async () => {
  const consultant = contextOf("consultant");
  const noBool = await setReferralContacted(env, consultant, "22222222-2222-4222-8222-222222222222", { contacted: 1 });
  const badId = await setReferralContacted(env, consultant, "no-es-un-uuid", { contacted: true });
  assert.equal((noBool as { statusCode: number }).statusCode, 400);
  assert.equal((badId as { statusCode: number }).statusCode, 404);
});

test("el admin recibe 400 con mensaje cuando el descuento sale de rango", async () => {
  const admin = contextOf("platform_admin");
  for (const body of [{ discount_percent: 150 }, { discount_percent: -1 }, { discount_percent: 10.5 }, { discount_months: 0 }, { discount_months: 37 }]) {
    const result = await upsertReferralCodeAdmin(env, admin, "33333333-3333-4333-8333-333333333333", body);
    assert.equal((result as { statusCode?: number }).statusCode, 400, JSON.stringify(body));
    assert.equal((result as { error?: string }).error, "referral_discount_invalid");
  }
});
