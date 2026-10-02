/** Respuestas con más días que esto se marcan para revisar. */
export const STALE_ANSWER_DAYS = 180;

export function isStaleAnswer(doc: { created_at: string; updated_at?: string }, now = Date.now()) {
  const last = Date.parse(doc.updated_at ?? doc.created_at);
  return Number.isFinite(last) && now - last > STALE_ANSWER_DAYS * 86_400_000;
}
