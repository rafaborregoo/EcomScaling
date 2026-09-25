import crypto from "node:crypto";
import type { LoadedApiEnv } from "@e-nora/config";
import { META_GRAPH_VERSION, metaGraphGet } from "./meta-client.js";

export type MetaOAuthEnv = {
  META_APP_ID: string;
  META_APP_SECRET: string;
  META_REDIRECT_URI: string;
  META_SCOPES: string;
  /** Id de una "configuracion" de Facebook Login for Business. Ver abajo. */
  META_LOGIN_CONFIG_ID?: string;
};

/**
 * Lo que se pide en el dialogo de permisos.
 *
 * `public_profile` se concede sola, pero el dialogo no la cuenta: exige al
 * menos un permiso no basico o responde "esta aplicacion necesita al menos un
 * supported permission". `ads_read` cumple ese papel.
 *
 * `business_management` y `pages_show_list` estaban aqui y tumbaban la pantalla
 * entera ("parece que esta aplicacion no esta disponible"): no son permisos
 * soportados mientras el negocio no este verificado, y Meta rechaza el dialogo
 * completo en vez de omitir el permiso. No se pierde nada, porque
 * `me/businesses` y `me/accounts` en discoverMetaAssets ya capturan su propio
 * error y siguen. Se vuelven a anadir cuando haya verificacion, via META_SCOPES.
 */
export const META_DEFAULT_SCOPES = "public_profile,ads_read";

/**
 * Lo que la conexion necesita de verdad, que no es lo mismo que lo que se pide.
 * Solo `me/adaccounts` -- y por tanto `ads_read` -- es imprescindible; el resto
 * del descubrimiento es opcional por diseno.
 *
 * Estan separados para no repetir el fallo que ya costo Shopify: tratar cada
 * permiso pedido como obligatorio convierte cualquier scope de mas en una
 * conexion en error permanente, con un mensaje que exige algo que el usuario no
 * puede conceder.
 */
export const META_REQUIRED_SCOPES: readonly string[] = ["ads_read"];

export function resolveMetaAppEnv(env: LoadedApiEnv): MetaOAuthEnv | null {
  if (!env.META_APP_ID || !env.META_APP_SECRET || !env.META_REDIRECT_URI) {
    return null;
  }

  return {
    META_APP_ID: env.META_APP_ID,
    META_APP_SECRET: env.META_APP_SECRET,
    META_REDIRECT_URI: env.META_REDIRECT_URI,
    META_SCOPES: env.META_SCOPES ?? META_DEFAULT_SCOPES,
    // Se omite la clave entera cuando no hay valor: con
    // `exactOptionalPropertyTypes` un `undefined` explicito no es lo mismo que
    // ausente.
    ...(env.META_LOGIN_CONFIG_ID
      ? { META_LOGIN_CONFIG_ID: env.META_LOGIN_CONFIG_ID }
      : {}),
  };
}

export function createMetaState() {
  return crypto.randomUUID();
}

/**
 * La pantalla de permisos de Meta.
 *
 * Hay dos productos de login y no aceptan los mismos parametros:
 *
 *   - **Facebook Login** (clasico): se le pasa `scope` con la lista de
 *     permisos. Es lo que esta app hacia siempre.
 *   - **Facebook Login for Business**: solo para apps de tipo Business, que es
 *     lo que Meta crea hoy para la Marketing API. Ahi los permisos NO se piden
 *     por `scope`: se declaran en una "configuracion" dentro del panel
 *     (Inicio de sesion con Facebook -> Configuraciones) y el dialogo se invoca
 *     con el `config_id` de esa configuracion. La documentacion lo dice literal:
 *     "config_id has replaced scope".
 *     https://developers.facebook.com/docs/facebook-login/facebook-login-for-business
 *
 * Invocar el dialogo de una app Business con solo `scope` es lo que produce el
 * "Funcion no disponible / estamos actualizando otros detalles de la
 * aplicacion": un mensaje que no nombra el parametro que falta y que manda a
 * revisar ajustes que estan bien.
 *
 * Por eso la eleccion es explicita y por configuracion: si hay
 * META_LOGIN_CONFIG_ID se usa esa via; si no, la clasica.
 */
