/**
 * DB-01: los 5 enums del nucleo (`platform_role`, `organization_status`,
 * `member_role`, `subscription_status`, `notification_status`) no tenian
 * ningun test que confirmara sus valores reales contra lo documentado -- un
 * `ALTER TYPE ... ADD VALUE` suelto en una migracion futura podia cambiar el
 * contrato sin que nada lo senalara. Este test lee los valores reales del
 * Supabase remoto (via `private.enum_labels`, ver migracion
 * `20260722210000_db_01_enum_labels_helper.sql`) y los compara contra la
 * lista esperada de abajo: si no coinciden, hay que actualizar
 * `DB-01-enums-core.md` (semantica del valor nuevo) Y esta lista en el mismo
 * commit -- ese es el punto del test.
 *
 * Requiere .env.local con SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY apuntando
 * al proyecto remoto, y la migracion db-01-enum-labels-helper aplicada.
 * Ejecutar con `npm run test -w @ecomscaling/api`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { loadApiEnv } from "@ecomscaling/config";

const env = loadApiEnv(process.env);

const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Orden = orden de declaracion en la migracion (el orden importa para
// enum_range, y coincide con el orden de aparicion en el tipo Postgres).
const EXPECTED_ENUM_LABELS: Record<string, string[]> = {
  platform_role: ["user", "consultant", "platform_admin"],
  // pending_deletion anadido 2026-07-21 (R-008, soft-delete de organizaciones).
  organization_status: ["onboarding", "active", "suspended", "cancelled", "pending_deletion"],
  member_role: ["owner", "manager", "member", "readonly"],
  subscription_status: ["pending", "trial", "active", "paused", "cancelled", "expired"],
  notification_status: ["unread", "read", "archived"],
};

for (const [enumName, expectedLabels] of Object.entries(EXPECTED_ENUM_LABELS)) {
  test(`el enum ${enumName} tiene exactamente los valores documentados en DB-01`, async () => {
    const { data, error } = await admin.schema("private").rpc("enum_labels", { enum_type_name: enumName });

    assert.equal(error, null, `no se pudo leer ${enumName}: ${error?.message}`);
    assert.deepEqual(
      data,
      expectedLabels,
      `${enumName} cambio respecto a lo documentado en DB-01-enums-core.md -- actualiza semantica y esta lista juntas`,
    );
  });
}
