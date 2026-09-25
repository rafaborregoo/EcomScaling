import { Redis } from "ioredis";
import { createLogger } from "@e-nora/observability";

const logger = createLogger("api:redis-cache");

let client: InstanceType<typeof Redis> | null | undefined;

function getClient(redisUrl: string | undefined): InstanceType<typeof Redis> | null {
  if (!redisUrl) {
    return null;
  }

  if (client !== undefined) {
    return client;
  }

  const instance = new Redis(redisUrl, {
    maxRetriesPerRequest: 1,
    retryStrategy: () => null,
    lazyConnect: true,
  });

  instance.on("error", (error: Error) => {
    logger.error("Redis cache connection error, continuing without cache", error);
  });

  client = instance;
  return client;
}

export async function getCached<T>(redisUrl: string | undefined, key: string): Promise<T | null> {
  const redis = getClient(redisUrl);

  if (!redis) {
    return null;
  }

  try {
    const raw = await redis.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch (error) {
    logger.error(`Redis cache read failed for key ${key}, falling back to live query`, error);
    return null;
  }
}

export async function setCached(
  redisUrl: string | undefined,
  key: string,
  value: unknown,
  ttlSeconds: number,
): Promise<void> {
  const redis = getClient(redisUrl);

  if (!redis) {
    return;
  }

  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch (error) {
    logger.error(`Redis cache write failed for key ${key}, continuing without cache`, error);
  }
}
