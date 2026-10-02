/**
 * Reglas de la pestaña Contenido: qué nombre lleva cada estado, qué le toca a
 * quien mira y qué cae en cada día de la semana.
 *
 * Fuera del componente por lo mismo que `piece-analysis.ts`: cliente y
 * consultor tienen que aplicarlas igual. Y porque un estado con dos nombres
 * («Pendiente de aprobación» / «En revisión») hace que el cliente dude si son
 * dos cosas.
 */
import type { Tone } from "@/components/ui";
import type { PieceAuthorKind, PieceThread } from "./piece-analysis";

export type PieceStatus = "draft" | "pending_approval" | "approved" | "rejected" | "published";

/** Un estado, un nombre, en toda la app. */
export const PIECE_STATE: Record<PieceStatus, { label: string; tone: Tone }> = {
  draft: { label: "En preparación", tone: "neutral" },
  pending_approval: { label: "Para revisar", tone: "warn" },
  rejected: { label: "Cambios pedidos", tone: "warn" },
  approved: { label: "Lista", tone: "success" },
  published: { label: "Publicada", tone: "success" },
};

type Piece = {
  status: PieceStatus;
  scheduled_for: string | null;
  thread?: PieceThread | null;
};

/**
 * ¿Le toca a `viewer` hacer algo con esta pieza?
 *
 * El cliente decide sobre lo que está para revisar; el consultor (y la
 * plataforma) retoman lo que el cliente devolvió o lo que aún no se ha
 * enviado. En los dos casos, un mensaje del otro lado sin contestar también
 * cuenta, salvo en piezas ya publicadas.
 */
export function needsViewer(piece: Piece, viewer: PieceAuthorKind): boolean {
  if (viewer === "client") {
    if (piece.status === "pending_approval") return true;
  } else if (piece.status === "rejected" || piece.status === "draft") {
    return true;
  }
  if (piece.status === "published" || piece.status === "draft") return false;
  const last = piece.thread?.last_author_kind;
  return Boolean(piece.thread?.count && last && last !== viewer);
}

/** Lo más cercano primero; sin fecha, al final. Para revisar antes que mensajes. */
export function queueOrder<T extends Piece>(pieces: T[]): T[] {
  const rank = (piece: T) => (piece.status === "pending_approval" || piece.status === "rejected" ? 0 : 1);
  const when = (piece: T) => (piece.scheduled_for ? Date.parse(piece.scheduled_for) : Number.POSITIVE_INFINITY);
  return [...pieces].sort((a, b) => rank(a) - rank(b) || when(a) - when(b));
}

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** Los siete días (lunes a domingo) de la semana que contiene `now`. */
export function weekDays(now: number): Date[] {
  const today = startOfDay(new Date(now));
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + index);
    return day;
  });
}

export function piecesOnDay<T extends Piece>(pieces: T[], day: Date): T[] {
  return pieces
    .filter((piece) => piece.scheduled_for && startOfDay(new Date(piece.scheduled_for)).getTime() === day.getTime())
    .sort((a, b) => Date.parse(a.scheduled_for as string) - Date.parse(b.scheduled_for as string));
}

/** «sale hoy», «sale mañana», «sale en 3 días», «salió hace 2 días». */
export function dueText(iso: string, now: number): string {
  const days = Math.round((startOfDay(new Date(iso)).getTime() - startOfDay(new Date(now)).getTime()) / 86_400_000);
  if (days === 0) return "sale hoy";
  if (days === 1) return "sale mañana";
  if (days > 1) return `sale en ${days} días`;
  return days === -1 ? "salía ayer" : `salía hace ${-days} días`;
}

/** Una frase de qué pasa ahora con la pieza y qué viene, según quién mira. */
export function pieceStatusNote(
  piece: Piece & { request?: { channel?: string } | null },
  viewer: PieceAuthorKind,
  now: number,
): string {
  const when = piece.scheduled_for ? `, ${dueText(piece.scheduled_for, now)}` : "";
  const client = viewer === "client";
  switch (piece.status) {
    case "draft":
      return client ? "Se está preparando. Aparecerá en «Te toca» cuando esté para revisar." : "Aún no se ha enviado a revisión.";
    case "pending_approval":
      return client ? `Si la apruebas queda lista${when}.` : "Esperando el sí del cliente o sus cambios.";
    case "rejected":
      return client ? "Has pedido cambios. Te avisamos cuando vuelva a estar para revisar." : "El cliente ha pedido cambios: corrígela y vuelve a enviarla.";
    case "approved": {
      const channel = piece.request?.channel;
      if (channel === "instagram_organic") return "Instagram no se publica desde NORA: copia el texto y sube la foto.";
      if (channel === "meta_ads") return "Lista para lanzar en Meta Ads.";
      return `Lista para mandar a Klaviyo${when}.`;
    }
    case "published":
      return "Ya ha salido. Sus cifras están en Rendimiento.";
  }
}
