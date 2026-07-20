import { pathToFileURL } from "node:url";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import Fastify, { type FastifyInstance } from "fastify";
import { loadApiEnv } from "@ecomscaling/config";
import { healthResponseSchema } from "@ecomscaling/contracts";
import { createLogger } from "@ecomscaling/observability";
import { listAccountActions } from "./actions.js";
import {
  deleteOrganization,
  deleteOrganizationStore,
  listConsultantOrganizations,
  listOrganizationStores,
  updateOrganization,
} from "./consultant.js";
import {
  isAuthContextError,
  resolveAuthContext,
  type AuthContextError,
} from "./auth-context.js";
import { listIntegrations } from "./integrations.js";
import { createShopifyConnectionAuthUrl, handleShopifyOAuthCallback, triggerShopifySync } from "./shopify.js";
import { getShopifyConnections, getShopifyOverview } from "./shopify-overview.js";
import { getShopifyMetrics } from "./shopify-metrics.js";
import { handleShopifyWebhookRequest } from "./shopify-webhook-handler.js";
import { reconcileAllShopifyConnections } from "./shopify-reconcile.js";
import { listProductCosts, upsertProductCost } from "./shopify-product-costs.js";
import {
  createFixedExpense,
  createShippingRule,
  deactivateFixedExpense,
  deactivateShippingRule,
  getFinancialConfig,
  upsertFinancialSettings,
} from "./financial-config.js";
import { createMetaConnectionAuthUrl, handleMetaOAuthCallback, triggerMetaSync } from "./meta.js";
import { getMetaMetrics } from "./meta-metrics.js";
import {
  addTaskComment,
  evaluateAlertRules,
  listOperations,
  runAlertRulesForAllOrganizations,
  updateAlertStatus,
  updateTaskStatus,
} from "./operations.js";
import {
  decideAgentOutput,
  getConsultantChatMessages,
  getMonitorDiagnostic,
  getKnowledgeManagerDiagnostic,
  getStockPlannerDiagnostic,
  getTaskPlannerDiagnostic,
  listAgentRuns,
  listConsultantChatConversations,
  runCallAnalyst,
  runConsultantChatTurn,
  runKnowledgeManagerAgent,
  runMonitorAgent,
  runStockPlannerAgent,
  runTaskPlannerAgent,
} from "./ai-runtime.js";
import { createKnowledgeDocument, listKnowledgeDocuments, searchKnowledge } from "./knowledge.js";
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
  activateStrategicPlan,
  addMilestoneInternalNote,
  createStrategicPlan,
  getStrategicPlan,
  linkTaskToMilestone,
  updateMilestoneStatus,
} from "./strategic-plans.js";

const logger = createLogger("api");

function sendAuthFailure(reply: { code: (statusCode: number) => { send: (payload: unknown) => unknown } }, error: AuthContextError) {
  return reply.code(error.statusCode).send(error);
}

type ServiceFailure = {
  ok: false;
  statusCode: number;
  [key: string]: unknown;
};

function isServiceFailure(result: { ok: boolean }): result is ServiceFailure {
  return result.ok === false;
}

function sendServiceFailure(
  reply: { code: (statusCode: number) => { send: (payload: unknown) => unknown } },
  result: unknown,
) {
  const failure = result as ServiceFailure;
  return reply.code(failure.statusCode).send(failure);
}

