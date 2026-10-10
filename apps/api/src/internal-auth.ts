import crypto from "node:crypto";

/**
 * Comprueba la cabecera x-internal-secret de las rutas /v1/internal/* en
 * tiempo constante: una comparacion con !== deja medir cuantos caracteres
 * coinciden.
 */
export function internalSecretMatches(provided: unknown, expected: string | undefined): boolean {
  if (!expected || typeof provided !== "string") return false;
  const a = crypto.createHash("sha256").update(provided).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}
