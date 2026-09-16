import { z } from "zod";

/**
 * Permisos que pedimos a Klaviyo. Lectura para el sync y los informes, y
 * `templates:read`/`templates:write` para leer plantillas de la cuenta y
 * publicar en ella las piezas aprobadas desde /marketing.
 *
 * Ampliar esta lista obliga a reautorizar las conexiones OAuth ya existentes:
 * el token viejo conserva los permisos que se concedieron entonces.
 */
export const DEFAULT_KLAVIYO_SCOPES =
  "accounts:read flows:read campaigns:read forms:read lists:read segments:read metrics:read templates:read templates:write";

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
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_BREVO: z.string().min(1).optional(),
  SMTP_FROM_EMAIL: z.string().email().optional(),
  SMTP_FROM_NAME: z.string().min(1).optional(),
  SHOPIFY_API_KEY: z.string().min(1).optional(),
  SHOPIFY_API_SECRET: z.string().min(1).optional(),
  SHOPIFY_SCOPES: z.string().min(1).optional(),
  SHOPIFY_REDIRECT_URI: z.string().url().optional(),
  SHOPIFY_API_VERSION: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
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
  META_GRAPH_VERSION: z
    .string()
    .regex(/^v\d+\.\d+$/)
    .optional(),
  META_SCOPES: z.string().min(1).optional(),
  // Id de una configuracion de Facebook Login for Business. Cuando esta, el
  // dialogo se invoca con config_id en vez de scope: las apps de tipo Business
  // declaran sus permisos en esa configuracion, no en la URL.
  META_LOGIN_CONFIG_ID: z.string().min(1).optional(),
  // Meta Insights puede usar reportes asincronos para cuentas grandes. Se
  // mantiene sync por defecto hasta activar esta opcion con una app real.
  META_INSIGHTS_MODE: z.enum(["sync", "async"]).optional(),
  // Ventana temporal con la que Meta atribuye acciones en Insights. Se deja
  // opcional para conservar el comportamiento actual hasta validar Ads
  // Manager con una cuenta real.
  META_ACTION_REPORT_TIME: z
    .enum(["impression", "conversion", "mixed"])
    .optional(),
  // Klaviyo OAuth. Opcional hasta que exista una app aprobada; las tres
  // variables de aplicación deben llegar juntas para no habilitar un flujo roto.
  KLAVIYO_CLIENT_ID: z.string().min(1).optional(),
  KLAVIYO_CLIENT_SECRET: z.string().min(1).optional(),
  KLAVIYO_REDIRECT_URI: z.string().url().optional(),
  KLAVIYO_SCOPES: z.string().min(1).optional(),
  // Fathom API key interna para registrar webhooks cuando exista una cuenta
  // de prueba aprobada. Nunca se expone al frontend.
  FATHOM_API_KEY: z.string().min(1).optional(),
  FATHOM_WEBHOOK_SECRET: z.string().min(1).optional(),
  // Whop: la pasarela de cobro de la plataforma. Las dos variables son
  // independientes -- solo con el secreto ya se reciben altas y bajas de plan;
  // la API key hace falta ademas para abrir un checkout desde la app. Sin
  // ninguna, la plataforma funciona igual y los planes se tocan a mano.
  WHOP_API_KEY: z.string().min(1).optional(),
  WHOP_WEBHOOK_SECRET: z.string().min(1).optional(),
  // Whop versiona por fecha. Sin esto se usa la version por defecto de la key;
  // fijarla es lo que evita que un cambio suyo mueva el payload bajo los pies.
  WHOP_API_VERSION_DATE: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  // Allowlist opcional de providers implementados, separado por comas.
  // Ejemplo: INTEGRATION_FEATURE_FLAGS=shopify,meta_ads
  INTEGRATION_FEATURE_FLAGS: z.string().min(1).optional(),
  // Runtime de agentes IA (AI-00). Opcional: sin key, los endpoints de IA
  // devuelven 503 y el resto de la plataforma funciona igual.
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  // Modelo Anthropic global opcional; permite actualizar el alias sin migrar
  // agent_versions. AI_MODEL_ROUTING_JSON tiene prioridad por agente.
  ANTHROPIC_MODEL: z.string().min(1).optional(),
  // Fallback de proveedor LLM (R-020/AI-09): si Anthropic falla de forma no
  // recuperable (error 5xx/overloaded, no un rechazo de contenido), el
  // runtime reintenta el mismo turno con OpenAI. Opcional: sin key, un fallo
  // de Anthropic sigue siendo un fallo, sin fallback (comportamiento actual).
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_MODEL: z.string().min(1).optional(),
  // AI-09: JSON opcional para routing por agente/proveedor y budgets por turno.
  // Sin esta variable se conservan los defaults actuales del runtime.
  AI_MODEL_ROUTING_JSON: z.string().min(1).optional(),
  // AI-09: limites diarios y por turno por plan comercial. Se mantiene
  // server-side; el cliente nunca recibe este JSON.
  AI_PLAN_BUDGETS_JSON: z.string().min(1).optional(),
  // AI-14: direct por defecto; langgraph solo se activa explícitamente en un
  // entorno de shadow/piloto tras validar paridad.
  // Observabilidad opcional de agentes. Nunca se activa solo por tener una
  // API key: exige LANGSMITH_TRACING=true y pasa por el adaptador de @ecomscaling/ai.
  LANGSMITH_TRACING: z.enum(["true", "false"]).optional(),
  LANGSMITH_API_KEY: z.string().min(1).optional(),
  LANGSMITH_PROJECT: z.string().min(1).optional(),
  APP_ENV: z.string().min(1).optional(),
  // AI-30: commit desplegado. Se inyecta en el build de la imagen (deploy/) y se
  // guarda en agent_runs.deployment_version para poder atar un comportamiento
  // de produccion al codigo exacto que lo produjo.
  GIT_SHA: z.string().min(1).optional(),
  // Embeddings para RAG (AI-04). Opcional: sin key, la ingestion/busqueda de
  // conocimiento devuelve 503 y la tool search_knowledge no se habilita.
  VOYAGE_API_KEY: z.string().min(1).optional(),
  INTERNAL_API_SECRET: z.string().min(1).optional(),
  REDIS_URL: z.string().url().optional(),
  // SQO-02: URL publica de una instancia de la API ya desplegada, para que el
  // chequeo de salud operativa (corrido aparte, por cron/CI) pueda leer
  // `/health/slo` de esa instancia real. Opcional: sin desplegar, el chequeo
  // simplemente omite esta alerta en vez de fallar.
  API_BASE_URL: z.string().url().optional(),
  // Control de coste de agentes de diagnostico (fase 3). Todos opcionales: sin
  // setear se usan los defaults del runtime (50 USD/dia de plataforma, 12
  // runs/dia por organizacion, 15 agentes por pasada del orquestador).
  AI_PLATFORM_DAILY_COST_CAP_USD: z.coerce.number().positive().optional(),
  AI_ORG_DAILY_RUN_CAP: z.coerce.number().int().positive().optional(),
  AI_DIAGNOSTICS_MAX_RUNS_PER_TICK: z.coerce
    .number()
    .int()
    .positive()
    .optional(),
  // Interruptor de desarrollo: con "false" ningun agente se lanza solo (ni el
  // cron del orquestador ni la regeneracion al abrir una pagina). Los botones
  // de "Ejecutar" siguen funcionando, para poder probar un agente concreto sin
  // que el resto consuma por su cuenta.
  AI_AUTORUN_ENABLED: z.enum(["true", "false"]).optional(),
  // Refrescos manuales ("Actualizar ahora") por organizacion y dia, sumando
  // todos los agentes de diagnostico. Default 12.
  AI_MANUAL_REFRESH_DAILY_CAP: z.coerce.number().int().positive().optional(),
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
  SMTP_HOST?: string;
  SMTP_PORT?: number;
  SMTP_USER?: string;
  SMTP_BREVO?: string;
  SMTP_FROM_EMAIL?: string;
  SMTP_FROM_NAME?: string;
  SHOPIFY_API_KEY: string;
  SHOPIFY_API_SECRET: string;
  SHOPIFY_SCOPES: string;
  SHOPIFY_REDIRECT_URI: string;
  SHOPIFY_API_VERSION?: string;
  SHOPIFY_CUSTOM_API_KEY?: string;
  SHOPIFY_CUSTOM_API_SECRET?: string;
  SHOPIFY_CUSTOM_SCOPES?: string;
  SHOPIFY_CUSTOM_REDIRECT_URI?: string;
  META_APP_ID?: string;
  META_APP_SECRET?: string;
  META_REDIRECT_URI?: string;
  META_GRAPH_VERSION?: string;
  META_SCOPES?: string;
  META_LOGIN_CONFIG_ID?: string;
  META_INSIGHTS_MODE?: "sync" | "async";
  META_ACTION_REPORT_TIME?: "impression" | "conversion" | "mixed";
  KLAVIYO_CLIENT_ID?: string;
  KLAVIYO_CLIENT_SECRET?: string;
  KLAVIYO_REDIRECT_URI?: string;
  KLAVIYO_SCOPES?: string;
  FATHOM_API_KEY?: string;
  FATHOM_WEBHOOK_SECRET?: string;
  WHOP_API_KEY?: string;
  WHOP_WEBHOOK_SECRET?: string;
  WHOP_API_VERSION_DATE?: string;
  INTEGRATION_FEATURE_FLAGS?: string;
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_MODEL?: string;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  AI_MODEL_ROUTING_JSON?: string;
  AI_PLAN_BUDGETS_JSON?: string;
  LANGSMITH_TRACING?: "true" | "false";
  LANGSMITH_API_KEY?: string;
  LANGSMITH_PROJECT?: string;
  APP_ENV?: string;
  GIT_SHA?: string;
  VOYAGE_API_KEY?: string;
  INTERNAL_API_SECRET?: string;
  REDIS_URL?: string;
  API_BASE_URL?: string;
  AI_PLATFORM_DAILY_COST_CAP_USD?: number;
  AI_ORG_DAILY_RUN_CAP?: number;
  AI_DIAGNOSTICS_MAX_RUNS_PER_TICK?: number;
  AI_AUTORUN_ENABLED?: "true" | "false";
  AI_MANUAL_REFRESH_DAILY_CAP?: number;
};

