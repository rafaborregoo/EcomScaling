import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import { createLogger } from "@e-nora/observability";
import type { AuthContext } from "./auth-context.js";
import { recordAuditLog } from "./audit-log.js";
import { consultingOrganizationIdOf, loadCapacidad } from "./capacidad-cartera.js";
import { assignPartnersToOrganization } from "./consultant-partners.js";
import {
  createClientOrganization,
  findConsultingOrganizationId,
  inviteConsultant,
} from "./consultant.js";
import { applyClientDefaults } from "./consultora-settings.js";
import { notify } from "./notify.js";

/**
 * Solicitudes de acceso (20270116100000). El registro libre esta cerrado
 * (`REGISTRO_CERRADO`): quien quiere entrar pide acceso en /solicitar, la
 * direccion lo revisa en /admin/solicitudes, aprobar le reserva plaza e
 * invitar le crea la cuenta y le manda el correo del onboarding. Aprobar e
 * invitar van separados a proposito: se aprueba durante la lista de espera y
 * se invita a todos el dia que se abre.
 *
 * Los clientes que declara un consultor siguen el mismo camino, pero gastan
 * plaza de su cartera, no de las plazas de cliente.
 */

const logger = createLogger("solicitudes");

type SolicitudesEnv = Parameters<typeof inviteConsultant>[0];

function createServiceClient(env: SolicitudesEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as any },
  });
}

type Db = ReturnType<typeof createServiceClient>;

export type RequestKind = "client" | "consultant" | "consultant_client";
export type RequestStatus = "pending" | "approved" | "waitlisted" | "rejected" | "invited";

/** Plan con el que entra cada cuenta mientras no hay precios. Se ajusta luego en su ficha. */
const PLAN_CLIENTE = { plan_code: "acceso_anticipado", store_limit: 1, member_limit: null };
const PLAN_CONSULTOR = { plan_code: "consultor_acceso_anticipado", store_limit: 1, member_limit: null };
/** Clientes que puede llevar un consultor si al aprobarle no se dice otra cosa (plan free). */
export const CLIENT_SLOTS_POR_DEFECTO = 2;

const MAX_DECLARED_CLIENTS = 20;

type Failure = { ok: false; statusCode: number; error: string; message?: string; detail?: string };

function fail(statusCode: number, error: string, message?: string): Failure {
  return { ok: false, statusCode, error, ...(message ? { message } : {}) };
}

function requireAdmin(context: AuthContext): Failure | null {
  return context.profile.platform_role === "platform_admin"
    ? null
    : fail(403, "platform_admin_required", "Solo la dirección puede gestionar solicitudes.");
}

// --- Validacion pura ---------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** El dominio de la tienda, sin esquema, ruta ni `www.`. Null si no es un dominio publico. */
export function dominioDeTienda(raw: string | null | undefined): string | null {
  const text = raw?.trim();
  if (!text || text.length > 500) return null;
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
  if (isIP(host) || host.length > 253) return null;
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host)) return null;
  if (/(^|\.)(localhost|local|internal|lan|home|test|invalid)$/.test(host)) return null;
  return host;
}

const CORREOS_GENERICOS = new Set([
  "gmail.com", "googlemail.com", "hotmail.com", "hotmail.es", "outlook.com", "outlook.es",
  "live.com", "msn.com", "yahoo.com", "yahoo.es", "icloud.com", "me.com", "aol.com",
  "proton.me", "protonmail.com", "gmx.com", "gmx.es",
]);

/**
 * Si el correo es del mismo dominio que la tienda. Un correo de Gmail no es
 * mala señal (muchas tiendas pequeñas lo usan), por eso es `generic` y no
 * `mismatch`.
 */
export function correoFrenteATienda(
  email: string,
  storeDomain: string | null,
): "match" | "generic" | "mismatch" | "unknown" {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  if (!domain) return "unknown";
  if (CORREOS_GENERICOS.has(domain)) return "generic";
  if (!storeDomain) return "unknown";
  if (domain === storeDomain || domain.endsWith(`.${storeDomain}`) || storeDomain.endsWith(`.${domain}`)) {
    return "match";
  }
  return "mismatch";
}

type Answers = Record<string, string | string[]>;

/** Las respuestas son libres (las preguntas las define la web), pero acotadas. */
export function limpiarRespuestas(raw: unknown): Answers {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Answers = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>).slice(0, 30)) {
    if (!/^[a-z_]{1,40}$/.test(key)) continue;
    if (typeof value === "string") {
      const text = value.trim().slice(0, 1000);
      if (text) out[key] = text;
    } else if (Array.isArray(value)) {
      const items = value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim().slice(0, 100))
        .filter(Boolean)
        .slice(0, 12);
      if (items.length > 0) out[key] = items;
    }
  }
  return out;
}

