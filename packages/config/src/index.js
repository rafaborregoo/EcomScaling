import { z } from "zod";
const apiEnvSchema = z.object({
    API_HOST: z.string().default("0.0.0.0"),
    API_PORT: z.coerce.number().int().positive().default(4000),
    WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
});
const workerEnvSchema = z.object({
    REDIS_URL: z.string().url().default("redis://localhost:6379"),
});
export function loadApiEnv(source) {
    return apiEnvSchema.parse(source);
}
export function loadWorkerEnv(source) {
    return workerEnvSchema.parse(source);
}
