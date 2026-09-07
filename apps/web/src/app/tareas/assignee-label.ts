/**
 * "Lo lleva Ana" en una tarea.
 *
 * Desde que el reparto escribe `assigned_to`, la lista del cliente mezcla lo
 * que tiene que hacer él con lo que ya lleva su consultor, y las dos cosas se
 * ven exactamente igual. La etiqueta solo aparece cuando el responsable es
 * OTRO: ponerle "lo lleva Rafa" a Rafa en sus propias tareas es ruido en cada
 * fila de la lista.
 */
export function assigneeLabel(
  assignedTo: string | null | undefined,
  assigneeName: string | null | undefined,
  viewerUserId: string,
): string | null {
  if (!assignedTo) return null;
  if (assignedTo === viewerUserId) return null;

  // Hay responsable pero no hemos podido resolver su nombre (perfil sin
  // rellenar). Decir que la lleva alguien sigue siendo la información útil:
  // callarse convertiría la tarea en una que parece esperar al cliente.
  const name = (assigneeName ?? "").trim();
  if (!name) return "la lleva otra persona";

  return `la lleva ${name.split(/\s+/)[0]}`;
}
