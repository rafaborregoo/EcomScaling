// Que le pasa a cada tienda y que hay que hacer, en palabras.
//
// /integraciones era una rejilla por PROVEEDOR: cinco tarjetas, cada una con el
// estado de "la peor de sus tiendas" y, debajo, una lista de ids en rojo. Para
// saber si la tienda de un cliente estaba bien habia que leer las cinco y
// cruzarlas mentalmente. Aqui se invierte el eje: la unidad es la tienda -- que
// es como el cliente piensa su negocio -- y Shopify, Meta y Klaviyo son tres
// conexiones DE esa tienda.
//
// Vive aparte de los componentes a proposito: esto se prueba sin arrancar media
// interfaz (ver store-view-model.test.ts).

import {
  classifyAuthorizationAttempt,
  type AuthorizationAttemptState,
} from "@e-nora/contracts";
import type {
  IntegrationConnection,
  IntegrationProvider,
  IntegrationsResponse,
} from "./shared";
import type { ScopeAccount, ScopeStore, StoreScope } from "./store-scope-model";

export type Tone = "neutral" | "brand" | "success" | "warn" | "danger";

/** Los tres proveedores que cuelgan de una tienda, en el orden en que se leen. */
export const STORE_PROVIDERS = ["shopify", "meta_ads", "klaviyo"] as const;
export type StoreProviderId = (typeof STORE_PROVIDERS)[number];

export const PROVIDER_NAME: Record<string, string> = {
  shopify: "Shopify",
  meta_ads: "Meta Ads",
  klaviyo: "Klaviyo",
  instagram: "Instagram",
  fathom: "Fathom",
};

// Peor = mas alto. Mismo orden que `healthSeverity` del backend
// (apps/api/src/integrations.ts): si los dos lados ordenaran distinto, una
// tienda saldria roja en la lista y verde al entrar, que es justo el fallo que
// ese comentario del backend documenta.
export function healthSeverity(status: string): number {
  switch (status) {
    case "reauthorization_required":
    case "needs_reauth":
      return 5;
    case "error":
      return 4;
    case "degraded":
      return 3;
    case "stale":
      return 2;
    case "unknown":
      return 1;
    case "healthy":
    case "syncing":
      return 0;
    default:
      return 1;
  }
}

/** Que le pasa a una conexion, en una etiqueta corta y una frase. */
export type Explanation = {
  /** Para el badge. Dice el estado, no el codigo. */
  label: string;
  /** Una frase que cualquiera entiende. `null` cuando no hay nada que contar. */
  detail: string | null;
  /** Lo que hay que hacer, si hay algo que hacer. */
  fix: "reconnect" | "retry" | "wait" | "connect" | "discard" | null;
  /** E-NORA lo reintenta sola (Meta/Klaviyo); no cuenta como error tuyo. */
  automaticRetry?: boolean;
};

// --- Los seis estados ------------------------------------------------------
// Todo lo que se pinta de una conexión (hub, ficha, tienda, subpáginas, vista
// de cartera) sale de aquí: seis palabras, una acción cada una. El matiz
// ("Atascada", "Faltan datos"…) va en la frase de `Explanation.detail`, no en
// la etiqueta.

export type ConnectionState =
  | "conectado"
  | "importando"
  | "atrasado"
  | "reconectar"
  | "error"
  | "desconectado";

export const CONNECTION_STATES: Record<
  ConnectionState,
  { label: string; tone: Tone; action: string }
> = {
  conectado: { label: "Conectado", tone: "success", action: "Detalle" },
  importando: { label: "Importando", tone: "brand", action: "Ver progreso" },
  atrasado: { label: "Datos atrasados", tone: "warn", action: "Sincronizar" },
  reconectar: { label: "Reconectar", tone: "warn", action: "Reconectar" },
  error: { label: "Error", tone: "danger", action: "Ver qué pasa" },
  desconectado: { label: "Desconectado", tone: "neutral", action: "Conectar" },
};