export async function buildApp(): Promise<FastifyInstance> {
  const env = loadApiEnv(process.env);
  const app = Fastify({
    logger: true,
    genReqId: (request) =>
      request.headers["x-request-id"]?.toString() ?? crypto.randomUUID(),
  });

  await app.register(cors, {
    origin: env.WEB_ORIGIN,
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"],
  });

  // SQO-00: cabeceras de seguridad. API pura JSON (nunca sirve HTML), asi que
  // desactivamos la CSP de helmet (pensada para paginas) y dejamos el resto
  // de cabeceras por defecto (X-Content-Type-Options, X-Frame-Options,
  // Referrer-Policy, HSTS, etc.).
  await app.register(helmet, {
    contentSecurityPolicy: false,
  });

  app.get("/health", async () =>
    healthResponseSchema.parse({
      status: "ok",
      service: "api",
      timestamp: new Date().toISOString(),
    }),
  );

  app.get("/v1/bootstrap", async (request, reply) => {
  const result = await resolveAuthContext(env, request.headers.authorization);

  if (isAuthContextError(result)) {
    return sendAuthFailure(reply, result.error);
  }

  return result.context;
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

  const result = await listConsultantOrganizations(env, authorization, auth.context);

  if (isServiceFailure(result)) {
    return sendServiceFailure(reply, result);
  }

  return result.data;
  });

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

    const result = await listOrganizationStores(env, authorization, auth.context, request.params.organizationId);

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

  app.delete<{ Params: { organizationId: string } }>(
  "/v1/consultant/organizations/:organizationId",
  async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);

    if (isAuthContextError(auth)) {
      return sendAuthFailure(reply, auth.error);
    }

    const result = await deleteOrganization(env, auth.context, request.params.organizationId);

    if (isServiceFailure(result)) {
      return sendServiceFailure(reply, result);
    }

    return result.data;
  },
  );

  app.patch<{
    Params: { organizationId: string };
    Body: { display_name?: string; status?: string; timezone?: string; currency_code?: string };
  }>(
  "/v1/consultant/organizations/:organizationId",
  async (request, reply) => {
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

  app.get<{ Params: { organizationId: string }; Querystring: { connectionId?: string } }>(
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

    const result = await getShopifyConnections(env, authorization, auth.context, request.params.organizationId);

    if (isServiceFailure(result)) {
      return sendServiceFailure(reply, result);
    }

    return result.data;
  },
  );

  app.get<{ Params: { organizationId: string }; Querystring: { days?: string; connectionId?: string } }>(
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

    const result = await listProductCosts(env, authorization, auth.context, request.params.organizationId);

    if (isServiceFailure(result)) {
      return sendServiceFailure(reply, result);
    }

    return result.data;
  },
  );

  app.post<{
  Params: { organizationId: string };
  Body: { sku?: string; inventoryItemId?: string; unitCost: number; currencyCode?: string; validFrom?: string };
}>("/v1/organizations/:organizationId/shopify/product-costs", async (request, reply) => {
  const auth = await resolveAuthContext(env, request.headers.authorization);

  if (isAuthContextError(auth)) {
    return sendAuthFailure(reply, auth.error);
  }

  const result = await upsertProductCost(env, auth.context, request.params.organizationId, request.body);

  if (isServiceFailure(result)) {
    return sendServiceFailure(reply, result);
  }

  return reply.code(201).send(result.data);
  });

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

    const result = await getFinancialConfig(env, authorization, auth.context, request.params.organizationId);

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
}>("/v1/organizations/:organizationId/financial-config/settings", async (request, reply) => {
  const auth = await resolveAuthContext(env, request.headers.authorization);

  if (isAuthContextError(auth)) {
    return sendAuthFailure(reply, auth.error);
  }

  const result = await upsertFinancialSettings(env, auth.context, request.params.organizationId, request.body ?? {});

  if (isServiceFailure(result)) {
    return sendServiceFailure(reply, result);
  }

  return result.data;
  });

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
}>("/v1/organizations/:organizationId/financial-config/fixed-expenses", async (request, reply) => {
  const auth = await resolveAuthContext(env, request.headers.authorization);

  if (isAuthContextError(auth)) {
    return sendAuthFailure(reply, auth.error);
  }

  const result = await createFixedExpense(env, auth.context, request.params.organizationId, request.body ?? {});

  if (isServiceFailure(result)) {
    return sendServiceFailure(reply, result);
  }

  return reply.code(201).send(result.data);
  });

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
}>("/v1/organizations/:organizationId/financial-config/shipping-rules", async (request, reply) => {
  const auth = await resolveAuthContext(env, request.headers.authorization);

  if (isAuthContextError(auth)) {
    return sendAuthFailure(reply, auth.error);
  }

  const result = await createShippingRule(env, auth.context, request.params.organizationId, request.body ?? {});

  if (isServiceFailure(result)) {
    return sendServiceFailure(reply, result);
  }

  return reply.code(201).send(result.data);
  });

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

  app.post<{ Params: { organizationId: string }; Body: { shopDomain: string; appMode?: "public" | "custom" } }>(
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

  app.post<{ Params: { organizationId: string }; Querystring: { connectionId?: string } }>(
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

    const result = await createMetaConnectionAuthUrl(env, auth.context, request.params.organizationId);

    if (isServiceFailure(result)) {
      return sendServiceFailure(reply, result);
    }

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

  app.get<{ Params: { organizationId: string }; Querystring: { days?: string } }>(
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

    const result = await triggerMetaSync(env, auth.context, request.params.organizationId);

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

    const result = await listOperations(env, authorization, auth.context, request.params.organizationId);

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

    const result = await evaluateAlertRules(env, auth.context, request.params.organizationId);

    if (isServiceFailure(result)) {
      return sendServiceFailure(reply, result);
    }

    return result.data;
  },
  );

  app.patch<{ Params: { organizationId: string; taskId: string }; Body: { status?: string; reason?: string } }>(
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

  app.post<{ Params: { organizationId: string; taskId: string }; Body: { body?: string; isInternal?: boolean } }>(
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

  app.patch<{ Params: { organizationId: string; alertId: string }; Body: { status?: string } }>(
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

    const result = await getStrategicPlan(env, authorization, auth.context, request.params.organizationId);

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
      milestones?: Array<{ name?: string; description?: string | null; targetDate?: string | null }>;
    }>;
  };
}>("/v1/organizations/:organizationId/strategic-plan", async (request, reply) => {
  const auth = await resolveAuthContext(env, request.headers.authorization);

  if (isAuthContextError(auth)) {
    return sendAuthFailure(reply, auth.error);
  }

  const result = await createStrategicPlan(env, auth.context, request.params.organizationId, request.body ?? {});

  if (isServiceFailure(result)) {
    return sendServiceFailure(reply, result);
  }

  return reply.code(201).send(result.data);
  });

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

  app.patch<{ Params: { organizationId: string; milestoneId: string }; Body: { status?: string } }>(
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

  app.post<{ Params: { organizationId: string; milestoneId: string }; Body: { body?: string } }>(
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

  app.post<{ Params: { organizationId: string; milestoneId: string }; Body: { taskId?: string } }>(
  "/v1/organizations/:organizationId/milestones/:milestoneId/tasks",
  async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);

    if (isAuthContextError(auth)) {
      return sendAuthFailure(reply, auth.error);
    }

    const result = await linkTaskToMilestone(
      env,
      auth.context,
      request.params.organizationId,
      request.params.milestoneId,
      request.body?.taskId,
    );

    if (isServiceFailure(result)) {
      return sendServiceFailure(reply, result);
    }

    return reply.code(201).send(result.data);
  },
  );

  // AI-02: diagnostico automatico, sin boton de "aprobar para ver" (RLS ya deja
  // ver pending_approval a consultor/admin). Devuelve el ultimo run fresco
  // (<24h) o genera uno nuevo sobre la marcha si no hay ninguno o esta viejo.
  app.get<{ Params: { organizationId: string }; Querystring: { connectionId?: string; days?: string } }>(
  "/v1/organizations/:organizationId/ai/monitor",
  async (request, reply) => {
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
  },
  );

  // Regenerar ahora (ignora la cache de 24h): boton secundario "Actualizar".
  app.post<{ Params: { organizationId: string }; Querystring: { connectionId?: string; days?: string } }>(
  "/v1/organizations/:organizationId/ai/monitor-run",
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
  app.get<{ Params: { organizationId: string }; Querystring: { connectionId?: string; days?: string } }>(
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

  app.post<{ Params: { organizationId: string }; Querystring: { connectionId?: string; days?: string } }>(
  "/v1/organizations/:organizationId/ai/task-planner-run",
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
  app.get<{ Params: { organizationId: string }; Querystring: { connectionId?: string; days?: string } }>(
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

  app.post<{ Params: { organizationId: string }; Querystring: { connectionId?: string; days?: string } }>(
  "/v1/organizations/:organizationId/ai/stock-planner-run",
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

    const result = await getKnowledgeManagerDiagnostic(env, auth.context, request.params.organizationId);

    if (isServiceFailure(result)) {
      return sendServiceFailure(reply, result);
    }

    return result.data;
  },
  );

  app.post<{ Params: { organizationId: string } }>(
  "/v1/organizations/:organizationId/ai/knowledge-manager-run",
  async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);

    if (isAuthContextError(auth)) {
      return sendAuthFailure(reply, auth.error);
    }

    const result = await runKnowledgeManagerAgent(env, auth.context, request.params.organizationId);

    if (isServiceFailure(result)) {
      return sendServiceFailure(reply, result);
    }

    return reply.code(201).send(result.data);
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

    const result = await listAgentRuns(env, authorization, auth.context, request.params.organizationId);

    if (isServiceFailure(result)) {
      return sendServiceFailure(reply, result);
    }

    return result.data;
  },
  );

  app.post<{ Params: { organizationId: string; outputId: string }; Body: { decision?: string; reason?: string } }>(
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

  // AI-05: copiloto del consultor (A09). Chat de solo lectura sobre sql_select
  // y search_knowledge; sin aprobacion (nunca escribe en el dominio).
  app.post<{ Params: { organizationId: string }; Body: { message?: string; conversation_id?: string } }>(
  "/v1/organizations/:organizationId/consultant-chat",
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

    const result = await listConsultantChatConversations(env, auth.context, request.params.organizationId);

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
    Body: { title?: string; description?: string; content?: string; source_type?: string };
  }>(
  "/v1/organizations/:organizationId/knowledge/documents",
  async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);

    if (isAuthContextError(auth)) {
      return sendAuthFailure(reply, auth.error);
    }

    const organizationId =
      request.params.organizationId === "global" ? null : request.params.organizationId;

    const result = await createKnowledgeDocument(env, auth.context, organizationId, request.body ?? {});

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

    const result = await listCalls(env, authorization, auth.context, request.params.organizationId);

    if (isServiceFailure(result)) {
      return sendServiceFailure(reply, result);
    }

    return result.data;
  },
  );

  app.post<{ Params: { organizationId: string }; Body: Record<string, unknown> }>(
  "/v1/organizations/:organizationId/calls",
  async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);

    if (isAuthContextError(auth)) {
      return sendAuthFailure(reply, auth.error);
    }

    const result = await createCall(env, auth.context, request.params.organizationId, request.body ?? {});

    if (isServiceFailure(result)) {
      return sendServiceFailure(reply, result);
    }

    return reply.code(201).send(result.data);
  },
  );

  app.patch<{ Params: { organizationId: string; callId: string }; Body: Record<string, unknown> }>(
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

  app.put<{ Params: { organizationId: string; callId: string }; Body: Record<string, unknown> }>(
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

  app.post<{ Params: { organizationId: string; callId: string }; Body: Record<string, unknown> }>(
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

  app.post<{ Params: { organizationId: string; callId: string }; Body: { body?: string } }>(
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

  app.post<{ Params: { organizationId: string; callId: string }; Body: Record<string, unknown> }>(
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
  webhookScope.addContentTypeParser("application/json", { parseAs: "buffer" }, (_request, body, done) => {
    done(null, body);
  });

  webhookScope.post("/v1/shopify/webhooks", async (request, reply) => {
    const result = await handleShopifyWebhookRequest(
      env,
      request.headers as Record<string, string | string[] | undefined>,
      request.body as Buffer,
    );

    return reply.code(result.statusCode).send(result.body);
  });
  });

  app.post("/v1/internal/operations/run-rules", async (request, reply) => {
  if (!env.INTERNAL_API_SECRET) {
    return reply.code(503).send({ error: "internal_api_secret_not_configured" });
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
    return reply.code(503).send({ error: "internal_api_secret_not_configured" });
  }

  if (request.headers["x-internal-secret"] !== env.INTERNAL_API_SECRET) {
    return reply.code(401).send({ error: "invalid_internal_secret" });
  }

  void reconcileAllShopifyConnections(env).catch((error: unknown) => {
    logger.error("Shopify reconciliation pass failed", error);
  });

  return reply.code(202).send({ status: "reconciliation_started" });
  });

  return app;
}

const isDirectRun = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;

if (isDirectRun) {
  const env = loadApiEnv(process.env);
  const app = await buildApp();

  try {
    await app.listen({ host: env.API_HOST, port: env.API_PORT });
    logger.info(`API listening on ${env.API_HOST}:${env.API_PORT}`);
  } catch (error) {
    logger.error("API failed to start", error);
    process.exit(1);
  }
}