const PLATAFORMAS = new Set(["shopify", "woocommerce", "prestashop", "wix", "otra", "sin_tienda"]);

export type DeclaredClientInput = { name: string; email: string; store_url: string; store_domain: string };

export type SolicitudValida = {
  kind: "client" | "consultant";
  email: string;
  full_name: string;
  business_name: string;
  store_url: string | null;
  store_domain: string | null;
  platform: string | null;
  answers: Answers;
  clients: DeclaredClientInput[];
};

function texto(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function validarCliente(raw: unknown): { ok: true; value: DeclaredClientInput } | { ok: false; message: string } {
  const item = (raw ?? {}) as Record<string, unknown>;
  const name = texto(item.name, 200);
  const email = texto(item.email, 320).toLowerCase();
  const storeUrl = texto(item.store_url, 500);
  const storeDomain = dominioDeTienda(storeUrl);
  if (!name) return { ok: false, message: "Falta el nombre de la tienda." };
  if (!EMAIL_RE.test(email)) return { ok: false, message: `El correo de ${name} no es válido.` };
  if (!storeDomain) return { ok: false, message: `La web de ${name} no es una dirección válida.` };
  return { ok: true, value: { name, email, store_url: storeUrl, store_domain: storeDomain } };
}

export function validarSolicitud(
  raw: unknown,
): { ok: true; value: SolicitudValida } | { ok: false; error: string; message: string } {
  const body = (raw ?? {}) as Record<string, unknown>;
  const kind = body.kind;
  if (kind !== "client" && kind !== "consultant") {
    return { ok: false, error: "invalid_kind", message: "Elige si eres tienda o consultor." };
  }
  const email = texto(body.email, 320).toLowerCase();
  const fullName = texto(body.full_name, 200);
  const businessName = texto(body.business_name, 200);
  if (!EMAIL_RE.test(email)) return { ok: false, error: "invalid_email", message: "El correo no es válido." };
  if (!fullName) return { ok: false, error: "invalid_full_name", message: "Falta tu nombre." };
  if (!businessName) {
    return {
      ok: false,
      error: "invalid_business_name",
      message: kind === "client" ? "Falta el nombre de la tienda." : "Falta el nombre de tu agencia o marca.",
    };
  }
  if (body.privacy_accepted !== true) {
    return { ok: false, error: "privacy_required", message: "Tienes que aceptar la política de privacidad." };
  }

  const storeUrl = texto(body.store_url, 500) || null;
  const storeDomain = dominioDeTienda(storeUrl);
  const platform = texto(body.platform, 50) || null;
  if (kind === "client") {
    if (!platform || !PLATAFORMAS.has(platform)) {
      return { ok: false, error: "invalid_platform", message: "Dinos en qué plataforma está tu tienda." };
    }
    if (platform !== "sin_tienda" && !storeDomain) {
      return { ok: false, error: "invalid_store_url", message: "La web de la tienda no es una dirección válida." };
    }
  } else if (storeUrl && !storeDomain) {
    return { ok: false, error: "invalid_store_url", message: "Tu web no es una dirección válida." };
  }

  const clients: DeclaredClientInput[] = [];
  if (kind === "consultant" && Array.isArray(body.clients)) {
    if (body.clients.length > MAX_DECLARED_CLIENTS) {
      return { ok: false, error: "too_many_clients", message: `Declara como mucho ${MAX_DECLARED_CLIENTS} clientes.` };
    }
    const seen = new Set<string>();
    for (const item of body.clients) {
      const checked = validarCliente(item);
      if (!checked.ok) return { ok: false, error: "invalid_client", message: checked.message };
      if (seen.has(checked.value.email)) continue;
      seen.add(checked.value.email);
      clients.push(checked.value);
    }
  }

  return {
    ok: true,
    value: {
      kind,
      email,
      full_name: fullName,
      business_name: businessName,
      store_url: storeUrl,
      store_domain: storeDomain,
      platform,
      answers: limpiarRespuestas(body.answers),
      clients,
    },
  };
}

// --- Comprobacion de tienda Shopify -----------------------------------------

export type ShopifyCheck = {
  checked_at: string;
  is_shopify: boolean | null;
  myshopify_domain: string | null;
  shop_name: string | null;
  final_domain: string | null;
  error?: string;
};

export function esDireccionPrivada(address: string): boolean {
  const v4 = address.startsWith("::ffff:") ? address.slice(7) : address;
  if (isIP(v4) === 4) {
    const [a = 0, b = 0] = v4.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  const v6 = address.toLowerCase();
  return v6 === "::" || v6 === "::1" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe8") ||
    v6.startsWith("fe9") || v6.startsWith("fea") || v6.startsWith("feb");
}

async function leerConTope(response: Response, max: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < max) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    chunks.push(value);
    size += value.length;
  }
  await reader.cancel().catch(() => undefined);
  return new TextDecoder().decode(Buffer.concat(chunks).subarray(0, max));
}

