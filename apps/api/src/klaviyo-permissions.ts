import type { KlaviyoClient } from "./klaviyo-client.js";

/**
 * Permisos de Klaviyo que usa el modulo, con el nombre EXACTO que tienen en
 * `Settings -> API keys` de Klaviyo.
 *
 * Existe porque el error crudo de la API ("klaviyo_api_error:AUTH:403:...") no
 * le dice a nadie que casilla marcar. Con esta tabla, tanto el alta de una
 * clave privada como un sync fallido pueden nombrar el permiso que falta.
 */
export type KlaviyoCapability = {
  /** Identificador interno, tambien el que se guarda en `connection.scopes`. */
  key: string;
  /** Scope equivalente en OAuth. */
  scope: string;
  /** Como se llama el permiso en la interfaz de Klaviyo. */
  label: string;
  /** Lectura barata para saber si la credencial puede con ese recurso. */
  probePath: string;
  /** Metodo del sondeo (write se comprueba sin escribir nada, ver abajo). */
  method?: "GET" | "PATCH";
  /** Sin esto el modulo no puede hacer su trabajo. */
  required: boolean;
};

const campaignsProbe =
  "/campaigns/?page[size]=1&filter=" +
  encodeURIComponent("equals(messages.channel,'email')");

export const KLAVIYO_CAPABILITIES: readonly KlaviyoCapability[] = [
  {
    key: "campaigns:read",
    scope: "campaigns:read",
    label: "Campaigns (Read)",
    probePath: campaignsProbe,
    required: true,
  },
  {
    key: "flows:read",
    scope: "flows:read",
    label: "Flows (Read)",
    probePath: "/flows/?page[size]=1",
    required: true,
  },
  {
    key: "lists:read",
    scope: "lists:read",
    label: "Lists (Read)",
    probePath: "/lists/?page[size]=1",
    required: true,
  },
  {
    key: "segments:read",
    scope: "segments:read",
    label: "Segments (Read)",
    probePath: "/segments/?page[size]=1",
    required: true,
  },
  {
    key: "events:read",
    scope: "events:read",
    label: "Events (Read)",
    probePath: "/events/?page[size]=1",
    required: true,
  },
  {
    key: "metrics:read",
    scope: "metrics:read",
    label: "Metrics (Read)",
    probePath: "/metrics/?page[size]=1",
    required: true,
  },
  {
    key: "forms:read",
    scope: "forms:read",
    label: "Forms (Read)",
    probePath: "/forms/?page[size]=1",
    required: false,
  },
  {
    key: "templates:read",
    scope: "templates:read",
    label: "Templates (Read)",
    probePath: "/templates/?page[size]=1",
    required: false,
  },
  {
    /**
     * No hay forma de comprobar la escritura sin escribir... salvo pedir un
     * PATCH sobre una plantilla que no existe: si la credencial puede escribir,
     * Klaviyo contesta 404 (no encuentro esa plantilla); si no puede, contesta
     * 403 antes de mirar el id. Nada se crea ni se modifica.
     */
    key: "templates:write",
    scope: "templates:write",
    label: "Templates (Full access)",
    probePath: "/templates/00000000-0000-0000-0000-000000000000/",
    method: "PATCH",
    required: false,
  },
  {
    /** Programar y cancelar campañas desde Marketing. Mismo sondeo sin escritura. */
    key: "campaigns:write",
    scope: "campaigns:write",
    label: "Campaigns (Full access)",
    probePath: "/campaigns/00000000-0000-0000-0000-000000000000/",
    method: "PATCH",
    required: false,
  },
  {
    /** Crear flows diseñados en Marketing → Flows. Mismo sondeo sin escritura. */
    key: "flows:write",
    scope: "flows:write",
    label: "Flows (Full access)",
    probePath: "/flows/00000000-0000-0000-0000-000000000000/",
    method: "PATCH",
    required: false,
  },
];

/** El error de la API viene como `klaviyo_api_error:<clase>:<status>:<cuerpo>`. */
export function isKlaviyoPermissionError(message: string): boolean {
  return /klaviyo_api_error:[A-Z_]+:(401|403)\b/.test(message);
}

export function klaviyoCapability(key: string): KlaviyoCapability | null {
  return KLAVIYO_CAPABILITIES.find((item) => item.key === key) ?? null;
}

/** Frase para la persona: que marcar y donde, sin jerga de scopes. */
export function describeKlaviyoMissingPermissions(
  missing: readonly KlaviyoCapability[],
  source: "api_key" | "oauth",
): string {
  const labels = missing.map((item) =>
    source === "api_key" ? item.label : item.scope,
  );
  const list = labels.join(", ");
  return source === "api_key"
    ? `A la API key le faltan permisos en Klaviyo: ${list}. Editala en Settings -> API keys (o crea otra) marcando esos permisos y vuelve a conectarla.`
    : `La conexion de Klaviyo no tiene estos permisos: ${list}. Vuelve a autorizar la cuenta desde Integraciones para concederlos.`;
}

export type KlaviyoPermissionProbe = {
  /** Claves que la credencial puede usar (`connection.scopes`). */
  granted: string[];
  /** Rechazados con 401/403: son los que hay que marcar. */
  missing: KlaviyoCapability[];
  /**
   * Fallaron por otra cosa (red, 5xx, contrato). No se puede afirmar que falte
   * el permiso, asi que no bloquean: el sync ya avisa si el recurso no llega.
   */
  inconclusive: KlaviyoCapability[];
};

/**
 * Pregunta a Klaviyo, una vez por recurso, si la credencial puede leerlo.
 *
 * Se llama al dar de alta una clave privada: es el unico momento en el que la
 * persona tiene el panel de Klaviyo abierto y puede arreglarlo en el acto.
 */
export async function probeKlaviyoPermissions(
  client: Pick<KlaviyoClient, "request">,
  capabilities: readonly KlaviyoCapability[] = KLAVIYO_CAPABILITIES,
): Promise<KlaviyoPermissionProbe> {
  const probe: KlaviyoPermissionProbe = {
    granted: [],
    missing: [],
    inconclusive: [],
  };

  await Promise.all(
    capabilities.map(async (capability) => {
      try {
        await client.request(capability.probePath, {
          method: capability.method ?? "GET",
          ...(capability.method === "PATCH"
            ? {
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  data: {
                    type: "template",
                    id: "00000000-0000-0000-0000-000000000000",
                    attributes: {},
                  },
                }),
              }
            : {}),
        });
        probe.granted.push(capability.key);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "unknown_error";
        if (isKlaviyoPermissionError(message)) {
          probe.missing.push(capability);
          return;
        }
        // 404 en el sondeo de escritura = la credencial SI puede escribir, solo
        // que esa plantilla no existe. Es la respuesta que buscabamos.
        if (capability.method === "PATCH" && message.includes(":404")) {
          probe.granted.push(capability.key);
          return;
        }
        probe.inconclusive.push(capability);
      }
    }),
  );

  return probe;
}
