// Fechas del modulo: `fmtDate` en listados/tarjetas, `fmtDateTime` en detalle,
// historial y notas. Un solo sitio para el locale.
export const fmtDate = (value: string) =>
  new Date(value).toLocaleDateString("es-ES");

export const fmtDateTime = (value: string) =>
  new Date(value).toLocaleString("es-ES");

// Fecha/hora prevista de publicación, legible ("23 de septiembre, 21:00").
export const fmtSchedule = (value: string) =>
  new Date(value).toLocaleString("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });

// value ISO -> "yyyy-MM-ddTHH:mm" en hora local, para <input type="datetime-local">.
export const toDatetimeLocal = (iso: string) => {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
