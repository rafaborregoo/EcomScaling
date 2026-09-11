import crypto from "node:crypto";
import { DEFAULT_KLAVIYO_SCOPES, type LoadedApiEnv } from "@ecomscaling/config";
import {
  DEFAULT_AGENT_RESILIENCE_POLICY,
  withAgentResilience,
} from "@ecomscaling/ai";

/** Pin the API contract instead of silently following Klaviyo's latest revision. */
export const KLAVIYO_API_REVISION = "2026-07-15";
export const KLAVIYO_AUTHORIZE_URL = "https://www.klaviyo.com/oauth/authorize";
export const KLAVIYO_TOKEN_URL = "https://a.klaviyo.com/oauth/token";
export const KLAVIYO_REVOKE_URL = "https://a.klaviyo.com/oauth/revoke";

export type KlaviyoOAuthEnv = {
  KLAVIYO_CLIENT_ID: string;
  KLAVIYO_CLIENT_SECRET: string;
  KLAVIYO_REDIRECT_URI: string;
  KLAVIYO_SCOPES: string;
};

export type KlaviyoOAuthTokens = {
  access_token: string;
  token_type: "bearer" | string;
  expires_in: number;
  refresh_token: string;
  scope?: string;
};

export function parseKlaviyoScopes(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/[\s,]+/)
        .map((scope) => scope.trim())
        .filter(Boolean),
    ),
  ];
}

export function missingKlaviyoScopes(
  requiredScopes: readonly string[],
  grantedScopes: readonly string[],
): string[] {
  const granted = new Set(grantedScopes);
  return requiredScopes.filter((scope) => !granted.has(scope));
}

export function resolveKlaviyoOAuthEnv(
  env: LoadedApiEnv,
): KlaviyoOAuthEnv | null {
  if (
    !env.KLAVIYO_CLIENT_ID ||
    !env.KLAVIYO_CLIENT_SECRET ||
    !env.KLAVIYO_REDIRECT_URI
  ) {
    return null;
  }

  return {
    KLAVIYO_CLIENT_ID: env.KLAVIYO_CLIENT_ID,
    KLAVIYO_CLIENT_SECRET: env.KLAVIYO_CLIENT_SECRET,
    KLAVIYO_REDIRECT_URI: env.KLAVIYO_REDIRECT_URI,
    KLAVIYO_SCOPES: parseKlaviyoScopes(
      env.KLAVIYO_SCOPES ?? DEFAULT_KLAVIYO_SCOPES,
    ).join(" "),
  };
}

export function createKlaviyoCodeVerifier(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function createKlaviyoCodeChallenge(codeVerifier: string): string {
  return crypto.createHash("sha256").update(codeVerifier).digest("base64url");
}

export function buildKlaviyoAuthorizeUrl(
  env: KlaviyoOAuthEnv,
  state: string,
  codeChallenge: string,
): string {
  const url = new URL(KLAVIYO_AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", env.KLAVIYO_CLIENT_ID);
  url.searchParams.set("redirect_uri", env.KLAVIYO_REDIRECT_URI);
  url.searchParams.set("scope", env.KLAVIYO_SCOPES);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("code_challenge", codeChallenge);
  return url.toString();
}

function basicClientAuthorization(env: KlaviyoOAuthEnv): string {
  return `Basic ${Buffer.from(
    `${env.KLAVIYO_CLIENT_ID}:${env.KLAVIYO_CLIENT_SECRET}`,
  ).toString("base64")}`;
}

async function requestKlaviyoTokens(
  env: KlaviyoOAuthEnv,
  body: URLSearchParams,
): Promise<KlaviyoOAuthTokens> {
  const response = await withAgentResilience(
    (signal) =>
      fetch(KLAVIYO_TOKEN_URL, {
        method: "POST",
        signal,
        headers: {
          Authorization: basicClientAuthorization(env),
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body,
      }).then(async (result) => {
        if (result.ok) return result;
        const detail = await result.text().catch(() => "");
        throw Object.assign(
          new Error(`klaviyo_oauth_token_request_failed:${result.status}:${detail.slice(0, 300)}`),
          { status: result.status },
        );
      }),
    DEFAULT_AGENT_RESILIENCE_POLICY,
  );

  const payload = (await response.json()) as Partial<KlaviyoOAuthTokens>;
  if (
    typeof payload.access_token !== "string" ||
    typeof payload.refresh_token !== "string" ||
    typeof payload.expires_in !== "number" ||
    typeof payload.token_type !== "string"
  ) {
    throw new Error("klaviyo_oauth_token_response_invalid");
  }

  return payload as KlaviyoOAuthTokens;
}

export function exchangeKlaviyoCodeForTokens(
  env: KlaviyoOAuthEnv,
  code: string,
  codeVerifier: string,
): Promise<KlaviyoOAuthTokens> {
  return requestKlaviyoTokens(
    env,
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: env.KLAVIYO_REDIRECT_URI,
      code_verifier: codeVerifier,
    }),
  );
}

export function refreshKlaviyoAccessToken(
  env: KlaviyoOAuthEnv,
  refreshToken: string,
): Promise<KlaviyoOAuthTokens> {
  return requestKlaviyoTokens(
    env,
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  );
}
