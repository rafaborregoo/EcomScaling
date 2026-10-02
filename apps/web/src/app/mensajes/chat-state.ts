/**
 * Reglas de la bandeja de Chats: a quién le toca contestar y qué filtro
 * enseña qué conversaciones. Fuera del componente para poder probarlas: si
 * `isWaiting` se equivoca, el consultor ve «te esperan» donde es él quien
 * esperaba, o no ve a quien lleva días sin respuesta.
 */

export type ChatFilter = "wait" | "unread" | "quiet" | "all";

/** Días sin hablar a partir de los cuales una conversación cuenta como en silencio. */
export const QUIET_DAYS = 14;

type ThreadLike = {
  unread_count: number;
  last_message: { author_kind: string; created_at: string } | null;
};

/**
 * ¿Le toca contestar a quien mira? El consultor (o la plataforma) debe
 * respuesta cuando el último mensaje es del cliente; el cliente no tiene
 * «cola», solo lee a su consultor.
 */
export function isWaiting(lastAuthorKind: string | null | undefined, viewerIsClient: boolean): boolean {
  if (viewerIsClient || !lastAuthorKind) return false;
  return lastAuthorKind === "client";
}

export function chatFilter(
  thread: ThreadLike,
  filter: ChatFilter,
  viewerIsClient: boolean,
  now: number,
): boolean {
  switch (filter) {
    case "wait":
      return isWaiting(thread.last_message?.author_kind, viewerIsClient);
    case "unread":
      return thread.unread_count > 0;
    case "quiet":
      return (
        thread.last_message !== null &&
        (now - Date.parse(thread.last_message.created_at)) / 86_400_000 >= QUIET_DAYS
      );
    default:
      return true;
  }
}

/** «te espera 5 min / 5 h / 2 d», contando desde el último mensaje del cliente. */
export function waitLabel(since: string, now: number): string {
  const minutes = Math.max(0, Math.round((now - Date.parse(since)) / 60_000));
  if (minutes < 60) return `te espera ${Math.max(1, minutes)} min`;
  if (minutes < 1440) return `te espera ${Math.round(minutes / 60)} h`;
  return `te espera ${Math.round(minutes / 1440)} d`;
}
