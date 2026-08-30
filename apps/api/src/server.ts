import { pathToFileURL } from "node:url";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance } from "fastify";
import { Redis } from "ioredis";
import { loadApiEnv } from "@ecomscaling/config";
import {
  healthResponseSchema,
  readinessResponseSchema,
} from "@ecomscaling/contracts";
import {
  createLogger,
  evaluateHttpSlo,
  redactSensitiveText,
} from "@ecomscaling/observability";
import { isIntegrationFeatureEnabled } from "@ecomscaling/integrations";
import { apiMetrics } from "./metrics.js";
import { listAccountActions } from "./actions.js";
import {
  addMarketingDraftNote,
  deleteOrganization,
  deleteOrganizationStore,
  getConsultantOverview,
  getOrganizationAccess,
  listConsultantCalls,
  listConsultantIntegrations,
  listConsultantKnowledge,
  listConsultantMarketing,
  listConsultantOperations,
  listConsultantOrganizations,
  listConsultantPlans,
  listConsultantStores,
  listMarketingDraftNotes,
  listConsultants,
  listOrganizationStores,
  restoreOrganization,
  restoreOrganizationStore,
  upsertConsultantAssignment,
  upsertOrganizationMember,
  updateOrganization,
} from "./consultant.js";
import {
  isAuthContextError,
  resolveAuthContext,
  type AuthContextError,
} from "./auth-context.js";
import { listIntegrations } from "./integrations.js";
import {
  createShopifyConnectionAuthUrl,
  handleShopifyOAuthCallback,
  triggerShopifySync,
} from "./shopify.js";
import {
  getShopifyConnections,
  getShopifyOverview,
} from "./shopify-overview.js";
import { getShopifyMetrics } from "./shopify-metrics.js";
import { handleShopifyWebhookRequest } from "./shopify-webhook-handler.js";
import { handleFathomWebhookRequest } from "./fathom-webhook-handler.js";
import { processQueuedFathomWebhookEvents } from "./fathom-webhook-handler.js";
import type { FathomWebhookHeaders } from "./fathom-webhook.js";
import { reconcileAllShopifyConnections } from "./shopify-reconcile.js";
import { purgeProcessedWebhookEvents } from "./webhook-retention.js";
import { purgeExpiredAiContext } from "./ai-context-retention.js";
import { exportOrganizationData } from "./organization-export.js";
import {
  listProductCosts,
  upsertProductCost,
} from "./shopify-product-costs.js";
import {
  createFixedExpense,
  createShippingRule,
  deactivateFixedExpense,
  deactivateShippingRule,
  getFinancialConfig,
  upsertFinancialSettings,
} from "./financial-config.js";
import {
  createMetaConnectionAuthUrl,
  handleMetaOAuthCallback,
  listMetaAssets,
  listMetaPurchaseActionTypes,
  selectMetaPurchaseActionType,
  triggerMetaSync,
  updateMetaAssetSelection,
} from "./meta.js";
import {
  connectKlaviyoWithApiKey,
  createKlaviyoConnectionAuthUrl,
  getKlaviyoEmailReport,
  handleKlaviyoOAuthCallback,
  importKlaviyoTemplate,
  listKlaviyoConversionMetrics,
  listKlaviyoTemplates,
  previewKlaviyoTemplate,
  selectKlaviyoConversionMetric,
  triggerKlaviyoSync,
} from "./klaviyo.js";
import { listKlaviyoReports, runKlaviyoReport } from "./klaviyo-sync.js";
import { getMetaMetrics } from "./meta-metrics.js";
import { prepareMetaAdCreationPlan } from "./meta-ad-write-plan.js";
import {
  addTaskComment,
  createTask,
  evaluateAlertRules,
  listOperations,
  runAlertRulesForAllOrganizations,
  updateAlertStatus,
  updateTaskStatus,
} from "./operations.js";
import {
  decideAgentOutput,
  getConsultantChatMessages,
  getEmailAnalystDiagnostic,
  getMonitorDiagnostic,
  getKnowledgeManagerDiagnostic,
  getStockPlannerDiagnostic,
  getTaskPlannerDiagnostic,
  listAgentRuns,
  getAgentRunTrace,
  getOrganizationDailyBudgetStatusForOrganization,
  listMarketingContentDrafts,
  listMarketingContentDraftVersions,
  updateMarketingContentDraft,
  decideMarketingContentDraft,
  runMarketingContentDraft,
  saveManualMarketingDraft,
  submitMarketingContentDraft,
  uploadMarketingAsset,
  listConsultantChatConversations,
  runCallAnalyst,
  runConsultantChatTurn,
  runEmailAnalystAgent,
  runKnowledgeManagerAgent,
  runMonitorAgent,
  runStockPlannerAgent,
  runTaskPlannerAgent,
} from "./ai-runtime.js";
import { getAgentEvalReadiness } from "./agent-eval-readiness.js";
import {
  createKnowledgeDocument,
  listKnowledgeDocuments,
  searchKnowledge,
} from "./knowledge.js";
import {
  addInternalNote,
  createCall,
  createSummary,
  createTaskFromCall,
  decideSummary,
  listCalls,
  saveTranscript,
  updateCall,
} from "./calls.js";
import {
  listNotifications,
  markAllNotificationsRead,
  updateNotificationStatus,
} from "./notifications.js";
import {
  activateStrategicPlan,
  addMilestoneInternalNote,
  getMilestoneInternalNotes,
  getObjectives,
  createObjective,
  deactivateObjective,
  setObjectiveActual,
  listObjectiveDefinitions,
  createObjectiveDefinition,
  updateObjectiveDefinition,
  archiveObjectiveDefinition,
  createMilestone,
  createMilestoneTask,
  createPhase,
  createStrategicPlan,
  getStrategicPlan,
  linkTaskToMilestone,
  reorderMilestones,
  reorderPhases,
  updateMilestone,
  updateMilestoneStatus,
  updatePhase,
} from "./strategic-plans.js";

const logger = createLogger("api");

export function sendAuthFailure(
  reply: {
    code: (statusCode: number) => { send: (payload: unknown) => unknown };
  },
  error: AuthContextError,
) {
  if (error.statusCode >= 500 && error.detail) {
    logger.error("auth_context_failed", {
      statusCode: error.statusCode,
      error: error.error,
      detail: redactFailureDetail(error.detail),
    });

    const { detail: _internalDetail, ...publicError } = error;
    return reply.code(error.statusCode).send(publicError);
  }

  return reply.code(error.statusCode).send(error);
}

type ServiceFailure = {
  ok: false;
  statusCode: number;
  [key: string]: unknown;
};

export const redactFailureDetail = redactSensitiveText;

const READINESS_CHECK_TIMEOUT_MS = 3_000;

// BE-00: check real de dependencias (no un ping simulado). GoTrue expone
// /auth/v1/health sin tocar ninguna tabla de negocio ni RLS -- confirma que
// Supabase responde, no si un query de negocio funcionaria. Redis solo se
// comprueba si REDIS_URL esta configurado (en dev local el rate limit usa un
// store en memoria, ver registro de @fastify/rate-limit arriba).
async function checkReadiness(env: ReturnType<typeof loadApiEnv>) {
  const checks = {
    supabase: "error" as "ok" | "error" | "not_configured",
    redis: "not_configured" as "ok" | "error" | "not_configured",
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      READINESS_CHECK_TIMEOUT_MS,
    );
    try {
      const response = await fetch(`${env.SUPABASE_URL}/auth/v1/health`, {
        headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY },
        signal: controller.signal,
      });
      checks.supabase = response.ok ? "ok" : "error";
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    checks.supabase = "error";
  }

  if (env.REDIS_URL) {
    const client = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: READINESS_CHECK_TIMEOUT_MS,
      lazyConnect: true,
    });

    try {
      await client.connect();
      await client.ping();
      checks.redis = "ok";
    } catch {
      checks.redis = "error";
    } finally {
      client.disconnect();
    }
  }

  return checks;
}

// SQO-02: extrae el `sub` (user id) del JWT sin verificar su firma -- solo
// para enriquecer logs, nunca para decisiones de autorizacion (eso lo sigue
// haciendo `resolveAuthContext` en cada handler, que si verifica contra
// Supabase). Un token invalido o forjado en este punto solo puede ensuciar
// una linea de log con un user_id que no se usa para nada mas; la request en
// si sigue siendo rechazada normalmente donde corresponda.
function decodeJwtSubject(
  authorizationHeader: string | undefined,
): string | undefined {
  if (!authorizationHeader?.startsWith("Bearer ")) {
    return undefined;
  }

  const token = authorizationHeader.slice("Bearer ".length);
  const parts = token.split(".");

  if (parts.length !== 3 || !parts[1]) {
    return undefined;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8"),
    ) as { sub?: unknown };
    return typeof payload.sub === "string" ? payload.sub : undefined;
  } catch {
    return undefined;
  }
}

function isServiceFailure(result: { ok: boolean }): result is ServiceFailure {
  return result.ok === false;
}

export function sendServiceFailure(
  reply: {
    code: (statusCode: number) => { send: (payload: unknown) => unknown };
  },
  result: unknown,
) {
  const failure = result as ServiceFailure;

  // No expongas mensajes de Supabase, SQL ni proveedores externos al cliente.
  // Muchos servicios construyen `detail` desde `error.message`; devolverlo en
  // una respuesta 5xx filtra nombres de tablas, restricciones y detalles de
  // infraestructura. Se conserva en logs para diagnóstico operativo.
  if (failure.statusCode >= 500 && typeof failure.detail === "string") {
    logger.error("service_request_failed", {
      statusCode: failure.statusCode,
      error: failure.error,
      detail: redactFailureDetail(failure.detail),
    });

    const { detail: _internalDetail, ...publicFailure } = failure;
    return reply.code(failure.statusCode).send(publicFailure);
  }

  return reply.code(failure.statusCode).send(failure);
}