/**
 * Mira si el dominio es una tienda Shopify: las tiendas responden con la
 * cabecera `x-shopid` (o `powered-by: Shopify`) y publican `/meta.json` con su
 * `myshopify_domain`. Sin credenciales: es una pista para quien revisa, no
 * una prueba -- la prueba es que el cliente conecte la tienda con OAuth.
 *
 * La URL la escribe un desconocido y la pide nuestro servidor, asi que solo
 * https, sin IPs, y cada salto se resuelve y se rechaza si apunta a una red
 * privada.
 * ponytail: entre resolver y conectar el DNS puede cambiar (rebinding). Con
 * solo GET a /meta.json, sin cuerpo ni credenciales, el riesgo es bajo; si
 * algun dia se amplia, conectar a la IP ya comprobada con un agent propio.
 */
export async function comprobarTiendaShopify(domain: string): Promise<ShopifyCheck> {
  const base: ShopifyCheck = {
    checked_at: new Date().toISOString(),
    is_shopify: null,
    myshopify_domain: null,
    shop_name: null,
    final_domain: null,
  };
  let host = domain;
  try {
    for (let hop = 0; hop < 4; hop += 1) {
      if (!dominioDeTienda(host)) return { ...base, error: "dominio_no_valido" };
      const addresses = await lookup(host, { all: true });
      if (addresses.length === 0 || addresses.some((item) => esDireccionPrivada(item.address))) {
        return { ...base, error: "dominio_no_publico" };
      }
      const response = await fetch(`https://${host}/meta.json`, {
        redirect: "manual",
        signal: AbortSignal.timeout(5000),
        headers: { accept: "application/json", "user-agent": "E-NORA-verificacion/1.0" },
      });
      const location = response.headers.get("location");
      if (response.status >= 300 && response.status < 400 && location) {
        const next = new URL(location, `https://${host}/`);
        if (next.protocol !== "https:") return { ...base, final_domain: host, error: "redirige_sin_https" };
        host = next.hostname.toLowerCase();
        continue;
      }
      const poweredBy = response.headers.get("powered-by") ?? "";
      const byHeaders = Boolean(response.headers.get("x-shopid")) || /shopify/i.test(poweredBy);
      let meta: { myshopify_domain?: unknown; name?: unknown } = {};
      if (response.ok) {
        try {
          meta = JSON.parse(await leerConTope(response, 64_000)) as typeof meta;
        } catch {
          meta = {};
        }
      } else {
        await response.body?.cancel().catch(() => undefined);
      }
      const myshopify = typeof meta.myshopify_domain === "string" ? meta.myshopify_domain.slice(0, 255) : null;
      return {
        ...base,
        final_domain: host,
        is_shopify: byHeaders || Boolean(myshopify) || host.endsWith(".myshopify.com"),
        myshopify_domain: myshopify,
        shop_name: typeof meta.name === "string" ? meta.name.slice(0, 200) : null,
      };
    }
    return { ...base, final_domain: host, error: "demasiadas_redirecciones" };
  } catch (error) {
    return {
      ...base,
      final_domain: host,
      error: error instanceof Error && error.name === "TimeoutError" ? "sin_respuesta" : "no_se_pudo_comprobar",
    };
  }
}

/** Comprueba y guarda en segundo plano: el formulario no espera a la tienda. */
function comprobarEnSegundoPlano(supabase: Db, rows: Array<{ id: string; store_domain: string | null }>) {
  for (const row of rows) {
    if (!row.store_domain) continue;
    void comprobarTiendaShopify(row.store_domain)
      .then((shopify) =>
        supabase.from("access_requests").update({ checks: { shopify } }).eq("id", row.id),
      )
      .catch((error: unknown) =>
        logger.error("shopify_check_failed", {
          request_id: row.id,
          detail: error instanceof Error ? error.message : String(error),
        }),
      );
  }
}

