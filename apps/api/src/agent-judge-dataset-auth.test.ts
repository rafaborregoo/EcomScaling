import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { FastifyInstance } from "fastify";
import { buildApp } from "./server.js";

let app: FastifyInstance;
before(async () => { app = await buildApp(); await app.ready(); });
after(async () => { await app?.close(); });

test("blind dataset queue and holdout export reject unauthenticated requests", async () => {
  const queue = await app.inject({ method: "GET", url: "/v1/admin/agent-judge-dataset/cases?split=holdout" });
  const holdout = await app.inject({ method: "GET", url: "/v1/admin/agent-judge-dataset/holdout?datasetVersion=judge-gold-v1" });
  const holdoutState = await app.inject({ method: "GET", url: "/v1/admin/agent-judge-dataset/holdout-state?datasetVersion=judge-gold-v1" });
  const certify = await app.inject({ method: "POST", url: "/v1/admin/agent-judge-dataset/certify", payload: {} });
  assert.equal(queue.statusCode, 401, queue.body);
  assert.equal(holdout.statusCode, 401, holdout.body);
  assert.equal(holdoutState.statusCode, 401, holdoutState.body);
  assert.equal(certify.statusCode, 401, certify.body);
});

test("blind dataset writes reject unauthenticated requests before reading a case", async () => {
  const response = await app.inject({ method: "POST", url: "/v1/admin/agent-judge-dataset/cases", payload: {} });
  assert.equal(response.statusCode, 401, response.body);
  const calibration = await app.inject({ method: "POST", url: "/v1/admin/agent-judge-dataset/calibrate", payload: { dataset_version: "judge-gold-v1", cost_limit_usd: 3 } });
  assert.equal(calibration.statusCode, 401, calibration.body);
});
