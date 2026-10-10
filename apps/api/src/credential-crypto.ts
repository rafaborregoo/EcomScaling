import crypto from "node:crypto";
import type { LoadedApiEnv } from "@e-nora/config";
import { decryptShopifyCredential, encryptShopifyCredential } from "./shopify-oauth.js";

// Cifrado de las credenciales de integraciones (tokens de Shopify, Meta y
// Klaviyo, claves API) guardadas en private.integration_credentials.
//
// v1 (heredado): AES-256-GCM con una clave derivada de SUPABASE_JWT_SECRET. Es
// el secreto que firma las sesiones: rotarlo dejaba ilegibles todas las
// credenciales, y no habia forma de rotar la clave de cifrado por separado.
//
// v2: clave propia (CREDENTIALS_ENCRYPTION_KEY) y el id de la conexion como
// dato autenticado (AAD): un payload copiado a otra fila no se descifra.
// Rotacion: se pone la clave nueva en CREDENTIALS_ENCRYPTION_KEY y la vieja en
// _PREVIOUS; se descifra con cualquiera de las dos y se cifra con la actual, y
// scripts/rotate-credentials.mjs recifra lo guardado.

type CryptoEnv = Pick<
  LoadedApiEnv,
  | "CREDENTIALS_ENCRYPTION_KEY"
  | "CREDENTIALS_ENCRYPTION_KEY_PREVIOUS"
  | "SUPABASE_JWT_SECRET"
  | "SUPABASE_SERVICE_ROLE_KEY"
  | "SHOPIFY_API_SECRET"
>;

const V2_PREFIX = "v2:";

/** Clave heredada (v1). Solo para descifrar lo antiguo, o cifrar si no hay clave propia. */
export function legacyCredentialSecret(env: CryptoEnv) {
  return env.SUPABASE_JWT_SECRET ?? env.SUPABASE_SERVICE_ROLE_KEY ?? env.SHOPIFY_API_SECRET;
}

function keyOf(secret: string) {
  return crypto.createHash("sha256").update(secret).digest();
}

/** Version con la que se cifra ahora: la que se guarda en encryption_key_version. */
export function credentialKeyVersion(env: CryptoEnv): "v1" | "v2" {
  return env.CREDENTIALS_ENCRYPTION_KEY ? "v2" : "v1";
}

export function encryptCredential(plainText: string, env: CryptoEnv, connectionId: string): string {
  if (!env.CREDENTIALS_ENCRYPTION_KEY) {
    return encryptShopifyCredential(plainText, legacyCredentialSecret(env));
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", keyOf(env.CREDENTIALS_ENCRYPTION_KEY), iv);
  cipher.setAAD(Buffer.from(connectionId, "utf8"));
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  return V2_PREFIX + Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64");
}

function decryptV2(payload: string, secret: string, connectionId: string) {
  const raw = Buffer.from(payload.slice(V2_PREFIX.length), "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", keyOf(secret), raw.subarray(0, 12));
  decipher.setAAD(Buffer.from(connectionId, "utf8"));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
}

export function decryptCredential(payload: string, env: CryptoEnv, connectionId: string): string {
  if (!payload.startsWith(V2_PREFIX)) {
    return decryptShopifyCredential(payload, legacyCredentialSecret(env));
  }
  const keys = [env.CREDENTIALS_ENCRYPTION_KEY, env.CREDENTIALS_ENCRYPTION_KEY_PREVIOUS].filter(
    (key): key is string => Boolean(key),
  );
  if (keys.length === 0) throw new Error("credentials_encryption_key_missing");
  let lastError: unknown = null;
  for (const key of keys) {
    try {
      return decryptV2(payload, key, connectionId);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("credential_decrypt_failed");
}

/** true cuando el payload no esta cifrado con la clave actual y conviene recifrarlo. */
export function needsReencryption(payload: string, env: CryptoEnv) {
  return Boolean(env.CREDENTIALS_ENCRYPTION_KEY) && !payload.startsWith(V2_PREFIX);
}