// --- Plazas -------------------------------------------------------------------

export type Plazas = Record<"client" | "consultant", { limit: number; occupied: number; available: number }>;

async function cargarPlazas(supabase: Db): Promise<Plazas> {
  const [{ data: limits, error }, client, consultant] = await Promise.all([
    supabase.from("access_seat_limits").select("kind, seat_limit"),
    supabase.rpc("plazas_de_acceso_ocupadas", { p_kind: "client" }),
    supabase.rpc("plazas_de_acceso_ocupadas", { p_kind: "consultant" }),
  ]);
  if (error) throw new Error(error.message);
  const limitOf = (kind: string) =>
    Number((limits ?? []).find((row) => row.kind === kind)?.seat_limit ?? 0);
  const build = (kind: "client" | "consultant", occupied: unknown) => {
    const limit = limitOf(kind);
    const used = Number(occupied ?? 0);
    return { limit, occupied: used, available: Math.max(0, limit - used) };
  };
  return { client: build("client", client.data), consultant: build("consultant", consultant.data) };
}

/** Lo que ve /solicitar: cuantas plazas quedan de cada clase. */
export async function getPlazasPublicas(env: SolicitudesEnv) {
  try {
    const plazas = await cargarPlazas(createServiceClient(env));
    return {
      ok: true as const,
      data: {
        client: { limit: plazas.client.limit, available: plazas.client.available },
        consultant: { limit: plazas.consultant.limit, available: plazas.consultant.available },
      },
    };
  } catch (error) {
    return { ...fail(500, "seats_load_failed"), detail: error instanceof Error ? error.message : String(error) };
  }
}

async function adminIds(supabase: Db): Promise<string[]> {
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("is_platform_staff", true)
    .eq("is_active", true);
  return (data ?? []).map((row) => row.id as string);
}

// --- Alta de solicitudes --------------------------------------------------------

/** POST publico de /solicitar. */
export async function crearSolicitud(env: SolicitudesEnv, raw: unknown) {
  // Campo trampa: invisible para una persona, los bots lo rellenan. Se
  // responde como si hubiera ido bien para no enseñarles a esquivarlo.
  const honeypot = (raw as Record<string, unknown> | null)?.website;
  if (typeof honeypot === "string" && honeypot.trim()) {
    return { ok: true as const, data: { received: true } };
  }

  const checked = validarSolicitud(raw);
  if (!checked.ok) return fail(400, checked.error, checked.message);
  const value = checked.value;
  const supabase = createServiceClient(env);

  const { data: request, error } = await supabase
    .from("access_requests")
    .insert({
      kind: value.kind,
      email: value.email,
      full_name: value.full_name,
      business_name: value.business_name,
      store_url: value.store_url,
      store_domain: value.store_domain,
      platform: value.platform,
      answers: value.answers,
      ...(value.kind === "consultant" ? { client_slots: CLIENT_SLOTS_POR_DEFECTO } : {}),
    })
    .select("id, store_domain")
    .single();
  if (error || !request) {
    // Ya hay una abierta con ese correo: no es un fallo de quien la manda.
    if (error?.code === "23505") {
      return { ok: true as const, data: { received: true, duplicate: true } };
    }
    return { ...fail(500, "request_create_failed"), detail: error?.message };
  }

  let children: Array<{ id: string; store_domain: string | null }> = [];
  if (value.clients.length > 0) {
    const { data, error: childError } = await supabase
      .from("access_requests")
      .insert(
        value.clients.map((client) => ({
          kind: "consultant_client",
          parent_request_id: request.id,
          email: client.email,
          business_name: client.name,
          store_url: client.store_url,
          store_domain: client.store_domain,
          platform: "shopify",
        })),
      )
      .select("id, store_domain");
    if (childError) {
      logger.error("declared_clients_create_failed", { request_id: request.id, detail: childError.message });
    }
    children = data ?? [];
  }

  comprobarEnSegundoPlano(supabase, [request, ...children]);

  await notify(supabase, {
    type: "access_request",
    organizationId: null,
    recipients: await adminIds(supabase),
    data: {
      requestId: request.id as string,
      kind: value.kind,
      name: value.business_name,
      consultant: null,
      count: children.length,
    },
  });

  return { ok: true as const, data: { received: true } };
}

