import { randomUUID } from "node:crypto";
import { getCached, setCached } from "./redis-cache.js";

/** A new generation prevents an in-flight old calculation from repopulating live keys. */
export async function integrationDataVersion(redisUrl: string | undefined, organizationId: string) {
  return await getCached<string>(redisUrl, `integration:data-version:${organizationId}`) ?? "0";
}

export async function invalidateIntegrationData(redisUrl: string | undefined, organizationId: string) {
  await setCached(redisUrl, `integration:data-version:${organizationId}`, randomUUID(), 30 * 24 * 60 * 60);
}
