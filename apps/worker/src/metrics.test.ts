import assert from "node:assert/strict";
import test from "node:test";
import { recordWorkerJobMetric, workerMetrics } from "./metrics.js";

test("registra estados de job con etiquetas de baja cardinalidad", () => {
  const jobName = `metrics-test-${Date.now()}`;

  recordWorkerJobMetric(jobName, "started");
  recordWorkerJobMetric(jobName, "completed");
  recordWorkerJobMetric(jobName, "completed");
  recordWorkerJobMetric(jobName, "failed");

  const samples = workerMetrics
    .snapshot()
    .filter(
      (sample) =>
        sample.name === "worker_jobs_total" &&
        sample.labels.job_name === jobName,
    );

  assert.deepEqual(
    samples
      .map((sample) => ({
        status: sample.labels.status,
        value: sample.value,
      }))
      .sort((left, right) =>
        String(left.status).localeCompare(String(right.status)),
      ),
    [
      { status: "completed", value: 2 },
      { status: "failed", value: 1 },
      { status: "started", value: 1 },
    ],
  );
});
