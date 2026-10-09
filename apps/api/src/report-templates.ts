export type ReportTemplateId =
  | "shopify_comercial"
  | "shopify_rentabilidad"
  | "shopify_clientes"
  | "meta_publicidad"
  | "klaviyo_email"
  | "adquisicion_multicanal"
  | "resumen_multicanal";

export type ReportProvider = "Shopify" | "Meta Ads" | "Klaviyo";
export type ReportStatus = "available" | "partial" | "unavailable";
export type ReportMetricFormat = "currency" | "number" | "percent" | "ratio";

export type ReportMetric = {
  label: string;
  value: number | null;
  format: ReportMetricFormat;
  previous?: number | null;
  note?: string;
  currencyCode?: string;
  decimalPlaces?: number;
};

export type ReportTable = {
  title: string;
  columns: Array<{ key: string; label: string; align?: "left" | "right"; width?: number }>;
  rows: Array<Record<string, string | number | null>>;
  emptyMessage?: string;
};

export type ReportChart = {
  title: string;
  unit: "currency" | "number" | "percent" | "ratio";
  currencyCode?: string;
  items: Array<{ label: string; value: number }>;
};

export type ReportSection =
  | { kind: "metrics"; title: string; metrics: ReportMetric[] }
  | { kind: "chart"; title: string; chart: ReportChart }
  | { kind: "table"; title: string; table: ReportTable }
  | { kind: "note"; title: string; body: string; tone: "info" | "warning" };

export type ReportSource = {
  provider: ReportProvider;
  status: ReportStatus;
  detail: string;
  asOf: string | null;
};

export type ReportDocument = {
  templateId: ReportTemplateId;
  templateVersion: "v1";
  title: string;
  subtitle: string;
  organizationName: string;
  storeName: string;
  currencyCode: string;
  periodStart: string;
  periodEnd: string;
  previousPeriodStart: string;
  previousPeriodEnd: string;
  generatedAt: string;
  sample: boolean;
  sections: ReportSection[];
  sources: ReportSource[];
};

export type ReportTemplateDefinition = {
  id: ReportTemplateId;
  version: "v1";
  name: string;
  category: "Comercial" | "Finanzas" | "Clientes" | "Publicidad" | "Email" | "Multicanal";
  applications: ReportProvider[];
  description: string;
  useWhen: string;
  includedSections: string[];
  tokenHint: string;
};