export function buildMetaAuthUrl(appEnv: MetaOAuthEnv, state: string) {
  const url = new URL(
    `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth`,
  );
  url.searchParams.set("client_id", appEnv.META_APP_ID);
  url.searchParams.set("redirect_uri", appEnv.META_REDIRECT_URI);
  url.searchParams.set("state", state);
  url.searchParams.set("response_type", "code");

  const configId = appEnv.META_LOGIN_CONFIG_ID?.trim();
  if (configId) {
    url.searchParams.set("config_id", configId);
  } else {
    url.searchParams.set("scope", appEnv.META_SCOPES);
  }

  return url.toString();
}

export type MetaLongLivedToken = {
  accessToken: string;
  expiresAt: string | null;
};

export function parseMetaScopes(value: string): string[] {
  return [
    ...new Set(
      value
        .split(",")
        .map((scope) => scope.trim())
        .filter(Boolean),
    ),
  ];
}

export function missingMetaScopes(
  requiredScopes: readonly string[],
  grantedScopes: readonly string[],
): string[] {
  const granted = new Set(
    grantedScopes.map((scope) => scope.trim()).filter(Boolean),
  );
  return requiredScopes.filter((scope) => !granted.has(scope));
}

export type MetaDebugToken = {
  scopes: string[];
  userId: string | null;
  appId: string | null;
  expiresAt: string | null;
};

/** Reads the permissions actually attached to a token before activation. */
export async function debugMetaAccessToken(
  appEnv: MetaOAuthEnv,
  accessToken: string,
): Promise<MetaDebugToken> {
  const response = await metaGraphGet<{
    data?: {
      is_valid?: boolean;
      scopes?: string[];
      user_id?: string;
      app_id?: string;
      expires_at?: number;
    };
  }>("debug_token", `${appEnv.META_APP_ID}|${appEnv.META_APP_SECRET}`, {
    input_token: accessToken,
  });
  const data = response.data;
  if (!data?.is_valid || !Array.isArray(data.scopes)) {
    throw new Error("meta_token_debug_invalid");
  }
  return {
    scopes: parseMetaScopes(data.scopes.join(",")),
    userId: data.user_id ?? null,
    appId: data.app_id ?? null,
    expiresAt:
      typeof data.expires_at === "number"
        ? new Date(data.expires_at * 1000).toISOString()
        : null,
  };
}

/**
 * Intercambia el code por un token corto y lo alarga inmediatamente
 * (fb_exchange_token, ~60 dias). Meta no da refresh_token para usuarios: cuando
 * el token largo caduque, la conexion pasa a error y hay que reautorizar.
 */
export async function exchangeMetaCodeForLongLivedToken(
  appEnv: MetaOAuthEnv,
  code: string,
): Promise<MetaLongLivedToken> {
  const shortResponse = await metaGraphGet<{
    access_token?: string;
    expires_in?: number;
  }>("oauth/access_token", "", {
    client_id: appEnv.META_APP_ID,
    client_secret: appEnv.META_APP_SECRET,
    redirect_uri: appEnv.META_REDIRECT_URI,
    code,
  });

  if (!shortResponse.access_token) {
    throw new Error("meta_oauth_missing_access_token");
  }

  const longResponse = await metaGraphGet<{
    access_token?: string;
    expires_in?: number;
  }>("oauth/access_token", "", {
    grant_type: "fb_exchange_token",
    client_id: appEnv.META_APP_ID,
    client_secret: appEnv.META_APP_SECRET,
    fb_exchange_token: shortResponse.access_token,
  });

  const accessToken = longResponse.access_token ?? shortResponse.access_token;
  const expiresIn = longResponse.expires_in ?? shortResponse.expires_in ?? null;

  return {
    accessToken,
    expiresAt: expiresIn
      ? new Date(Date.now() + expiresIn * 1000).toISOString()
      : null,
  };
}

/**
 * appsecret_proof requerido por Marketing API en llamadas server-to-server.
 */
export function buildAppSecretProof(accessToken: string, appSecret: string) {
  return crypto
    .createHmac("sha256", appSecret)
    .update(accessToken)
    .digest("hex");
}
