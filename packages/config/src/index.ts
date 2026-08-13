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
  // App Meta (Marketing API). Opcional: si no esta seteada, el boton "Conectar
  // Meta Ads" no aparece en la UI. Deben estar las 3 seteadas juntas o ninguna.
  META_APP_ID: z.string().min(1).optional(),
  META_APP_SECRET: z.string().min(1).optional(),
  META_REDIRECT_URI: z.string().url().optional(),
  META_SCOPES: z.string().min(1).optional(),
  // Klaviyo OAuth. Opcional hasta que exista una app aprobada; las tres
  // variables de aplicación deben llegar juntas para no habilitar un flujo roto.
  KLAVIYO_CLIENT_ID: z.string().min(1).optional(),
  KLAVIYO_CLIENT_SECRET: z.string().min(1).optional(),
  KLAVIYO_REDIRECT_URI: z.string().url().optional(),
  KLAVIYO_SCOPES: z.string().min(1).optional(),
  // Allowlist opcional de providers implementados, separado por comas.
  // Ejemplo: INTEGRATION_FEATURE_FLAGS=shopify,meta_ads
  INTEGRATION_FEATURE_FLAGS: z.string().min(1).optional(),
  // Runtime de agentes IA (AI-00). Opcional: sin key, los endpoints de IA
  // devuelven 503 y el resto de la plataforma funciona igual.
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  // Fallback de proveedor LLM (R-020/AI-09): si Anthropic falla de forma no
  // recuperable (error 5xx/overloaded, no un rechazo de contenido), el
  // runtime reintenta el mismo turno con OpenAI. Opcional: sin key, un fallo
  // de Anthropic sigue siendo un fallo, sin fallback (comportamiento actual).
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_MODEL: z.string().min(1).optional(),
  // Embeddings para RAG (AI-04). Opcional: sin key, la ingestion/busqueda de
  // conocimiento devuelve 503 y la tool search_knowledge no se habilita.
  VOYAGE_API_KEY: z.string().min(1).optional(),
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
  META_APP_ID?: string;
  META_APP_SECRET?: string;
  META_REDIRECT_URI?: string;
  META_SCOPES?: string;
  KLAVIYO_CLIENT_ID?: string;
  KLAVIYO_CLIENT_SECRET?: string;
  KLAVIYO_REDIRECT_URI?: string;
  KLAVIYO_SCOPES?: string;
  INTEGRATION_FEATURE_FLAGS?: string;
  ANTHROPIC_API_KEY?: string;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  VOYAGE_API_KEY?: string;
  INTERNAL_API_SECRET?: string;
  REDIS_URL?: string;
};

export function loadApiEnv(
  source: Record<string, string | undefined>,
): LoadedApiEnv {
  // Una variable presente pero vacia (META_APP_ID=) cuenta como no configurada:
  // los .env suelen copiarse de .env.example con claves opcionales en blanco.
  const cleanedSource = Object.fromEntries(
    Object.entries(source).filter(([, value]) => value !== ""),
  );
  const env = apiEnvSchema.parse(cleanedSource);
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

  const metaFields = [
    env.META_APP_ID,
    env.META_APP_SECRET,
    env.META_REDIRECT_URI,
  ];
  const metaFieldsSetCount = metaFields.filter(Boolean).length;

  if (metaFieldsSetCount > 0 && metaFieldsSetCount < metaFields.length) {
    throw new Error(
      "META_APP_ID, META_APP_SECRET y META_REDIRECT_URI deben estar todas seteadas o ninguna",
    );
  }

  const klaviyoFields = [
    env.KLAVIYO_CLIENT_ID,
    env.KLAVIYO_CLIENT_SECRET,
    env.KLAVIYO_REDIRECT_URI,
  ];
  const klaviyoFieldsSetCount = klaviyoFields.filter(Boolean).length;

  if (
    klaviyoFieldsSetCount > 0 &&
    klaviyoFieldsSetCount < klaviyoFields.length
  ) {
    throw new Error(
      "KLAVIYO_CLIENT_ID, KLAVIYO_CLIENT_SECRET y KLAVIYO_REDIRECT_URI deben estar todas seteadas o ninguna",
    );
  }

  return {
    API_HOST: env.API_HOST,
    API_PORT: env.API_PORT,
    WEB_ORIGIN: env.WEB_ORIGIN,
    SUPABASE_URL: supabaseUrl,
    SUPABASE_PUBLISHABLE_KEY: supabasePublishableKey,
    ...(env.SUPABASE_SERVICE_ROLE_KEY
      ? { SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY }
      : {}),
    ...(env.SUPABASE_JWT_SECRET
      ? { SUPABASE_JWT_SECRET: env.SUPABASE_JWT_SECRET }
      : {}),
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
    ...(metaFieldsSetCount === metaFields.length
      ? {
          META_APP_ID: env.META_APP_ID!,
          META_APP_SECRET: env.META_APP_SECRET!,
          META_REDIRECT_URI: env.META_REDIRECT_URI!,
          META_SCOPES:
            env.META_SCOPES ?? "ads_read,business_management,pages_show_list",
        }
      : {}),
    ...(klaviyoFieldsSetCount === klaviyoFields.length
      ? {
          KLAVIYO_CLIENT_ID: env.KLAVIYO_CLIENT_ID!,
          KLAVIYO_CLIENT_SECRET: env.KLAVIYO_CLIENT_SECRET!,
          KLAVIYO_REDIRECT_URI: env.KLAVIYO_REDIRECT_URI!,
          KLAVIYO_SCOPES:
            env.KLAVIYO_SCOPES ??
            "accounts:read,flows:read,campaigns:read,forms:read,lists:read,segments:read,metrics:read",
        }
      : {}),
    ...(env.INTEGRATION_FEATURE_FLAGS
      ? { INTEGRATION_FEATURE_FLAGS: env.INTEGRATION_FEATURE_FLAGS }
      : {}),
    ...(env.ANTHROPIC_API_KEY
      ? { ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY }
      : {}),
    ...(env.OPENAI_API_KEY ? { OPENAI_API_KEY: env.OPENAI_API_KEY } : {}),
    ...(env.OPENAI_MODEL ? { OPENAI_MODEL: env.OPENAI_MODEL } : {}),
    ...(env.VOYAGE_API_KEY ? { VOYAGE_API_KEY: env.VOYAGE_API_KEY } : {}),
    ...(env.INTERNAL_API_SECRET
      ? { INTERNAL_API_SECRET: env.INTERNAL_API_SECRET }
      : {}),
    ...(env.REDIS_URL ? { REDIS_URL: env.REDIS_URL } : {}),
  };
}

export function loadWorkerEnv(source: Record<string, string | undefined>) {
  return workerEnvSchema.parse(source);
}
