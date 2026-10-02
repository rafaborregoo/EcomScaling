/**
 * Formateo de dinero compartido (antes duplicado en `/shopify` y
 * `/shopify/diagnostico`). Agrupa miles y usa el simbolo de moneda -- un
 * numero crudo tipo "1234.56" es legible para quien ya conoce el dato, no
 * para un cliente escaneando el dashboard.
 */
export function formatMoney(value: number | null | undefined, currency: string | null = "EUR") {
  if (currency === null) return "—";
  return new Intl.NumberFormat("es-ES", { style: "currency", currency }).format(
    Number(value ?? 0),
  );
}
