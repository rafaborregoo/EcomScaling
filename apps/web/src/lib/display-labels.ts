/**
 * Presentacion de datos de integraciones.
 *
 * Los proveedores y Supabase conservan sus identificadores canonicos en
 * ingles; la UI nunca debe obligar al usuario a conocerlos. Las claves no
 * reconocidas se humanizan como fallback para que un nuevo enum no rompa la
 * experiencia mientras se incorpora su traduccion explicita.
 */

const labels: Record<string, string> = {
  financial_status: "Estado del pago",
  fulfillment_status: "Estado del envio",
  current_unit_cost: "Coste unitario actual",
  cost_currency_code: "Moneda del coste",
  publisher_platform: "Plataforma de publicacion",
  platform_position: "Ubicacion del anuncio",
  device_platform: "Dispositivo",
  action_type: "Tipo de accion",
  gross_sales: "Ventas brutas",
  net_sales: "Ventas netas",
  net_profit: "Beneficio neto",
  purchase_roas: "ROAS de compras",
  cpm: "CPM",
  cpc: "CPC",
  ctr: "CTR",
  aov: "Ticket medio",
  impressions: "Impresiones",
  reach: "Alcance",
  clicks: "Clics",
  spend: "Inversion",
  conversions: "Conversiones",
  revenue: "Ingresos",
  currency_code: "Moneda",
  timezone: "Zona horaria",
  tracked: "Inventario controlado",
  requires_shipping: "Requiere envio",
  vendor: "Proveedor",
  sku: "SKU",
};

const values: Record<string, string> = {
  paid: "pagado",
  pending: "pendiente",
  authorized: "autorizado",
  partially_paid: "parcialmente pagado",
  refunded: "reembolsado",
  voided: "anulado",
  fulfilled: "enviado",
  partial: "parcialmente enviado",
  unfulfilled: "pendiente de envio",
  restocked: "reintegrado al inventario",
  running: "en curso",
  syncing: "sincronizando",
  queued: "en cola",
  succeeded: "completado",
  completed: "completado",
  failed: "fallido",
  cancelled: "cancelado",
  connected: "conectada",
  disconnected: "desconectada",
  error: "en error",
  reauthorization_required: "requiere reautorización",
  needs_reauth: "requiere reautorización",
  facebook: "Facebook",
  instagram: "Instagram",
  audience_network: "Audience Network",
  messenger: "Messenger",
  mobile: "Movil",
  desktop: "Ordenador",
  platform_admin: "Administrador de plataforma",
  consultant: "Consultor",
  owner: "Propietario",
  manager: "Manager",
  member: "Miembro",
};

export function displayLabel(value: string | null | undefined): string {
  if (!value) return "Sin indicar";
  const normalized = value.trim().toLowerCase();
  return labels[normalized] ?? humanize(normalized);
}

export function displayValue(value: string | null | undefined): string {
  if (!value) return "Sin indicar";
  const normalized = value.trim().toLowerCase();
  return values[normalized] ?? humanize(normalized);
}

export function displayBoolean(value: boolean | null | undefined): string {
  if (value === true) return "Sí";
  if (value === false) return "No";
  return "Sin indicar";
}

function humanize(value: string): string {
  return value
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}