/** El consultor declara un cliente desde su portal. */
export async function declararCliente(env: SolicitudesEnv, context: AuthContext, raw: unknown) {
  if (!["consultant", "platform_admin"].includes(context.profile.platform_role)) {
    return fail(403, "consultant_access_required", "Solo un consultor puede declarar clientes.");
  }
  const consultingOrganizationId = consultingOrganizationIdOf(context);
  if (!consultingOrganizationId) {
    return fail(409, "consulting_organization_missing", "Tu cuenta no está asociada a ninguna consultora. Avisa a soporte.");
  }
  const checked = validarCliente(raw);
  if (!checked.ok) return fail(400, "invalid_client", checked.message);
  const client = checked.value;
  const supabase = createServiceClient(env);

  const { data: open } = await supabase
    .from("access_requests")
    .select("id")
    .eq("consulting_organization_id", consultingOrganizationId)
    .eq("email", client.email)
    .in("status", ["pending", "approved", "waitlisted"])
    .limit(1)
    .maybeSingle();
  if (open) return fail(409, "already_declared", "Ese cliente ya está declarado y pendiente de revisión.");

  const { data: request, error } = await supabase
    .from("access_requests")
    .insert({
      kind: "consultant_client",
      consulting_organization_id: consultingOrganizationId,
      consultant_user_id: context.user.id,
      email: client.email,
      business_name: client.name,
      store_url: client.store_url,
      store_domain: client.store_domain,
      platform: "shopify",
    })
    .select("id, store_domain")
    .single();
  if (error || !request) return { ...fail(500, "request_create_failed"), detail: error?.message };

  comprobarEnSegundoPlano(supabase, [request]);
  await notify(supabase, {
    type: "access_request",
    organizationId: null,
    recipients: await adminIds(supabase),
    actorUserId: context.user.id,
    data: {
      requestId: request.id as string,
      kind: "consultant_client",
      name: client.name,
      consultant: context.profile.full_name,
      count: 0,
    },
  });
  return { ok: true as const, data: { id: request.id as string } };
}

/** Los clientes que ha declarado la consultora de quien pide, con sus plazas. */
export async function listarDeclarados(env: SolicitudesEnv, context: AuthContext) {
  if (!["consultant", "platform_admin"].includes(context.profile.platform_role)) {
    return fail(403, "consultant_access_required");
  }
  const consultingOrganizationId = consultingOrganizationIdOf(context);
  if (!consultingOrganizationId) {
    return { ok: true as const, data: { capacidad: null, clients: [] } };
  }
  const supabase = createServiceClient(env);
  const [{ data, error }, capacidad] = await Promise.all([
    supabase
      .from("access_requests")
      .select("id, business_name, email, store_domain, status, created_at, invited_at")
      .eq("consulting_organization_id", consultingOrganizationId)
      .eq("kind", "consultant_client")
      .order("created_at", { ascending: false })
      .limit(200),
    loadCapacidad(supabase, consultingOrganizationId),
  ]);
  if (error) return { ...fail(500, "declared_clients_load_failed"), detail: error.message };
  return { ok: true as const, data: { capacidad, clients: data ?? [] } };
}

// --- Panel de la direccion ------------------------------------------------------

const REQUEST_COLUMNS =
  "id, kind, status, email, full_name, business_name, store_url, store_domain, platform, answers, checks, client_slots, parent_request_id, consultant_user_id, consulting_organization_id, admin_note, reviewed_at, invited_at, created_user_id, created_organization_id, created_at";

type RequestRow = {
  id: string;
  kind: RequestKind;
  status: RequestStatus;
  email: string;
  full_name: string | null;
  business_name: string | null;
  store_url: string | null;
  store_domain: string | null;
  platform: string | null;
  answers: Answers;
  checks: { shopify?: ShopifyCheck };
  client_slots: number | null;
  parent_request_id: string | null;
  consultant_user_id: string | null;
  consulting_organization_id: string | null;
  admin_note: string | null;
  reviewed_at: string | null;
  invited_at: string | null;
  created_user_id: string | null;
  created_organization_id: string | null;
  created_at: string;
};