/** Sin conexión no hay estado: quien llama dice «Sin conectar» o «Aún no disponible». */
export function connectionState(
  connection: IntegrationConnection | null | undefined,
  explanation: Explanation,
): ConnectionState | null {
  if (!connection) return null;
  if (["disconnected", "pending_deletion"].includes(connection.status)) return "desconectado";
  if (explanation.fix === "reconnect") return "reconectar";
  if (explanation.fix === "wait") return "importando";
  if (explanation.fix === "connect" || explanation.fix === "discard") return "desconectado";
  if (connection.health.status === "healthy") return "conectado";
  // Meta/Klaviyo con un fallo que E-NORA reintenta sola: los datos van
  // atrasados, pero no es un error que tengas que mirar tú.
  if (connection.health.status === "error" && !explanation.automaticRetry) return "error";
  return "atrasado";
}

/** Para la vista de cartera, que solo recibe el `status` crudo de cada conexión. */
export function stateFromStatus(status: string): ConnectionState {
  if (["connected", "healthy"].includes(status)) return "conectado";
  if (status === "syncing") return "importando";
  if (["reauthorization_required", "needs_reauth", "revoked"].includes(status)) return "reconectar";
  if (status === "error") return "error";
  // pending = OAuth sin terminar: con solo el status no se sabe si es de ahora.
  if (["disconnected", "pending_deletion", "pending"].includes(status)) return "desconectado";
  return "atrasado";
}

// Por `health.reason`, que es un codigo estable del backend (packages/
// integrations: deriveIntegrationHealth), no por el texto del error del
// proveedor, que cambia cada vez.
const BY_REASON: Record<string, Explanation> = {
  not_connected: {
    label: "Sin conectar",
    detail: "Esta tienda todavía no tiene esta plataforma conectada.",
    fix: "connect",
  },
  integration_not_available: {
    label: "Aún no disponible",
    detail: "Este conector todavía no está abierto. No hay nada que hacer.",
    fix: null,
  },
  authorization_revoked: {
    label: "Hay que reconectar",
    detail:
      "Se retiró el permiso a E-NORA, así que dejamos de recibir datos. Reconéctala y vuelven solos.",
    fix: "reconnect",
  },
  authorization_pending: {
    label: "A medias",
    detail:
      "Se empezó la conexión pero no llegó a terminarse. Vuelve a lanzarla desde el principio.",
    fix: "connect",
  },
  disconnected: {
    label: "Desconectada",
    detail:
      "La conexión está dada de baja. Sus datos dejaron de actualizarse en ese momento.",
    fix: "connect",
  },
  connection_error: {
    label: "Conexión con error",
    detail:
      "La última solicitud no terminó bien. Revisa el detalle técnico y reintenta; solo hace falta reconectar si el error menciona permisos o autorización.",
    fix: "retry",
  },
  sync_stuck: {
    label: "Atascada",
    detail:
      "Una sincronización se quedó a medias y no ha vuelto a terminar. Lánzala otra vez.",
    fix: "retry",
  },
  last_sync_failed: {
    label: "Faltan datos",
    detail:
      "La última pasada no pudo traerlo todo. Lo anterior sigue siendo válido; lo de esa pasada, no.",
    fix: "retry",
  },
  recent_sync_error: {
    label: "Faltan datos",
    detail:
      "Después de la última sincronización buena hubo un error, así que lo más reciente puede no estar.",
    fix: "retry",
  },
  never_synced: {
    label: "Aún sin datos",
    detail:
      "Conectada, pero todavía no ha traído nada. La primera importación tarda unos minutos.",
    fix: "wait",
  },
  sync_stale: {
    label: "Datos antiguos",
    detail:
      "Lleva más de un día sin actualizarse. Las cifras que veas no son de hoy.",
    fix: "retry",
  },
  invalid_sync_timestamp: {
    label: "Estado desconocido",
    detail: "No podemos saber cuándo sincronizó por última vez.",
    fix: "retry",
  },
};

