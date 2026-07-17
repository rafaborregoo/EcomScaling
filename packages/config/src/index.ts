import { z } from "zod";

const apiEnvSchema = z.object({
  API_HOST: z.string().default("0.0.0.0"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.string().url().default("http://localhost:3001"),
  SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  SUPABASE_JWT_SECRET: z.string().min(1).optional(),
  SHOPIFY_API_KEY: z.string().min(1).optional(),
  SHOPIFY_API_SECRET: z.string().min(1).optional(),
  SHOPIFY_SCOPES: z.string().min(1).optional(),
  SHOPIFY_REDIRECT_URI: z.string().url().optional(),
  // App Shopify de distribucion personalizada (custom distribution): permite conectar
  // tiendas reales de clientes antes de que la app publica pase la revision de Shopify.
  // Opcional: si no esta seteada, la opcion "app personalizada" no aparece en la UI.
  SHOPIFY_CUSTOM_API_KEY: z.string().min(1).optional(),
  SHOPIFY_CUSTOM_API_SECRET: z.string().min(1).optional(),
  SHOPIFY_CUSTOM_SCOPES: z.string().min(1).optional(),
  SHOPIFY_CUSTOM_REDIRECT_URI: z.string().url().optional(),
  INTERNAL_API_SECRET: z.string().min(1).optional(),
  REDIS_URL: z.string().url().optional(),
});

const workerEnvSchema = z.object({
  REDIS_URL: z.string().url().default("redis://localhost:6379"),
  API_URL: z.string().url().default("http://localhost:4000"),
  INTERNAL_API_SECRET: z.string().min(1).optional(),
});

export type LoadedApiEnv = {
  API_HOST: string;
  API_PORT: number;
  WEB_ORIGIN: string;
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_JWT_SECRET?: string;
  SHOPIFY_API_KEY: string;
  SHOPIFY_API_SECRET: string;
  SHOPIFY_SCOPES: string;
  SHOPIFY_REDIRECT_URI: string;
  SHOPIFY_CUSTOM_API_KEY?: string;
  SHOPIFY_CUSTOM_API_SECRET?: string;
  SHOPIFY_CUSTOM_SCOPES?: string;
  SHOPIFY_CUSTOM_REDIRECT_URI?: string;
  INTERNAL_API_SECRET?: string;
  REDIS_URL?: string;
};

export function loadApiEnv(source: Record<string, string | undefined>): LoadedApiEnv {
  const env = apiEnvSchema.parse(source);
  const supabaseUrl = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey =
    env.SUPABASE_PUBLISHABLE_KEY ?? env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL is required");
  }

  if (!supabasePublishableKey) {
    throw new Error(
      "SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required",
    );
  }

  if (!env.SHOPIFY_API_KEY) {
    throw new Error("SHOPIFY_API_KEY is required");
  }

  if (!env.SHOPIFY_API_SECRET) {
    throw new Error("SHOPIFY_API_SECRET is required");
  }

  if (!env.SHOPIFY_SCOPES) {
    throw new Error("SHOPIFY_SCOPES is required");
  }

  if (!env.SHOPIFY_REDIRECT_URI) {
    throw new Error("SHOPIFY_REDIRECT_URI is required");
  }

  const customFields = [
    env.SHOPIFY_CUSTOM_API_KEY,
    env.SHOPIFY_CUSTOM_API_SECRET,
    env.SHOPIFY_CUSTOM_SCOPES,
    env.SHOPIFY_CUSTOM_REDIRECT_URI,
  ];
  const customFieldsSetCount = customFields.filter(Boolean).length;

  if (customFieldsSetCount > 0 && customFieldsSetCount < customFields.length) {
    throw new Error(
      "SHOPIFY_CUSTOM_API_KEY, SHOPIFY_CUSTOM_API_SECRET, SHOPIFY_CUSTOM_SCOPES y SHOPIFY_CUSTOM_REDIRECT_URI deben estar todas seteadas o ninguna",
    );
  }

  return {
    API_HOST: env.API_HOST,
    API_PORT: env.API_PORT,
    WEB_ORIGIN: env.WEB_ORIGIN,
    SUPABASE_URL: supabaseUrl,
    SUPABASE_PUBLISHABLE_KEY: supabasePublishableKey,
    ...(env.SUPABASE_SERVICE_ROLE_KEY ? { SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY } : {}),
    ...(env.SUPABASE_JWT_SECRET ? { SUPABASE_JWT_SECRET: env.SUPABASE_JWT_SECRET } : {}),
    SHOPIFY_API_KEY: env.SHOPIFY_API_KEY,
    SHOPIFY_API_SECRET: env.SHOPIFY_API_SECRET,
    SHOPIFY_SCOPES: env.SHOPIFY_SCOPES,
    SHOPIFY_REDIRECT_URI: env.SHOPIFY_REDIRECT_URI,
    ...(customFieldsSetCount === customFields.length
      ? {
          SHOPIFY_CUSTOM_API_KEY: env.SHOPIFY_CUSTOM_API_KEY!,
          SHOPIFY_CUSTOM_API_SECRET: env.SHOPIFY_CUSTOM_API_SECRET!,
          SHOPIFY_CUSTOM_SCOPES: env.SHOPIFY_CUSTOM_SCOPES!,
          SHOPIFY_CUSTOM_REDIRECT_URI: env.SHOPIFY_CUSTOM_REDIRECT_URI!,
        }
      : {}),
    ...(env.INTERNAL_API_SECRET ? { INTERNAL_API_SECRET: env.INTERNAL_API_SECRET } : {}),
    ...(env.REDIS_URL ? { REDIS_URL: env.REDIS_URL } : {}),
  };
}

export function loadWorkerEnv(source: Record<string, string | undefined>) {
  return workerEnvSchema.parse(source);
}