export async function listarSolicitudes(env: SolicitudesEnv, context: AuthContext) {
  const denied = requireAdmin(context);
  if (denied) return denied;
  const supabase = createServiceClient(env);
  const [{ data, error }, plazas] = await Promise.all([
    supabase.from("access_requests").select(REQUEST_COLUMNS).order("created_at", { ascending: false }).limit(2000),
    cargarPlazas(supabase).catch(() => null),
  ]);
  if (error) return { ...fail(500, "requests_load_failed"), detail: error.message };
  const rows = (data ?? []) as RequestRow[];

  // Quien ya tiene cuenta: si termino el onboarding. Y el nombre del consultor
  // que declaro cada cliente desde su portal.
  const profileIds = [
    ...new Set(rows.flatMap((row) => [row.created_user_id, row.consultant_user_id]).filter(Boolean) as string[]),
  ];
  const { data: profiles } = profileIds.length
    ? await supabase.from("profiles").select("id, full_name, onboarding_completed_at").in("id", profileIds)
    : { data: [] };
  const profileById = new Map((profiles ?? []).map((profile) => [profile.id as string, profile]));

  // El mismo correo o la misma tienda en otra solicitud: dos consultores
  // declarando a la misma tienda es lo primero que hay que mirar.
  const byEmail = new Map<string, string[]>();
  const byDomain = new Map<string, string[]>();
  for (const row of rows) {
    byEmail.set(row.email, [...(byEmail.get(row.email) ?? []), row.id]);
    if (row.store_domain) byDomain.set(row.store_domain, [...(byDomain.get(row.store_domain) ?? []), row.id]);
  }

  return {
    ok: true as const,
    data: {
      plazas,
      requests: rows.map((row) => {
        const createdProfile = row.created_user_id ? profileById.get(row.created_user_id) : null;
        const consultant = row.consultant_user_id ? profileById.get(row.consultant_user_id) : null;
        const duplicates = new Set([
          ...(byEmail.get(row.email) ?? []),
          ...(row.store_domain ? (byDomain.get(row.store_domain) ?? []) : []),
        ]);
        duplicates.delete(row.id);
        if (row.parent_request_id) duplicates.delete(row.parent_request_id);
        return {
          ...row,
          email_check: correoFrenteATienda(row.email, row.store_domain),
          duplicate_ids: [...duplicates],
          consultant_name: (consultant?.full_name as string | null | undefined) ?? null,
          onboarding_completed: Boolean(createdProfile?.onboarding_completed_at),
        };
      }),
    },
  };
}

export async function actualizarSolicitud(
  env: SolicitudesEnv,
  context: AuthContext,
  id: string,
  body: { status?: unknown; admin_note?: unknown; client_slots?: unknown },
) {
  const denied = requireAdmin(context);
  if (denied) return denied;
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.status !== undefined) {
    if (body.status !== "pending" && body.status !== "waitlisted" && body.status !== "rejected") {
      return fail(400, "invalid_status", "Para aprobar está «Aprobar»; aquí solo pendiente, lista de espera o rechazada.");
    }
    patch.status = body.status;
    patch.reviewed_by = context.user.id;
    patch.reviewed_at = new Date().toISOString();
  }
  if (body.admin_note !== undefined) {
    patch.admin_note = typeof body.admin_note === "string" ? body.admin_note.trim().slice(0, 4000) || null : null;
  }
  if (body.client_slots !== undefined) {
    const slots = Number(body.client_slots);
    if (!Number.isSafeInteger(slots) || slots < 0 || slots > 1000) {
      return fail(400, "client_slots_invalid", "Los clientes en cartera tienen que ser un entero de 0 en adelante.");
    }
    patch.client_slots = slots;
  }

  const supabase = createServiceClient(env);
  const { data: current } = await supabase.from("access_requests").select("id, kind, status").eq("id", id).maybeSingle();
  if (!current) return fail(404, "request_not_found");
  if (current.status === "invited" && patch.status) {
    return fail(409, "already_invited", "Ya tiene cuenta: para quitarle el acceso, desactívala desde su ficha.");
  }
  if (patch.client_slots !== undefined && current.kind !== "consultant") {
    return fail(400, "client_slots_only_consultant");
  }

  const { data, error } = await supabase.from("access_requests").update(patch).eq("id", id).select(REQUEST_COLUMNS).single();
  if (error) return { ...fail(500, "request_update_failed"), detail: error.message };
  return { ok: true as const, data };
}

const APPROVE_MESSAGES: Record<string, [number, string]> = {
  not_found: [404, "Esa solicitud no existe."],
  invalid_status: [409, "Ya está aprobada o invitada."],
  no_seats: [409, "No quedan plazas. Sube el límite o libera una plaza antes de aprobar."],
  parent_not_approved: [409, "Aprueba antes al consultor que lo declara: sus plazas de cartera salen de su aprobación."],
};

