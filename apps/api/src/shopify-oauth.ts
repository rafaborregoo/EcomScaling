import crypto from "node:crypto";

export type ShopifyOAuthEnv = {
  SHOPIFY_API_KEY: string;
  SHOPIFY_API_SECRET: string;
  SHOPIFY_SCOPES: string;
  SHOPIFY_REDIRECT_URI: string;
};

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

// App publica creada despues del 1 abr 2026: Shopify exige expiring=1 (access_token +
// refresh_token de corta vida) en vez del offline token clasico sin expiracion.
export async function exchangeShopifyCodeForToken(
  env: ShopifyOAuthEnv,
  shop: string,
  code: string,
): Promise<ShopifyExpiringToken> {
  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: env.SHOPIFY_API_KEY,
      client_secret: env.SHOPIFY_API_SECRET,
      code,
      expiring: 1,
    }),
  });

  if (!response.ok) {
    throw new Error(`shopify_token_exchange_failed_${response.status}`);
  }

  const payload = (await response.json()) as ShopifyTokenExchangeResponse;
  return parseExpiringTokenPayload(payload, Date.now());
}

export async function refreshShopifyOfflineToken(
  env: ShopifyOAuthEnv,
  shop: string,
  refreshToken: string,
): Promise<ShopifyExpiringToken> {
  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: env.SHOPIFY_API_KEY,
      client_secret: env.SHOPIFY_API_SECRET,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    // Shopify no devuelve el refresh_token en el cuerpo de error, pero por si acaso
    // no se registra el body de la respuesta aqui.
    throw new Error(`shopify_token_refresh_failed_${response.status}`);
  }

  const payload = (await response.json()) as ShopifyTokenExchangeResponse;
  return parseExpiringTokenPayload(payload, Date.now());
}

export function parseProviderAccountName(shop: string) {
  return shop.replace(/\.myshopify\.com$/, "");
}
