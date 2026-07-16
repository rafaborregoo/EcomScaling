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

export async function exchangeShopifyCodeForToken(env: ShopifyOAuthEnv, shop: string, code: string) {
  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: env.SHOPIFY_API_KEY,
      client_secret: env.SHOPIFY_API_SECRET,
      code,
    }),
  });

  if (!response.ok) {
    throw new Error(`shopify_token_exchange_failed_${response.status}`);
  }

  const payload = (await response.json()) as {
    access_token?: string;
    scope?: string;
    associated_user?: { id?: number; email?: string };
  };

  if (!payload.access_token) {
    throw new Error("shopify_access_token_missing");
  }

  return {
    accessToken: payload.access_token,
    scope: payload.scope ?? "",
    associatedUserEmail: payload.associated_user?.email ?? null,
  };
}

export function parseProviderAccountName(shop: string) {
  return shop.replace(/\.myshopify\.com$/, "");
}
