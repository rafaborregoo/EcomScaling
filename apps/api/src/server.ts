import { pathToFileURL } from "node:url";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance } from "fastify";
import { Redis } from "ioredis";
import {
  describeEnvironmentTargetRisk,
  loadApiEnv,
  shouldBlockOnEnvironmentRisk,
} from "@ecomscaling/config";
import {
  causalEdgeInputSchema,
  healthReferenceInputSchema,
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
import {
  createConsultantDecisionContextDeclaration,
  listConsultantDecisionContexts,
} from "./decision-context-api.js";
import { listConsultantTemporalUrgency } from "./temporal-urgency-api.js";
import { listConsultantDecisionImpact } from "./decision-impact-api.js";
import { listConsultantConstraints } from "./constraints-api.js";
import { listConsultantFeasibility } from "./feasibility-api.js";
import { listConsultantRisk } from "./risk-api.js";
import { listConsultantAllocation } from "./allocation-api.js";
import { listConsultantStrategicFit } from "./strategic-fit-api.js";
import { listConsultantRanking } from "./ranking-api.js";
import { listConsultantPortfolio } from "./portfolio-api.js";
import { listConsultantDecisionOutputs } from "./decision-output-api.js";
import { listConsultantPlaybookRuns } from "./playbook-api.js";
import { listConsultantAcquisitionRuns } from "./acquisition-api.js";
import { listConsultantPaidMediaRuns } from "./paid-media-api.js";
import { listConsultantConversionRuns } from "./conversion-api.js";
import { listAccountActions } from "./actions.js";
import {
  addMarketingDraftNote,
  generateClientInviteCode,
  createClientOrganization,
  deleteConsultant,
  deleteOrganization,
  deleteOrganizationStore,
  getAdminObservability,
  getConsultantOverview,
  listConsultantAgenda,
  getOrganizationAccess,
  getClientAccess,
  inviteClientMember,
  setClientMemberRole,
  inviteConsultant,
  listAdminClients,
  listConsultantCalls,
  listConsultantContextReadings,
  listConsultantMaturity,
  listConsultantCapabilityHealth,
  createConsultantHealthReference,
  listConsultantHealthReferences,
  retireConsultantHealthReference,
  createConsultantCausalEdge,
  listConsultantCausalPaths,
  listConsultantHypotheses,
  listConsultantRootCauses,
  listConsultantDiagnosticRobustness,
  listConsultantTemporalDiagnoses,
  listConsultantDiagnosticOutputs,
  listConsultantPrioritizationRuns,
  listConsultantConfidence,
  listConsultantSeverity,
  listConsultantSignals,
  listConsultantSymptomMap,
  listConsultantDataQuality,
  listConsultantIntegrations,
  listConsultantKnowledge,
  listConsultantMarketing,
  listConsultantMetaPortfolio,
  listConsultantMetaAccounts,
  listConsultantKlaviyoAccounts,
  listConsultantKlaviyoPortfolio,
  listConsultantOperations,
  listConsultantWork,
  listConsultantOrders,
  listConsultantProposedTasks,
  listConsultantOrganizations,
  listConsultantPlans,
  listConsultantStores,
  listMarketingDraftNotes,
  setMarketingDraftSchedule,
  listConsultants,
  createOwnStore,
  listOrganizationStores,
  hardDeleteOrganization,
  listOwnStoresOverview,
  pauseConsultantClient,
  previewClientInvite,
  redeemClientInvite,
  regenerateClientInvite,
  resendConsultantInvite,
  resumeConsultantClient,
  restoreOrganization,
  restoreOrganizationStore,
  updateConsultant,
  unlinkConsultantClient,
  upsertConsultantAssignment,
  upsertOrganizationMember,
  updateOrganization,
} from "./consultant.js";
import {
  listClientMessageThreads,
  listThreadMessages,
  postThreadMessage,
  uploadThreadAttachment,
} from "./consultant-messages.js";
import {
  isAuthContextError,
  resolveAuthContext,
  type AuthContextError,
} from "./auth-context.js";
import { runWithRequestCorrelation } from "./request-context.js";
import { listOrganizationDataQuality } from "./data-quality.js";
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
import { getShopifyInsights } from "./shopify-insights.js";
import { getMetaInsights } from "./meta-insights.js";
import { getKlaviyoInsights } from "./klaviyo-insights.js";
import { handleShopifyWebhookRequest } from "./shopify-webhook-handler.js";
import { handleFathomWebhookRequest } from "./fathom-webhook-handler.js";
import { ensureOwnOrganization } from "./registro.js";
import {
  grantSubscription,
  getPlatformFinancialDashboard,
  listPlans,
  listPlatformSubscriptions,
  revokeSubscription,
  type GrantInput,
} from "./billing.js";
import {
  getPlatformBillingSettings,
  getPlatformInvoice,
  listPlatformInvoices,
  retryInvoiceVerifactu,
  sendInvoiceEmailForInvoice,
  upsertPlatformBillingSettings,
} from "./invoicing.js";
import {
  archivePlatformExpense,
  createPlatformExpense,
  listPlatformExpenses,
  updatePlatformExpense,
  type PlatformExpenseInput,
} from "./platform-finance.js";
import type { StandardWebhookHeaders } from "./standard-webhook.js";
import { processQueuedFathomWebhookEvents } from "./fathom-webhook-handler.js";
import type { FathomWebhookHeaders } from "./fathom-webhook.js";
import { reconcileAllShopifyConnections } from "./shopify-reconcile.js";
import { purgeProcessedWebhookEvents } from "./webhook-retention.js";
import { purgeExpiredAiContext } from "./ai-context-retention.js";
import { exportOrganizationData } from "./organization-export.js";
import {
  listProductCosts,
  upsertProductCost,
  importProductCosts,
} from "./shopify-product-costs.js";
import {
  createFixedExpense,
  createShippingRule,
  deactivateFixedExpense,
  deactivateShippingRule,
  getFinancialConfig,
  upsertFinancialSettings,
  upsertMetricTarget,
  retireMetricTarget,
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
  assignStoreScope,
  listStoreScope,
  type StoreScopeInput,
} from "./store-scope.js";
import {
  connectKlaviyoWithApiKey,
  createKlaviyoConnectionAuthUrl,
  getKlaviyoEmailReport,
  handleKlaviyoOAuthCallback,
  importKlaviyoTemplate,
  listKlaviyoConversionMetrics,
  listKlaviyoTemplates,
  previewKlaviyoTemplate,
  pushDraftToKlaviyoTemplate,
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
import { listAlertRules, upsertAlertRule } from "./alert-rules.js";
import { getAuditLog, getPlatformErrors } from "./platform-logs.js";
import { getClientConsultant } from "./client-autonomy.js";
import {
  listConsultantPartners,
  addConsultantPartner,
  removeConsultantPartner,
} from "./consultant-partners.js";
import { listWorkSplit, updateWorkSplit } from "./work-split.js";
import {
  createCampaignCalendar,
  createCampaignCalendarItem,
  createCampaignItemsFromProposal,
  archiveCampaignCalendarItem,
  listCampaignPlanning,
  listCampaignPlanningResources,
  listKpiSnapshots,
  listCampaignPlanningAttention,
  updateCampaignCalendarExecution,
  updateCampaignCalendarItem,
  upsertKpiSnapshot,
} from "./campaign-planning.js";
import {
  decideAgentOutput,
  type ProposedWriteEdit,
  getConsultantChatMessages,
  getEmailAnalystDiagnostic,
  getMonitorDiagnostic,
  getKnowledgeManagerDiagnostic,
  getOperativaShopifyDiagnostic,
  getRetencionClientesDiagnostic,
  getAdquisicionShopifyDiagnostic,
  getPostventaShopifyDiagnostic,
  getCreatividadMetaDiagnostic,
  runCreatividadMetaAgent,
  getMedicionMetaDiagnostic,
  runMedicionMetaAgent,
  getCambiosMetaDiagnostic,
  getContenidoEmailDiagnostic,
  runContenidoEmailAgent,
  runCambiosMetaAgent,
  runRetencionClientesAgent,
  runAdquisicionShopifyAgent,
  runPostventaShopifyAgent,
  getOperativaMetaDiagnostic,
  getStockPlannerDiagnostic,
  getTaskPlannerDiagnostic,
  getPlanDiagnostic,
  runPlanAgent,
  isPlanHorizon,
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
  getDiagnosticOrchestratorObservability,
  runConsultantChatTurn,
  runDiagnosticOrchestratorTick,
  runEmailAnalystAgent,
  runKnowledgeManagerAgent,
  runOperativaShopifyAgent,
  runOperativaMetaAgent,
  runMonitorAgent,
  runStockPlannerAgent,
  runTaskPlannerAgent,
  runCaminoArchitectAgent,
  runCampaignStrategist,
  getCampaignPlanProposal,
  isCampaignPlanHorizon,
  getCaminoProposal,
  isCaminoHorizon,
  type ConsultantChatViewContext,
  describeProviderRedundancy,
} from "./ai-runtime.js";
import { getCopilotBalance } from "./copilot-saldo.js";
import { createStripeCheckout } from "./stripe-checkout.js";
import { handleStripeWebhookRequest } from "./stripe-webhook-handler.js";
import type { StripeWebhookHeaders } from "./stripe-webhook.js";
import {
  enqueueInstagramImage,
  listInstagramImageBank,
  updateInstagramImageMarkdown,
  retryInstagramImage,
  deleteInstagramImage,
  processInstagramImageQueue,
  listInstagramOverlays,
  createInstagramOverlay,
  updateInstagramOverlay,
  deleteInstagramOverlay,
  draftInstagramOverlayText,
  generatePublicationCaption,
} from "./instagram-image-bank.js";
import { getAgentEvalReadiness } from "./agent-eval-readiness.js";
import {
  createKnowledgeDocument,
  listKnowledgeDocuments,
  getKnowledgeDocument,
  searchKnowledge,
} from "./knowledge.js";
import {
  listClientConstraints,
  createClientConstraint,
  setClientConstraintStatus,
} from "./client-constraints.js";
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
  assertCanManagePlan,
  createMilestone,
  createMilestoneTask,
  createPhase,
  createStrategicPlan,
  createStrategicPlanFromMarkdown,
  createStrategicPlanFromProposal,
  getStrategicPlan,
  linkTaskToMilestone,
  reorderMilestones,
  reorderPhases,
  updateMilestone,
  updateMilestoneStatus,
  updatePhase,
  previewStrategicPlanMarkdown,
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
  // Test y produccion separados (Shopify, datos protegidos Nivel 2). Avisa
  // siempre; solo mata el proceso con SUPABASE_ENV_GUARD=block.
  const environmentRisk = describeEnvironmentTargetRisk(process.env);
  if (environmentRisk) {
    if (shouldBlockOnEnvironmentRisk(process.env)) {
      throw new Error(`entorno_cruzado: ${environmentRisk}`);
    }
    console.warn(`entorno_cruzado: ${environmentRisk}`);
  }
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

  // La clave por defecto de @fastify/rate-limit es la IP. Eso rompe en los dos
  // entornos que importan: en local todo (navegador, worker, SSR) sale de
  // 127.0.0.1 y comparte un unico cubo de 120/min -- una sesion normal del
  // portal lo agotaba y a partir de ahi TODA la app respondia 429; en
  // produccion, detras de Caddy y sin `trustProxy`, request.ip es la IP interna
  // del proxy, o sea que todos los clientes compartirian ese mismo cubo. Se
  // limita por usuario autenticado (sub del JWT, decodificado sin verificar --
  // sirve para trocear el cubo, no para autorizar) y solo se cae a la IP en las
  // rutas sin sesion (login, invitaciones, webhooks). El worker se salta el
  // limite: no es trafico de usuario y ya va autenticado por secreto interno.
  await app.register(rateLimit, {
    global: true,
    max: 120,
    timeWindow: "1 minute",
    skipOnError: true,
    redis: rateLimitRedis,
    keyGenerator: (request) =>
      decodeJwtSubject(request.headers.authorization) ?? request.ip,
    // `INTERNAL_API_SECRET` es opcional en la config: sin este `Boolean(...)`,
    // cuando no esta puesto `undefined === undefined` seria true y el limite
    // quedaria desactivado para todo el mundo.
    allowList: (request) =>
      Boolean(env.INTERNAL_API_SECRET) &&
      request.headers["x-internal-secret"] === env.INTERNAL_API_SECRET,
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

  const inviteRedeemRateLimit = {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: "1 minute",
        keyGenerator: (request: { ip: string }) => request.ip,
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
  // AI-30: mete el resto de la peticion dentro del AsyncLocalStorage de
  // correlacion, para que el runtime de IA pueda poner el mismo request id en
  // `agent_runs.trace_id` sin que haya que pasarlo por la firma de cada agente.
  // Tiene que ser el hook de estilo callback: con `async` el contexto se
  // cerraria al volver del hook y no cubriria al handler.
  app.addHook("onRequest", (request, _reply, done) => {
    runWithRequestCorrelation({ requestId: String(request.id) }, done);
  });

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

  // Genera un codigo de vinculacion suelto (no requiere platform_admin). El
  // cliente crea su propia organizacion en /planes -- ver §16 del plan de
  // organizacion consultora.
  app.post<{ Body: { email?: string } }>(
    "/v1/consultant/clients",
    async (request, reply) => {
      const auth = await resolveAuthContext(
        env,
        request.headers.authorization,
      );
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

      const result = await generateClientInviteCode(
        env,
        auth.context,
        request.body ?? {},
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return reply.code(201).send(result.data);
    },
  );

  // Con quien comparte cartera un consultor. Emparejarse reparte las tiendas
  // que ya tienen los dos y hace que las nuevas nazcan compartidas.
  app.get("/v1/consultant/partners", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

    const result = await listConsultantPartners(env, auth.context);
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  app.post<{ Body: { email?: string } }>(
    "/v1/consultant/partners",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

      const result = await addConsultantPartner(
        env,
        auth.context,
        request.body ?? {},
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return reply.code(201).send(result.data);
    },
  );

  app.post<{ Body: { business_name?: string; invite_code?: string } }>(
    "/v1/mi-organizacion",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

      const result = await ensureOwnOrganization(
        env,
        auth.context,
        request.body ?? {},
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.get("/v1/billing/plans", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

    const result = await listPlans(env);
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  app.get("/v1/admin/subscriptions", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

    const result = await listPlatformSubscriptions(env, auth.context);
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  app.get<{ Querystring: { days?: string } }>(
    "/v1/admin/financial-dashboard",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

      const requestedDays = Number.parseInt(request.query.days ?? "30", 10);
      const result = await getPlatformFinancialDashboard(
        env,
        auth.context,
        requestedDays,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.get<{ Querystring: { days?: string } }>(
    "/v1/admin/expenses",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const requestedDays = Number.parseInt(request.query.days ?? "30", 10);
      const result = await listPlatformExpenses(
        env,
        auth.context,
        requestedDays,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.post<{ Body: PlatformExpenseInput }>(
    "/v1/admin/expenses",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await createPlatformExpense(
        env,
        auth.context,
        request.body ?? {},
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return reply.code(201).send(result.data);
    },
  );

  app.patch<{ Params: { expenseId: string }; Body: PlatformExpenseInput }>(
    "/v1/admin/expenses/:expenseId",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await updatePlatformExpense(
        env,
        auth.context,
        request.params.expenseId,
        request.body ?? {},
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.delete<{ Params: { expenseId: string } }>(
    "/v1/admin/expenses/:expenseId",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await archivePlatformExpense(
        env,
        auth.context,
        request.params.expenseId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.get("/v1/admin/billing-settings", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    if (auth.context.profile.platform_role !== "platform_admin") {
      return reply.code(403).send({ error: "platform_admin_required" });
    }
    const result = await getPlatformBillingSettings(env);
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  app.put<{ Body: Record<string, unknown> }>(
    "/v1/admin/billing-settings",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await upsertPlatformBillingSettings(
        env,
        auth.context,
        request.body ?? {},
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.get("/v1/admin/invoices", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const result = await listPlatformInvoices(env, auth.context);
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  app.get<{ Params: { invoiceId: string } }>(
    "/v1/admin/invoices/:invoiceId",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await getPlatformInvoice(
        env,
        auth.context,
        request.params.invoiceId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.post<{ Params: { invoiceId: string } }>(
    "/v1/admin/invoices/:invoiceId/verifactu/retry",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await retryInvoiceVerifactu(
        env,
        auth.context,
        request.params.invoiceId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.post<{ Params: { invoiceId: string } }>(
    "/v1/admin/invoices/:invoiceId/email/retry",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      if (auth.context.profile.platform_role !== "platform_admin") {
        return reply.code(403).send({ error: "platform_admin_required" });
      }
      const result = await sendInvoiceEmailForInvoice(
        env,
        request.params.invoiceId,
      );
      if (!result.ok) return reply.code(result.statusCode).send(result);
      return result;
    },
  );

  app.post<{ Body: GrantInput }>(
    "/v1/admin/subscriptions",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

      const result = await grantSubscription(
        env,
        auth.context,
        request.body ?? {},
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return reply.code(201).send(result.data);
    },
  );

  app.delete<{ Params: { subscriptionId: string } }>(
    "/v1/admin/subscriptions/:subscriptionId",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

      const result = await revokeSubscription(
        env,
        auth.context,
        request.params.subscriptionId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.post<{
    Body: {
      price_id?: string;
      organization_id?: string;
      success_url?: string;
      cancel_url?: string;
      customer_tax_id?: string;
    };
  }>("/v1/billing/stripe/checkout", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

    const result = await createStripeCheckout(
      env,
      auth.context,
      request.body ?? {},
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  app.delete<{ Params: { partnerUserId: string } }>(
    "/v1/consultant/partners/:partnerUserId",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

      const result = await removeConsultantPartner(
        env,
        auth.context,
        request.params.partnerUserId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  // Reparto de trabajo entre los consultores de cada tienda: quien es el
  // principal y que parte de las tareas automaticas le toca a cada uno.
  app.get("/v1/consultant/work-split", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

    const result = await listWorkSplit(env, auth.context);
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  app.put<{
    Body: {
      organization_ids?: string[];
      shares?: Array<{ user_id: string; work_share: number }>;
      primary_user_id?: string;
    };
  }>("/v1/consultant/work-split", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

    const result = await updateWorkSplit(env, auth.context, request.body ?? {});
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  // Accesos de un cliente para su consultor: ver quien entra, invitar a otra
  // persona y cambiar roles. Antes solo existia la version platform_admin, que
  // ademas devuelve el directorio de perfiles de toda la plataforma.
  app.get<{ Params: { organizationId: string } }>(
    "/v1/consultant/organizations/:organizationId/client-access",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

      const result = await getClientAccess(
        env,
        auth.context,
        request.params.organizationId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string };
    Body: { markdown?: string; fileName?: string };
  }>(
    "/v1/organizations/:organizationId/strategic-plan/import/preview",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const access = assertCanManagePlan(
        auth.context,
        request.params.organizationId,
      );
      if (isServiceFailure(access)) return sendServiceFailure(reply, access);
      const markdown = request.body?.markdown;
      if (typeof markdown !== "string") {
        return reply.code(400).send({ error: "missing_markdown" });
      }
      return reply.send({
        ...previewStrategicPlanMarkdown(markdown),
        fileName: request.body?.fileName ?? null,
      });
    },
  );

  app.post<{
    Params: { organizationId: string };
    Body: { markdown?: string; fileName?: string };
  }>(
    "/v1/organizations/:organizationId/strategic-plan/import",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const markdown = request.body?.markdown;
      if (typeof markdown !== "string") {
        return reply.code(400).send({ error: "missing_markdown" });
      }
      const result = await createStrategicPlanFromMarkdown(
        env,
        auth.context,
        request.params.organizationId,
        markdown,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return reply.code(201).send(result.data);
    },
  );

  app.post<{
    Params: { organizationId: string };
    Body: { email?: string; full_name?: string; role?: string };
  }>(
    "/v1/consultant/organizations/:organizationId/client-access/invite",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

      const result = await inviteClientMember(
        env,
        auth.context,
        request.params.organizationId,
        request.body ?? {},
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return reply.code(201).send(result.data);
    },
  );

  app.patch<{
    Params: { organizationId: string; userId: string };
    Body: { role?: string; isActive?: boolean };
  }>(
    "/v1/consultant/organizations/:organizationId/client-access/:userId",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

      const result = await setClientMemberRole(
        env,
        auth.context,
        request.params.organizationId,
        request.params.userId,
        request.body ?? {},
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.post<{ Params: { inviteId: string } }>(
    "/v1/consultant/invites/:inviteId/regenerate",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

      const result = await regenerateClientInvite(
        env,
        auth.context,
        request.params.inviteId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  // Vista previa publica de un codigo: sin auth (el cliente aun no tiene
  // sesion). Un codigo suelto (§16) manda a /registro; uno de cliente ya
  // existente devuelve `requires_signup: false` y sigue por /v1/invites/redeem.
  app.post<{ Body: { code?: string; email?: string } }>(
    "/v1/invites/preview",
    inviteRedeemRateLimit,
    async (request, reply) => {
      const result = await previewClientInvite(env, request.body ?? {});
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.post<{ Body: { code?: string; email?: string } }>(
    "/v1/invites/redeem",
    inviteRedeemRateLimit,
    async (request, reply) => {
      const result = await redeemClientInvite(env, request.body ?? {});
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

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

  app.get<{ Querystring: { from?: string; to?: string; scope?: string } }>(
    "/v1/consultant/agenda",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const authorization = request.headers.authorization;
      if (!authorization) {
        return reply.code(401).send({ error: "missing_bearer_token" });
      }

      const result = await listConsultantAgenda(
        env,
        authorization,
        auth.context,
        {
          from: request.query.from,
          to: request.query.to,
          scope: request.query.scope || "all",
        },
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.get<{ Querystring: { from?: string; to?: string } }>(
    "/v1/consultant/orders",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const authorization = request.headers.authorization;
      if (!authorization) {
        return reply.code(401).send({ error: "missing_bearer_token" });
      }

      const now = Date.now();
      const dayMs = 24 * 60 * 60 * 1000;
      const toMs = Date.parse(request.query.to ?? "") || now;
      const fromMs = Date.parse(request.query.from ?? "") || toMs - dayMs;
      // Rango sano: from < to y como mucho ~13 meses.
      if (fromMs >= toMs || toMs - fromMs > 400 * dayMs) {
        return reply.code(400).send({ error: "invalid_date_range" });
      }

      const result = await listConsultantOrders(
        env,
        authorization,
        auth.context,
        new Date(fromMs).toISOString(),
        new Date(toMs).toISOString(),
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.get<{ Querystring: { compare?: string } }>(
    "/v1/consultant/meta-portfolio",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const authorization = request.headers.authorization;
      if (!authorization) {
        return reply.code(401).send({ error: "missing_bearer_token" });
      }

      const result = await listConsultantMetaPortfolio(
        env,
        authorization,
        auth.context,
        request.query.compare ?? "month",
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.get<{ Querystring: { window?: string } }>(
    "/v1/consultant/klaviyo-portfolio",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const authorization = request.headers.authorization;
      if (!authorization) {
        return reply.code(401).send({ error: "missing_bearer_token" });
      }

      const result = await listConsultantKlaviyoPortfolio(
        env,
        authorization,
        auth.context,
        request.query.window ?? "30d",
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.get("/v1/consultant/proposed-tasks", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);

    if (isAuthContextError(auth)) {
      return sendAuthFailure(reply, auth.error);
    }

    const authorization = request.headers.authorization;
    if (!authorization) {
      return reply.code(401).send({ error: "missing_bearer_token" });
    }

    const result = await listConsultantProposedTasks(
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
    "/v1/consultant/own-stores",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await listOwnStoresOverview(
        env,
        auth.context,
        Number(request.query.days ?? "30"),
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.post<{
    Body: { display_name?: string; timezone?: string; currency_code?: string };
  }>("/v1/consultant/own-stores", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);

    if (isAuthContextError(auth)) {
      return sendAuthFailure(reply, auth.error);
    }

    const result = await createOwnStore(env, auth.context, request.body ?? {});

    if (isServiceFailure(result)) {
      return sendServiceFailure(reply, result);
    }

    return reply.code(201).send(result.data);
  });

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
    Body: { body?: string; from_ai?: boolean };
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

  // --- Canal de mensajería consultor <-> cliente -------------------------

  app.get("/v1/consultant/message-threads", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const authorization = request.headers.authorization;
    if (!authorization) {
      return reply.code(401).send({ error: "missing_bearer_token" });
    }
    const result = await listClientMessageThreads(
      env,
      authorization,
      auth.context,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  app.get<{
    Params: { organizationId: string };
    Querystring: { limit?: string };
  }>(
    "/v1/organizations/:organizationId/consultant-messages",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const authorization = request.headers.authorization;
      if (!authorization) {
        return reply.code(401).send({ error: "missing_bearer_token" });
      }
      const result = await listThreadMessages(
        env,
        authorization,
        auth.context,
        request.params.organizationId,
        {
          limit: request.query.limit ? Number(request.query.limit) : undefined,
        },
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string };
    Body: {
      filename?: string;
      content_type?: string;
      content_base64?: string;
    };
  }>(
    "/v1/organizations/:organizationId/consultant-messages/attachments",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await uploadThreadAttachment(
        env,
        auth.context,
        request.params.organizationId,
        request.body ?? {},
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return reply.code(201).send(result.data);
    },
  );

  app.post<{
    Params: { organizationId: string };
    Body: { body?: string; attachments?: unknown[] };
  }>(
    "/v1/organizations/:organizationId/consultant-messages",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await postThreadMessage(
        env,
        auth.context,
        request.params.organizationId,
        request.body ?? {},
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return reply.code(201).send(result.data);
    },
  );

  app.patch<{
    Params: { organizationId: string; draftId: string };
    Body: { scheduled_for?: string | null };
  }>(
    "/v1/organizations/:organizationId/marketing/drafts/:draftId/schedule",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await setMarketingDraftSchedule(
        env,
        auth.context,
        request.params.organizationId,
        request.params.draftId,
        request.body ?? {},
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
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

  // Cartera de Meta ordenada por urgencia. Distinta de /meta-portfolio, que
  // compara rendimiento entre periodos: esta responde a que cuenta hay que
  // mirar hoy.
  app.get("/v1/consultant/meta-accounts", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);

    if (isAuthContextError(auth)) {
      return sendAuthFailure(reply, auth.error);
    }

    const authorization = request.headers.authorization;
    if (!authorization) {
      return reply.code(401).send({ error: "missing_bearer_token" });
    }

    const result = await listConsultantMetaAccounts(
      env,
      authorization,
      auth.context,
    );

    if (isServiceFailure(result)) {
      return sendServiceFailure(reply, result);
    }

    return result.data;
  });

  // Cartera de email ordenada por urgencia: que cuenta de Klaviyo hay que
  // mirar hoy. Determinista, igual que la de Meta.
  app.get("/v1/consultant/klaviyo-accounts", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);

    if (isAuthContextError(auth)) {
      return sendAuthFailure(reply, auth.error);
    }

    const authorization = request.headers.authorization;
    if (!authorization) {
      return reply.code(401).send({ error: "missing_bearer_token" });
    }

    const result = await listConsultantKlaviyoAccounts(
      env,
      authorization,
      auth.context,
    );

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

  // F3/D01. La calidad del dato de cada fuente, antes de que nadie interprete
  // una variacion como cambio del negocio. La escribe el motor de
  // `data-quality-engine.ts`; aqui solo se lee, y con el token del usuario para
  // que quien decida que organizaciones entran sea la RLS y no este codigo.
  // F3/D02. Las lecturas contextuales: contra que se compara cada senal, si la
  // comparacion aguanta y si lo que se movio fue el rendimiento o el peso de
  // los segmentos. Solo consultor: es razonamiento a medio hacer.
  app.get("/v1/consultant/context-readings", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);

    if (isAuthContextError(auth)) {
      return sendAuthFailure(reply, auth.error);
    }

    const authorization = request.headers.authorization;
    if (!authorization) {
      return reply.code(401).send({ error: "missing_bearer_token" });
    }

    const result = await listConsultantContextReadings(
      env,
      authorization,
      auth.context,
    );

    if (isServiceFailure(result)) {
      return sendServiceFailure(reply, result);
    }

    return result.data;
  });

  // F3/D03. De que es capaz el negocio: que capacidades demuestra el dato, cuales
  // no se pueden ver y con que numero. Solo consultor -- decirle a un cliente
  // "tu retencion es ad_hoc" sin acompanamiento es un juicio, no una ayuda.
  app.get("/v1/consultant/maturity", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);

    if (isAuthContextError(auth)) {
      return sendAuthFailure(reply, auth.error);
    }

    const authorization = request.headers.authorization;
    if (!authorization) {
      return reply.code(401).send({ error: "missing_bearer_token" });
    }

    const result = await listConsultantMaturity(
      env,
      authorization,
      auth.context,
    );

    if (isServiceFailure(result)) {
      return sendServiceFailure(reply, result);
    }

    return result.data;
  });

  // F3/D04. Contra que se juzga cada metrica en cada tienda. Es la declaracion
  // que el guardrail 11 exige y que hasta ahora no tenia donde escribirse: sin
  // ella, D04 y D10 contestan "falta un dato" en vez de diagnosticar.
  app.get("/v1/consultant/health-references", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

    const authorization = request.headers.authorization;
    if (!authorization) {
      return reply.code(401).send({ error: "missing_bearer_token" });
    }

    const result = await listConsultantHealthReferences(
      env,
      authorization,
      auth.context,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  app.post("/v1/consultant/health-references", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

    const authorization = request.headers.authorization;
    if (!authorization) {
      return reply.code(401).send({ error: "missing_bearer_token" });
    }

    const parsed = healthReferenceInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "invalid_health_reference",
        detail: parsed.error.message,
      });
    }

    const result = await createConsultantHealthReference(
      env,
      authorization,
      auth.context,
      parsed.data,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return reply.code(201).send(result.data);
  });

  app.delete("/v1/consultant/health-references/:id", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

    const authorization = request.headers.authorization;
    if (!authorization) {
      return reply.code(401).send({ error: "missing_bearer_token" });
    }

    const { id } = request.params as { id: string };
    const result = await retireConsultantHealthReference(
      env,
      authorization,
      auth.context,
      id,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  // F3/D07. Las rutas causales candidatas de un caso: las que apoya, las que
  // contradice y las que nadie ha podido comprobar. Van **todas**, incluidas las
  // contradichas -- una rama podada dice donde no esta el problema, y eso es la
  // mitad de un diagnostico (guardrail 49). Solo consultor: son candidatas.
  app.get("/v1/consultant/causal-paths", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

    const authorization = request.headers.authorization;
    if (!authorization) {
      return reply.code(401).send({ error: "missing_bearer_token" });
    }

    const result = await listConsultantCausalPaths(
      env,
      authorization,
      auth.context,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  // F3/D08. Las explicaciones que se han barajado para un caso, **incluidas las
  // descartadas con su motivo**: filtrarlas es como se repite el mes que viene
  // una busqueda que ya se hizo. Y el test siguiente de cada una, que es la
  // parte accionable. Solo consultor.
  app.get("/v1/consultant/hypotheses", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

    const authorization = request.headers.authorization;
    if (!authorization) {
      return reply.code(401).send({ error: "missing_bearer_token" });
    }

    const result = await listConsultantHypotheses(
      env,
      authorization,
      auth.context,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  // F3/D09. Causa raiz y constraint, dos preguntas independientes. Casi todo
  // llega "unresolved" o "latent" y se ensena tal cual: no cerrar es la
  // respuesta correcta cuando la evidencia es co-movimiento. Solo consultor.
  app.get("/v1/consultant/root-causes", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

    const authorization = request.headers.authorization;
    if (!authorization) {
      return reply.code(401).send({ error: "missing_bearer_token" });
    }

    const result = await listConsultantRootCauses(env, authorization, auth.context);
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  // F3/D12. El consultor ve la contraexplicación, todos los confusores,
  // checks obligatorios y sensibilidad; no se presenta como dato accionable
  // al cliente sin una traducción posterior.
  app.get("/v1/consultant/adversarial", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const authorization = request.headers.authorization;
    if (!authorization) return reply.code(401).send({ error: "missing_bearer_token" });

    const result = await listConsultantDiagnosticRobustness(env, authorization, auth.context);
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  // F3/D13. Película temporal para revisión del consultor.
  app.get("/v1/consultant/temporal", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const authorization = request.headers.authorization;
    if (!authorization) return reply.code(401).send({ error: "missing_bearer_token" });
    const result = await listConsultantTemporalDiagnoses(env, authorization, auth.context);
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  // F3/D14. Registro administrativo validado, con snapshot, evidencia y checks.
  app.get("/v1/consultant/diagnostic-outputs", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const authorization = request.headers.authorization;
    if (!authorization) return reply.code(401).send({ error: "missing_bearer_token" });
    const result = await listConsultantDiagnosticOutputs(env, authorization, auth.context);
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  // F4/P00. La primera pantalla deja visible si P0 puede empezar o debe
  // esperar a P1; no transforma la ausencia de contexto en una prioridad.
  app.get("/v1/consultant/prioritization", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const authorization = request.headers.authorization;
    if (!authorization) return reply.code(401).send({ error: "missing_bearer_token" });
    const result = await listConsultantPrioritizationRuns(env, authorization, auth.context);
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  // F4/P01. El contexto se expone como snapshot y la declaración solo entra
  // por la frontera de consultor; el worker es quien evalúa y persiste P1.
  app.get("/v1/consultant/decision-context", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const authorization = request.headers.authorization;
    if (!authorization) return reply.code(401).send({ error: "missing_bearer_token" });
    const result = await listConsultantDecisionContexts(env, authorization, auth.context);
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  app.post<{ Body: unknown }>("/v1/consultant/decision-context", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const result = await createConsultantDecisionContextDeclaration(env, auth.context, request.body);
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return reply.code(201).send(result.data);
  });

  app.get("/v1/consultant/temporal-urgency", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const authorization = request.headers.authorization;
    if (!authorization) return reply.code(401).send({ error: "missing_bearer_token" });
    const result = await listConsultantTemporalUrgency(env, authorization, auth.context);
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });
  app.get("/v1/consultant/decision-impact", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const authorization = request.headers.authorization;
    if (!authorization) return reply.code(401).send({ error: "missing_bearer_token" });
    const result = await listConsultantDecisionImpact(env, authorization, auth.context);
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });
  app.get("/v1/consultant/constraints", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const authorization = request.headers.authorization;
    if (!authorization) return reply.code(401).send({ error: "missing_bearer_token" });
    const result = await listConsultantConstraints(env, authorization, auth.context);
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });
  app.get("/v1/consultant/feasibility", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const authorization = request.headers.authorization;
    if (!authorization) return reply.code(401).send({ error: "missing_bearer_token" });
    const result = await listConsultantFeasibility(env, authorization, auth.context);
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });
  app.get("/v1/consultant/risk", async (request, reply) => { const auth = await resolveAuthContext(env, request.headers.authorization); if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error); const authorization = request.headers.authorization; if (!authorization) return reply.code(401).send({ error: "missing_bearer_token" }); const result = await listConsultantRisk(env, authorization, auth.context); if (isServiceFailure(result)) return sendServiceFailure(reply, result); return result.data; });
  app.get("/v1/consultant/allocation", async (request, reply) => { const auth = await resolveAuthContext(env, request.headers.authorization); if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error); const authorization = request.headers.authorization; if (!authorization) return reply.code(401).send({ error: "missing_bearer_token" }); const result = await listConsultantAllocation(env, authorization, auth.context); if (isServiceFailure(result)) return sendServiceFailure(reply, result); return result.data; });
  app.get("/v1/consultant/strategic-fit", async (request, reply) => { const auth = await resolveAuthContext(env, request.headers.authorization); if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error); const authorization = request.headers.authorization; if (!authorization) return reply.code(401).send({ error: "missing_bearer_token" }); const result = await listConsultantStrategicFit(env, authorization, auth.context); if (isServiceFailure(result)) return sendServiceFailure(reply, result); return result.data; });
  app.get("/v1/consultant/ranking", async (request, reply) => { const auth = await resolveAuthContext(env, request.headers.authorization); if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error); const authorization = request.headers.authorization; if (!authorization) return reply.code(401).send({ error: "missing_bearer_token" }); const result = await listConsultantRanking(env, authorization, auth.context); if (isServiceFailure(result)) return sendServiceFailure(reply, result); return result.data; });
  app.get("/v1/consultant/portfolio", async (request, reply) => { const auth = await resolveAuthContext(env, request.headers.authorization); if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error); const authorization = request.headers.authorization; if (!authorization) return reply.code(401).send({ error: "missing_bearer_token" }); const result = await listConsultantPortfolio(env, authorization, auth.context); if (isServiceFailure(result)) return sendServiceFailure(reply, result); return result.data; });
  app.get("/v1/consultant/decision-outputs", async (request, reply) => { const auth = await resolveAuthContext(env, request.headers.authorization); if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error); const authorization = request.headers.authorization; if (!authorization) return reply.code(401).send({ error: "missing_bearer_token" }); const result = await listConsultantDecisionOutputs(env, authorization, auth.context); if (isServiceFailure(result)) return sendServiceFailure(reply, result); return result.data; });
  app.get("/v1/consultant/playbooks", async (request, reply) => { const auth = await resolveAuthContext(env, request.headers.authorization); if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error); const authorization = request.headers.authorization; if (!authorization) return reply.code(401).send({ error: "missing_bearer_token" }); const result = await listConsultantPlaybookRuns(env, authorization, auth.context); if (isServiceFailure(result)) return sendServiceFailure(reply, result); return result.data; });
  app.get("/v1/consultant/acquisition", async (request, reply) => { const auth = await resolveAuthContext(env, request.headers.authorization); if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error); const authorization = request.headers.authorization; if (!authorization) return reply.code(401).send({ error: "missing_bearer_token" }); const result = await listConsultantAcquisitionRuns(env, authorization, auth.context); if (isServiceFailure(result)) return sendServiceFailure(reply, result); return result.data; });
  app.get("/v1/consultant/paid-media", async (request, reply) => { const auth = await resolveAuthContext(env, request.headers.authorization); if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error); const authorization = request.headers.authorization; if (!authorization) return reply.code(401).send({ error: "missing_bearer_token" }); const result = await listConsultantPaidMediaRuns(env, authorization, auth.context); if (isServiceFailure(result)) return sendServiceFailure(reply, result); return result.data; });
  app.get("/v1/consultant/conversion", async (request, reply) => { const auth = await resolveAuthContext(env, request.headers.authorization); if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error); const authorization = request.headers.authorization; if (!authorization) return reply.code(401).send({ error: "missing_bearer_token" }); const result = await listConsultantConversionRuns(env, authorization, auth.context); if (isServiceFailure(result)) return sendServiceFailure(reply, result); return result.data; });

  // F3/D07. Declarar una relacion causal propia de una tienda. Es lo que
  // desbloquea el bloque: el grafo global trae cinco aristas, y todo lo demas
  // que un consultor sabe de una tienda concreta no tenia donde escribirse.
  app.post("/v1/consultant/causal-edges", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

    const authorization = request.headers.authorization;
    if (!authorization) {
      return reply.code(401).send({ error: "missing_bearer_token" });
    }

    const parsed = causalEdgeInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "invalid_causal_edge",
        detail: parsed.error.message,
      });
    }

    const result = await createConsultantCausalEdge(
      env,
      authorization,
      auth.context,
      parsed.data,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return reply.code(201).send(result.data);
  });
  // F3/D11. Cuanto se puede afirmar de cada cosa, capa por capa, y que falta
  // para afirmar mas. Es lo unico que impide leer un caso descrito como un caso
  // explicado. Solo consultor.
  app.get("/v1/consultant/confidence", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

    const authorization = request.headers.authorization;
    if (!authorization) {
      return reply.code(401).send({ error: "missing_bearer_token" });
    }

    const result = await listConsultantConfidence(
      env,
      authorization,
      auth.context,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  // F3/D10. Cuanto dano hay, medido: cuanto se movio, sobre que base y con que
  // supuestos. **Ninguna severidad**: la fuente no define formula ni umbral.
  // Solo consultor -- una cifra de perdida sin causa es un susto sin salida.
  app.get("/v1/consultant/severity", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);

    if (isAuthContextError(auth)) {
      return sendAuthFailure(reply, auth.error);
    }

    const authorization = request.headers.authorization;
    if (!authorization) {
      return reply.code(401).send({ error: "missing_bearer_token" });
    }

    const result = await listConsultantSeverity(
      env,
      authorization,
      auth.context,
    );

    if (isServiceFailure(result)) {
      return sendServiceFailure(reply, result);
    }

    return result.data;
  });

  // F3/D04. Como esta cada capacidad hoy, y cuando no se puede saber, que falta
  // declarar para poder saberlo. Solo consultor: el estado de una capacidad es
  // una etiqueta sin la conversacion que la acompana.
  app.get("/v1/consultant/capability-health", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);

    if (isAuthContextError(auth)) {
      return sendAuthFailure(reply, auth.error);
    }

    const authorization = request.headers.authorization;
    if (!authorization) {
      return reply.code(401).send({ error: "missing_bearer_token" });
    }

    const result = await listConsultantCapabilityHealth(
      env,
      authorization,
      auth.context,
    );

    if (isServiceFailure(result)) {
      return sendServiceFailure(reply, result);
    }

    return result.data;
  });

  // F3/D05. Las senales en crudo: que ha cambiado, cuanto y desde cuando, sin
  // interpretar por que. Solo consultor -- el guardrail 2 de D05 dice que no
  // toda senal es un problema, y una lista de desviaciones delante del cliente
  // es una alarma permanente.
  app.get("/v1/consultant/signals", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);

    if (isAuthContextError(auth)) {
      return sendAuthFailure(reply, auth.error);
    }

    const authorization = request.headers.authorization;
    if (!authorization) {
      return reply.code(401).send({ error: "missing_bearer_token" });
    }

    const result = await listConsultantSignals(
      env,
      authorization,
      auth.context,
    );

    if (isServiceFailure(result)) {
      return sendServiceFailure(reply, result);
    }

    return result.data;
  });

  // F3/D06. El mapa de sintomas activos: que patron empresarial forman las
  // senales coherentes entre si, con que se sostiene y que lo contradice. Solo
  // consultor: un sintoma es un patron sin causa, y ensenarselo al cliente le da
  // el susto sin la salida.
  app.get("/v1/consultant/symptoms", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);

    if (isAuthContextError(auth)) {
      return sendAuthFailure(reply, auth.error);
    }

    const authorization = request.headers.authorization;
    if (!authorization) {
      return reply.code(401).send({ error: "missing_bearer_token" });
    }

    const result = await listConsultantSymptomMap(
      env,
      authorization,
      auth.context,
    );

    if (isServiceFailure(result)) {
      return sendServiceFailure(reply, result);
    }

    return result.data;
  });

  app.get("/v1/consultant/data-quality", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);

    if (isAuthContextError(auth)) {
      return sendAuthFailure(reply, auth.error);
    }

    const authorization = request.headers.authorization;
    if (!authorization) {
      return reply.code(401).send({ error: "missing_bearer_token" });
    }

    const result = await listConsultantDataQuality(
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

  // "Mi trabajo": proximas llamadas con lo que hay que preparar, tareas
  // internas del consultor y clientes sin nada agendado. Compone datos que ya
  // existen; no hay tabla nueva detras.
  app.get("/v1/consultant/work", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);

    if (isAuthContextError(auth)) {
      return sendAuthFailure(reply, auth.error);
    }

    const authorization = request.headers.authorization;
    if (!authorization) {
      return reply.code(401).send({ error: "missing_bearer_token" });
    }

    const result = await listConsultantWork(env, authorization, auth.context);

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

  app.post<{
    Body: {
      email?: string;
      full_name?: string;
      grant_plan?: {
        plan_code?: string;
        store_limit?: number | string | null;
        ends_at?: string | null;
      } | null;
    };
  }>(
    "/v1/admin/consultants",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

      const result = await inviteConsultant(
        env,
        auth.context,
        request.body ?? {},
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return reply.code(201).send(result.data);
    },
  );

  app.patch<{
    Params: { userId: string };
    Body: { full_name?: string; is_active?: boolean };
  }>("/v1/admin/consultants/:userId", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

    const result = await updateConsultant(
      env,
      auth.context,
      request.params.userId,
      request.body ?? {},
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  app.post<{ Params: { userId: string } }>(
    "/v1/admin/consultants/:userId/resend-invite",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

      const result = await resendConsultantInvite(
        env,
        auth.context,
        request.params.userId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.delete<{ Params: { userId: string } }>(
    "/v1/admin/consultants/:userId",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

      const result = await deleteConsultant(
        env,
        auth.context,
        request.params.userId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.get("/v1/admin/clients", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

    const result = await listAdminClients(env, auth.context);
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  // /admin/logs: el rastro de auditoria (61 puntos del codigo lo escriben y
  // no habia una sola lectura) y lo que se ha roto en la plataforma.
  app.get<{
    Querystring: {
      organizationId?: string;
      action?: string;
      actorUserId?: string;
      before?: string;
      limit?: string;
    };
  }>("/v1/admin/audit-log", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

    const result = await getAuditLog(env, auth.context, request.query ?? {});
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  app.get<{ Querystring: { days?: string; limit?: string } }>(
    "/v1/admin/platform-errors",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

      const result = await getPlatformErrors(
        env,
        auth.context,
        request.query ?? {},
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.get("/v1/admin/observability", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

    const result = await getAdminObservability(env, auth.context);
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  // Fase 4: tarjeta del orquestador de diagnosticos IA (gasto de plataforma,
  // ejecuciones de hoy, decisiones del gate). Solo platform_admin.
  app.get("/v1/admin/ai-orchestrator", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

    const result = await getDiagnosticOrchestratorObservability(
      env,
      auth.context,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  app.post<{
    Body: {
      display_name?: string;
      owner_email?: string;
      owner_full_name?: string;
      timezone?: string;
      currency_code?: string;
      grant_plan?: {
        plan_code?: string;
        store_limit?: number | string | null;
        ends_at?: string | null;
      } | null;
    };
  }>("/v1/admin/clients", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

    const result = await createClientOrganization(
      env,
      auth.context,
      request.body ?? {},
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return reply.code(201).send(result.data);
  });

  app.get<{
    Params: { organizationId: string };
    Querystring: { year?: string; storeId?: string };
  }>(
    "/v1/organizations/:organizationId/campaign-planning",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const planningFilters: { year?: number; storeId?: string | null } = {
        storeId: request.query.storeId || null,
      };
      if (request.query.year) planningFilters.year = Number(request.query.year);
      const result = await listCampaignPlanning(
        env,
        auth.context,
        request.params.organizationId,
        planningFilters,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.get<{
    Params: { organizationId: string };
    Querystring: { storeId?: string };
  }>(
    "/v1/organizations/:organizationId/campaign-planning/resources",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await listCampaignPlanningResources(
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
    Querystring: { storeId?: string; period?: string; limit?: string };
  }>(
    "/v1/organizations/:organizationId/kpi-snapshots",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await listKpiSnapshots(
        env,
        auth.context,
        request.params.organizationId,
        {
          storeId: request.query.storeId || null,
          ...(request.query.period ? { period: request.query.period } : {}),
          ...(request.query.limit
            ? { limit: Number(request.query.limit) }
            : {}),
        },
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string };
    Body: {
      name?: string;
      year?: number;
      storeId?: string | null;
      description?: string | null;
      isVisibleToClient?: boolean;
    };
  }>(
    "/v1/organizations/:organizationId/campaign-planning/calendars",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await createCampaignCalendar(
        env,
        auth.context,
        request.params.organizationId,
        request.body ?? {},
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return reply.code(201).send(result.data);
    },
  );

  app.post<{
    Params: { organizationId: string };
    Body: {
      calendarId?: string;
      title?: string;
      description?: string | null;
      channel?: string;
      itemType?: string;
      startsAt?: string;
      endsAt?: string | null;
      storeId?: string | null;
      status?: string;
      isVisibleToClient?: boolean;
      createTask?: boolean;
      milestoneId?: string | null;
      marketingDraftId?: string | null;
      metaCampaignId?: string | null;
      klaviyoCampaignId?: string | null;
    };
  }>(
    "/v1/organizations/:organizationId/campaign-planning/items",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await createCampaignCalendarItem(
        env,
        auth.context,
        request.params.organizationId,
        request.body ?? {},
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return reply.code(201).send(result.data);
    },
  );

  app.delete<{
    Params: { organizationId: string; itemId: string };
  }>(
    "/v1/organizations/:organizationId/campaign-planning/items/:itemId",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await archiveCampaignCalendarItem(
        env,
        auth.context,
        request.params.organizationId,
        request.params.itemId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return reply.send(result.data);
    },
  );

  app.patch<{
    Params: { organizationId: string; itemId: string };
    Body: {
      title?: string;
      channel?: string;
      startsAt?: string;
      endsAt?: string | null;
      status?: string;
      marketingDraftId?: string | null;
      metaCampaignId?: string | null;
      klaviyoCampaignId?: string | null;
    };
  }>(
    "/v1/organizations/:organizationId/campaign-planning/items/:itemId",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await updateCampaignCalendarItem(
        env,
        auth.context,
        request.params.organizationId,
        request.params.itemId,
        request.body ?? {},
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return reply.send(result.data);
    },
  );

  app.post<{
    Params: { organizationId: string };
    Body: {
      storeId?: string | null;
      period?: string;
      periodStart?: string;
      periodEnd?: string;
      netSales?: number | null;
      ordersCount?: number | null;
      aov?: number | null;
      adSpend?: number | null;
      roas?: number | null;
      cac?: number | null;
      netProfit?: number | null;
      notes?: string | null;
    };
  }>(
    "/v1/organizations/:organizationId/kpi-snapshots",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await upsertKpiSnapshot(
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

  for (const [suffix, handler] of [
    ["pause", pauseConsultantClient],
    ["resume", resumeConsultantClient],
    ["unlink", unlinkConsultantClient],
    ["hard-delete", hardDeleteOrganization],
  ] as const) {
    app.post<{ Params: { organizationId: string } }>(
      `/v1/consultant/organizations/:organizationId/${suffix}`,
      async (request, reply) => {
        const auth = await resolveAuthContext(
          env,
          request.headers.authorization,
        );
        if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

        const result = await handler(
          env,
          auth.context,
          request.params.organizationId,
        );
        if (isServiceFailure(result)) return sendServiceFailure(reply, result);
        return result.data;
      },
    );
  }

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

  // F3/D01, vista de cliente. Solo lo que ocurre en sus sistemas y ya esta
  // verificado: la regla vive en `data-quality.ts` y en la RLS, no aqui.
  app.get<{ Params: { organizationId: string } }>(
    "/v1/organizations/:organizationId/data-quality",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const authorization = request.headers.authorization;

      if (!authorization) {
        return reply.code(401).send({ error: "missing_bearer_token" });
      }

      const result = await listOrganizationDataQuality(
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

  // Recurrencia, cohortes, atribucion, devoluciones, entregas, carritos y
  // promociones. Van juntas en una llamada porque la pagina las pinta a la
  // vez y cada RPC ya falla por su cuenta dentro.
  app.get<{
    Params: { organizationId: string };
    Querystring: { days?: string; connectionId?: string };
  }>(
    "/v1/organizations/:organizationId/shopify/insights",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const authorization = request.headers.authorization;

      if (!authorization) {
        return reply.code(401).send({ error: "missing_bearer_token" });
      }

      const result = await getShopifyInsights(
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
  // Creatividades, veredictos de subasta, aprendizaje, pixel, publicos y el
  // impacto de los cambios. Una sola llamada porque la pagina los pinta a la
  // vez, y cada RPC falla por su cuenta dentro.
  app.get<{
    Params: { organizationId: string };
    Querystring: { days?: string; connectionId?: string };
  }>(
    "/v1/organizations/:organizationId/meta/insights",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const authorization = request.headers.authorization;

      if (!authorization) {
        return reply.code(401).send({ error: "missing_bearer_token" });
      }

      const result = await getMetaInsights(
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
  // Modulo de Klaviyo: inventario de emails, salud de la medicion y
  // rendimiento mensual, en una llamada porque la pagina los pinta juntos.
  app.get<{
    Params: { organizationId: string };
    Querystring: { days?: string; connectionId?: string };
  }>(
    "/v1/organizations/:organizationId/klaviyo/insights",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const authorization = request.headers.authorization;

      if (!authorization) {
        return reply.code(401).send({ error: "missing_bearer_token" });
      }

      const result = await getKlaviyoInsights(
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
    Body: {
      rows?: Array<{ sku?: string; unitCost?: number; currencyCode?: string }>;
      dryRun?: boolean;
    };
  }>(
    "/v1/organizations/:organizationId/shopify/product-costs/import",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await importProductCosts(
        env,
        auth.context,
        request.params.organizationId,
        request.body ?? {},
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      // 200 y no 201: con `dryRun` no se crea nada, y sin el la respuesta
      // interesante es el desglose por linea, no un recurso nuevo.
      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string };
    Body: {
      metricKey?: string;
      targetValue?: number;
      period?: string;
      storeId?: string | null;
    };
  }>(
    "/v1/organizations/:organizationId/financial-config/metric-targets",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await upsertMetricTarget(
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
    "/v1/organizations/:organizationId/financial-config/metric-targets/:targetId",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await retireMetricTarget(
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

  app.post<{
    Params: { organizationId: string };
    Body: { draftId?: string };
  }>(
    "/v1/organizations/:organizationId/klaviyo/templates/push",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const draftId = request.body?.draftId;
      if (typeof draftId !== "string" || !draftId.trim()) {
        return reply.code(400).send({ error: "missing_draft_id" });
      }
      const result = await pushDraftToKlaviyoTemplate(
        env,
        auth.context,
        request.params.organizationId,
        draftId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
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
    Querystring: { days?: string; connectionId?: string };
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
        request.query.connectionId,
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

  // Que cuenta de Meta y de Klaviyo pertenece a que tienda Shopify. Con una
  // sola tienda la migracion ya lo resolvio sola; esto existe para el cliente
  // con varias, donde adivinarlo seria inventarse la atribucion.
  app.get<{ Params: { organizationId: string } }>(
    "/v1/organizations/:organizationId/store-scope",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await listStoreScope(
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
    Body: StoreScopeInput;
  }>(
    "/v1/organizations/:organizationId/store-scope",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await assignStoreScope(
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
    Querystring: { days?: string; connectionId?: string };
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
        request.query.connectionId,
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
      milestoneId?: string | null;
    };
  }>("/v1/organizations/:organizationId/tasks", async (request, reply) => {
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
  });

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

  // Configuracion de avisos por cliente. El motor (`runAlertRules`) ya lee
  // `organization_alert_rules`; estas son las rutas que faltaban para poder
  // escribir en ella.
  app.get<{ Params: { organizationId: string } }>(
    "/v1/organizations/:organizationId/alert-rules",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const authorization = request.headers.authorization;

      if (!authorization) {
        return reply.code(401).send({ error: "missing_bearer_token" });
      }

      const result = await listAlertRules(
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
    Params: { organizationId: string; templateId: string };
    Body: {
      isEnabled?: boolean;
      severity?: string | null;
      threshold?: number | null;
    };
  }>(
    "/v1/organizations/:organizationId/alert-rules/:templateId",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await upsertAlertRule(
        env,
        auth.context,
        request.params.organizationId,
        request.params.templateId,
        request.body ?? {},
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

  app.get<{
    Params: { organizationId: string };
    Querystring: { storeId?: string };
  }>("/v1/organizations/:organizationId/objectives", async (request, reply) => {
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
      request.query.storeId || null,
    );

    if (isServiceFailure(result)) {
      return sendServiceFailure(reply, result);
    }

    return result.data;
  });

  app.post<{
    Params: { organizationId: string };
    Body: {
      metricKey?: string;
      targetValue?: number;
      period?: string;
      storeId?: string | null;
    };
  }>("/v1/organizations/:organizationId/objectives", async (request, reply) => {
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
  });

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
    if (
      !["platform_admin", "consultant"].includes(
        auth.context.profile.platform_role,
      )
    ) {
      return reply
        .code(403)
        .send({ error: "agent_eval_readiness_access_denied" });
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

  // Planes semanal (A17) y mensual (A18): mismo par de rutas que A04, con el
  // horizonte en la ruta. El reparto dia/semana/mes lo enseña el prompt de cada
  // agente; aqui solo se elige cual corre.
  app.get<{
    Params: { organizationId: string; horizon: string };
    Querystring: { connectionId?: string; days?: string };
  }>(
    "/v1/organizations/:organizationId/ai/plan/:horizon",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      if (!isPlanHorizon(request.params.horizon)) {
        return reply.code(400).send({ error: "invalid_plan_horizon" });
      }

      const result = await getPlanDiagnostic(
        env,
        auth.context,
        request.params.organizationId,
        request.params.horizon,
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
    Params: { organizationId: string; horizon: string };
    Querystring: { connectionId?: string; days?: string };
  }>(
    "/v1/organizations/:organizationId/ai/plan/:horizon/run",
    aiEndpointRateLimit,
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      if (!isPlanHorizon(request.params.horizon)) {
        return reply.code(400).send({ error: "invalid_plan_horizon" });
      }

      const result = await runPlanAgent(
        env,
        auth.context,
        request.params.organizationId,
        request.params.horizon,
        request.query.connectionId,
        request.query.days ? Number(request.query.days) : null,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return reply.code(201).send(result.data);
    },
  );

  // A19: propuesta de CAMINO (plan estrategico completo) para un horizonte.
  // No se autogenera al abrir la pantalla como los diagnosticos: el GET solo
  // recupera la propuesta que ya exista, el POST es el que gasta modelo.
  app.get<{ Params: { organizationId: string } }>(
    "/v1/organizations/:organizationId/ai/camino-proposal",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await getCaminoProposal(
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
    Querystring: { connectionId?: string };
    Body: { horizon?: string };
  }>(
    "/v1/organizations/:organizationId/ai/camino-proposal/run",
    aiEndpointRateLimit,
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const horizon = request.body?.horizon ?? "";
      if (!isCaminoHorizon(horizon)) {
        return reply.code(400).send({ error: "invalid_camino_horizon" });
      }

      const result = await runCaminoArchitectAgent(
        env,
        auth.context,
        request.params.organizationId,
        horizon,
        request.query.connectionId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return reply.code(201).send(result.data);
    },
  );

  // Aceptar la propuesta: crea el plan real en estado borrador. Activarlo
  // sigue siendo un segundo gesto humano (activateStrategicPlan).
  app.post<{
    Params: { organizationId: string };
    Body: { output_id?: string };
  }>(
    "/v1/organizations/:organizationId/strategic-plan/from-proposal",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const outputId = request.body?.output_id;
      if (!outputId) {
        return reply.code(400).send({ error: "output_id_requerido" });
      }

      const result = await createStrategicPlanFromProposal(
        env,
        auth.context,
        request.params.organizationId,
        outputId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return reply.code(201).send(result.data);
    },
  );

  // A05: propuesta de PLAN DE CAMPANAS para un horizonte. Mismo patron que el
  // camino: el GET solo recupera lo que ya exista, el POST gasta modelo, y una
  // tercera ruta materializa lo aprobado -- aqui, como items del calendario.
  app.get<{ Params: { organizationId: string } }>(
    "/v1/organizations/:organizationId/ai/campaign-plan",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await getCampaignPlanProposal(
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
    Querystring: { connectionId?: string };
    Body: { horizon?: string };
  }>(
    "/v1/organizations/:organizationId/ai/campaign-plan/run",
    aiEndpointRateLimit,
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const horizon = request.body?.horizon ?? "";
      if (!isCampaignPlanHorizon(horizon)) {
        return reply.code(400).send({ error: "invalid_campaign_plan_horizon" });
      }

      const result = await runCampaignStrategist(
        env,
        auth.context,
        request.params.organizationId,
        horizon,
        request.query.connectionId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return reply.code(201).send(result.data);
    },
  );

  // Aceptar (total o parcialmente): crea las campanas elegidas en el
  // calendario, en estado `planned` y no visibles al cliente todavia.
  app.post<{
    Params: { organizationId: string };
    Body: {
      output_id?: string;
      calendar_id?: string;
      selected_indexes?: number[];
    };
  }>(
    "/v1/organizations/:organizationId/campaign-planning/from-proposal",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await createCampaignItemsFromProposal(
        env,
        auth.context,
        request.params.organizationId,
        {
          outputId: request.body?.output_id,
          calendarId: request.body?.calendar_id,
          selectedIndexes: request.body?.selected_indexes,
        },
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

  // AI (A13/A14): operativa por canal para el consultor. Mismo patron: GET
  // sirve cache (lo regenera el orquestador), POST -run fuerza una ejecucion.
  for (const agent of [
    {
      slug: "operativa-shopify",
      get: getOperativaShopifyDiagnostic,
      run: runOperativaShopifyAgent,
    },
    {
      slug: "operativa-meta",
      get: getOperativaMetaDiagnostic,
      run: runOperativaMetaAgent,
    },
    // A20/A21/A22: especialistas del modulo de Shopify. Mismo contrato que la
    // operativa por canal, asi que entran en el mismo bucle en vez de repetir
    // seis endpoints identicos.
    {
      slug: "retencion-clientes",
      get: getRetencionClientesDiagnostic,
      run: runRetencionClientesAgent,
    },
    {
      slug: "adquisicion-shopify",
      get: getAdquisicionShopifyDiagnostic,
      run: runAdquisicionShopifyAgent,
    },
    {
      slug: "postventa-shopify",
      get: getPostventaShopifyDiagnostic,
      run: runPostventaShopifyAgent,
    },
    // A23/A24/A25: especialistas del modulo de Meta, mismo contrato.
    {
      slug: "creatividad-meta",
      get: getCreatividadMetaDiagnostic,
      run: runCreatividadMetaAgent,
    },
    {
      slug: "medicion-meta",
      get: getMedicionMetaDiagnostic,
      run: runMedicionMetaAgent,
    },
    {
      slug: "cambios-meta",
      get: getCambiosMetaDiagnostic,
      run: runCambiosMetaAgent,
    },
    // A26: contenido del email. Mismo contrato que los especialistas de Meta.
    {
      slug: "contenido-email",
      get: getContenidoEmailDiagnostic,
      run: runContenidoEmailAgent,
    },
  ] as const) {
    app.get<{ Params: { organizationId: string } }>(
      `/v1/organizations/:organizationId/ai/${agent.slug}`,
      async (request, reply) => {
        const auth = await resolveAuthContext(
          env,
          request.headers.authorization,
        );
        if (isAuthContextError(auth)) {
          return sendAuthFailure(reply, auth.error);
        }
        const result = await agent.get(
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
      `/v1/organizations/:organizationId/ai/${agent.slug}-run`,
      aiEndpointRateLimit,
      async (request, reply) => {
        const auth = await resolveAuthContext(
          env,
          request.headers.authorization,
        );
        if (isAuthContextError(auth)) {
          return sendAuthFailure(reply, auth.error);
        }
        const result = await agent.run(
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
  }

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
    // `edits`: el consultor reescribe o descarta propuestas sueltas antes de
    // que se creen como tareas reales (ver ProposedWriteEdit en ai-runtime).
    Body: { decision?: string; reason?: string; edits?: ProposedWriteEdit[] };
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
        Array.isArray(request.body?.edits) ? request.body.edits : undefined,
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
  app.post<{
    Params: { organizationId: string };
    Body: Record<string, unknown>;
  }>(
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
  app.post<{
    Params: { organizationId: string };
    Body: Record<string, unknown>;
  }>(
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

  // --- Banco de imágenes de Instagram (módulo Marketing, vista cliente) ---

  app.post<{
    Params: { organizationId: string };
    Body: Record<string, unknown>;
  }>(
    "/v1/organizations/:organizationId/instagram/image-bank",
    { bodyLimit: 8 * 1024 * 1024 },
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

      const result = await enqueueInstagramImage(
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
    "/v1/organizations/:organizationId/instagram/image-bank",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const authorization = request.headers.authorization;
      if (!authorization)
        return reply.code(401).send({ error: "missing_bearer_token" });

      const result = await listInstagramImageBank(
        env,
        authorization,
        auth.context,
        request.params.organizationId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.patch<{
    Params: { organizationId: string; imageId: string };
    Body: Record<string, unknown>;
  }>(
    "/v1/organizations/:organizationId/instagram/image-bank/:imageId",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

      const result = await updateInstagramImageMarkdown(
        env,
        auth.context,
        request.params.organizationId,
        request.params.imageId,
        request.body ?? {},
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.post<{ Params: { organizationId: string; imageId: string } }>(
    "/v1/organizations/:organizationId/instagram/image-bank/:imageId/retry",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

      const result = await retryInstagramImage(
        env,
        auth.context,
        request.params.organizationId,
        request.params.imageId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.delete<{ Params: { organizationId: string; imageId: string } }>(
    "/v1/organizations/:organizationId/instagram/image-bank/:imageId",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

      const result = await deleteInstagramImage(
        env,
        auth.context,
        request.params.organizationId,
        request.params.imageId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  // --- Piezas estáticas: texto sobre una imagen del banco ---

  app.get<{
    Params: { organizationId: string };
    Querystring: { imageId?: string };
  }>(
    "/v1/organizations/:organizationId/instagram/overlays",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const authorization = request.headers.authorization;
      if (!authorization)
        return reply.code(401).send({ error: "missing_bearer_token" });

      const result = await listInstagramOverlays(
        env,
        authorization,
        auth.context,
        request.params.organizationId,
        request.query.imageId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string };
    Body: Record<string, unknown>;
  }>(
    "/v1/organizations/:organizationId/instagram/overlays",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

      const result = await createInstagramOverlay(
        env,
        auth.context,
        request.params.organizationId,
        request.body ?? {},
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return reply.code(201).send(result.data);
    },
  );

  app.patch<{
    Params: { organizationId: string; overlayId: string };
    Body: Record<string, unknown>;
  }>(
    "/v1/organizations/:organizationId/instagram/overlays/:overlayId",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

      const result = await updateInstagramOverlay(
        env,
        auth.context,
        request.params.organizationId,
        request.params.overlayId,
        request.body ?? {},
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.delete<{ Params: { organizationId: string; overlayId: string } }>(
    "/v1/organizations/:organizationId/instagram/overlays/:overlayId",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

      const result = await deleteInstagramOverlay(
        env,
        auth.context,
        request.params.organizationId,
        request.params.overlayId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string; overlayId: string };
    Body: Record<string, unknown>;
  }>(
    "/v1/organizations/:organizationId/instagram/overlays/:overlayId/ai-draft",
    aiEndpointRateLimit,
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

      const result = await draftInstagramOverlayText(
        env,
        auth.context,
        request.params.organizationId,
        request.params.overlayId,
        request.body ?? {},
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string; overlayId: string };
    Body: Record<string, unknown>;
  }>(
    "/v1/organizations/:organizationId/instagram/overlays/:overlayId/caption",
    aiEndpointRateLimit,
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

      const result = await generatePublicationCaption(
        env,
        auth.context,
        request.params.organizationId,
        request.params.overlayId,
        request.body ?? {},
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
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

  // AI-05: Consultor IA (A09). Chat de solo lectura sobre las tools de lectura
  // del tenant; sin aprobacion (nunca escribe en el dominio). `view_context`
  // es la pantalla desde la que se pregunta (modulo, tienda, periodo, cifras
  // visibles): se sanea en runConsultantChatTurn y nunca amplia el alcance de
  // datos, que lo sigue fijando `organizationId` + membership.
  app.post<{
    Params: { organizationId: string };
    Body: {
      message?: string;
      conversation_id?: string;
      view_context?: ConsultantChatViewContext;
      model?: string;
    };
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
        request.body?.view_context,
        request.body?.model,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return reply.code(201).send(result.data);
    },
  );

  // El saldo del copiloto. Solo se lee al abrir el panel: despues viaja en la
  // respuesta de cada mensaje, que es cuando cambia.
  app.get<{ Params: { organizationId: string } }>(
    "/v1/organizations/:organizationId/copilot/saldo",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await getCopilotBalance(
        env,
        auth.context,
        request.params.organizationId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return reply.send(result.data);
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
      audience?: string;
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

  app.get<{ Params: { organizationId: string; documentId: string } }>(
    "/v1/organizations/:organizationId/knowledge/documents/:documentId",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await getKnowledgeDocument(
        env,
        auth.context,
        request.params.organizationId,
        request.params.documentId,
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

  // Quien acompaña a este cliente. Sin esto el portal no puede distinguir un
  // cliente con consultor de uno que se apoya solo en los agentes: la relacion
  // solo se consultaba consultor -> organizaciones, nunca al reves.
  app.get<{ Params: { organizationId: string } }>(
    "/v1/organizations/:organizationId/my-consultant",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await getClientConsultant(
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

  // Reglas del cliente: lo que el copiloto tiene SIEMPRE delante, frente a los
  // documentos, que solo usa si salen en la busqueda. La tabla y su inyeccion
  // existian desde AI-07; estas son las tres rutas que faltaban para poder
  // crear una.
  app.get<{ Params: { organizationId: string } }>(
    "/v1/organizations/:organizationId/knowledge/constraints",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const authorization = request.headers.authorization;

      if (!authorization) {
        return reply.code(401).send({ error: "missing_bearer_token" });
      }

      const result = await listClientConstraints(
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
      category?: string;
      statement?: string;
      storeId?: string | null;
      validUntil?: string | null;
    };
  }>(
    "/v1/organizations/:organizationId/knowledge/constraints",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await createClientConstraint(
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
    Params: { organizationId: string; constraintId: string };
    Body: { status?: string };
  }>(
    "/v1/organizations/:organizationId/knowledge/constraints/:constraintId",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await setClientConstraintStatus(
        env,
        auth.context,
        request.params.organizationId,
        request.params.constraintId,
        request.body?.status,
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
  app.post<{
    Params: { organizationId: string; callId: string };
    Body: { focus?: string };
  }>(
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
        request.body?.focus,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return reply.code(201).send(result.data);
    },
  );

  app.post<{
    Params: { organizationId: string; summaryId: string };
    Body: {
      decision?: string;
      reason?: string;
      selectedTaskIndexes?: number[];
      taskMilestones?: Record<string, string>;
    };
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
        request.body?.selectedTaskIndexes,
        request.body?.taskMilestones,
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

    webhookScope.post("/v1/stripe/webhooks", async (request, reply) => {
      const result = await handleStripeWebhookRequest(
        env,
        request.headers as StripeWebhookHeaders,
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
      return reply
        .code(503)
        .send({ error: "internal_api_secret_not_configured" });
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

  app.post(
    "/v1/internal/instagram/process-image-queue",
    async (request, reply) => {
      if (!env.INTERNAL_API_SECRET) {
        return reply
          .code(503)
          .send({ error: "internal_api_secret_not_configured" });
      }
      if (request.headers["x-internal-secret"] !== env.INTERNAL_API_SECRET) {
        return reply.code(401).send({ error: "invalid_internal_secret" });
      }
      try {
        const result = await processInstagramImageQueue(env);
        return reply.code(200).send(result);
      } catch (error) {
        return reply.code(503).send({
          error: "instagram_image_queue_processing_failed",
          detail: error instanceof Error ? error.message : "unknown_error",
        });
      }
    },
  );

  app.post("/v1/internal/webhooks/purge-retained", async (request, reply) => {
    if (!env.INTERNAL_API_SECRET) {
      return reply
        .code(503)
        .send({ error: "internal_api_secret_not_configured" });
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
      return reply
        .code(503)
        .send({ error: "internal_api_secret_not_configured" });
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

  // Fase 3: pasada del orquestador de diagnosticos de fondo. La dispara el
  // worker por cron (2x/dia). Sincrono: son ~15 runs como mucho y el worker
  // quiere el resumen en su log.
  app.post("/v1/internal/ai/diagnostics/tick", async (request, reply) => {
    if (!env.INTERNAL_API_SECRET) {
      return reply
        .code(503)
        .send({ error: "internal_api_secret_not_configured" });
    }
    if (request.headers["x-internal-secret"] !== env.INTERNAL_API_SECRET) {
      return reply.code(401).send({ error: "invalid_internal_secret" });
    }
    try {
      const result = await runDiagnosticOrchestratorTick(env);
      if (result.ok === false) {
        return reply.code(result.statusCode).send({
          error: result.error,
          detail: result.message,
        });
      }
      return reply.code(200).send(result);
    } catch (error) {
      return reply.code(503).send({
        error: "ai_diagnostics_tick_failed",
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

  app.patch<{
    Params: { organizationId: string; itemId: string };
    Body: {
      status?: string;
      ownerUserId?: string | null;
      executionNotes?: string | null;
      blockedReason?: string | null;
      resultData?: Record<string, unknown>;
    };
  }>(
    "/v1/organizations/:organizationId/campaign-planning/items/:itemId/execution",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await updateCampaignCalendarExecution(
        env,
        auth.context,
        request.params.organizationId,
        request.params.itemId,
        request.body ?? {},
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.get<{
    Params: { organizationId: string };
    Querystring: { storeId?: string };
  }>(
    "/v1/organizations/:organizationId/campaign-planning/attention",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await listCampaignPlanningAttention(
        env,
        auth.context,
        request.params.organizationId,
        request.query.storeId || null,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
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

    // AI-30: decir en voz alta si la IA tiene red de seguridad. No aborta el
    // arranque -- un solo proveedor es una configuracion valida -- pero deja de
    // ser invisible, que es lo que costo una semana de ejecuciones muertas.
    const redundancy = describeProviderRedundancy(env);
    if (redundancy.level === "redundant") {
      logger.info(redundancy.message);
    } else {
      logger.error(`ai_provider_redundancy: ${redundancy.message}`);
    }

    registerGracefulShutdown(app);
  } catch (error) {
    logger.error("API failed to start", error);
    process.exit(1);
  }
}