// Un `pending` recien sembrado y uno de hace tres semanas caian los dos en
// `authorization_pending` y se leian igual: "A medias". Pero uno es una persona
// que ahora mismo tiene abierta la pantalla de permisos de Shopify -- no hay
// nada que arreglar, hay que esperar -- y el otro es basura que ocupa cupo del
// plan. El criterio es el mismo que usa el cron que los purga.
const ATTEMPT_EXPLANATION: Record<string, Explanation> = {
  in_progress: {
    label: "Autorización en curso",
    detail:
      "Se abrió la pantalla de permisos de la plataforma. En cuanto la aceptes, esta tienda se activa sola.",
    fix: "wait",
  },
  abandoned: {
    label: "Sin terminar",
    detail:
      "Se empezó a conectar pero nunca se autorizó, así que no hay datos ni los habrá. Retómalo o descártalo: mientras exista ocupa una tienda de tu plan.",
    fix: "discard",
  },
};

export function explainHealth(
  health: {
    status: string;
    reason?: string;
  },
  /** La conexion, cuando la haya: sin ella no se puede saber si un `pending`
   * acaba de empezar o lleva semanas muerto. */
  connection?: IntegrationConnection | null,
  providerId?: string,
): Explanation {
  if (connection) {
    const attempt = classifyAuthorizationAttempt(connection);
    if (attempt) return ATTEMPT_EXPLANATION[attempt];
    if (
      health.reason === "connection_error" &&
      ["meta_ads", "klaviyo"].includes(providerId ?? "") &&
      !/reauth|reconnect|invalid[_ :.-]*grant|token.{0,24}(expired|invalid|revoked)|invalid.{0,16}(api.?key|credential)|unauthorized|permission(s)?[_ :-]*(missing|denied)|scope(s)?[_ :.-]*(missing|insufficient)|oauth[_ :.-]*(denied|error)/i.test(
        connection.last_error_message ?? "",
      )
    ) {
      const cadence = providerId === "klaviyo" ? "6 horas" : "día";
      return {
        label: "Reintento automático",
        detail: `La última solicitud no terminó bien. E-NORA la volverá a intentar cada ${cadence}; no hace falta pulsar sincronizar.`,
        fix: "retry",
        automaticRetry: true,
      };
    }
    if (
      health.reason === "connection_error" &&
      ["meta_ads", "klaviyo"].includes(providerId ?? "") &&
      /reauth|reconnect|invalid[_ :.-]*grant|token.{0,24}(expired|invalid|revoked)|invalid.{0,16}(api.?key|credential)|unauthorized|permission(s)?[_ :.-]*(missing|denied)|scope(s)?[_ :.-]*(missing|insufficient)|oauth[_ :.-]*(denied|error)/i.test(
        connection.last_error_message ?? "",
      )
    ) {
      return {
        label: "Hay que reconectar",
        detail:
          "La plataforma rechazó la autorización o falta un permiso. Reconecta la cuenta para que E-NORA pueda reanudar la sincronización.",
        fix: "reconnect",
      };
    }
  }
  if (health.status === "healthy")
    return { label: "Al día", detail: null, fix: null };
  if (health.status === "syncing")
    return {
      label: "Sincronizando",
      detail: "Trayendo datos ahora mismo. No hay que hacer nada.",
      fix: "wait",
    };

  const byReason = health.reason ? BY_REASON[health.reason] : undefined;
  if (byReason) return byReason;

  // Estados que solo llegan por `status` (reauthorization_required sin un
  // reason conocido, por ejemplo).
  if (["reauthorization_required", "needs_reauth"].includes(health.status)) {
    return BY_REASON.authorization_revoked;
  }
  if (health.status === "error") return BY_REASON.connection_error;
  if (health.status === "stale") return BY_REASON.sync_stale;
  if (health.status === "degraded") return BY_REASON.last_sync_failed;

  return {
    label: "Estado desconocido",
    detail:
      "No sabemos cómo está esta conexión. Míralo antes de fiarte de sus cifras.",
    fix: "retry",
  };
}

