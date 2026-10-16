const META_WINDOWS: Record<string, string> = {
  "1d_click": "1 día tras clic",
  "7d_click": "7 días tras clic",
  "28d_click": "28 días tras clic",
  "1d_view": "1 día tras visualización",
  "1d_click_1d_view": "1 día tras clic y 1 día tras visualización",
  "7d_click_1d_view": "7 días tras clic y 1 día tras visualización",
};

export function metaAttributionLabel(values: Array<string | null | undefined>): string | null {
  const windows = [...new Set(values.filter((value): value is string => Boolean(value)))];
  if (!windows.length) return null;
  if (windows.length > 1) return "ventanas de atribución distintas por anuncio";
  return META_WINDOWS[windows[0]] ?? "ventana configurada en Meta";
}
