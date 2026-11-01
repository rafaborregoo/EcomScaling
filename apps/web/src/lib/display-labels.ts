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
  fulfillment_status: "Estado del envío",
  current_unit_cost: "Coste unitario actual",
  cost_currency_code: "Moneda del coste",
  publisher_platform: "Plataforma de publicación",
  platform_position: "Ubicación del anuncio",
  device_platform: "Dispositivo",
  action_type: "Tipo de acción",
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
  spend: "Inversión",
  conversions: "Conversiones",
  revenue: "Ingresos",
  currency_code: "Moneda",
  timezone: "Zona horaria",
  timezone_name: "Zona horaria",
  account_name: "Nombre de cuenta",
  account_status_code: "Estado de la cuenta",
  external_ad_account_id: "ID externo de cuenta publicitaria",
  external_instagram_id: "ID externo de Instagram",
  external_media_id: "ID externo de publicación",
  media_type: "Tipo de publicación",
  metric_name: "Métrica",
  period_start: "Inicio del periodo",
  period_end: "Fin del periodo",
  last_synced_at: "Última sincronización",
  captured_at: "Fecha de captura",
  ad_account_id: "Cuenta publicitaria",
  campaign_id: "Campaña",
  ad_set_id: "Conjunto de anuncios",
  ad_id: "Anuncio",
  is_active: "Activo",
  is_selected: "Seleccionado",
  published_at: "Publicado el",
  permalink: "Enlace permanente",
  destination_url: "URL de destino",
  primary_text: "Texto principal",
  call_to_action: "Llamada a la acción",
  headline: "Titular",
  description: "Descripción",
  tracked: "Inventario controlado",
  requires_shipping: "Requiere envío",
  vendor: "Proveedor",
  campaign_objective: "Objetivo de campaña",
  meta_objective: "Objetivo de Meta",
  sku: "SKU",
};

const values: Record<string, string> = {
  paid: "pagado",
  active: "activo",
  draft: "borrador",
  archived: "archivado",
  unread: "sin leer",
  open: "abierta",
  acknowledged: "vista",
  resolved: "resuelta",
  dismissed: "descartada",
  read: "leído",
  pending_model: "pendiente de modelo",
  pending: "pendiente",
  authorized: "autorizado",
  partially_paid: "parcialmente pagado",
  refunded: "reembolsado",
  voided: "anulado",
  fulfilled: "enviado",
  partial: "parcialmente enviado",
  unfulfilled: "pendiente de envío",
  restocked: "reintegrado al inventario",
  running: "en curso",
  syncing: "sincronizando",
  onboarding: "onboarding",
  suspended: "suspendido",
  pending_deletion: "borrado pendiente",
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
  mobile: "Móvil",
  desktop: "Ordenador",
  platform_admin: "Administrador de plataforma",
  consultant: "Consultor",
  owner: "Propietario",
  manager: "Gestor",
  member: "Miembro",
  image: "imagen",
  video: "vídeo",
  reel: "reel",
  carousel: "carrusel",
  story: "story",
  unknown: "sin clasificar",
  outcome_awareness: "reconocimiento",
  outcome_traffic: "tr\u00E1fico",
  outcome_engagement: "interacci\u00F3n",
  outcome_leads: "clientes potenciales",
  outcome_app_promotion: "promoci\u00F3n de app",
  outcome_sales: "ventas",
};

export function displayLabel(value: string | null | undefined): string {
  if (!value) return "Sin indicar";
  const normalized = value.trim().toLowerCase();
  return labels[normalized] ?? humanize(value.trim());
}

export function displayValue(value: string | null | undefined): string {
  if (!value) return "Sin indicar";
  const normalized = value.trim().toLowerCase();
  return values[normalized] ?? humanize(value.trim());
}

export function displayBoolean(value: boolean | null | undefined): string {
  if (value === true) return "Sí";
  if (value === false) return "No";
  return "Sin indicar";
}

// Tono del estado de una organizacion (clientes, tiendas propias): el mismo
// mapeo lo necesitan /admin/clientes y /admin/consultores para que "activo"
// se lea de un vistazo entre las que siguen en onboarding (nunca hubo forma
// de distinguirlas: badge neutral para las cinco).
export function organizationStatusTone(
  status: string | null | undefined,
): "neutral" | "brand" | "success" | "warn" | "danger" {
  switch (status) {
    case "active":
      return "success";
    case "onboarding":
      return "warn";
    case "suspended":
    case "pending_deletion":
      return "danger";
    case "cancelled":
      return "neutral";
    default:
      return "neutral";
  }
}

function humanize(value: string): string {
  return value
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}
