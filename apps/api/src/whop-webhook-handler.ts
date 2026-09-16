import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import type { LoadedApiEnv } from "@ecomscaling/config";
import {
  verifyStandardWebhookSignature,
  type StandardWebhookHeaders,
} from "./standard-webhook.js";
import {
  WHOP_HANDLED_EVENTS,
  mapWhopMembershipToSubscription,
  parseWhopMembership,
  parseWhopWebhook,
  type WhopMembership,
} from "./whop.js";

function createServiceClient(env: LoadedApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as any },
  });
}

type ServiceClient = ReturnType<typeof createServiceClient>;

type Subject =
  | { user_id: string; organization_id?: undefined }
  | { organization_id: string; user_id?: undefined };

/**
 * A quien se le apunta lo que acaba de pagar.
 *
 * Por orden de fiabilidad: la metadata que la plataforma metio en la checkout
 * configuration (exacta, la pusimos nosotros) y, si la compra empezo en un
 * enlace suelto de Whop sin pasar por la app, el correo del comprador.
 *
 * Si no se resuelve NO se inventa nada. Una suscripcion colgada de la cuenta
 * equivocada da acceso a la cartera de otro; el evento se marca como fallido,
 * queda con su payload en `private.webhook_events` y se arregla a mano.
 */
async function resolveSubject(
  supabase: ServiceClient,
  membership: WhopMembership,
): Promise<{ subject: Subject } | { error: string }> {
  if (membership.subjectUserId) {
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", membership.subjectUserId)
      .maybeSingle();
    if (data) return { subject: { user_id: data.id } };
    return {
      error: `whop_user_metadata_desconocido:${membership.subjectUserId}`,
    };
  }

  if (membership.subjectOrganizationId) {
    const { data } = await supabase
      .from("organizations")
      .select("id")
      .eq("id", membership.subjectOrganizationId)
      .maybeSingle();
    if (data) return { subject: { organization_id: data.id } };
    return {
      error: `whop_organization_metadata_desconocida:${membership.subjectOrganizationId}`,
    };
  }

  if (membership.email) {
    const { data, error } = await supabase
      .schema("private")
      .rpc("user_id_by_email", { target_email: membership.email });
    if (error)
      return { error: `whop_lookup_por_correo_fallido:${error.message}` };
    if (data) return { subject: { user_id: data as string } };
    return { error: `whop_correo_sin_cuenta:${membership.email}` };
  }

  return { error: "whop_membresia_sin_atribucion" };
}

/**
 * Escribe la membresia en `service_subscriptions`. Idempotente por
 * `external_subscription_id`: Whop reintenta, y reintentar tiene que dar el
 * mismo estado, no una fila mas.
 */
export async function applyWhopMembership(
  supabase: ServiceClient,
  membership: WhopMembership,
): Promise<
  { ok: true; subscriptionId: string } | { ok: false; error: string }
> {
  const patch = mapWhopMembershipToSubscription(membership);
  const metadata = {
    whop: {
      membership_id: membership.membershipId,
      status: membership.whopStatus,
      plan_id: membership.planId,
      product_id: membership.productId,
      user_id: membership.whopUserId,
    },
  };

  const { data: existing, error: existingError } = await supabase
    .from("service_subscriptions")
    .select("id")
    .eq("external_subscription_id", membership.membershipId)
    .maybeSingle();
  if (existingError) {
    return {
      ok: false,
      error: `whop_subscription_lookup_failed:${existingError.message}`,
    };
  }

  if (existing) {
    const { error } = await supabase
      .from("service_subscriptions")
      .update({ ...patch, metadata })
      .eq("id", existing.id);
    if (error) {
      return {
        ok: false,
        error: `whop_subscription_update_failed:${error.message}`,
      };
    }
    return { ok: true, subscriptionId: existing.id };
  }

  const resolved = await resolveSubject(supabase, membership);
  if ("error" in resolved) return { ok: false, error: resolved.error };

  // Un plan sustituye al anterior. Sin esto chocaria con los indices de "un
  // plan vigente por sujeto" -- y peor que el choque seria no tenerlos: dos
  // planes activos y el limite de tiendas saliendo del que lea primero quien
  // pregunte.
  if (patch.status === "active" || patch.status === "trial") {
    const previous = supabase
      .from("service_subscriptions")
      .update({ status: "expired", ends_at: new Date().toISOString() })
      .in("status", ["trial", "active"]);
    const { error } = await (resolved.subject.user_id
      ? previous.eq("user_id", resolved.subject.user_id)
      : previous.eq("organization_id", resolved.subject.organization_id));
    if (error) {
      return {
        ok: false,
        error: `whop_subscription_expire_previous_failed:${error.message}`,
      };
    }
  }

  const { data: inserted, error: insertError } = await supabase
    .from("service_subscriptions")
    .insert({ ...resolved.subject, ...patch, metadata })
    .select("id")
    .maybeSingle();
  if (insertError || !inserted) {
    return {
      ok: false,
      error: `whop_subscription_insert_failed:${insertError?.message ?? "sin_fila"}`,
    };
  }

  return { ok: true, subscriptionId: inserted.id };
}

