/**
 * Seguimiento de las generaciones de A19 lanzadas en segundo plano.
 *
 * El run tarda minutos: la API responde 202 al instante y la pantalla consulta
 * el progreso. Los fallos previos a crear el run en base de datos (agente no
 * activado, presupuesto agotado, horizonte invalido) no dejan fila en
 * agent_runs, asi que se anotan aqui para que la pantalla los pueda contar.
 *
 * ponytail: memoria del proceso. Con varias instancias de la API o tras un
 * reinicio solo se pierde el motivo de un fallo temprano; el run en curso se
 * sigue viendo desde agent_runs. Mover a tabla si se escala a varias instancias.
 */

export type CaminoRunFailure = { error: string; message: string | null };
export type CaminoRunEntry =
  | { status: "running"; startedAt: number }
  | { status: "failed"; startedAt: number; failure: CaminoRunFailure }
  | { status: "done"; startedAt: number };

/** Un run que lleva mas que esto sin terminar se da por perdido y se puede relanzar. */
export const CAMINO_RUN_STALE_MS = 2 * 60 * 60_000;

const runs = new Map<string, CaminoRunEntry>();

export const caminoRunKey = (organizationId: string, storeId: string | null) => `${organizationId}:${storeId ?? "all"}`;

export function getCaminoRun(key: string, now = Date.now()): CaminoRunEntry | null {
  const entry = runs.get(key);
  if (!entry) return null;
  if (entry.status === "running" && now - entry.startedAt > CAMINO_RUN_STALE_MS) {
    runs.delete(key);
    return null;
  }
  return entry;
}

/** false si ya hay uno en marcha para ese alcance: evita pagar dos veces por un doble clic. */
export function beginCaminoRun(key: string, now = Date.now()): boolean {
  if (getCaminoRun(key, now)?.status === "running") return false;
  runs.set(key, { status: "running", startedAt: now });
  return true;
}

export function finishCaminoRun(key: string, failure?: CaminoRunFailure) {
  const entry = runs.get(key);
  if (!entry) return;
  runs.set(key, failure ? { status: "failed", startedAt: entry.startedAt, failure } : { status: "done", startedAt: entry.startedAt });
}

/** Solo para tests. */
export function resetCaminoRuns() {
  runs.clear();
}
