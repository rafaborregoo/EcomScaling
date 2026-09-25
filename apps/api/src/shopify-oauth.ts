import crypto from "node:crypto";
import {
  DEFAULT_AGENT_RESILIENCE_POLICY,
  withAgentResilience,
} from "@e-nora/ai";

export type ShopifyOAuthEnv = {
  SHOPIFY_API_KEY: string;
  SHOPIFY_API_SECRET: string;
  SHOPIFY_SCOPES: string;
  SHOPIFY_REDIRECT_URI: string;
};

export type ShopifyAppMode = "public" | "custom";

export type ShopifyMultiAppEnv = ShopifyOAuthEnv & {
  SHOPIFY_CUSTOM_API_KEY?: string;
  SHOPIFY_CUSTOM_API_SECRET?: string;
  SHOPIFY_CUSTOM_SCOPES?: string;
  SHOPIFY_CUSTOM_REDIRECT_URI?: string;
};

export function isCustomShopifyAppConfigured(env: ShopifyMultiAppEnv) {
  return Boolean(
    env.SHOPIFY_CUSTOM_API_KEY &&
      env.SHOPIFY_CUSTOM_API_SECRET &&
      env.SHOPIFY_CUSTOM_SCOPES &&
      env.SHOPIFY_CUSTOM_REDIRECT_URI,
  );
}

// La app publica y la app de distribucion personalizada son dos registros distintos en
// Shopify (el modo de distribucion no se puede cambiar en la misma app una vez elegido),
// cada una con su propio client_id/secret/scopes/redirect_uri. Esta funcion resuelve cual
// usar segun el modo guardado en la conexion, sin tocar la config de la app publica.
export function resolveShopifyAppEnv(env: ShopifyMultiAppEnv, mode: ShopifyAppMode): ShopifyOAuthEnv {
  if (mode === "public") {
    return {
      SHOPIFY_API_KEY: env.SHOPIFY_API_KEY,
      SHOPIFY_API_SECRET: env.SHOPIFY_API_SECRET,
      SHOPIFY_SCOPES: env.SHOPIFY_SCOPES,
      SHOPIFY_REDIRECT_URI: env.SHOPIFY_REDIRECT_URI,
    };
  }

  if (!isCustomShopifyAppConfigured(env)) {
    throw new Error("shopify_custom_app_not_configured");
  }

  return {
    SHOPIFY_API_KEY: env.SHOPIFY_CUSTOM_API_KEY!,
    SHOPIFY_API_SECRET: env.SHOPIFY_CUSTOM_API_SECRET!,
    SHOPIFY_SCOPES: env.SHOPIFY_CUSTOM_SCOPES!,
    SHOPIFY_REDIRECT_URI: env.SHOPIFY_CUSTOM_REDIRECT_URI!,
  };
}

export type ShopifyPendingConnection = {
  state: string;
  organizationId: string;
  providerAccountId: string;
  providerAccountName: string;
};

function normalizeShopDomain(shop: string) {
  const value = shop.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");

  if (!/^[a-z0-9][a-z0-9.-]*\.myshopify\.com$/.test(value)) {
    throw new Error("invalid_shop_domain");
  }

  return value;
}

export function buildShopifyAuthorizeUrl(
  env: ShopifyOAuthEnv,
  shopDomain: string,
  state: string,
) {
  const shop = normalizeShopDomain(shopDomain);
  const url = new URL(`https://${shop}/admin/oauth/authorize`);

  url.searchParams.set("client_id", env.SHOPIFY_API_KEY);
  url.searchParams.set("scope", env.SHOPIFY_SCOPES);
  url.searchParams.set("redirect_uri", env.SHOPIFY_REDIRECT_URI);
  url.searchParams.set("state", state);

  return { shop, url: url.toString() };
}

