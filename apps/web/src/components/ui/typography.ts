// Escala tipográfica compartida (ver docs/decisions/ADR-0020-design-tokens-y-escala.md).
// Recetas de clases que antes se copiaban con deriva en Field, Card (kicker),
// Combobox y el nav del shell (unas con font-mono a 0.65rem, otras sans a
// 0.7rem). Aquí una sola definición: cambiar el estilo se hace en un sitio.

/** Etiqueta / kicker en mayúsculas: label de Field, kicker de Card, cabecera
 * de grupo del nav. Una sola fuente (sans), sin font-mono. */
export const EYEBROW =
  "text-[0.7rem] font-medium uppercase tracking-[0.08em] text-muted";