// Los mensajes de error del backend llegan de dos formas: codigos internos en
// snake_case (meta_sync_partial_failure) y frases ya escritas para una persona.
// Los primeros no se le ensenan a nadie tal cual; las segundas se respetan.
const BY_ERROR_CODE: Record<string, string> = {
  meta_sync_partial_failure:
    "Meta devolvió solo una parte de los datos en la última sincronización.",
  meta_token_expired:
    "El permiso de Meta caducó. Hay que volver a autorizar la cuenta.",
  shopify_token_refresh_failed:
    "No se pudo renovar el permiso de Shopify. Hay que reinstalar la app en la tienda.",
  klaviyo_rate_limited:
    "Klaviyo nos limitó el ritmo de llamadas. Se reintenta solo más tarde.",
  sync_partial_failure:
    "La plataforma devolvió solo una parte de los datos en la última sincronización.",
  sync_permanent_failure:
    "La sincronización falló de forma definitiva: reintentar sin tocar nada no la arregla.",
  permission_missing:
    "Falta un permiso que la plataforma no nos concedió al instalar.",
  rate_limited:
    "La plataforma nos limitó el ritmo de llamadas. Se reintenta solo más tarde.",
  external_api_unavailable: "La plataforma no respondió. Suele ser temporal.",
};

/** Un codigo interno, no una frase: todo en minusculas y sin espacios. */
export function looksLikeErrorCode(raw: string): boolean {
  return /^[a-z0-9]+(?:[_.:-][a-z0-9]+)+$/.test(raw.trim());
}

/**
 * El error del proveedor en cristiano. Devuelve tambien el original para poder
 * guardarlo detras de "detalle tecnico" en vez de tirarlo: quien depura lo
 * necesita, quien solo quiere su tienda arreglada no.
 */
export function explainError(
  raw: string | null | undefined,
): { text: string; technical: string | null } | null {
  const message = raw?.trim();
  if (!message) return null;

  const known = BY_ERROR_CODE[message.toLowerCase()];
  if (known) return { text: known, technical: message };

  if (
    /klaviyo_api_error:PERMISSION_MISSING:403/i.test(message) &&
    /events:read/i.test(message)
  ) {
    return {
      text: "Klaviyo no concedió el permiso para leer eventos. Reautoriza Klaviyo y acepta events:read para reanudar la sincronización.",
      technical: message,
    };
  }

  if (
    /catalog:\s*shopify_variant_media_upsert_failed:/i.test(message) &&
    /organization_id/i.test(message)
  ) {
    return {
      text: "La última sincronización intentó guardar la imagen de una variante sin su organización. Hay que actualizar el worker de Shopify y repetir la sincronización.",
      technical: message,
    };
  }

  // «catalog: shopify_variant_media_upsert_failed: null value…»: bloque + codigo
  // + texto de la base de datos. Tampoco es una frase para nadie.
  if (looksLikeErrorCode(message) || /^[a-z_]+:s*[a-z0-9_]+:/.test(message)) {
    return {
      text: "La plataforma devolvió un error técnico que todavía no sabemos traducir.",
      technical: message,
    };
  }

  // Ya es una frase escrita para una persona (las del backend de Shopify lo
  // son): repetirla traducida seria empeorarla.
  return { text: message, technical: null };
}

// --- Una tienda y sus tres conexiones ------------------------------------