export function verifyShopifyHmac(
  query: Record<string, string | string[] | undefined>,
  secret: string,
) {
  const entries = Object.entries(query)
    .filter(([key, value]) => key !== "hmac" && typeof value === "string")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`);

  const digest = crypto.createHmac("sha256", secret).update(entries.join("&")).digest("hex");
  const hmac = typeof query.hmac === "string" ? query.hmac : "";

  if (!hmac || hmac.length !== digest.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(digest, "hex"), Buffer.from(hmac, "hex"));
}

export function createShopifyState() {
  return crypto.randomUUID();
}

export function encryptShopifyCredential(plainText: string, masterSecret: string) {
  const key = crypto.createHash("sha256").update(masterSecret).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

export function decryptShopifyCredential(payload: string, masterSecret: string) {
  const raw = Buffer.from(payload, "base64");
  const iv = raw.subarray(0, 12);
  const authTag = raw.subarray(12, 28);
  const encrypted = raw.subarray(28);
  const key = crypto.createHash("sha256").update(masterSecret).digest();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}

type ShopifyTokenExchangeResponse = {
  access_token?: string;
  scope?: string;
  expires_in?: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  associated_user?: { id?: number; email?: string };
};

export type ShopifyExpiringToken = {
  accessToken: string;
  scope: string;
  associatedUserEmail: string | null;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
};

function parseExpiringTokenPayload(payload: ShopifyTokenExchangeResponse, now: number): ShopifyExpiringToken {
  if (!payload.access_token) {
    throw new Error("shopify_access_token_missing");
  }

  if (!payload.refresh_token || !payload.expires_in || !payload.refresh_token_expires_in) {
    // No incluyas el payload aqui: puede contener el access_token en claro.
    throw new Error("shopify_expiring_token_fields_missing");
  }

  return {
    accessToken: payload.access_token,
    scope: payload.scope ?? "",
    associatedUserEmail: payload.associated_user?.email ?? null,
    refreshToken: payload.refresh_token,
    accessTokenExpiresAt: new Date(now + payload.expires_in * 1000).toISOString(),
    refreshTokenExpiresAt: new Date(now + payload.refresh_token_expires_in * 1000).toISOString(),
  };
}

async function postShopifyTokenEndpoint(
  shop: string,
  params: Record<string, string>,
  errorPrefix: string,
): Promise<ShopifyTokenExchangeResponse> {
  // Shopify documenta este endpoint con application/x-www-form-urlencoded; con JSON el
  // parametro expiring=1 no se reconoce y la peticion falla con 400.
  const response = await withAgentResilience(
    (signal) =>
      fetch(`https://${shop}/admin/oauth/access_token`, {
        method: "POST",
        signal,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: new URLSearchParams(params).toString(),
      }).then(async (result) => {
        if (result.ok) return result;
        // El body de error de Shopify trae error/error_description, nunca tokens.
        const bodyText = await result.text().catch(() => "");
        throw Object.assign(
          new Error(`${errorPrefix}_${result.status}${bodyText ? `: ${bodyText.slice(0, 300)}` : ""}`),
          { status: result.status },
        );
      }),
    DEFAULT_AGENT_RESILIENCE_POLICY,
  );

  return (await response.json()) as ShopifyTokenExchangeResponse;
}

// App publica creada despues del 1 abr 2026: Shopify exige expiring=1 (access_token +
// refresh_token de corta vida) en vez del offline token clasico sin expiracion.
export async function exchangeShopifyCodeForToken(
  env: ShopifyOAuthEnv,
  shop: string,
  code: string,
): Promise<ShopifyExpiringToken> {
  const payload = await postShopifyTokenEndpoint(
    shop,
    {
      client_id: env.SHOPIFY_API_KEY,
      client_secret: env.SHOPIFY_API_SECRET,
      code,
      expiring: "1",
    },
    "shopify_token_exchange_failed",
  );

  return parseExpiringTokenPayload(payload, Date.now());
}

export async function refreshShopifyOfflineToken(
  env: ShopifyOAuthEnv,
  shop: string,
  refreshToken: string,
): Promise<ShopifyExpiringToken> {
  const payload = await postShopifyTokenEndpoint(
    shop,
    {
      client_id: env.SHOPIFY_API_KEY,
      client_secret: env.SHOPIFY_API_SECRET,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    },
    "shopify_token_refresh_failed",
  );

  return parseExpiringTokenPayload(payload, Date.now());
}

export function parseProviderAccountName(shop: string) {
  return shop.replace(/\.myshopify\.com$/, "");
}