/**
 * Proyecto Supabase de PRODUCCION. Sale del `--project-ref` de
 * `npm run supabase:link`; no es un secreto (aparece en cada URL del proyecto),
 * y tenerlo aqui es lo que permite detectar que un entorno de desarrollo esta
 * apuntando a los datos reales.
 */
export const PRODUCTION_SUPABASE_PROJECT_REF = "cthjwpeygpzwdmjkxeqa";

/** Entornos que NO deben tocar produccion. `APP_ENV=local` es el de siempre. */
const NON_PRODUCTION_APP_ENVS = new Set([
  "local",
  "dev",
  "development",
  "test",
  "staging",
  "shadow",
]);

export function isProductionSupabaseUrl(url: string | undefined): boolean {
  if (!url) return false;
  return url.includes(PRODUCTION_SUPABASE_PROJECT_REF);
}

/**
 * Nivel 2 de datos protegidos de Shopify exige separar test y produccion. Esto
 * detecta el fallo real: no un diseño equivocado, sino la variable pegada de
 * mas un martes por la tarde.
 *
 * Devuelve el aviso, o `null` si el entorno esta donde dice estar. No decide
 * si eso mata el proceso: eso lo elige quien arranca (ver `SUPABASE_ENV_GUARD`),
 * para que activar la proteccion no rompa a nadie el dia que se despliega.
 */
