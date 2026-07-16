import cors from "@fastify/cors";
import Fastify from "fastify";
import { loadApiEnv } from "@ecomscaling/config";
import { healthResponseSchema } from "@ecomscaling/contracts";
import { createLogger } from "@ecomscaling/observability";
import { listAccountActions } from "./actions.js";
import { listConsultantOrganizations } from "./consultant.js";
import { resolveAuthContext } from "./auth-context.js";
import { listIntegrations } from "./integrations.js";
import { createShopifyConnectionAuthUrl, handleShopifyOAuthCallback, triggerShopifySync } from "./shopify.js";
import { getShopifyOverview } from "./shopify-overview.js";
import { getShopifyMetrics } from "./shopify-metrics.js";
import { handleShopifyWebhookRequest } from "./shopify-webhook-handler.js";
import { reconcileAllShopifyConnections } from "./shopify-reconcile.js";
import { listProductCosts, upsertProductCost } from "./shopify-product-costs.js";

const env = loadApiEnv(process.env);
const logger = createLogger("api");

const app = Fastify({
  logger: true,
  genReqId: (request) =>
    request.headers["x-request-id"]?.toString() ?? crypto.randomUUID(),
});

await app.register(cors, {
  origin: env.WEB_ORIGIN,
  credentials: true,
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

  if (!result.ok) {
    return reply.code(result.error.statusCode).send(result.error);
  }

  return result.context;
});

app.get("/v1/actions", async (request, reply) => {
  const auth = await resolveAuthContext(env, request.headers.authorization);

  if (!auth.ok) {
    return reply.code(auth.error.statusCode).send(auth.error);
  }

  const authorization = request.headers.authorization;

  if (!authorization) {
    return reply.code(401).send({ error: "missing_bearer_token" });
  }

  const result = await listAccountActions(env, authorization, auth.context);

  if (!result.ok) {
    return reply.code(result.statusCode).send(result);
  }

  return result.data;
});

app.get("/v1/consultant/organizations", async (request, reply) => {
  const auth = await resolveAuthContext(env, request.headers.authorization);

  if (!auth.ok) {
    return reply.code(auth.error.statusCode).send(auth.error);
  }

  const authorization = request.headers.authorization;

  if (!authorization) {
    return reply.code(401).send({ error: "missing_bearer_token" });
  }

  const result = await listConsultantOrganizations(env, authorization, auth.context);

  if (!result.ok) {
    return reply.code(result.statusCode).send(result);
  }

  return result.data;
});

app.get<{ Params: { organizationId: string } }>(
  "/v1/organizations/:organizationId/integrations",
  async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);

    if (!auth.ok) {
      return reply.code(auth.error.statusCode).send(auth.error);
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

    if (!result.ok) {
      return reply.code(result.statusCode).send(result);
    }

    return result.data;
  },
);

app.get<{ Params: { organizationId: string } }>(
  "/v1/organizations/:organizationId/shopify/overview",
  async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);

    if (!auth.ok) {
      return reply.code(auth.error.statusCode).send(auth.error);
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
    );

    if (!result.ok) {
      return reply.code(result.statusCode).send(result);
    }

    return result.data;
  },
);

app.get<{ Params: { organizationId: string }; Querystring: { days?: string } }>(
  "/v1/organizations/:organizationId/shopify/metrics",
  async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);

    if (!auth.ok) {
      return reply.code(auth.error.statusCode).send(auth.error);
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
    );

    if (!result.ok) {
      return reply.code(result.statusCode).send(result);
    }

    return result.data;
  },
);

app.get<{ Params: { organizationId: string } }>(
  "/v1/organizations/:organizationId/shopify/product-costs",
  async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);

    if (!auth.ok) {
      return reply.code(auth.error.statusCode).send(auth.error);
    }

    const authorization = request.headers.authorization;

    if (!authorization) {
      return reply.code(401).send({ error: "missing_bearer_token" });
    }

    const result = await listProductCosts(env, authorization, auth.context, request.params.organizationId);

    if (!result.ok) {
      return reply.code(result.statusCode).send(result);
    }

    return result.data;
  },
);

app.post<{
  Params: { organizationId: string };
  Body: { sku?: string; inventoryItemId?: string; unitCost: number; currencyCode?: string; validFrom?: string };
}>("/v1/organizations/:organizationId/shopify/product-costs", async (request, reply) => {
  const auth = await resolveAuthContext(env, request.headers.authorization);

  if (!auth.ok) {
    return reply.code(auth.error.statusCode).send(auth.error);
  }

  const result = await upsertProductCost(env, auth.context, request.params.organizationId, request.body);

  if (!result.ok) {
    return reply.code(result.statusCode).send(result);
  }

  return reply.code(201).send(result.data);
});

app.post<{ Params: { organizationId: string }; Body: { shopDomain: string } }>(
  "/v1/organizations/:organizationId/integrations/shopify/connect",
  async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);

    if (!auth.ok) {
      return reply.code(auth.error.statusCode).send(auth.error);
    }

    if (!request.body?.shopDomain) {
      return reply.code(400).send({ error: "missing_shop_domain" });
    }

    const result = await createShopifyConnectionAuthUrl(
      env,
      auth.context,
      request.params.organizationId,
      request.body.shopDomain,
    );

    if (!result.ok) {
      return reply.code(result.statusCode).send(result);
    }

    return result.data;
  },
);

app.post<{ Params: { organizationId: string } }>(
  "/v1/organizations/:organizationId/shopify/sync",
  async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);

    if (!auth.ok) {
      return reply.code(auth.error.statusCode).send(auth.error);
    }

    const result = await triggerShopifySync(env, auth.context, request.params.organizationId);

    if (!result.ok) {
      return reply.code(result.statusCode).send(result);
    }

    return reply.code(202).send(result.data);
  },
);

app.get("/v1/shopify/oauth/callback", async (request, reply) => {
  const result = await handleShopifyOAuthCallback(
    env,
    request.query as Record<string, string | string[] | undefined>,
  );

  if (!result.ok) {
    return reply.code(result.statusCode).send(result);
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

try {
  await app.listen({ host: env.API_HOST, port: env.API_PORT });
  logger.info(`API listening on ${env.API_HOST}:${env.API_PORT}`);
} catch (error) {
  logger.error("API failed to start", error);
  process.exit(1);
}
