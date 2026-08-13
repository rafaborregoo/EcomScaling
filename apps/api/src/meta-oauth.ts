import crypto from "node:crypto";
import type { LoadedApiEnv } from "@ecomscaling/config";
import { META_GRAPH_VERSION, metaGraphGet } from "./meta-client.js";

export type MetaOAuthEnv = {
  META_APP_ID: string;
  META_APP_SECRET: string;
  META_REDIRECT_URI: string;
  META_SCOPES: string;
};

export function resolveMetaAppEnv(env: LoadedApiEnv): MetaOAuthEnv | null {
  if (!env.META_APP_ID || !env.META_APP_SECRET || !env.META_REDIRECT_URI) {
    return null;
  }

  return {
    META_APP_ID: env.META_APP_ID,
    META_APP_SECRET: env.META_APP_SECRET,
    META_REDIRECT_URI: env.META_REDIRECT_URI,
    META_SCOPES:
      env.META_SCOPES ?? "ads_read,business_management,pages_show_list",
  };
}

export function createMetaState() {
  return crypto.randomUUID();
}

export function buildMetaAuthUrl(appEnv: MetaOAuthEnv, state: string) {
  const url = new URL(
    `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth`,
  );
  url.searchParams.set("client_id", appEnv.META_APP_ID);
  url.searchParams.set("redirect_uri", appEnv.META_REDIRECT_URI);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", appEnv.META_SCOPES);
  url.searchParams.set("response_type", "code");
  return url.toString();
}

export type MetaLongLivedToken = {
  accessToken: string;
  expiresAt: string | null;
};

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