export function describeEnvironmentTargetRisk(source: {
  APP_ENV?: string;
  SUPABASE_URL?: string;
  NODE_ENV?: string;
}): string | null {
  const appEnv = source.APP_ENV?.trim().toLowerCase();
  if (!appEnv || !NON_PRODUCTION_APP_ENVS.has(appEnv)) return null;
  if (!isProductionSupabaseUrl(source.SUPABASE_URL)) return null;
  return `APP_ENV=${appEnv} apuntando al Supabase de PRODUCCION (${PRODUCTION_SUPABASE_PROJECT_REF}). Shopify exige separar datos de test y de produccion: usa el proyecto de desarrollo en este entorno. Para bloquear el arranque en vez de avisar, SUPABASE_ENV_GUARD=block.`;
}

/**
 * `block` mata el proceso; cualquier otro valor (o ninguno) solo avisa. Se pone
 * en `block` cuando el proyecto de desarrollo ya existe.
 */
export function shouldBlockOnEnvironmentRisk(source: {
  SUPABASE_ENV_GUARD?: string;
}): boolean {
  return source.SUPABASE_ENV_GUARD?.trim().toLowerCase() === "block";
}

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
    ...(env.SMTP_HOST ? { SMTP_HOST: env.SMTP_HOST } : {}),
    ...(env.SMTP_PORT !== undefined ? { SMTP_PORT: env.SMTP_PORT } : {}),
    ...(env.SMTP_USER ? { SMTP_USER: env.SMTP_USER } : {}),
    ...(env.SMTP_BREVO ? { SMTP_BREVO: env.SMTP_BREVO } : {}),
    ...(env.SMTP_FROM_EMAIL ? { SMTP_FROM_EMAIL: env.SMTP_FROM_EMAIL } : {}),
    ...(env.SMTP_FROM_NAME ? { SMTP_FROM_NAME: env.SMTP_FROM_NAME } : {}),
    SHOPIFY_API_KEY: env.SHOPIFY_API_KEY,
    SHOPIFY_API_SECRET: env.SHOPIFY_API_SECRET,
    SHOPIFY_SCOPES: env.SHOPIFY_SCOPES,
    SHOPIFY_REDIRECT_URI: env.SHOPIFY_REDIRECT_URI,
    ...(env.SHOPIFY_API_VERSION
      ? { SHOPIFY_API_VERSION: env.SHOPIFY_API_VERSION }
      : {}),
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
          ...(env.META_GRAPH_VERSION
            ? { META_GRAPH_VERSION: env.META_GRAPH_VERSION }
            : {}),
          // Ver META_DEFAULT_SCOPES en apps/api/src/meta-oauth.ts: pedir mas
          // permisos de los imprescindibles tumbaba el dialogo entero.
          META_SCOPES: env.META_SCOPES ?? "public_profile,ads_read",
          ...(env.META_LOGIN_CONFIG_ID
            ? { META_LOGIN_CONFIG_ID: env.META_LOGIN_CONFIG_ID }
            : {}),
          ...(env.META_INSIGHTS_MODE
            ? { META_INSIGHTS_MODE: env.META_INSIGHTS_MODE }
            : {}),
          ...(env.META_ACTION_REPORT_TIME
            ? { META_ACTION_REPORT_TIME: env.META_ACTION_REPORT_TIME }
            : {}),
        }
      : {}),
    ...(klaviyoFieldsSetCount === klaviyoFields.length
      ? {
          KLAVIYO_CLIENT_ID: env.KLAVIYO_CLIENT_ID!,
          KLAVIYO_CLIENT_SECRET: env.KLAVIYO_CLIENT_SECRET!,
          KLAVIYO_REDIRECT_URI: env.KLAVIYO_REDIRECT_URI!,
          KLAVIYO_SCOPES: env.KLAVIYO_SCOPES ?? DEFAULT_KLAVIYO_SCOPES,
        }
      : {}),
    ...(env.FATHOM_API_KEY ? { FATHOM_API_KEY: env.FATHOM_API_KEY } : {}),
    ...(env.FATHOM_WEBHOOK_SECRET
      ? { FATHOM_WEBHOOK_SECRET: env.FATHOM_WEBHOOK_SECRET }
      : {}),
    ...(env.WHOP_API_KEY ? { WHOP_API_KEY: env.WHOP_API_KEY } : {}),
    ...(env.WHOP_WEBHOOK_SECRET
      ? { WHOP_WEBHOOK_SECRET: env.WHOP_WEBHOOK_SECRET }
      : {}),
    ...(env.WHOP_API_VERSION_DATE
      ? { WHOP_API_VERSION_DATE: env.WHOP_API_VERSION_DATE }
      : {}),
    ...(env.INTEGRATION_FEATURE_FLAGS
      ? { INTEGRATION_FEATURE_FLAGS: env.INTEGRATION_FEATURE_FLAGS }
      : {}),
    ...(env.ANTHROPIC_API_KEY
      ? { ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY }
      : {}),
    ...(env.ANTHROPIC_MODEL ? { ANTHROPIC_MODEL: env.ANTHROPIC_MODEL } : {}),
    ...(env.OPENAI_API_KEY ? { OPENAI_API_KEY: env.OPENAI_API_KEY } : {}),
    ...(env.OPENAI_MODEL ? { OPENAI_MODEL: env.OPENAI_MODEL } : {}),
    ...(env.AI_MODEL_ROUTING_JSON
      ? { AI_MODEL_ROUTING_JSON: env.AI_MODEL_ROUTING_JSON }
      : {}),
    ...(env.AI_PLAN_BUDGETS_JSON
      ? { AI_PLAN_BUDGETS_JSON: env.AI_PLAN_BUDGETS_JSON }
      : {}),
    ...(env.LANGSMITH_TRACING
      ? { LANGSMITH_TRACING: env.LANGSMITH_TRACING }
      : {}),
    ...(env.LANGSMITH_API_KEY
      ? { LANGSMITH_API_KEY: env.LANGSMITH_API_KEY }
      : {}),
    ...(env.LANGSMITH_PROJECT
      ? { LANGSMITH_PROJECT: env.LANGSMITH_PROJECT }
      : {}),
    ...(env.APP_ENV ? { APP_ENV: env.APP_ENV } : {}),
    ...(env.GIT_SHA ? { GIT_SHA: env.GIT_SHA } : {}),
    ...(env.VOYAGE_API_KEY ? { VOYAGE_API_KEY: env.VOYAGE_API_KEY } : {}),
    ...(env.INTERNAL_API_SECRET
      ? { INTERNAL_API_SECRET: env.INTERNAL_API_SECRET }
      : {}),
    ...(env.REDIS_URL ? { REDIS_URL: env.REDIS_URL } : {}),
    ...(env.API_BASE_URL ? { API_BASE_URL: env.API_BASE_URL } : {}),
    ...(env.AI_PLATFORM_DAILY_COST_CAP_USD !== undefined
      ? { AI_PLATFORM_DAILY_COST_CAP_USD: env.AI_PLATFORM_DAILY_COST_CAP_USD }
      : {}),
    ...(env.AI_ORG_DAILY_RUN_CAP !== undefined
      ? { AI_ORG_DAILY_RUN_CAP: env.AI_ORG_DAILY_RUN_CAP }
      : {}),
    ...(env.AI_DIAGNOSTICS_MAX_RUNS_PER_TICK !== undefined
      ? {
          AI_DIAGNOSTICS_MAX_RUNS_PER_TICK:
            env.AI_DIAGNOSTICS_MAX_RUNS_PER_TICK,
        }
      : {}),
    ...(env.AI_AUTORUN_ENABLED
      ? { AI_AUTORUN_ENABLED: env.AI_AUTORUN_ENABLED }
      : {}),
    ...(env.AI_MANUAL_REFRESH_DAILY_CAP !== undefined
      ? { AI_MANUAL_REFRESH_DAILY_CAP: env.AI_MANUAL_REFRESH_DAILY_CAP }
      : {}),
  };
}

export function loadWorkerEnv(source: Record<string, string | undefined>) {
  return workerEnvSchema.parse(source);
}
