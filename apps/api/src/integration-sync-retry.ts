/**
 * Errores de autorización o permisos no se arreglan repitiendo la petición.
 * El resto se puede reintentar en el siguiente ciclo programado.
 */
export function requiresIntegrationReauthorization(
  message: string | null | undefined,
): boolean {
  if (!message) return false;
  return /reauth|reconnect|invalid[_ :.-]*grant|token.{0,24}(expired|invalid|revoked)|invalid.{0,16}(api.?key|credential)|unauthorized|permission(s)?[_ :-]*(missing|denied)|scope(s)?[_ :.-]*(missing|insufficient)|oauth[_ :.-]*(denied|error)/i.test(
    message,
  );
}
