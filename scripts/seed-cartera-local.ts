/**
 * Enlaza dos usuarios que YA existen en auth como consultor y cliente suyo,
 * para poder probar en local las dos caras del producto con cuentas reales
 * (entrar como consultor y ver la cartera; entrar como cliente y ver su tienda).
 *
 * No crea usuarios de auth: si un email no existe, falla y lo dice. Registrarse
 * es lo que se esta probando.
 *
 * Idempotente. Mismos guardarrailes que seed-demo-user.ts: flag explicito y
 * rechazo del proyecto de produccion.
 *
 * Uso (PowerShell):
 *   $env:ALLOW_CARTERA_SEED="true"; npm run seed:cartera-local
 * o en .env.local:
 *   ALLOW_CARTERA_SEED=true
 *   SUPABASE_PRODUCTION_PROJECT_REF=cthjwpeygpzwdmjkxeqa
 */
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import { z } from "zod";

const envSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  ALLOW_CARTERA_SEED: z.literal("true"),
  SUPABASE_PRODUCTION_PROJECT_REF: z.string().regex(/^[a-z0-9]{10,30}$/),
  SEED_CONSULTANT_EMAIL: z.string().email().default("rafael@noraapp.es"),
  SEED_CLIENT_EMAIL: z.string().email().default("borregorafa99@gmail.com"),
  SEED_CLIENT_ORG_SLUG: z.string().default("prueba-borrego"),
  SEED_CLIENT_ORG_NAME: z.string().default("Prueba Borrego"),
});

const env = envSchema.parse(process.env);
const targetProjectRef = new URL(env.SUPABASE_URL).hostname.split(".")[0];
if (targetProjectRef === env.SUPABASE_PRODUCTION_PROJECT_REF) {
  throw new Error(
    "CARTERA_SEED_PRODUCTION_PROJECT_REFUSED: este seed requiere un proyecto Supabase distinto de produccion",
  );
}

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: WebSocket as any },
});

const now = new Date().toISOString();

async function userIdByEmail(email: string): Promise<string> {
  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw new Error(`listUsers failed: ${error.message}`);
  const user = data.users.find(
    (candidate) => candidate.email?.toLowerCase() === email.toLowerCase(),
  );
  if (!user) {
    throw new Error(
      `AUTH_USER_NOT_FOUND: ${email} no existe en ${targetProjectRef}. Registrate con ese email y vuelve a ejecutar el seed.`,
    );
  }
  return user.id;
}

async function main() {
  const consultantId = await userIdByEmail(env.SEED_CONSULTANT_EMAIL);
  const clientId = await userIdByEmail(env.SEED_CLIENT_EMAIL);

  // 1. Consultor = suscripcion activa A SU NOMBRE (ver migracion
  //    20261006090000_rol_derivado_de_la_suscripcion.sql). La columna
  //    platform_role ya no concede el rol, asi que no basta con ponerla.
  const { data: consultantPlan, error: consultantPlanError } = await supabase
    .from("service_subscriptions")
    .select("id")
    .eq("user_id", consultantId)
    .in("status", ["trial", "active"])
    .maybeSingle();
  if (consultantPlanError) {
    throw new Error(`Consultant plan lookup failed: ${consultantPlanError.message}`);
  }
  if (!consultantPlan) {
    const { error } = await supabase.from("service_subscriptions").insert({
      user_id: consultantId,
      plan_code: "consultant",
      status: "active",
      starts_at: now,
    });
    if (error) throw new Error(`Consultant plan insert failed: ${error.message}`);
  }

  // 2. Organizacion del cliente, activa y con el cliente de owner.
  const { data: clientOrg, error: clientOrgError } = await supabase
    .from("organizations")
    .upsert(
      {
        display_name: env.SEED_CLIENT_ORG_NAME,
        slug: env.SEED_CLIENT_ORG_SLUG,
        timezone: "Europe/Madrid",
        currency_code: "EUR",
        status: "active",
        activated_at: now,
        created_by: consultantId,
      },
      { onConflict: "slug" },
    )
    .select("id")
    .single();
  if (clientOrgError || !clientOrg) {
    throw new Error(`Client organization seed failed: ${clientOrgError?.message}`);
  }

  const { error: memberError } = await supabase
    .from("organization_members")
    .upsert(
      {
        organization_id: clientOrg.id,
        user_id: clientId,
        role: "owner",
        is_active: true,
        joined_at: now,
      },
      { onConflict: "organization_id,user_id" },
    );
  if (memberError) throw new Error(`Client membership seed failed: ${memberError.message}`);

  // 3. El consultor lleva esa tienda.
  const { error: assignmentError } = await supabase
    .from("consultant_assignments")
    .upsert(
      {
        organization_id: clientOrg.id,
        consultant_user_id: consultantId,
        is_primary: true,
        is_active: true,
        assigned_by: consultantId,
        assigned_at: now,
      },
      { onConflict: "organization_id,consultant_user_id" },
    );
  if (assignmentError) {
    throw new Error(`Consultant assignment seed failed: ${assignmentError.message}`);
  }

  // 4. Plan de la tienda, para que el cliente no entre en modo caducado.
  const { data: clientPlan, error: clientPlanLookupError } = await supabase
    .from("service_subscriptions")
    .select("id")
    .eq("organization_id", clientOrg.id)
    .in("status", ["trial", "active"])
    .maybeSingle();
  if (clientPlanLookupError) {
    throw new Error(`Client plan lookup failed: ${clientPlanLookupError.message}`);
  }
  if (!clientPlan) {
    const { error } = await supabase.from("service_subscriptions").insert({
      organization_id: clientOrg.id,
      plan_code: "growth",
      status: "active",
      starts_at: now,
    });
    if (error) throw new Error(`Client plan insert failed: ${error.message}`);
  }

  console.log(
    JSON.stringify(
      {
        status: "ok",
        project_ref: targetProjectRef,
        consultant: { email: env.SEED_CONSULTANT_EMAIL, user_id: consultantId },
        client: { email: env.SEED_CLIENT_EMAIL, user_id: clientId },
        client_organization: { id: clientOrg.id, slug: env.SEED_CLIENT_ORG_SLUG },
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
