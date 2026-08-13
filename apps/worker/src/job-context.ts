import crypto from "node:crypto";

export type WorkerJobContext = {
  job_name: string;
  job_id: string | null;
  correlation_id: string;
};

export function createWorkerJobContext(
  jobName: string,
  jobId: string | null = null,
): WorkerJobContext {
  return {
    job_name: jobName,
    job_id: jobId,
    correlation_id: `worker:${jobName}:${jobId ?? crypto.randomUUID()}`,
  };
}

export function workerJobMeta(
  context: WorkerJobContext,
  extra: Record<string, unknown> = {},
): WorkerJobContext & Record<string, unknown> {
  return {
    job_name: context.job_name,
    job_id: context.job_id,
    correlation_id: context.correlation_id,
    ...extra,
  };
}