export async function buildApp(): Promise<FastifyInstance> {
  const env = loadApiEnv(process.env);
  const app = Fastify({
    // SQO-00/SQO-02 (R-014): Fastify ya trae pino y ya no logea headers por
    // defecto (verificado), pero cualquier log futuro que incluya
    // request.headers/body a mano no deberia poder filtrar secretos -- estas
    // rutas se redactan pase lo que pase, en logs de request y en cualquier
    // objeto logueado con esta forma.
    logger: {
      redact: {
        paths: [
          "req.headers.authorization",
          "req.headers.cookie",
          "req.headers['x-internal-secret']",
          "headers.authorization",
          "headers.cookie",
          "*.access_token",
          "*.refresh_token",
          "*.client_secret",
          "*.api_key",
          "*.service_role_key",
        ],
        censor: "[REDACTED]",
      },
    },
    genReqId: (request) =>
      request.headers["x-request-id"]?.toString() ?? crypto.randomUUID(),
  });

  await app.register(cors, {
    origin: env.WEB_ORIGIN,
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"],
    // SQO-02: sin exponerla, el navegador no puede leer `x-request-id` en una
    // respuesta cross-origin, asi que la cabecera solo servia si ya estabas
    // mirando los logs del servidor -- justo lo contrario de lo que hace falta
    // cuando un cliente reporta un error y hay que encontrarlo.
    exposedHeaders: ["x-request-id"],
  });

  // SQO-00: cabeceras de seguridad. API pura JSON (nunca sirve HTML), asi que
  // desactivamos la CSP de helmet (pensada para paginas) y dejamos el resto
  // de cabeceras por defecto (X-Content-Type-Options, X-Frame-Options,
  // Referrer-Policy, HSTS, etc.).
  await app.register(helmet, {
    contentSecurityPolicy: false,
  });

  // SQO-00 (gap real: "sin rate limiting a nivel de endpoint"). Limite
  // global generoso como red de seguridad basica, mas limites estrictos por
  // organizacion en los endpoints de IA (los caros de verdad, ver AI-00
  // budget por run -- esto limita frecuencia, no coste por run). `skipOnError`
  // evita que un fallo del store de rate limit tumbe la API entera.
  // Store en Redis si `REDIS_URL` esta configurado (necesario en serverless,
  // donde el estado en memoria no persiste entre invocaciones); en memoria
  // como fallback para desarrollo local.
  // @fastify/rate-limit no cierra un cliente de Redis que le pasamos nosotros
  // (asume que lo administramos externamente) -- sin este hook, `app.close()`
  // deja la conexion abierta y el proceso nunca termina limpio ante SIGTERM
  // (encontrado escribiendo be-01-cross-tenant-route-manipulation.test.ts:
  // el test colgaba indefinidamente en el cleanup, no en las aserciones).
  // `retryStrategy: () => null` (2026-07-29, mismo hallazgo repetido en la
  // misma suite): sin esto, si `.disconnect()` corre mientras la conexion
  // inicial todavia se esta estableciendo, ioredis puede dejar programado un
  // reintento de reconexion que abre un socket nuevo *despues* del
  // disconnect() -- confirmado con diagnostico real (`process._getActiveHandles()`
  // mostraba 2 sockets huerfanos tras `app.close()` incluso sin ninguna
  // request de por medio). Mismo patron que ya usaba `redis-cache.ts`.
  const rateLimitRedis = env.REDIS_URL
    ? new Redis(env.REDIS_URL, {
        maxRetriesPerRequest: null,
        enableOfflineQueue: false,
        retryStrategy: () => null,
      })
    : undefined;

  if (rateLimitRedis) {
    // ioredis emits connection failures asynchronously. Register the listener
    // immediately so a missing/unreachable Redis in local CI never becomes an
    // unhandled error event; @fastify/rate-limit will use its configured
    // skipOnError fallback for the request.
    rateLimitRedis.on("error", (error: Error) => {
      logger.error("rate_limit_redis_unavailable_using_fallback", error);
    });
    app.addHook("onClose", async () => {
      rateLimitRedis.disconnect();
    });
  }

  await app.register(rateLimit, {
    global: true,
    max: 120,
    timeWindow: "1 minute",
    skipOnError: true,
    redis: rateLimitRedis,
  });

  const aiEndpointRateLimit = {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: "1 minute",
        keyGenerator: (request: { params: unknown; ip: string }) =>
          (request.params as { organizationId?: string } | undefined)
            ?.organizationId ?? request.ip,
      },
    },
  };

  // SQO-02 (R-014): la mayoria de rutas (62 de las de abajo) llevan
  // `:organizationId` en el path. Sin esto, diagnosticar "los pedidos de esta
  // organizacion no aparecen" exigia leer codigo y consultar la DB a mano --
  // los logs JSON de pino no tenian forma de filtrar por organizacion. Un
  // child logger con `organization_id` fijado aqui (route params ya estan
  // parseados en `onRequest`) hace que todo log posterior de la misma
  // request (incluido el log automatico de fin de request de Fastify) lo
  // incluya, sin tocar cada handler uno a uno. `user_id` (2026-07-23) se
  // extrae del JWT sin verificar -- solo para poder filtrar logs por usuario,
  // no como decision de autorizacion.
  app.addHook("onRequest", async (request, reply) => {
    // SQO-02: permite correlacionar el error que ve el cliente con los logs
    // JSON de Fastify sin incluir datos de negocio en la respuesta.
    reply.header("x-request-id", request.id);

    const organizationId = (
      request.params as { organizationId?: string } | undefined
    )?.organizationId;
    const userId = decodeJwtSubject(request.headers.authorization);
    const bindings: Record<string, string> = {};

    if (organizationId) {
      bindings.organization_id = organizationId;
    }
    if (userId) {
      bindings.user_id = userId;
    }

    if (Object.keys(bindings).length > 0) {
      request.log = request.log.child(bindings);
    }
  });

  // INT-00: el allowlist de integraciones es una guarda de runtime, no solo
  // una señal visual del catálogo. Mantenerla aquí evita que un cliente llame
  // directamente a OAuth/sync/metrics cuando el proveedor está desactivado.
  app.addHook("onRequest", async (request, reply) => {
    const path = (request.url ?? "").split("?")[0] ?? "";
    const provider = path.includes("/meta/")
      ? "meta_ads"
      : path.includes("/klaviyo/")
        ? "klaviyo"
        : null;
    if (
      provider &&
      !isIntegrationFeatureEnabled(provider, env.INTEGRATION_FEATURE_FLAGS)
    ) {
      return reply.code(404).send({
        error: "integration_feature_disabled",
        provider,
      });
    }
  });

  // El "request completed" automatico de Fastify usa el logger capturado al
  // crear la request, antes de que corra el onRequest de arriba -- nunca
  // lleva organization_id/user_id aunque el resto de logs de la misma
  // request si (confirmado en vivo con app.inject). Este resumen explicito
  // en onResponse si usa el logger ya enriquecido, para que exista al menos
  // una linea por request filtrable por organizacion o usuario sin tener que
  // buscar en logs internos.
  app.addHook("onResponse", async (request, reply) => {
    const route =
      request.routeOptions.url ?? request.url.split("?")[0] ?? "unknown";
    apiMetrics.increment("http_requests_total", {
      method: request.method,
      route,
      status_code: reply.statusCode,
    });
    apiMetrics.observe(
      "http_request_duration_ms",
      {
        method: request.method,
        route,
        status_code: reply.statusCode,
      },
      reply.elapsedTime,
      [5, 10, 25, 50, 100, 250, 500, 1_000, 2_500, 5_000],
    );

    const organizationId = (
      request.params as { organizationId?: string } | undefined
    )?.organizationId;
    const userId = decodeJwtSubject(request.headers.authorization);

    if (organizationId || userId) {
      request.log.info(
        { statusCode: reply.statusCode, responseTimeMs: reply.elapsedTime },
        "request_completed_with_org",
      );
    }
  });

  // BE-00: /health (y su alias /health/live) es liveness -- responde "ok" en
  // cuanto el proceso esta arriba, sin tocar dependencias. Es lo que decide
  // si un orquestador debe reiniciar el contenedor: si el proceso puede
  // responder HTTP, reiniciarlo no arreglaria nada. Se mantiene sin cambios
  // de comportamiento porque el HEALTHCHECK de apps/api/Dockerfile ya
  // apunta aqui.
  app.get("/health", async () =>
    healthResponseSchema.parse({
      status: "ok",
      service: "api",
      timestamp: new Date().toISOString(),
    }),
  );

  app.get("/health/live", async () =>
    healthResponseSchema.parse({
      status: "ok",
      service: "api",
      timestamp: new Date().toISOString(),
    }),
  );

  app.get("/health/metrics", async (request, reply) => {
    if (!env.INTERNAL_API_SECRET) {
      return reply
        .code(503)
        .send({ error: "internal_api_secret_not_configured" });
    }

    if (request.headers["x-internal-secret"] !== env.INTERNAL_API_SECRET) {
      return reply.code(401).send({ error: "invalid_internal_secret" });
    }

    return reply
      .type("text/plain; version=0.0.4; charset=utf-8")
      .send(`${apiMetrics.toPrometheus()}\n`);
  });

  app.get("/health/slo", async (request, reply) => {
    if (!env.INTERNAL_API_SECRET) {
      return reply
        .code(503)
        .send({ error: "internal_api_secret_not_configured" });
    }
    if (request.headers["x-internal-secret"] !== env.INTERNAL_API_SECRET) {
      return reply.code(401).send({ error: "invalid_internal_secret" });
    }
    return evaluateHttpSlo(apiMetrics.snapshot());
  });

  // Readiness: puede el proceso servir trafico de verdad ahora mismo. A
  // diferencia de liveness, esto si toca dependencias externas y puede
  // fallar sin que el proceso este roto (Supabase caido, Redis caido) --
  // es la senal que decide si un balanceador debe sacar esta instancia del
  // pool, no si debe reiniciarla.
  app.get("/health/ready", async (_request, reply) => {
    const checks = await checkReadiness(env);
    const degraded = checks.supabase !== "ok" || checks.redis === "error";

    if (degraded) {
      reply.code(503);
    }

    return readinessResponseSchema.parse({
      status: degraded ? "degraded" : "ok",
      service: "api",
      timestamp: new Date().toISOString(),
      checks,
    });
  });

  app.get("/v1/bootstrap", async (request, reply) => {
    const result = await resolveAuthContext(env, request.headers.authorization);

    if (isAuthContextError(result)) {
      return sendAuthFailure(reply, result.error);
    }

    return result.context;
  });

  // Estado público del runtime para que la UI pueda explicar la ausencia de
  // credenciales sin exponer claves ni obligar al usuario a descubrirlo al
  // enviar el primer brief.
  app.get("/v1/ai/status", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) {
      return sendAuthFailure(reply, auth.error);
    }

    return {
      configured: Boolean(env.ANTHROPIC_API_KEY || env.OPENAI_API_KEY),
      primary_provider: env.ANTHROPIC_API_KEY
        ? "anthropic"
        : env.OPENAI_API_KEY
          ? "openai"
          : null,
    } as const;
  });

  app.get("/v1/actions", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);

    if (isAuthContextError(auth)) {
      return sendAuthFailure(reply, auth.error);
    }

    const authorization = request.headers.authorization;

    if (!authorization) {
      return reply.code(401).send({ error: "missing_bearer_token" });
    }

    const result = await listAccountActions(env, authorization, auth.context);

    if (isServiceFailure(result)) {
      return sendServiceFailure(reply, result);
    }

    return result.data;
  });

  app.get("/v1/consultant/organizations", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);

    if (isAuthContextError(auth)) {
      return sendAuthFailure(reply, auth.error);
    }

    const authorization = request.headers.authorization;

    if (!authorization) {
      return reply.code(401).send({ error: "missing_bearer_token" });
    }

    const result = await listConsultantOrganizations(
      env,
      authorization,
      auth.context,
    );

    if (isServiceFailure(result)) {
      return sendServiceFailure(reply, result);
    }

    return result.data;
  });

  app.get<{ Querystring: { days?: string } }>(
    "/v1/consultant/overview",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const authorization = request.headers.authorization;
      if (!authorization) {
        return reply.code(401).send({ error: "missing_bearer_token" });
      }

      const result = await getConsultantOverview(
        env,
        authorization,
        auth.context,
        Number(request.query.days ?? "30"),
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.get("/v1/consultant/marketing", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);

    if (isAuthContextError(auth)) {
      return sendAuthFailure(reply, auth.error);
    }

    const authorization = request.headers.authorization;
    if (!authorization) {
      return reply.code(401).send({ error: "missing_bearer_token" });
    }

    const result = await listConsultantMarketing(
      env,
      authorization,
      auth.context,
    );

    if (isServiceFailure(result)) {
      return sendServiceFailure(reply, result);
    }

    return result.data;
  });

  app.get<{ Params: { organizationId: string; draftId: string } }>(
    "/v1/organizations/:organizationId/marketing/drafts/:draftId/notes",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const authorization = request.headers.authorization;
      if (!authorization) {
        return reply.code(401).send({ error: "missing_bearer_token" });
      }

      const result = await listMarketingDraftNotes(
        env,
        authorization,
        auth.context,
        request.params.organizationId,
        request.params.draftId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string; draftId: string };
    Body: { body?: string };
  }>(
    "/v1/organizations/:organizationId/marketing/drafts/:draftId/notes",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await addMarketingDraftNote(
        env,
        auth.context,
        request.params.organizationId,
        request.params.draftId,
        request.body ?? {},
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return reply.code(201).send(result.data);
    },
  );

  app.get("/v1/consultant/knowledge", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);

    if (isAuthContextError(auth)) {
      return sendAuthFailure(reply, auth.error);
    }

    const authorization = request.headers.authorization;
    if (!authorization) {
      return reply.code(401).send({ error: "missing_bearer_token" });
    }

    const result = await listConsultantKnowledge(
      env,
      authorization,
      auth.context,
    );

    if (isServiceFailure(result)) {
      return sendServiceFailure(reply, result);
    }

    return result.data;
  });

  app.get("/v1/consultant/stores", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);

    if (isAuthContextError(auth)) {
      return sendAuthFailure(reply, auth.error);
    }

    const authorization = request.headers.authorization;
    if (!authorization) {
      return reply.code(401).send({ error: "missing_bearer_token" });
    }

    const result = await listConsultantStores(env, authorization, auth.context);

    if (isServiceFailure(result)) {
      return sendServiceFailure(reply, result);
    }

    return result.data;
  });

  app.get("/v1/consultant/integrations", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);

    if (isAuthContextError(auth)) {
      return sendAuthFailure(reply, auth.error);
    }

    const authorization = request.headers.authorization;
    if (!authorization) {
      return reply.code(401).send({ error: "missing_bearer_token" });
    }

    const result = await listConsultantIntegrations(
      env,
      authorization,
      auth.context,
    );

    if (isServiceFailure(result)) {
      return sendServiceFailure(reply, result);
    }

    return result.data;
  });

  app.get("/v1/consultant/calls", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);

    if (isAuthContextError(auth)) {
      return sendAuthFailure(reply, auth.error);
    }

    const authorization = request.headers.authorization;
    if (!authorization) {
      return reply.code(401).send({ error: "missing_bearer_token" });
    }

    const result = await listConsultantCalls(env, authorization, auth.context);

    if (isServiceFailure(result)) {
      return sendServiceFailure(reply, result);
    }

    return result.data;
  });

  app.get("/v1/consultant/plans", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);

    if (isAuthContextError(auth)) {
      return sendAuthFailure(reply, auth.error);
    }

    const authorization = request.headers.authorization;
    if (!authorization) {
      return reply.code(401).send({ error: "missing_bearer_token" });
    }

    const result = await listConsultantPlans(env, authorization, auth.context);

    if (isServiceFailure(result)) {
      return sendServiceFailure(reply, result);
    }

    return result.data;
  });

  app.get("/v1/consultant/operations", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);

    if (isAuthContextError(auth)) {
      return sendAuthFailure(reply, auth.error);
    }

    const authorization = request.headers.authorization;
    if (!authorization) {
      return reply.code(401).send({ error: "missing_bearer_token" });
    }

    const result = await listConsultantOperations(
      env,
      authorization,
      auth.context,
    );

    if (isServiceFailure(result)) {
      return sendServiceFailure(reply, result);
    }

    return result.data;
  });

  app.get("/v1/admin/consultants", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);

    if (isAuthContextError(auth)) {
      return sendAuthFailure(reply, auth.error);
    }

    const result = await listConsultants(env, auth.context);

    if (isServiceFailure(result)) {
      return sendServiceFailure(reply, result);
    }

    return result.data;
  });

  app.get<{ Params: { organizationId: string } }>(
    "/v1/consultant/organizations/:organizationId/access",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await getOrganizationAccess(
        env,
        auth.context,
        request.params.organizationId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.put<{
    Params: { organizationId: string };
    Body: { user_id?: string; role?: string; is_active?: boolean };
  }>(
    "/v1/consultant/organizations/:organizationId/members",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await upsertOrganizationMember(
        env,
        auth.context,
        request.params.organizationId,
        request.body ?? {},
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string };
    Body: {
      connectionId?: string;
      type?:
        | "campaign-values-report"
        | "flow-values-report"
        | "form-values-report"
        | "segment-values-report";
      statistics?: string[];
      periodStart?: string;
      periodEnd?: string;
      filter?: string;
      group_by?: string[];
      interval?: "hourly" | "daily" | "weekly" | "monthly";
    };
  }>(
    "/v1/organizations/:organizationId/klaviyo/reporting",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const body = request.body ?? {};
      if (
        !body.connectionId ||
        !body.type ||
        !body.statistics?.length ||
        !body.periodStart ||
        !body.periodEnd
      ) {
        return reply
          .code(400)
          .send({ error: "invalid_klaviyo_reporting_request" });
      }
      if (
        !auth.context.memberships.some(
          (item) => item.organization_id === request.params.organizationId,
        )
      ) {
        return reply.code(403).send({ error: "organization_access_denied" });
      }
      try {
        const result = await runKlaviyoReport(
          env,
          request.params.organizationId,
          body.connectionId,
          {
            type: body.type,
            statistics: body.statistics,
            periodStart: body.periodStart,
            periodEnd: body.periodEnd,
            ...(body.filter ? { filter: body.filter } : {}),
            ...(body.group_by ? { group_by: body.group_by } : {}),
            ...(body.interval ? { interval: body.interval } : {}),
          },
        );
        return result;
      } catch (error) {
        return reply.code(502).send({
          error: "klaviyo_reporting_failed",
          detail: error instanceof Error ? error.message : "unknown_error",
        });
      }
    },
  );

  app.get<{
    Params: { organizationId: string };
    Querystring: { connectionId?: string; limit?: string };
  }>(
    "/v1/organizations/:organizationId/klaviyo/reporting",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      if (
        !auth.context.memberships.some(
          (item) => item.organization_id === request.params.organizationId,
        )
      ) {
        return reply.code(403).send({ error: "organization_access_denied" });
      }
      if (!request.query.connectionId) {
        return reply.code(400).send({ error: "missing_klaviyo_connection_id" });
      }
      try {
        return await listKlaviyoReports(
          env,
          request.params.organizationId,
          request.query.connectionId,
          Number(request.query.limit ?? 25),
        );
      } catch (error) {
        return reply.code(502).send({
          error: "klaviyo_reporting_load_failed",
          detail: error instanceof Error ? error.message : "unknown_error",
        });
      }
    },
  );

  app.put<{
    Params: { organizationId: string };
    Body: {
      consultant_user_id?: string;
      is_primary?: boolean;
      is_active?: boolean;
    };
  }>(
    "/v1/consultant/organizations/:organizationId/assignments",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await upsertConsultantAssignment(
        env,
        auth.context,
        request.params.organizationId,
        request.body ?? {},
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  // CRUD de consultoria: tiendas de un cliente, borrar tienda, borrar cliente
  // entero. Las escrituras (borrados) son solo platform_admin (irreversibles).
  app.get<{ Params: { organizationId: string } }>(
    "/v1/consultant/organizations/:organizationId/stores",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const authorization = request.headers.authorization;

      if (!authorization) {
        return reply.code(401).send({ error: "missing_bearer_token" });
      }

      const result = await listOrganizationStores(
        env,
        authorization,
        auth.context,
        request.params.organizationId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.delete<{ Params: { organizationId: string; connectionId: string } }>(
    "/v1/consultant/organizations/:organizationId/stores/:connectionId",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await deleteOrganizationStore(
        env,
        auth.context,
        request.params.organizationId,
        request.params.connectionId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.post<{ Params: { organizationId: string; connectionId: string } }>(
    "/v1/consultant/organizations/:organizationId/stores/:connectionId/restore",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await restoreOrganizationStore(
        env,
        auth.context,
        request.params.organizationId,
        request.params.connectionId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.delete<{ Params: { organizationId: string } }>(
    "/v1/consultant/organizations/:organizationId",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await deleteOrganization(
        env,
        auth.context,
        request.params.organizationId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.post<{ Params: { organizationId: string } }>(
    "/v1/consultant/organizations/:organizationId/restore",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await restoreOrganization(
        env,
        auth.context,
        request.params.organizationId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.patch<{
    Params: { organizationId: string };
    Body: {
      display_name?: string;
      status?: string;
      timezone?: string;
      currency_code?: string;
    };
  }>("/v1/consultant/organizations/:organizationId", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);

    if (isAuthContextError(auth)) {
      return sendAuthFailure(reply, auth.error);
    }

    const result = await updateOrganization(
      env,
      auth.context,
      request.params.organizationId,
      request.body ?? {},
    );

    if (isServiceFailure(result)) {
      return sendServiceFailure(reply, result);
    }

    return result.data;
  });

  app.get<{ Params: { organizationId: string } }>(
    "/v1/organizations/:organizationId/integrations",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const authorization = request.headers.authorization;

      if (!authorization) {
        return reply.code(401).send({ error: "missing_bearer_token" });
      }

      const result = await listIntegrations(
        env,
        authorization,
        auth.context,
        request.params.organizationId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.get<{
    Params: { organizationId: string };
    Querystring: { connectionId?: string };
  }>(
    "/v1/organizations/:organizationId/shopify/overview",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const authorization = request.headers.authorization;

      if (!authorization) {
        return reply.code(401).send({ error: "missing_bearer_token" });
      }

      const result = await getShopifyOverview(
        env,
        authorization,
        auth.context,
        request.params.organizationId,
        request.query.connectionId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  // Lista liviana de conexiones, para el selector de tienda del header global
  // (evita pedir el overview completo -- ~20 queries de conteo -- en cada
  // cambio de cliente activo).
  app.get<{ Params: { organizationId: string } }>(
    "/v1/organizations/:organizationId/shopify/connections",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const authorization = request.headers.authorization;

      if (!authorization) {
        return reply.code(401).send({ error: "missing_bearer_token" });
      }

      const result = await getShopifyConnections(
        env,
        authorization,
        auth.context,
        request.params.organizationId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.get<{
    Params: { organizationId: string };
    Querystring: { days?: string; connectionId?: string };
  }>(
    "/v1/organizations/:organizationId/shopify/metrics",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const authorization = request.headers.authorization;

      if (!authorization) {
        return reply.code(401).send({ error: "missing_bearer_token" });
      }

      const result = await getShopifyMetrics(
        env,
        authorization,
        auth.context,
        request.params.organizationId,
        request.query.days,
        request.query.connectionId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.get<{ Params: { organizationId: string } }>(
    "/v1/organizations/:organizationId/shopify/product-costs",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const authorization = request.headers.authorization;

      if (!authorization) {
        return reply.code(401).send({ error: "missing_bearer_token" });
      }

      const result = await listProductCosts(
        env,
        authorization,
        auth.context,
        request.params.organizationId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string };
    Body: {
      sku?: string;
      inventoryItemId?: string;
      unitCost: number;
      currencyCode?: string;
      validFrom?: string;
    };
  }>(
    "/v1/organizations/:organizationId/shopify/product-costs",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await upsertProductCost(
        env,
        auth.context,
        request.params.organizationId,
        request.body,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return reply.code(201).send(result.data);
    },
  );

  app.get<{ Params: { organizationId: string } }>(
    "/v1/organizations/:organizationId/financial-config",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const authorization = request.headers.authorization;

      if (!authorization) {
        return reply.code(401).send({ error: "missing_bearer_token" });
      }

      const result = await getFinancialConfig(
        env,
        authorization,
        auth.context,
        request.params.organizationId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.put<{
    Params: { organizationId: string };
    Body: {
      currencyCode?: string;
      paymentFeePct?: number;
      paymentFeeFixed?: number;
      defaultShippingCost?: number;
      vatPct?: number;
      notes?: string | null;
    };
  }>(
    "/v1/organizations/:organizationId/financial-config/settings",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await upsertFinancialSettings(
        env,
        auth.context,
        request.params.organizationId,
        request.body ?? {},
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string };
    Body: {
      name?: string;
      category?: string | null;
      amount?: number;
      currencyCode?: string;
      billingPeriod?: string;
      validFrom?: string;
      validUntil?: string | null;
    };
  }>(
    "/v1/organizations/:organizationId/financial-config/fixed-expenses",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await createFixedExpense(
        env,
        auth.context,
        request.params.organizationId,
        request.body ?? {},
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return reply.code(201).send(result.data);
    },
  );

  app.delete<{ Params: { organizationId: string; expenseId: string } }>(
    "/v1/organizations/:organizationId/financial-config/fixed-expenses/:expenseId",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await deactivateFixedExpense(
        env,
        auth.context,
        request.params.organizationId,
        request.params.expenseId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string };
    Body: {
      name?: string;
      countryCode?: string | null;
      costPerOrder?: number;
      currencyCode?: string;
      minOrderTotal?: number;
      maxOrderTotal?: number | null;
    };
  }>(
    "/v1/organizations/:organizationId/financial-config/shipping-rules",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await createShippingRule(
        env,
        auth.context,
        request.params.organizationId,
        request.body ?? {},
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return reply.code(201).send(result.data);
    },
  );

  app.delete<{ Params: { organizationId: string; ruleId: string } }>(
    "/v1/organizations/:organizationId/financial-config/shipping-rules/:ruleId",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await deactivateShippingRule(
        env,
        auth.context,
        request.params.organizationId,
        request.params.ruleId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string };
    Body: { shopDomain: string; appMode?: "public" | "custom" };
  }>(
    "/v1/organizations/:organizationId/integrations/shopify/connect",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      if (!request.body?.shopDomain) {
        return reply.code(400).send({ error: "missing_shop_domain" });
      }

      const result = await createShopifyConnectionAuthUrl(
        env,
        auth.context,
        request.params.organizationId,
        request.body.shopDomain,
        request.body.appMode === "custom" ? "custom" : "public",
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string };
    Querystring: { connectionId?: string };
  }>(
    "/v1/organizations/:organizationId/shopify/sync",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await triggerShopifySync(
        env,
        auth.context,
        request.params.organizationId,
        request.query.connectionId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return reply.code(202).send(result.data);
    },
  );

  app.post<{ Params: { organizationId: string } }>(
    "/v1/organizations/:organizationId/integrations/meta/connect",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await createMetaConnectionAuthUrl(
        env,
        auth.context,
        request.params.organizationId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.post<{ Params: { organizationId: string } }>(
    "/v1/organizations/:organizationId/integrations/klaviyo/connect",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await createKlaviyoConnectionAuthUrl(
        env,
        auth.context,
        request.params.organizationId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string };
    Body: { apiKey?: string };
  }>(
    "/v1/organizations/:organizationId/integrations/klaviyo/connect-api-key",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const apiKey = request.body?.apiKey;
      if (typeof apiKey !== "string" || !apiKey.trim()) {
        return reply.code(400).send({ error: "missing_klaviyo_api_key" });
      }
      const result = await connectKlaviyoWithApiKey(
        env,
        auth.context,
        request.params.organizationId,
        apiKey,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.get<{ Params: { organizationId: string } }>(
    "/v1/organizations/:organizationId/klaviyo/templates",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await listKlaviyoTemplates(
        env,
        auth.context,
        request.params.organizationId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.get<{
    Params: { organizationId: string; templateId: string };
  }>(
    "/v1/organizations/:organizationId/klaviyo/templates/:templateId/preview",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await previewKlaviyoTemplate(
        env,
        auth.context,
        request.params.organizationId,
        request.params.templateId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string };
    Body: { templateId?: string };
  }>(
    "/v1/organizations/:organizationId/klaviyo/templates/import",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const templateId = request.body?.templateId;
      if (typeof templateId !== "string" || !templateId.trim()) {
        return reply.code(400).send({ error: "missing_template_id" });
      }
      const result = await importKlaviyoTemplate(
        env,
        auth.context,
        request.params.organizationId,
        templateId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return reply.code(201).send(result.data);
    },
  );

  app.get<{ Params: { organizationId: string } }>(
    "/v1/organizations/:organizationId/klaviyo/metrics",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await listKlaviyoConversionMetrics(
        env,
        auth.context,
        request.params.organizationId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.get<{
    Params: { organizationId: string };
    Querystring: { days?: string };
  }>(
    "/v1/organizations/:organizationId/klaviyo/email-report",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await getKlaviyoEmailReport(
        env,
        auth.context,
        request.params.organizationId,
        request.query.days,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string };
    Querystring: { connectionId?: string };
  }>(
    "/v1/organizations/:organizationId/klaviyo/sync",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await triggerKlaviyoSync(
        env,
        auth.context,
        request.params.organizationId,
        request.query.connectionId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return reply.code(202).send(result.data);
    },
  );

  app.put<{
    Params: { organizationId: string };
    Body: {
      metricId?: string;
      source?: "shopify" | "klaviyo" | "custom" | "other";
    };
  }>(
    "/v1/organizations/:organizationId/klaviyo/conversion-metric",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await selectKlaviyoConversionMetric(
        env,
        auth.context,
        request.params.organizationId,
        request.body?.metricId ?? "",
        request.body?.source ?? "klaviyo",
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.get("/v1/meta/oauth/callback", async (request, reply) => {
    const result = await handleMetaOAuthCallback(
      env,
      request.query as Record<string, string | string[] | undefined>,
    );

    if (isServiceFailure(result)) {
      return sendServiceFailure(reply, result);
    }

    return reply.redirect(result.data.redirectUrl);
  });

  app.get("/v1/klaviyo/oauth/callback", async (request, reply) => {
    const result = await handleKlaviyoOAuthCallback(
      env,
      request.query as Record<string, string | string[] | undefined>,
    );

    if (isServiceFailure(result)) {
      return sendServiceFailure(reply, result);
    }

    return reply.redirect(result.data.redirectUrl);
  });

  app.get<{ Params: { organizationId: string } }>(
    "/v1/organizations/:organizationId/meta/assets",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await listMetaAssets(
        env,
        auth.context,
        request.params.organizationId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.put<{
    Params: { organizationId: string };
    Body: { businessIds?: unknown; pageIds?: unknown; adAccountIds?: unknown };
  }>(
    "/v1/organizations/:organizationId/meta/assets/selection",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await updateMetaAssetSelection(
        env,
        auth.context,
        request.params.organizationId,
        request.body ?? {},
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.get<{ Params: { organizationId: string } }>(
    "/v1/organizations/:organizationId/meta/purchase-action-types",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await listMetaPurchaseActionTypes(
        env,
        auth.context,
        request.params.organizationId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.put<{
    Params: { organizationId: string };
    Body: { adAccountId?: string; actionType?: string };
  }>(
    "/v1/organizations/:organizationId/meta/purchase-action-types",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await selectMetaPurchaseActionType(
        env,
        auth.context,
        request.params.organizationId,
        request.body?.adAccountId ?? "",
        request.body?.actionType ?? "",
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string };
    Body: Record<string, unknown>;
  }>(
    "/v1/organizations/:organizationId/meta/ad-creation-plan",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = prepareMetaAdCreationPlan(
        auth.context,
        request.params.organizationId,
        request.body ?? {},
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.get<{
    Params: { organizationId: string };
    Querystring: { days?: string };
  }>(
    "/v1/organizations/:organizationId/meta/metrics",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const authorization = request.headers.authorization;

      if (!authorization) {
        return reply.code(401).send({ error: "missing_bearer_token" });
      }

      const result = await getMetaMetrics(
        env,
        authorization,
        auth.context,
        request.params.organizationId,
        request.query.days,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.post<{ Params: { organizationId: string } }>(
    "/v1/organizations/:organizationId/meta/sync",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await triggerMetaSync(
        env,
        auth.context,
        request.params.organizationId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return reply.code(202).send(result.data);
    },
  );

  app.get<{ Params: { organizationId: string } }>(
    "/v1/organizations/:organizationId/operations",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const authorization = request.headers.authorization;

      if (!authorization) {
        return reply.code(401).send({ error: "missing_bearer_token" });
      }

      const result = await listOperations(
        env,
        authorization,
        auth.context,
        request.params.organizationId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.post<{ Params: { organizationId: string } }>(
    "/v1/organizations/:organizationId/operations/run-rules",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await evaluateAlertRules(
        env,
        auth.context,
        request.params.organizationId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string };
    Body: {
      title?: string;
      description?: string;
      priority?: string;
      category?: string;
      dueAt?: string;
      isVisibleToClient?: boolean;
    };
  }>(
    "/v1/organizations/:organizationId/tasks",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await createTask(
        env,
        auth.context,
        request.params.organizationId,
        request.body ?? {},
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return reply.code(201).send(result.data);
    },
  );

  app.patch<{
    Params: { organizationId: string; taskId: string };
    Body: { status?: string; reason?: string };
  }>(
    "/v1/organizations/:organizationId/tasks/:taskId/status",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await updateTaskStatus(
        env,
        auth.context,
        request.params.organizationId,
        request.params.taskId,
        request.body?.status,
        request.body?.reason,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string; taskId: string };
    Body: { body?: string; isInternal?: boolean };
  }>(
    "/v1/organizations/:organizationId/tasks/:taskId/comments",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await addTaskComment(
        env,
        auth.context,
        request.params.organizationId,
        request.params.taskId,
        request.body?.body,
        request.body?.isInternal,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return reply.code(201).send(result.data);
    },
  );

  app.patch<{
    Params: { organizationId: string; alertId: string };
    Body: { status?: string };
  }>(
    "/v1/organizations/:organizationId/alerts/:alertId/status",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await updateAlertStatus(
        env,
        auth.context,
        request.params.organizationId,
        request.params.alertId,
        request.body?.status,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.get<{ Querystring: { status?: string } }>(
    "/v1/notifications",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const authorization = request.headers.authorization;

      if (!authorization) {
        return reply.code(401).send({ error: "missing_bearer_token" });
      }

      const result = await listNotifications(
        env,
        authorization,
        request.query?.status,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.patch<{ Params: { notificationId: string }; Body: { status?: string } }>(
    "/v1/notifications/:notificationId/status",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const authorization = request.headers.authorization;

      if (!authorization) {
        return reply.code(401).send({ error: "missing_bearer_token" });
      }

      const result = await updateNotificationStatus(
        env,
        authorization,
        request.params.notificationId,
        request.body?.status,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.post("/v1/notifications/read-all", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);

    if (isAuthContextError(auth)) {
      return sendAuthFailure(reply, auth.error);
    }

    const authorization = request.headers.authorization;

    if (!authorization) {
      return reply.code(401).send({ error: "missing_bearer_token" });
    }

    const result = await markAllNotificationsRead(env, authorization);

    if (isServiceFailure(result)) {
      return sendServiceFailure(reply, result);
    }

    return result.data;
  });

  app.get<{ Params: { organizationId: string } }>(
    "/v1/organizations/:organizationId/strategic-plan",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const authorization = request.headers.authorization;

      if (!authorization) {
        return reply.code(401).send({ error: "missing_bearer_token" });
      }

      const result = await getStrategicPlan(
        env,
        authorization,
        auth.context,
        request.params.organizationId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string };
    Body: {
      name?: string;
      description?: string | null;
      phases?: Array<{
        name?: string;
        description?: string | null;
        milestones?: Array<{
          name?: string;
          description?: string | null;
          targetDate?: string | null;
        }>;
      }>;
    };
  }>(
    "/v1/organizations/:organizationId/strategic-plan",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await createStrategicPlan(
        env,
        auth.context,
        request.params.organizationId,
        request.body ?? {},
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return reply.code(201).send(result.data);
    },
  );

  app.post<{
    Params: { organizationId: string; planId: string };
    Body: { name?: string; description?: string | null };
  }>(
    "/v1/organizations/:organizationId/strategic-plan/:planId/phases",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await createPhase(
        env,
        auth.context,
        request.params.organizationId,
        request.params.planId,
        {
          name: request.body?.name,
          description: request.body?.description,
        },
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return reply.code(201).send(result.data);
    },
  );

  app.patch<{
    Params: { organizationId: string; planId: string };
    Body: { orderedIds?: string[] };
  }>(
    "/v1/organizations/:organizationId/strategic-plan/:planId/phases/reorder",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await reorderPhases(
        env,
        auth.context,
        request.params.organizationId,
        request.params.planId,
        request.body?.orderedIds,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.patch<{
    Params: { organizationId: string; phaseId: string };
    Body: { orderedIds?: string[] };
  }>(
    "/v1/organizations/:organizationId/strategic-plan/phases/:phaseId/milestones/reorder",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await reorderMilestones(
        env,
        auth.context,
        request.params.organizationId,
        request.params.phaseId,
        request.body?.orderedIds,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string; phaseId: string };
    Body: {
      name?: string;
      description?: string | null;
      targetDate?: string | null;
    };
  }>(
    "/v1/organizations/:organizationId/strategic-plan/phases/:phaseId/milestones",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await createMilestone(
        env,
        auth.context,
        request.params.organizationId,
        request.params.phaseId,
        {
          name: request.body?.name,
          description: request.body?.description,
          targetDate: request.body?.targetDate,
        },
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return reply.code(201).send(result.data);
    },
  );

  app.post<{ Params: { organizationId: string; planId: string } }>(
    "/v1/organizations/:organizationId/strategic-plan/:planId/activate",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await activateStrategicPlan(
        env,
        auth.context,
        request.params.organizationId,
        request.params.planId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.patch<{
    Params: { organizationId: string; milestoneId: string };
    Body: { status?: string };
  }>(
    "/v1/organizations/:organizationId/milestones/:milestoneId/status",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await updateMilestoneStatus(
        env,
        auth.context,
        request.params.organizationId,
        request.params.milestoneId,
        request.body?.status,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.get<{ Params: { organizationId: string; milestoneId: string } }>(
    "/v1/organizations/:organizationId/milestones/:milestoneId/internal-notes",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const authorization = request.headers.authorization;
      if (!authorization) {
        return reply.code(401).send({ error: "missing_bearer_token" });
      }

      const result = await getMilestoneInternalNotes(
        env,
        authorization,
        auth.context,
        request.params.organizationId,
        request.params.milestoneId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string; milestoneId: string };
    Body: { body?: string };
  }>(
    "/v1/organizations/:organizationId/milestones/:milestoneId/internal-notes",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await addMilestoneInternalNote(
        env,
        auth.context,
        request.params.organizationId,
        request.params.milestoneId,
        request.body?.body,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return reply.code(201).send(result.data);
    },
  );

  app.get<{ Params: { organizationId: string } }>(
    "/v1/organizations/:organizationId/objectives",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const authorization = request.headers.authorization;
      if (!authorization) {
        return reply.code(401).send({ error: "missing_bearer_token" });
      }

      const result = await getObjectives(
        env,
        authorization,
        auth.context,
        request.params.organizationId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string };
    Body: { metricKey?: string; targetValue?: number; period?: string };
  }>(
    "/v1/organizations/:organizationId/objectives",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await createObjective(
        env,
        auth.context,
        request.params.organizationId,
        request.body ?? {},
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return reply.code(201).send(result.data);
    },
  );

  app.delete<{ Params: { organizationId: string; targetId: string } }>(
    "/v1/organizations/:organizationId/objectives/:targetId",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await deactivateObjective(
        env,
        auth.context,
        request.params.organizationId,
        request.params.targetId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.patch<{
    Params: { organizationId: string; targetId: string };
    Body: { value?: number };
  }>(
    "/v1/organizations/:organizationId/objectives/:targetId/actual",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await setObjectiveActual(
        env,
        auth.context,
        request.params.organizationId,
        request.params.targetId,
        request.body?.value,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  // Tipos de objetivo (catalogo editable del consultor) --------------------
  app.get("/v1/consultant/objective-definitions", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);

    if (isAuthContextError(auth)) {
      return sendAuthFailure(reply, auth.error);
    }
    if (!request.headers.authorization) {
      return reply.code(401).send({ error: "missing_bearer_token" });
    }

    const result = await listObjectiveDefinitions(
      env,
      request.headers.authorization,
      auth.context,
    );

    if (isServiceFailure(result)) {
      return sendServiceFailure(reply, result);
    }

    return result.data;
  });

  app.post<{
    Body: {
      label?: string;
      unit?: string;
      direction?: string;
      source?: string;
      metricKey?: string | null;
      organizationId?: string | null;
    };
  }>("/v1/consultant/objective-definitions", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);

    if (isAuthContextError(auth)) {
      return sendAuthFailure(reply, auth.error);
    }

    const result = await createObjectiveDefinition(
      env,
      auth.context,
      request.body ?? {},
    );

    if (isServiceFailure(result)) {
      return sendServiceFailure(reply, result);
    }

    return reply.code(201).send(result.data);
  });

  app.patch<{
    Params: { definitionId: string };
    Body: { label?: string; unit?: string; direction?: string };
  }>(
    "/v1/consultant/objective-definitions/:definitionId",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await updateObjectiveDefinition(
        env,
        auth.context,
        request.params.definitionId,
        request.body ?? {},
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.delete<{ Params: { definitionId: string } }>(
    "/v1/consultant/objective-definitions/:definitionId",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await archiveObjectiveDefinition(
        env,
        auth.context,
        request.params.definitionId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string; milestoneId: string };
    Body: {
      taskId?: string;
      title?: string;
      description?: string | null;
      priority?: string;
      dueAt?: string | null;
    };
  }>(
    "/v1/organizations/:organizationId/milestones/:milestoneId/tasks",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      // Dos modos: enlazar una tarea ya existente (taskId) o crearla directamente
      // con el contexto del hito (title) -- el consultor/IA que compone Mi Camino
      // usa el segundo para no tener que crear la tarea aparte y volver a enlazarla.
      const result = request.body?.taskId
        ? await linkTaskToMilestone(
            env,
            auth.context,
            request.params.organizationId,
            request.params.milestoneId,
            request.body.taskId,
          )
        : await createMilestoneTask(
            env,
            auth.context,
            request.params.organizationId,
            request.params.milestoneId,
            {
              title: request.body?.title,
              description: request.body?.description,
              priority: request.body?.priority,
              dueAt: request.body?.dueAt,
            },
          );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return reply.code(201).send(result.data);
    },
  );

  app.patch<{
    Params: { organizationId: string; phaseId: string };
    Body: { name?: string; description?: string | null };
  }>(
    "/v1/organizations/:organizationId/strategic-plan/phases/:phaseId",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await updatePhase(
        env,
        auth.context,
        request.params.organizationId,
        request.params.phaseId,
        {
          name: request.body?.name,
          description: request.body?.description,
        },
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.patch<{
    Params: { organizationId: string; milestoneId: string };
    Body: {
      name?: string;
      description?: string | null;
      targetDate?: string | null;
    };
  }>(
    "/v1/organizations/:organizationId/milestones/:milestoneId",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await updateMilestone(
        env,
        auth.context,
        request.params.organizationId,
        request.params.milestoneId,
        {
          name: request.body?.name,
          description: request.body?.description,
          targetDate: request.body?.targetDate,
        },
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.get("/v1/agents/eval-readiness", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) {
      return sendAuthFailure(reply, auth.error);
    }
    if (!["platform_admin", "consultant"].includes(auth.context.profile.platform_role)) {
      return reply.code(403).send({ error: "agent_eval_readiness_access_denied" });
    }
    return reply.send(await getAgentEvalReadiness(env));
  });

  // AI-02: diagnostico automatico, sin boton de "aprobar para ver" (RLS ya deja
  // ver pending_approval a consultor/admin). Devuelve el ultimo run fresco
  // (<24h) o genera uno nuevo sobre la marcha si no hay ninguno o esta viejo.
  app.get<{
    Params: { organizationId: string };
    Querystring: { connectionId?: string; days?: string };
  }>("/v1/organizations/:organizationId/ai/monitor", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);

    if (isAuthContextError(auth)) {
      return sendAuthFailure(reply, auth.error);
    }

    const result = await getMonitorDiagnostic(
      env,
      auth.context,
      request.params.organizationId,
      request.query.connectionId,
      request.query.days ? Number(request.query.days) : null,
    );

    if (isServiceFailure(result)) {
      return sendServiceFailure(reply, result);
    }

    return result.data;
  });

  // Regenerar ahora (ignora la cache de 24h): boton secundario "Actualizar".
  app.post<{
    Params: { organizationId: string };
    Querystring: { connectionId?: string; days?: string };
  }>(
    "/v1/organizations/:organizationId/ai/monitor-run",
    aiEndpointRateLimit,
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await runMonitorAgent(
        env,
        auth.context,
        request.params.organizationId,
        request.query.connectionId,
        request.query.days ? Number(request.query.days) : null,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return reply.code(201).send(result.data);
    },
  );

  // AI-05 (A04): plan de tareas automatico, mismo patron de cache/regenerar que A02.
  app.get<{
    Params: { organizationId: string };
    Querystring: { connectionId?: string; days?: string };
  }>(
    "/v1/organizations/:organizationId/ai/task-planner",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await getTaskPlannerDiagnostic(
        env,
        auth.context,
        request.params.organizationId,
        request.query.connectionId,
        request.query.days ? Number(request.query.days) : null,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string };
    Querystring: { connectionId?: string; days?: string };
  }>(
    "/v1/organizations/:organizationId/ai/task-planner-run",
    aiEndpointRateLimit,
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await runTaskPlannerAgent(
        env,
        auth.context,
        request.params.organizationId,
        request.query.connectionId,
        request.query.days ? Number(request.query.days) : null,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return reply.code(201).send(result.data);
    },
  );

  // AI-05 (A06): plan de reposicion de stock automatico, mismo patron.
  app.get<{
    Params: { organizationId: string };
    Querystring: { connectionId?: string; days?: string };
  }>(
    "/v1/organizations/:organizationId/ai/stock-planner",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await getStockPlannerDiagnostic(
        env,
        auth.context,
        request.params.organizationId,
        request.query.connectionId,
        request.query.days ? Number(request.query.days) : null,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string };
    Querystring: { connectionId?: string; days?: string };
  }>(
    "/v1/organizations/:organizationId/ai/stock-planner-run",
    aiEndpointRateLimit,
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await runStockPlannerAgent(
        env,
        auth.context,
        request.params.organizationId,
        request.query.connectionId,
        request.query.days ? Number(request.query.days) : null,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return reply.code(201).send(result.data);
    },
  );

  // AI-05 (A08): gestor de conocimiento automatico, mismo patron.
  app.get<{ Params: { organizationId: string } }>(
    "/v1/organizations/:organizationId/ai/knowledge-manager",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await getKnowledgeManagerDiagnostic(
        env,
        auth.context,
        request.params.organizationId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.post<{ Params: { organizationId: string } }>(
    "/v1/organizations/:organizationId/ai/knowledge-manager-run",
    aiEndpointRateLimit,
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await runKnowledgeManagerAgent(
        env,
        auth.context,
        request.params.organizationId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return reply.code(201).send(result.data);
    },
  );

  // AI (A12): analista de email marketing (Klaviyo), mismo patron read-only.
  app.get<{ Params: { organizationId: string } }>(
    "/v1/organizations/:organizationId/ai/email-analyst",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await getEmailAnalystDiagnostic(
        env,
        auth.context,
        request.params.organizationId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.post<{ Params: { organizationId: string } }>(
    "/v1/organizations/:organizationId/ai/email-analyst-run",
    aiEndpointRateLimit,
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await runEmailAnalystAgent(
        env,
        auth.context,
        request.params.organizationId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return reply.code(201).send(result.data);
    },
  );

  app.get<{ Params: { organizationId: string } }>(
    "/v1/organizations/:organizationId/ai/budget",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      if (
        !auth.context.memberships.some(
          (membership) =>
            membership.organization_id === request.params.organizationId,
        )
      ) {
        return reply.code(403).send({ error: "organization_access_denied" });
      }

      const result = await getOrganizationDailyBudgetStatusForOrganization(
        env,
        request.params.organizationId,
      );
      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return reply.send(result.data);
    },
  );

  app.get<{ Params: { organizationId: string } }>(
    "/v1/organizations/:organizationId/ai/runs",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const authorization = request.headers.authorization;

      if (!authorization) {
        return reply.code(401).send({ error: "missing_bearer_token" });
      }

      const result = await listAgentRuns(
        env,
        authorization,
        auth.context,
        request.params.organizationId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.get<{ Params: { organizationId: string; runId: string } }>(
    "/v1/organizations/:organizationId/ai/runs/:runId/trace",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const authorization = request.headers.authorization;

      if (!authorization) {
        return reply.code(401).send({ error: "missing_bearer_token" });
      }

      const result = await getAgentRunTrace(
        env,
        authorization,
        auth.context,
        request.params.organizationId,
        request.params.runId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string; outputId: string };
    Body: { decision?: string; reason?: string };
  }>(
    "/v1/organizations/:organizationId/ai/outputs/:outputId/decision",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await decideAgentOutput(
        env,
        auth.context,
        request.params.organizationId,
        request.params.outputId,
        request.body?.decision,
        request.body?.reason,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  // AI-11 Fase A: borradores Klaviyo sanitizados. No conecta, publica ni
  // envía contenido al proveedor; requiere aprobación antes de quedar listos
  // para copiar manualmente.
  app.post<{
    Params: { organizationId: string };
    Body: { content_type?: string; brief?: string };
  }>(
    "/v1/organizations/:organizationId/marketing/drafts",
    aiEndpointRateLimit,
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

      const result = await runMarketingContentDraft(
        env,
        auth.context,
        request.params.organizationId,
        request.body ?? {},
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return reply.code(201).send(result.data);
    },
  );

  // Guardar una plantilla del editor visual como borrador (sin IA).
  app.post<{ Params: { organizationId: string }; Body: Record<string, unknown> }>(
    "/v1/organizations/:organizationId/marketing/drafts/manual",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

      const result = await saveManualMarketingDraft(
        env,
        auth.context,
        request.params.organizationId,
        request.body ?? {},
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return reply.code(201).send(result.data);
    },
  );

  // Subir una imagen (base64) desde el ordenador para un bloque del editor.
  app.post<{ Params: { organizationId: string }; Body: Record<string, unknown> }>(
    "/v1/organizations/:organizationId/marketing/assets",
    { bodyLimit: 8 * 1024 * 1024 },
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

      const result = await uploadMarketingAsset(
        env,
        auth.context,
        request.params.organizationId,
        request.body ?? {},
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return reply.code(201).send(result.data);
    },
  );

  app.get<{ Params: { organizationId: string } }>(
    "/v1/organizations/:organizationId/marketing/drafts",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const authorization = request.headers.authorization;
      if (!authorization)
        return reply.code(401).send({ error: "missing_bearer_token" });

      const result = await listMarketingContentDrafts(
        env,
        authorization,
        auth.context,
        request.params.organizationId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.get<{
    Params: { organizationId: string; draftId: string };
  }>(
    "/v1/organizations/:organizationId/marketing/drafts/:draftId/versions",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const authorization = request.headers.authorization;
      if (!authorization) {
        return reply.code(401).send({ error: "missing_bearer_token" });
      }

      const result = await listMarketingContentDraftVersions(
        env,
        authorization,
        auth.context,
        request.params.organizationId,
        request.params.draftId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.patch<{
    Params: { organizationId: string; draftId: string };
    Body: Record<string, unknown>;
  }>(
    "/v1/organizations/:organizationId/marketing/drafts/:draftId",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

      const result = await updateMarketingContentDraft(
        env,
        auth.context,
        request.params.organizationId,
        request.params.draftId,
        request.body ?? {},
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string; draftId: string };
  }>(
    "/v1/organizations/:organizationId/marketing/drafts/:draftId/submit",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

      const result = await submitMarketingContentDraft(
        env,
        auth.context,
        request.params.organizationId,
        request.params.draftId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string; draftId: string };
    Body: { decision?: string; reason?: string };
  }>(
    "/v1/organizations/:organizationId/marketing/drafts/:draftId/decision",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

      const result = await decideMarketingContentDraft(
        env,
        auth.context,
        request.params.organizationId,
        request.params.draftId,
        request.body?.decision,
        request.body?.reason,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  // AI-05: copiloto del consultor (A09). Chat de solo lectura sobre sql_select
  // y search_knowledge; sin aprobacion (nunca escribe en el dominio).
  app.post<{
    Params: { organizationId: string };
    Body: { message?: string; conversation_id?: string };
  }>(
    "/v1/organizations/:organizationId/consultant-chat",
    aiEndpointRateLimit,
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await runConsultantChatTurn(
        env,
        auth.context,
        request.params.organizationId,
        request.body?.message ?? "",
        request.body?.conversation_id,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return reply.code(201).send(result.data);
    },
  );

  app.get<{ Params: { organizationId: string } }>(
    "/v1/organizations/:organizationId/consultant-chat/conversations",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await listConsultantChatConversations(
        env,
        auth.context,
        request.params.organizationId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.get<{ Params: { organizationId: string; conversationId: string } }>(
    "/v1/organizations/:organizationId/consultant-chat/conversations/:conversationId",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await getConsultantChatMessages(
        env,
        auth.context,
        request.params.organizationId,
        request.params.conversationId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  // AI-04: conocimiento (RAG). Ingestion por organizacion; con "global" en la
  // ruta se crea metodologia compartida (solo platform admin).
  app.post<{
    Params: { organizationId: string };
    Body: {
      title?: string;
      description?: string;
      content?: string;
      source_type?: string;
    };
  }>(
    "/v1/organizations/:organizationId/knowledge/documents",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const organizationId =
        request.params.organizationId === "global"
          ? null
          : request.params.organizationId;

      const result = await createKnowledgeDocument(
        env,
        auth.context,
        organizationId,
        request.body ?? {},
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return reply.code(201).send(result.data);
    },
  );

  app.get<{ Params: { organizationId: string } }>(
    "/v1/organizations/:organizationId/knowledge/documents",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const authorization = request.headers.authorization;

      if (!authorization) {
        return reply.code(401).send({ error: "missing_bearer_token" });
      }

      const result = await listKnowledgeDocuments(
        env,
        authorization,
        auth.context,
        request.params.organizationId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.post<{ Params: { organizationId: string }; Body: { query?: string } }>(
    "/v1/organizations/:organizationId/knowledge/search",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await searchKnowledge(
        env,
        auth.context,
        request.params.organizationId,
        request.body?.query,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  // BE-05: llamadas de consultoria (registro, transcripcion, resumen aprobado).
  app.get<{ Params: { organizationId: string } }>(
    "/v1/organizations/:organizationId/calls",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const authorization = request.headers.authorization;

      if (!authorization) {
        return reply.code(401).send({ error: "missing_bearer_token" });
      }

      const result = await listCalls(
        env,
        authorization,
        auth.context,
        request.params.organizationId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string };
    Body: Record<string, unknown>;
  }>("/v1/organizations/:organizationId/calls", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);

    if (isAuthContextError(auth)) {
      return sendAuthFailure(reply, auth.error);
    }

    const result = await createCall(
      env,
      auth.context,
      request.params.organizationId,
      request.body ?? {},
    );

    if (isServiceFailure(result)) {
      return sendServiceFailure(reply, result);
    }

    return reply.code(201).send(result.data);
  });

  app.patch<{
    Params: { organizationId: string; callId: string };
    Body: Record<string, unknown>;
  }>(
    "/v1/organizations/:organizationId/calls/:callId",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await updateCall(
        env,
        auth.context,
        request.params.organizationId,
        request.params.callId,
        request.body ?? {},
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.put<{
    Params: { organizationId: string; callId: string };
    Body: Record<string, unknown>;
  }>(
    "/v1/organizations/:organizationId/calls/:callId/transcript",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await saveTranscript(
        env,
        auth.context,
        request.params.organizationId,
        request.params.callId,
        request.body ?? {},
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return reply.code(201).send(result.data);
    },
  );

  app.post<{
    Params: { organizationId: string; callId: string };
    Body: Record<string, unknown>;
  }>(
    "/v1/organizations/:organizationId/calls/:callId/summary",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await createSummary(
        env,
        auth.context,
        request.params.organizationId,
        request.params.callId,
        request.body ?? {},
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return reply.code(201).send(result.data);
    },
  );

  // AI-01: genera el resumen estructurado de la llamada con el agente A01 a
  // partir de su transcripcion actual. Queda pending_approval como el manual.
  app.post<{ Params: { organizationId: string; callId: string } }>(
    "/v1/organizations/:organizationId/calls/:callId/analyze",
    aiEndpointRateLimit,
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await runCallAnalyst(
        env,
        auth.context,
        request.params.organizationId,
        request.params.callId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return reply.code(201).send(result.data);
    },
  );

  app.post<{
    Params: { organizationId: string; summaryId: string };
    Body: { decision?: string; reason?: string };
  }>(
    "/v1/organizations/:organizationId/call-summaries/:summaryId/decision",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await decideSummary(
        env,
        auth.context,
        request.params.organizationId,
        request.params.summaryId,
        request.body?.decision,
        request.body?.reason,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string; callId: string };
    Body: { body?: string };
  }>(
    "/v1/organizations/:organizationId/calls/:callId/internal-notes",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await addInternalNote(
        env,
        auth.context,
        request.params.organizationId,
        request.params.callId,
        request.body?.body,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return reply.code(201).send(result.data);
    },
  );

  app.post<{
    Params: { organizationId: string; callId: string };
    Body: Record<string, unknown>;
  }>(
    "/v1/organizations/:organizationId/calls/:callId/tasks",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await createTaskFromCall(
        env,
        auth.context,
        request.params.organizationId,
        request.params.callId,
        request.body ?? {},
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return reply.code(201).send(result.data);
    },
  );

  app.get("/v1/shopify/oauth/callback", async (request, reply) => {
    const result = await handleShopifyOAuthCallback(
      env,
      request.query as Record<string, string | string[] | undefined>,
    );

    if (isServiceFailure(result)) {
      return sendServiceFailure(reply, result);
    }

    return reply.redirect(result.data.redirectUrl);
  });

  await app.register(async (webhookScope) => {
    webhookScope.addContentTypeParser(
      "application/json",
      { parseAs: "buffer" },
      (_request, body, done) => {
        done(null, body);
      },
    );

    webhookScope.post("/v1/shopify/webhooks", async (request, reply) => {
      const result = await handleShopifyWebhookRequest(
        env,
        request.headers as Record<string, string | string[] | undefined>,
        request.body as Buffer,
      );

      return reply.code(result.statusCode).send(result.body);
    });

    webhookScope.post<{ Params: { connectionId: string } }>(
      "/v1/fathom/webhooks/:connectionId",
      async (request, reply) => {
        const result = await handleFathomWebhookRequest(
          env,
          request.params.connectionId,
          request.headers as FathomWebhookHeaders,
          request.body as Buffer,
        );
        return reply.code(result.statusCode).send(result.body);
      },
    );
  });

  app.post("/v1/internal/operations/run-rules", async (request, reply) => {
    if (!env.INTERNAL_API_SECRET) {
      return reply
        .code(503)
        .send({ error: "internal_api_secret_not_configured" });
    }

    if (request.headers["x-internal-secret"] !== env.INTERNAL_API_SECRET) {
      return reply.code(401).send({ error: "invalid_internal_secret" });
    }

    void runAlertRulesForAllOrganizations(env).catch((error: unknown) => {
      logger.error("Alert rules pass failed", error);
    });

    return reply.code(202).send({ status: "alert_rules_started" });
  });

  app.post("/v1/internal/shopify/reconcile", async (request, reply) => {
    if (!env.INTERNAL_API_SECRET) {
      return reply
        .code(503)
        .send({ error: "internal_api_secret_not_configured" });
    }

    if (request.headers["x-internal-secret"] !== env.INTERNAL_API_SECRET) {
      return reply.code(401).send({ error: "invalid_internal_secret" });
    }

    void reconcileAllShopifyConnections(env).catch((error: unknown) => {
      logger.error("Shopify reconciliation pass failed", error);
    });

    return reply.code(202).send({ status: "reconciliation_started" });
  });

  app.post("/v1/internal/fathom/process-queued", async (request, reply) => {
    if (!env.INTERNAL_API_SECRET) {
      return reply.code(503).send({ error: "internal_api_secret_not_configured" });
    }
    if (request.headers["x-internal-secret"] !== env.INTERNAL_API_SECRET) {
      return reply.code(401).send({ error: "invalid_internal_secret" });
    }
    try {
      const result = await processQueuedFathomWebhookEvents(env, 10);
      return reply.code(200).send(result);
    } catch (error) {
      return reply.code(503).send({
        error: "fathom_queue_processing_failed",
        detail: error instanceof Error ? error.message : "unknown_error",
      });
    }
  });

  app.post("/v1/internal/webhooks/purge-retained", async (request, reply) => {
    if (!env.INTERNAL_API_SECRET) {
      return reply.code(503).send({ error: "internal_api_secret_not_configured" });
    }
    if (request.headers["x-internal-secret"] !== env.INTERNAL_API_SECRET) {
      return reply.code(401).send({ error: "invalid_internal_secret" });
    }
    try {
      const result = await purgeProcessedWebhookEvents(env);
      return reply.code(200).send(result);
    } catch (error) {
      return reply.code(503).send({
        error: "webhook_retention_purge_failed",
        detail: error instanceof Error ? error.message : "unknown_error",
      });
    }
  });

  app.post("/v1/internal/ai/purge-retained-context", async (request, reply) => {
    if (!env.INTERNAL_API_SECRET) {
      return reply.code(503).send({ error: "internal_api_secret_not_configured" });
    }
    if (request.headers["x-internal-secret"] !== env.INTERNAL_API_SECRET) {
      return reply.code(401).send({ error: "invalid_internal_secret" });
    }
    try {
      const result = await purgeExpiredAiContext(env);
      return reply.code(200).send(result);
    } catch (error) {
      return reply.code(503).send({
        error: "ai_context_retention_purge_failed",
        detail: error instanceof Error ? error.message : "unknown_error",
      });
    }
  });

  app.get<{ Params: { organizationId: string } }>(
    "/v1/consultant/organizations/:organizationId/export",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

      const result = await exportOrganizationData(
        env,
        auth.context,
        request.params.organizationId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);

      reply.header("content-type", "application/json; charset=utf-8");
      reply.header(
        "content-disposition",
        `attachment; filename="ecomscaling-organization-${request.params.organizationId}-export.json"`,
      );
      return result.data;
    },
  );

  return app;
}

const isDirectRun = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

// BE-00: sin esto, un SIGTERM (docker stop, redeploy, scale-down) mata el
// proceso a mitad de request en vez de drenar las conexiones en vuelo --
// `app.close()` deja de aceptar conexiones nuevas y espera a que las
// existentes terminen (Fastify), ademas de correr los hooks `onClose` ya
// registrados en `buildApp()` (desconectar el Redis del rate-limit). Timeout
// de seguridad: un `app.close()` colgado (encontrado 2026-07-29 en tests,
// ver BE-00) no debe dejar el proceso zombie en produccion esperando un
// SIGKILL del orquestador -- forzamos la salida si no cierra a tiempo.
const SHUTDOWN_TIMEOUT_MS = 10_000;

// `exit`/`timeoutMs` inyectables solo para poder probar el timeout y el
// guard de senal duplicada sin depender de un SIGTERM real del SO (Windows
// no entrega SIGTERM real a procesos hijos, ver be-00-graceful-shutdown.test.ts)
// ni de registrar listeners reales de `process` en el proceso de test.
export function createShutdownHandler(
  app: { close: () => Promise<unknown> },
  {
    exit = process.exit,
    timeoutMs = SHUTDOWN_TIMEOUT_MS,
  }: { exit?: (code: number) => void; timeoutMs?: number } = {},
) {
  let shuttingDown = false;

  return async function shutdown(signal: string) {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    logger.info(`Received ${signal}, shutting down gracefully`);

    const forceExitTimer = setTimeout(() => {
      logger.error(
        `Graceful shutdown did not complete within ${timeoutMs}ms, forcing exit`,
      );
      exit(1);
    }, timeoutMs);
    forceExitTimer.unref();

    try {
      await app.close();
      clearTimeout(forceExitTimer);
      logger.info("Shutdown complete");
      exit(0);
    } catch (error) {
      clearTimeout(forceExitTimer);
      logger.error("Error during shutdown", error);
      exit(1);
    }
  };
}

function registerGracefulShutdown(app: FastifyInstance) {
  const shutdown = createShutdownHandler(app);
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

if (isDirectRun) {
  const env = loadApiEnv(process.env);
  const app = await buildApp();

  try {
    await app.listen({ host: env.API_HOST, port: env.API_PORT });
    logger.info(`API listening on ${env.API_HOST}:${env.API_PORT}`);
    registerGracefulShutdown(app);
  } catch (error) {
    logger.error("API failed to start", error);
    process.exit(1);
  }
}