export async function aprobarSolicitud(
  env: SolicitudesEnv,
  context: AuthContext,
  id: string,
  body: { client_slots?: unknown },
) {
  const denied = requireAdmin(context);
  if (denied) return denied;
  const supabase = createServiceClient(env);

  if (body.client_slots !== undefined) {
    const updated = await actualizarSolicitud(env, context, id, { client_slots: body.client_slots });
    if (!updated.ok) return updated;
  }

  const { data: outcome, error } = await supabase.rpc("aprobar_solicitud_de_acceso", {
    p_request_id: id,
    p_reviewer: context.user.id,
  });
  if (error) return { ...fail(500, "request_approve_failed"), detail: error.message };
  if (outcome !== "approved") {
    const [statusCode, message] = APPROVE_MESSAGES[outcome as string] ?? [409, "No se pudo aprobar."];
    return fail(statusCode, String(outcome), message);
  }
  await recordAuditLog(supabase, {
    organizationId: null,
    actorUserId: context.user.id,
    action: "admin.approve_access_request",
    entityType: "access_request",
    entityId: id,
    newData: { status: "approved" },
  });
  return { ok: true as const, data: { id, status: "approved" } };
}

export async function actualizarPlazas(
  env: SolicitudesEnv,
  context: AuthContext,
  body: { client?: unknown; consultant?: unknown },
) {
  const denied = requireAdmin(context);
  if (denied) return denied;
  const supabase = createServiceClient(env);
  for (const kind of ["client", "consultant"] as const) {
    if (body[kind] === undefined) continue;
    const limit = Number(body[kind]);
    if (!Number.isSafeInteger(limit) || limit < 0 || limit > 100_000) {
      return fail(400, "seat_limit_invalid", "Las plazas tienen que ser un entero de 0 en adelante.");
    }
    const { error } = await supabase
      .from("access_seat_limits")
      .upsert({ kind, seat_limit: limit, updated_at: new Date().toISOString() }, { onConflict: "kind" });
    if (error) return { ...fail(500, "seat_limit_update_failed"), detail: error.message };
  }
  return { ok: true as const, data: await cargarPlazas(supabase) };
}

export async function recomprobarTienda(env: SolicitudesEnv, context: AuthContext, id: string) {
  const denied = requireAdmin(context);
  if (denied) return denied;
  const supabase = createServiceClient(env);
  const { data: row } = await supabase.from("access_requests").select("id, store_domain").eq("id", id).maybeSingle();
  if (!row) return fail(404, "request_not_found");
  if (!row.store_domain) return fail(400, "no_store_domain", "Esta solicitud no tiene web que comprobar.");
  const shopify = await comprobarTiendaShopify(row.store_domain as string);
  const { error } = await supabase.from("access_requests").update({ checks: { shopify } }).eq("id", id);
  if (error) return { ...fail(500, "request_update_failed"), detail: error.message };
  return { ok: true as const, data: { shopify } };
}

// --- Invitar: crear la cuenta y mandar el correo -----------------------------

type InviteOutcome = {
  id: string;
  ok: boolean;
  message?: string;
  delivery?: "email" | "manual_link";
  invite_url?: string | null;
};

const ALREADY_REGISTERED = new Set(["owner_email_already_registered", "email_already_registered"]);

function failureMessage(result: { error: string; message?: string }) {
  if (ALREADY_REGISTERED.has(result.error)) return "Ese correo ya tiene cuenta en E-NORA.";
  return result.message ?? `No se pudo crear la cuenta (${result.error}).`;
}