export const REPORT_TEMPLATES: readonly ReportTemplateDefinition[] = [
  {
    id: "shopify_comercial",
    version: "v1",
    name: "Ventas y producto",
    category: "Comercial",
    applications: ["Shopify"],
    description: "Ventas netas y brutas, pedidos, ticket medio, descuentos, reembolsos y productos principales.",
    useWhen: "Revisar el rendimiento comercial de una tienda.",
    includedSections: ["Indicadores comerciales y comparación", "Gráfico de ventas por producto", "Tabla de unidades, ventas y calidad de métricas por producto", "Cobertura de datos"],
    tokenHint: "ventas, pedidos, ticket medio, productos, facturación Shopify",
  },
  {
    id: "shopify_rentabilidad",
    version: "v1",
    name: "Rentabilidad y costes",
    category: "Finanzas",
    applications: ["Shopify"],
    description: "Ingresos, COGS, margen, costes variables, beneficio y cobertura de costes de producto.",
    useWhen: "Entender el margen real y los costes que condicionan el beneficio.",
    includedSections: ["Cuenta de resultados", "Gráfico de ingresos, costes y beneficio", "Tabla de costes, impuestos, punto de equilibrio y CAC", "Cobertura financiera"],
    tokenHint: "margen, beneficio, COGS, costes, rentabilidad, break-even",
  },
  {
    id: "shopify_clientes",
    version: "v1",
    name: "Clientes y recompra",
    category: "Clientes",
    applications: ["Shopify"],
    description: "Clientes identificados, pedidos de invitado, frecuencia y retención por cohortes.",
    useWhen: "Analizar recompra, valor de cliente y evolución de cohortes.",
    includedSections: ["Base de clientes", "Gráfico de retención al mismo mes de vida", "Tablas de retención y actividad de cohortes", "Límites de identificación"],
    tokenHint: "clientes, recompra, retención, cohortes, LTV",
  },
  {
    id: "meta_publicidad",
    version: "v1",
    name: "Publicidad de Meta",
    category: "Publicidad",
    applications: ["Meta Ads"],
    description: "Inversión, impresiones, clics, compras y valor atribuidos por Meta, ROAS y campañas.",
    useWhen: "Revisar inversión y rendimiento atribuido de campañas Meta.",
    includedSections: ["Resultados atribuidos por Meta", "Gráfico ROAS por campaña", "Tablas de inversión, compras, clics, CTR e impresiones", "Límites de atribución"],
    tokenHint: "Meta Ads, campañas, gasto, ROAS, CAC atribuido, publicidad",
  },
  {
    id: "klaviyo_email",
    version: "v1",
    name: "Email y automatizaciones",
    category: "Email",
    applications: ["Klaviyo"],
    description: "Ingresos y conversiones atribuidos por Klaviyo, entregas, aperturas, clics y rendimiento por campaña/flow.",
    useWhen: "Evaluar campañas y automatizaciones de email sin confundir atribución con ventas incrementales.",
    includedSections: ["Rendimiento de email", "Gráfico de ingresos atribuidos por envío", "Tablas de campañas, flows, entregas, aperturas, clics y rebotes", "Límites de atribución"],
    tokenHint: "Klaviyo, email, newsletter, flows, campañas, entregabilidad",
  },
  {
    id: "adquisicion_multicanal",
    version: "v1",
    name: "Adquisición y atribución",
    category: "Multicanal",
    applications: ["Shopify", "Meta Ads", "Klaviyo"],
    description: "Ventas de Shopify junto a inversión y conversiones atribuidas por Meta y Klaviyo, en bloques separados.",
    useWhen: "Comparar señales de adquisición sin sumar modelos de atribución distintos.",
    includedSections: ["Ventas y productos Shopify", "Gráfico ROAS por campaña Meta", "Gráfico de ingresos atribuidos Klaviyo", "Tablas por canal", "Cómo leer estas cifras"],
    tokenHint: "adquisición, atribución, comparar canales, Meta y Shopify, canales",
  },
  {
    id: "resumen_multicanal",
    version: "v1",
    name: "Resumen ejecutivo de negocio",
    category: "Multicanal",
    applications: ["Shopify", "Meta Ads", "Klaviyo"],
    description: "Lectura ejecutiva con ventas reales de Shopify y señales separadas de publicidad y email.",
    useWhen: "Preparar un resumen para dirección o una revisión periódica del negocio.",
    includedSections: ["Ventas, productos y margen Shopify", "Publicidad y campañas Meta", "Email y flows Klaviyo", "Gráficos y tablas por canal", "Cobertura y lectura"],
    tokenHint: "resumen ejecutivo, informe mensual, todas las aplicaciones, estado del negocio",
  },
] as const;

export function getReportTemplate(templateId: string): ReportTemplateDefinition | null {
  return REPORT_TEMPLATES.find((template) => template.id === templateId) ?? null;
}

export function listReportTemplates() {
  return REPORT_TEMPLATES.map(({ tokenHint: _tokenHint, ...template }) => template);
}

export function resolveReportTemplateId(value: unknown): ReportTemplateId | null {
  return typeof value === "string" && REPORT_TEMPLATES.some((template) => template.id === value)
    ? value as ReportTemplateId
    : null;
}

export function reportTemplateSelectionInstructions(): string {
  return REPORT_TEMPLATES.map((template) => `${template.id}: ${template.tokenHint}`).join("\n");
}
