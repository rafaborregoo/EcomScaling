/**
 * F3/D02: el contexto que declara el cliente.
 *
 * Los pasos 9 (cambios internos) y 13 (declarado contra observado) del runtime
 * de D02 necesitan que alguien escriba en `context_change_events` y
 * `tenant_context_facts`. Aqui lo escriben el cliente (owner/manager) y su
 * consultor. Escritura con service role tras comprobar acceso a mano (ADR-0006
 * punto 7): la RLS de esas tablas solo deja leer al staff.
 */
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import {
  declaredChangeEventSchema,
  declaredContextFactSchema,
} from "@e-nora/contracts";
import { type AuthContext, requireOperationalOrganization } from "./auth-context.js";

type ApiEnv = {
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

function createServiceClient(env: ApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as any },
  });
}

/** Cliente owner/manager de la tienda, su consultor o platform admin. */
export function canDeclareContext(context: AuthContext, organizationId: string) {
  const access = requireOperationalOrganization(context, organizationId);
  if (access.ok === false) return access;
  if (["consultant", "platform_admin"].includes(context.profile.platform_role)) {
    return { ok: true as const };
  }
  const membership = context.memberships.find((m) => m.organization_id === organizationId);
  if (
    membership?.accessSource === "membership" &&
    ["owner", "manager"].includes(membership.role)
  ) {
    return { ok: true as const };
  }
  return {
    ok: false as const,
    statusCode: 403,
    error: "context_declaration_denied",
    message: "Solo el propietario, un manager o su consultor pueden declarar el contexto.",
  };
}

export async function getTenantContext(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
) {
  const access = requireOperationalOrganization(context, organizationId);
  if (access.ok === false) return access;
  const supabase = createServiceClient(env);
  const [facts, events] = await Promise.all([
    supabase
      .from("tenant_context_facts")
      .select("id, dimension, value, source, origin, effective_from")
      .eq("organization_id", organizationId)
      .is("effective_to", null)
      .order("dimension"),
    supabase
      .from("context_change_events")
      .select("id, event_type, description, occurred_at, ended_at, source")
      .eq("organization_id", organizationId)
      .gte("occurred_at", new Date(Date.now() - 365 * 86400000).toISOString())
      .order("occurred_at", { ascending: false })
      .limit(100),
  ]);
  if (facts.error || events.error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "tenant_context_load_failed",
      detail: facts.error?.message ?? events.error?.message,
    };
  }
  return {
    ok: true as const,
    data: { facts: facts.data ?? [], events: events.data ?? [] },
  };
}

export async function declareContextFact(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  body: unknown,
) {
  const access = canDeclareContext(context, organizationId);
  if (access.ok === false) return access;
  const parsed = declaredContextFactSchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false as const,
      statusCode: 400,
      error: "invalid_context_fact",
      detail: parsed.error.message,
    };
  }

  const supabase = createServiceClient(env);
  const now = new Date().toISOString();
  // Un solo valor declarado vigente por dimension; el anterior queda en el
  // historico con su fecha de cierre. El observado no se toca: la
  // contradiccion entre los dos es informacion (guardrail 28).
  const closed = await supabase
    .from("tenant_context_facts")
    .update({ effective_to: now })
    .eq("organization_id", organizationId)
    .is("store_id", null)
    .eq("dimension", parsed.data.dimension)
    .eq("source", "declared")
    .is("effective_to", null);
  if (closed.error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "context_fact_close_failed",
      detail: closed.error.message,
    };
  }
  const inserted = await supabase
    .from("tenant_context_facts")
    .insert({
      organization_id: organizationId,
      store_id: null,
      dimension: parsed.data.dimension,
      value: parsed.data.value,
      source: "declared",
      origin: ["consultant", "platform_admin"].includes(context.profile.platform_role)
        ? "consultant"
        : "client",
      effective_from: now,
    })
    .select("id")
    .single();
  if (inserted.error || !inserted.data) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "context_fact_write_failed",
      detail: inserted.error?.message,
    };
  }
  return { ok: true as const, data: { id: inserted.data.id as string } };
}

export async function declareChangeEvent(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  body: unknown,
) {
  const access = canDeclareContext(context, organizationId);
  if (access.ok === false) return access;
  const parsed = declaredChangeEventSchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false as const,
      statusCode: 400,
      error: "invalid_change_event",
      detail: parsed.error.message,
    };
  }
  const supabase = createServiceClient(env);
  const inserted = await supabase
    .from("context_change_events")
    .insert({
      organization_id: organizationId,
      event_type: parsed.data.event_type,
      description: parsed.data.description,
      occurred_at: parsed.data.occurred_at,
      ended_at: parsed.data.ended_at ?? null,
      source: "declared",
    })
    .select("id")
    .single();
  if (inserted.error || !inserted.data) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "change_event_write_failed",
      detail: inserted.error?.message,
    };
  }
  return { ok: true as const, data: { id: inserted.data.id as string } };
}

export async function deleteChangeEvent(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  eventId: string,
) {
  const access = canDeclareContext(context, organizationId);
  if (access.ok === false) return access;
  const supabase = createServiceClient(env);
  // Solo lo declarado se borra desde aqui: lo observado o detectado no es suyo.
  const { error } = await supabase
    .from("context_change_events")
    .delete()
    .eq("id", eventId)
    .eq("organization_id", organizationId)
    .eq("source", "declared");
  if (error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "change_event_delete_failed",
      detail: error.message,
    };
  }
  return { ok: true as const, data: { id: eventId } };
}