export async function handleWhopWebhookRequest(
  env: LoadedApiEnv,
  headers: StandardWebhookHeaders,
  rawBody: Buffer,
) {
  if (!env.WHOP_WEBHOOK_SECRET) {
    return { statusCode: 503, body: { error: "whop_webhook_not_configured" } };
  }

  const body = rawBody.toString("utf8");
  if (!verifyStandardWebhookSignature(env.WHOP_WEBHOOK_SECRET, headers, body)) {
    return {
      statusCode: 401,
      body: { error: "whop_webhook_signature_invalid" },
    };
  }

  let envelope;
  try {
    envelope = parseWhopWebhook(body);
  } catch (error) {
    return {
      statusCode: 400,
      body: {
        error:
          error instanceof Error
            ? error.message
            : "whop_webhook_payload_invalid",
      },
    };
  }

  // Whop deja suscribirse a 70 tipos de evento y conviene poder activar de mas
  // en el dashboard sin que la API los rechace: un 4xx haria que Whop reintente
  // para siempre algo que nunca vamos a procesar.
  if (!(WHOP_HANDLED_EVENTS as readonly string[]).includes(envelope.type)) {
    return {
      statusCode: 200,
      body: { status: "ignored", type: envelope.type },
    };
  }

  let membership: WhopMembership;
  try {
    membership = parseWhopMembership(envelope.data);
  } catch (error) {
    return {
      statusCode: 400,
      body: {
        error:
          error instanceof Error
            ? error.message
            : "whop_membership_payload_invalid",
      },
    };
  }

  const supabase = createServiceClient(env);
  const { data: event, error: insertError } = await supabase
    .schema("private")
    .from("webhook_events")
    .insert({
      provider: "whop",
      topic: envelope.type,
      external_event_id: envelope.id,
      fingerprint: crypto.createHash("sha256").update(rawBody).digest("hex"),
      signature_valid: true,
      status: "received",
      payload: envelope.data,
      headers,
    })
    .select("id")
    .maybeSingle();

  if (insertError) {
    const { data: duplicate } = await supabase
      .schema("private")
      .from("webhook_events")
      .select("id")
      .eq("provider", "whop")
      .eq("external_event_id", envelope.id)
      .maybeSingle();
    if (duplicate) {
      return {
        statusCode: 200,
        body: { status: "duplicate", event_id: duplicate.id },
      };
    }
    return { statusCode: 503, body: { error: "whop_webhook_persist_failed" } };
  }

  // Se procesa en linea y no en cola: es un upsert, no hay IA ni red de por
  // medio, y el rol de quien acaba de pagar deriva de esta fila -- encolarlo
  // seria dejarle fuera de su propia cuenta hasta la siguiente pasada.
  const applied = await applyWhopMembership(supabase, membership);

  await supabase
    .schema("private")
    .from("webhook_events")
    .update({
      status: applied.ok ? "processed" : "failed",
      processed_at: new Date().toISOString(),
      error_message: applied.ok ? null : applied.error.slice(0, 500),
    })
    .eq("id", event?.id ?? "");

  if (!applied.ok) {
    // 200 a proposito: reintentar no lo va a arreglar (la cuenta no existe, la
    // metadata apunta a nadie). El evento queda en `failed` con su payload para
    // reprocesarlo cuando se corrija.
    return {
      statusCode: 200,
      body: { status: "failed", error: applied.error },
    };
  }

  return {
    statusCode: 200,
    body: { status: "processed", subscription_id: applied.subscriptionId },
  };
}
