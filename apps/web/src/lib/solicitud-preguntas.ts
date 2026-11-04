/**
 * Las preguntas de /solicitar y cómo se leen en /admin/solicitudes. El API
 * guarda las respuestas tal cual (`answers`, acotadas en solicitudes.ts): la
 * lista vive aquí para que el formulario y el panel no se separen.
 */

export type Opcion = { value: string; label: string };

export type Pregunta = {
  key: string;
  label: string;
  type: "select" | "multi" | "text";
  required?: boolean;
  options?: Opcion[];
};

export const PLATAFORMAS: Opcion[] = [
  { value: "shopify", label: "Shopify" },
  { value: "woocommerce", label: "WooCommerce" },
  { value: "prestashop", label: "PrestaShop" },
  { value: "wix", label: "Wix" },
  { value: "otra", label: "Otra" },
  { value: "sin_tienda", label: "Aún no tengo tienda" },
];

export const PREGUNTAS_CLIENTE: Pregunta[] = [
  {
    key: "monthly_revenue",
    label: "Facturación mensual aproximada",
    type: "select",
    required: true,
    options: [
      { value: "lt5k", label: "Menos de 5.000 €" },
      { value: "5k_20k", label: "5.000 – 20.000 €" },
      { value: "20k_50k", label: "20.000 – 50.000 €" },
      { value: "50k_150k", label: "50.000 – 150.000 €" },
      { value: "gt150k", label: "Más de 150.000 €" },
    ],
  },
  {
    key: "channels",
    label: "Qué usas ya",
    type: "multi",
    options: [
      { value: "meta_ads", label: "Meta Ads" },
      { value: "klaviyo", label: "Klaviyo" },
      { value: "google_ads", label: "Google Ads" },
      { value: "tiktok_ads", label: "TikTok Ads" },
      { value: "ninguno", label: "Ninguno todavía" },
    ],
  },
  {
    key: "has_consultant",
    label: "¿Trabajas con un consultor o una agencia?",
    type: "select",
    required: true,
    options: [
      { value: "no", label: "No" },
      { value: "si", label: "Sí" },
    ],
  },
  { key: "goal", label: "Qué te gustaría conseguir con E-NORA", type: "text", required: true },
  { key: "how_found", label: "Cómo nos has conocido", type: "text" },
];

export const PREGUNTAS_CONSULTOR: Pregunta[] = [
  {
    key: "years",
    label: "Años trabajando con tiendas online",
    type: "select",
    required: true,
    options: [
      { value: "lt1", label: "Menos de 1" },
      { value: "1_3", label: "1 – 3" },
      { value: "3_5", label: "3 – 5" },
      { value: "gt5", label: "Más de 5" },
    ],
  },
  {
    key: "active_clients",
    label: "Clientes activos ahora mismo",
    type: "select",
    required: true,
    options: [
      { value: "1_3", label: "1 – 3" },
      { value: "4_10", label: "4 – 10" },
      { value: "11_25", label: "11 – 25" },
      { value: "gt25", label: "Más de 25" },
    ],
  },
  {
    key: "services",
    label: "Qué servicios das",
    type: "multi",
    options: [
      { value: "estrategia", label: "Estrategia de ecommerce" },
      { value: "meta_ads", label: "Meta Ads" },
      { value: "email", label: "Email marketing / Klaviyo" },
      { value: "google_ads", label: "Google Ads" },
      { value: "cro", label: "CRO y web" },
      { value: "shopify_dev", label: "Desarrollo Shopify" },
    ],
  },
  { key: "linkedin", label: "LinkedIn o perfil profesional", type: "text" },
  { key: "why", label: "Qué esperas de E-NORA", type: "text", required: true },
];

/** La respuesta en texto legible, para el panel. */
export function respuestaLegible(pregunta: Pregunta, value: string | string[] | undefined): string {
  if (value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) return "—";
  const label = (item: string) => pregunta.options?.find((option) => option.value === item)?.label ?? item;
  return Array.isArray(value) ? value.map(label).join(" · ") : label(value);
}

export function plataformaLegible(value: string | null): string {
  return PLATAFORMAS.find((option) => option.value === value)?.label ?? value ?? "—";
}