export type StoreProviderView = {
  provider: StoreProviderId;
  name: string;
  /** Las conexiones de ese proveedor que pertenecen a esta tienda. */
  connections: IntegrationConnection[];
  /** El estado de la peor de ellas, o "sin conectar" si no hay ninguna. */
  status: string;
  explanation: Explanation;
  error: { text: string; technical: string | null } | null;
  lastSyncAt: string | null;
  /** El conector esta abierto y configurado en el servidor. */
  available: boolean;
  /** Un OAuth sembrado que nunca llego a completarse, si lo hay. La interfaz
   * ofrece "descartar" sobre el, y no sobre una tienda con datos detras. */
  attempt: AuthorizationAttemptState | null;
  /** La conexion sobre la que actuar (reintentar, descartar). */
  target: IntegrationConnection | null;
};

export type StoreView = {
  /** La conexion de Shopify ES la identidad de la tienda, y es lo que usa el
   * selector del encabezado (?connectionId=). */
  connectionId: string;
  /** Fila en shopify_stores, si ya existe. Es la clave de Meta y Klaviyo. */
  storeId: string | null;
  name: string;
  domain: string;
  providers: StoreProviderView[];
  /** La peor de las tres. Ordena la lista y pinta el badge de la fila. */
  severity: number;
  status: string;
};

function worstConnection(
  connections: IntegrationConnection[],
): IntegrationConnection | null {
  return (
    [...connections].sort(
      (a, b) =>
        healthSeverity(b.health.status) - healthSeverity(a.health.status),
    )[0] ?? null
  );
}

function providerView(
  provider: IntegrationProvider | undefined,
  id: StoreProviderId,
  connections: IntegrationConnection[],
): StoreProviderView {
  const worst = worstConnection(connections);
  const available = provider?.available ?? false;

  // Sin conexion no hay salud que derivar, y el `health` del proveedor es el de
  // la peor de sus tiendas: usarlo aqui seria contar de esta tienda lo que le
  // pasa a otra.
  const health = worst
    ? worst.health
    : {
        status: "unknown",
        reason: available ? "not_connected" : "integration_not_available",
      };

  return {
    provider: id,
    name: provider?.name ?? PROVIDER_NAME[id] ?? id,
    connections,
    status: health.status,
    explanation: explainHealth(health, worst, id),
    error: explainError(
      worst?.latest_sync?.error_message ?? worst?.last_error_message ?? null,
    ),
    lastSyncAt: worst?.health.lastSyncAt ?? worst?.last_sync_at ?? null,
    available,
    attempt: worst ? classifyAuthorizationAttempt(worst) : null,
    target: worst,
  };
}

function connectionsOfStore(
  provider: IntegrationProvider | undefined,
  accounts: ScopeAccount[],
  storeId: string | null,
  /** Con una sola tienda, lo que no esta asignado es suyo por definicion: no
   * hay otra a la que pudiera pertenecer. Es la misma regla que ya aplica la
   * pantalla de asignacion, que con una tienda no pide elegir nada. Sin esto,
   * el caso mas comun -- un cliente, una tienda -- veria su Klaviyo conectado
   * como "sin conectar". */
  includeUnassigned = false,
): IntegrationConnection[] {
  if (!provider || !storeId) return [];
  const ids = new Set(
    accounts
      .filter(
        (account) =>
          account.store_id === storeId ||
          (includeUnassigned && account.store_id === null),
      )
      .map((account) => account.connection_id),
  );
  return provider.connections.filter((connection) => ids.has(connection.id));
}

export function storeDisplayName(
  store: ScopeStore | null,
  connection: IntegrationConnection,
): string {
  return (
    store?.shop_name ||
    connection.provider_account_name ||
    store?.myshopify_domain ||
    connection.provider_account_id ||
    "Tienda sin nombre"
  );
}

/**
 * La lista de tiendas, peor primero.
 *
 * La identidad es la conexion de Shopify y no la fila de `shopify_stores`: una
 * tienda recien autorizada (o a medio autorizar) tiene conexion antes de tener
 * fila, y dejarla fuera de la lista seria esconder precisamente la que hay que
 * terminar de conectar.
 */