async function invitarUna(env: SolicitudesEnv, context: AuthContext, supabase: Db, row: RequestRow): Promise<InviteOutcome> {
  if (row.status !== "approved") {
    return { id: row.id, ok: false, message: "Solo se invita a solicitudes aprobadas." };
  }
  const now = new Date().toISOString();

  if (row.kind === "consultant") {
    const result = await inviteConsultant(env, context, {
      email: row.email,
      ...(row.full_name ? { full_name: row.full_name } : {}),
      grant_plan: { ...PLAN_CONSULTOR, client_slots: row.client_slots ?? CLIENT_SLOTS_POR_DEFECTO },
    });
    if (!result.ok) return { id: row.id, ok: false, message: failureMessage(result) };
    const userId = result.data.user_id as string;
    const consultingOrganizationId = await findConsultingOrganizationId(supabase, userId);
    if (consultingOrganizationId && row.business_name) {
      await supabase.from("organizations").update({ display_name: row.business_name }).eq("id", consultingOrganizationId);
    }
    await supabase
      .from("access_requests")
      .update({ status: "invited", invited_at: now, updated_at: now, created_user_id: userId, created_organization_id: consultingOrganizationId })
      .eq("id", row.id);
    // Sus clientes declarados pasan a colgar de su consultora: a partir de
    // aqui se invitan como cualquier cliente declarado desde el portal.
    if (consultingOrganizationId) {
      await supabase
        .from("access_requests")
        .update({ consulting_organization_id: consultingOrganizationId, consultant_user_id: userId, updated_at: now })
        .eq("parent_request_id", row.id);
    }
    return { id: row.id, ok: true, delivery: result.data.delivery, invite_url: result.data.invite_url };
  }

  if (row.kind === "consultant_client" && (!row.consulting_organization_id || !row.consultant_user_id)) {
    return { id: row.id, ok: false, message: "Invita antes al consultor que lo declara." };
  }

  const result = await createClientOrganization(env, context, {
    display_name: row.business_name || row.store_domain || row.email,
    owner_email: row.email,
    ...(row.full_name ? { owner_full_name: row.full_name } : {}),
    grant_plan: PLAN_CLIENTE,
  });
  if (!result.ok) return { id: row.id, ok: false, message: failureMessage(result) };
  const organizationId = result.data.organization.id as string;

  if (row.store_url) {
    await supabase.from("organizations").update({ ecommerce_url: row.store_url }).eq("id", organizationId);
  }

  if (row.kind === "consultant_client") {
    const consultantUserId = row.consultant_user_id as string;
    const consultingOrganizationId = row.consulting_organization_id as string;
    const { error: assignError } = await supabase.from("consultant_assignments").upsert(
      {
        organization_id: organizationId,
        consultant_user_id: consultantUserId,
        consulting_organization_id: consultingOrganizationId,
        is_primary: true,
        is_active: true,
        assigned_by: context.user.id,
      },
      { onConflict: "organization_id,consultant_user_id" },
    );
    if (assignError) {
      logger.error("declared_client_assign_failed", { request_id: row.id, detail: assignError.message });
    } else {
      await assignPartnersToOrganization(supabase, consultantUserId, organizationId);
      await applyClientDefaults(supabase, consultingOrganizationId, organizationId).catch((error: unknown) =>
        logger.error("declared_client_defaults_failed", {
          request_id: row.id,
          detail: error instanceof Error ? error.message : String(error),
        }),
      );
      await notify(supabase, {
        organizationId,
        recipients: [consultantUserId],
        actorUserId: context.user.id,
        type: "client_linked",
        data: { store: result.data.organization.display_name as string },
      });
    }
  }

  await supabase
    .from("access_requests")
    .update({
      status: "invited",
      invited_at: now,
      updated_at: now,
      created_user_id: result.data.owner.user_id,
      created_organization_id: organizationId,
    })
    .eq("id", row.id);
  return { id: row.id, ok: true, delivery: result.data.delivery, invite_url: result.data.invite_url };
}

export async function invitarSolicitud(env: SolicitudesEnv, context: AuthContext, id: string) {
  const denied = requireAdmin(context);
  if (denied) return denied;
  const supabase = createServiceClient(env);
  const { data: row } = await supabase.from("access_requests").select(REQUEST_COLUMNS).eq("id", id).maybeSingle();
  if (!row) return fail(404, "request_not_found");
  const outcome = await invitarUna(env, context, supabase, row as RequestRow);
  if (!outcome.ok) return fail(409, "invite_failed", outcome.message);
  return { ok: true as const, data: outcome };
}

/**
 * El dia que se abre: invita a todas las aprobadas. Consultores primero,
 * porque sus clientes declarados necesitan que exista su consultora; luego
 * clientes directos y declarados. Una que falla no para a las demas.
 */
export async function invitarAprobadas(env: SolicitudesEnv, context: AuthContext) {
  const denied = requireAdmin(context);
  if (denied) return denied;
  const supabase = createServiceClient(env);
  const results: InviteOutcome[] = [];
  for (const kinds of [["consultant"], ["client", "consultant_client"]]) {
    const { data, error } = await supabase
      .from("access_requests")
      .select(REQUEST_COLUMNS)
      .eq("status", "approved")
      .in("kind", kinds)
      .order("created_at", { ascending: true });
    if (error) return { ...fail(500, "requests_load_failed"), detail: error.message };
    for (const row of (data ?? []) as RequestRow[]) {
      results.push(await invitarUna(env, context, supabase, row));
    }
  }
  return {
    ok: true as const,
    data: {
      invited: results.filter((item) => item.ok).length,
      failed: results.filter((item) => !item.ok).length,
      results,
    },
  };
}
