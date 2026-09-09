/**
 * AI-30: contexto de correlacion de la peticion en curso.
 *
 * El problema que resuelve: la API ya generaba `x-request-id` y lo devolvia en
 * cada respuesta, pero ese identificador no llegaba a `agent_runs`. No se podia
 * unir el error que ve un usuario en el navegador con la ejecucion de IA que lo
 * produjo -- justo la union que hace falta para investigar un incidente.
 *
 * Por que AsyncLocalStorage y no un parametro mas:
 *
 * - Pasarlo por firma obligaba a tocar ~20 funciones de agente y toda su cadena
 *   de llamadas, para un dato que es puramente ambiental.
 * - Meterlo en `AuthContext` no vale: `resolveAuthContext` esta cacheado
 *   (apps/api/src/auth-context.ts), asi que la segunda peticion del mismo
 *   usuario heredaria el request id de la primera. Seria peor que no tenerlo:
 *   una correlacion falsa.
 *
 * ALS sobrevive a los `await` dentro de la misma peticion, que es exactamente
 * el alcance que queremos. Fuera de una peticion HTTP (worker, cron, tests)
 * devuelve null y quien llama decide el fallback.
 */
import { AsyncLocalStorage } from "node:async_hooks";

export type RequestCorrelation = {
  /**
   * Identificador de la operacion completa: `x-request-id` cuando viene de
   * HTTP, o el `tick_id` de la pasada cuando viene del orquestador.
   */
  requestId: string;
  /**
   * Lote de ejecuciones lanzadas juntas, cuando lo hay. El orquestador de
   * diagnosticos lanza N agentes por pasada y hasta ahora no quedaba registro
   * de que pertenecian a la misma: el `tick_id` solo vivia en
   * `ai_diagnostic_gate_log`, una tabla distinta y sin FK a `agent_runs`.
   */
  parallelGroupId?: string;
};

const storage = new AsyncLocalStorage<RequestCorrelation>();

/** Ejecuta `fn` con el contexto de correlacion de una peticion. */
export function runWithRequestCorrelation<T>(
  correlation: RequestCorrelation,
  fn: () => T,
): T {
  return storage.run(correlation, fn);
}

/**
 * Request id de la peticion en curso, o null si no hay ninguna (worker, cron,
 * script, test). null es una respuesta legitima: no se inventa un id para
 * disimular que la ejecucion no vino de HTTP.
 */
export function currentRequestId(): string | null {
  return storage.getStore()?.requestId ?? null;
}

/** Lote al que pertenece la ejecucion en curso, o null si no va en lote. */
export function currentParallelGroupId(): string | null {
  return storage.getStore()?.parallelGroupId ?? null;
}