export function buildStoreViews(
  payload: IntegrationsResponse,
  scope: StoreScope | null,
): StoreView[] {
  const byId = new Map(
    payload.providers.map((provider) => [provider.id, provider]),
  );
  const shopify = byId.get("shopify");
  const soloUnaTienda = (scope?.stores ?? []).length === 1;
  const storeByConnection = new Map(
    (scope?.stores ?? [])
      .filter((store) => Boolean(store.connection_id))
      .map((store) => [store.connection_id as string, store]),
  );

  return (shopify?.connections ?? [])
    .map((connection) => {
      const store = storeByConnection.get(connection.id) ?? null;
      const storeId = store?.id ?? null;

      const providers: StoreProviderView[] = [
        providerView(shopify, "shopify", [connection]),
        providerView(
          byId.get("meta_ads"),
          "meta_ads",
          connectionsOfStore(
            byId.get("meta_ads"),
            scope?.meta_ad_accounts ?? [],
            storeId,
            soloUnaTienda,
          ),
        ),
        providerView(
          byId.get("klaviyo"),
          "klaviyo",
          connectionsOfStore(
            byId.get("klaviyo"),
            scope?.klaviyo_accounts ?? [],
            storeId,
            soloUnaTienda,
          ),
        ),
      ];

      // Solo cuenta lo que esta conectado. Una tienda que no usa Klaviyo no
      // tiene "una incidencia de Klaviyo": no tenerlo es una decision, no una
      // averia, y pintarlo igual que un token caducado era la mitad del rojo de
      // esta pantalla.
      // Una autorizacion que se esta haciendo ahora mismo tampoco: durante esos
      // minutos la tienda no esta rota, esta naciendo.
      const connected = providers.filter(
        (item) => item.connections.length > 0 && item.attempt !== "in_progress",
      );
      const severity = connected.length
        ? Math.max(...connected.map((item) => healthSeverity(item.status)))
        : 0;

      return {
        connectionId: connection.id,
        storeId,
        name: storeDisplayName(store, connection),
        domain: store?.myshopify_domain ?? connection.provider_account_id ?? "",
        providers,
        severity,
        status:
          connected.find((item) => healthSeverity(item.status) === severity)
            ?.status ?? "unknown",
      };
    })
    .sort(
      (a, b) => b.severity - a.severity || a.name.localeCompare(b.name, "es"),
    );
}

/**
 * Conexiones de Meta o Klaviyo que no cuelgan de ninguna tienda.
 *
 * Existen de verdad: una conexion OAuth a medio terminar, o cuentas que nadie
 * asigno todavia. En la vista por proveedor se colaban en la tarjeta como una
 * linea roja mas, indistinguibles de una tienda rota; aqui se dicen aparte, que
 * es lo que son.
 */
export function unassignedConnections(
  payload: IntegrationsResponse,
  scope: StoreScope | null,
): Array<{ provider: string; name: string; connection: IntegrationConnection }> {
  // Con una sola tienda todo cuelga de ella (ver `connectionsOfStore`): decir
  // aqui que hay cuentas sueltas contradiria a la pantalla de asignacion, que
  // en ese caso no ofrece nada que elegir.
  if ((scope?.stores ?? []).length === 1) return [];

  const assigned = new Set<string>();
  for (const account of [
    ...(scope?.meta_ad_accounts ?? []),
    ...(scope?.klaviyo_accounts ?? []),
  ]) {
    if (account.store_id) assigned.add(account.connection_id);
  }

  return payload.providers
    .filter((provider) => ["meta_ads", "klaviyo"].includes(provider.id))
    .flatMap((provider) =>
      provider.connections
        .filter((connection) => !assigned.has(connection.id))
        .map((connection) => ({
          provider: provider.id,
          name: provider.name,
          connection,
        })),
    );
}
