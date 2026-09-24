/**
 * FASE 3 / D03 — del perfil de madurez a lo que se lee en pantalla.
 *
 * LA DECISION DE FONDO: **esta pantalla vale por lo que dice que no sabe.**
 *
 * Un panel de madurez con siete capacidades bonitas y ocho ausentes se lee como
 * "a este negocio le faltan ocho cosas". No es eso lo que pasa: le faltan ocho
 * *a nuestra vista*. La diferencia entre "no lo tiene" y "no lo veo" es la
 * diferencia entre insultar a un cliente y saber que preguntarle, y toda esta
 * pantalla existe para no confundirlas.
 *
 * Por eso lo no observable no va escondido en un pie: va en su propio bloque,
 * con el numero que lo explica, y redactado como una pregunta pendiente.
 *
 * Y por eso `required_level` vacio no se pinta como un cero: se pinta como lo
 * que es, **una decision que todavia no ha tomado nadie**. El artefacto dice
 * que los umbrales no estan definidos; el motor no los inventa y la pantalla no
 * los disimula.
 */

export type MaturityEvidenceView = {
  evidence_type: string;
  description: string;
  source: string | null;
  observed_at: string | null;
};

export type CapabilityView = {
  id: string;
  capability: string;
  current_level: string;
  required_level: string | null;
  expectation_band: string | null;
  finding: string | null;
  gap_interpretation: string | null;
  has_existence: boolean;
  has_consistency: boolean;
  has_repeatability: boolean;
  has_measurement: boolean;
  influences_decisions: boolean;
  confidence: string;
  evidence: MaturityEvidenceView[];
};

export type ComplexityView = { key: string; label: string; value: number; unit: string };

/** Lo que un consultor declaro y el dato no puede ver (guardrail 20). */
export type MaturityDeclarationView = {
  capability: string;
  influences_decisions: boolean;
  has_ownership: boolean;
  owner_role: string | null;
  note: string | null;
  declared_at: string;
};

export type MaturityProfileView = {
  id: string;
  organization_id: string;
  organization_name: string | null;
  business_stage: string | null;
  change_type: string | null;
  change_summary: string | null;
  confidence: string;
  assessed_at: string;
  capabilities: CapabilityView[];
  unobserved: { capability: string; reason: string }[];
  complexity: ComplexityView[];
  dependencies: { capability: string; depends_on: string; relation: string; rationale: string }[];
  declarations?: MaturityDeclarationView[];
};

export type MaturityTone = "neutral" | "brand" | "success" | "warn" | "danger";

const CAPACIDAD_EN_CASTELLANO: Record<string, string> = {
  market: "Mercado",
  product: "Producto",
  offer: "Oferta",
  unit_economics: "Economía unitaria",
  acquisition: "Adquisición",
  creative: "Creatividades",
  conversion: "Conversión",
  retention: "Retención",
  inventory: "Inventario",
  operations: "Operaciones",
  finance: "Finanzas",
  data: "Datos",
  technology: "Tecnología",
  team: "Equipo",
  strategy: "Estrategia",
};

export function capabilityLabel(capability: string): string {
  return CAPACIDAD_EN_CASTELLANO[capability] ?? capability;
}

/**
 * El nivel, dicho por lo que significa hacer algo asi.
 *
 * "repeatable" no es una nota: es "lo hacen siempre igual, pero no lo miden".
 * Esa frase se puede llevar a una llamada; la etiqueta inglesa no.
 */
export function levelLabel(level: string): { label: string; detail: string; tone: MaturityTone } {
  switch (level) {
    case "ad_hoc":
      return {
        label: "A ratos",
        detail: "Pasa, pero no de la misma forma cada vez.",
        tone: "warn",
      };
    case "repeatable":
      return {
        label: "Siempre igual",
        detail: "Lo hacen de forma parecida cada vez; todavía no lo miden.",
        tone: "brand",
      };
    case "defined":
      return {
        label: "Con método y medida",
        detail: "Hay una forma de hacerlo y hay datos con los que seguirla.",
        tone: "success",
      };
    case "absent":
      return { label: "No existe", detail: "", tone: "danger" };
    default:
      return {
        label: level,
        detail: "Por encima de lo que el dato puede demostrar por sí solo.",
        tone: "success",
      };
  }
}

/**
 * Por que cambio el perfil. Es el guardrail 28 puesto en una frase.
 *
 * Confundir "ha mejorado" con "ahora lo vemos mejor" hace que el consultor
 * felicite al cliente por algo que no ha hecho, y eso se nota en la llamada.
 */
export function changeLabel(changeType: string | null): { label: string; tone: MaturityTone } {
  switch (changeType) {
    case "real_change":
      return { label: "Cambió el negocio", tone: "success" };
    case "confidence_increase":
      return { label: "Lo vemos mejor, no ha cambiado", tone: "neutral" };
    case "uncertainty_reduction":
      return { label: "Vemos algo que antes no veíamos", tone: "neutral" };
    case "initial":
      return { label: "Primera lectura", tone: "brand" };
    default:
      return { label: "Sin cambios", tone: "neutral" };
  }
}

/**
 * Las dimensiones que faltan para el siguiente peldano.
 *
 * Solo las que faltan: las que se cumplen no cambian ninguna decision, y
 * enumerarlas tapa la que importa. Misma regla que en la pantalla de `D06`.
 */
export function missingDimensions(c: CapabilityView): string[] {
  const faltan: string[] = [];
  if (!c.has_consistency) faltan.push("no se hace igual cada vez");
  if (!c.has_repeatability) faltan.push("no se repite con regularidad");
  if (!c.has_measurement) faltan.push("no hay con qué medirlo");
  if (!c.influences_decisions) faltan.push("nadie ha dicho si la medida cambia decisiones");
  return faltan;
}

/**
 * El texto de la brecha cuando nadie la ha decidido.
 *
 * **No es un cero ni un "pendiente" gris.** El artefacto dice que los umbrales
 * no estan definidos, asi que la brecha es una decision humana que falta, y la
 * pantalla la pide en vez de fingirla.
 */
export function gapLabel(c: CapabilityView): { label: string; tone: MaturityTone } {
  if (c.required_level == null) {
    return { label: "Nadie ha dicho qué necesita este negocio", tone: "neutral" };
  }
  if (c.finding == null) {
    return { label: `Necesita ${levelLabel(c.required_level).label.toLowerCase()}`, tone: "warn" };
  }
  return { label: c.gap_interpretation ?? c.finding, tone: "warn" };
}

/**
 * Lo que el dato no puede ver, ordenado por si tiene arreglo.
 *
 * Los huecos que se cierran conectando o rellenando algo --origen de los
 * pedidos, coste por referencia-- van primero, porque son accionables. Los que
 * no estan en ningun sistema --equipo, estrategia-- van despues: esos se
 * preguntan, no se conectan.
 */
export function sortUnobserved(
  unobserved: { capability: string; reason: string }[],
): { capability: string; reason: string; actionable: boolean }[] {
  const ARREGLABLES = new Set(["acquisition", "unit_economics", "inventory", "conversion", "retention"]);
  return unobserved
    .map((u) => ({ ...u, actionable: ARREGLABLES.has(u.capability) }))
    .sort((a, b) => Number(b.actionable) - Number(a.actionable));
}

/** Una cifra de complejidad, legible. Sin decimales falsos en un contador. */
export function formatMeasure(m: ComplexityView): string {
  const valor =
    m.unit === "EUR"
      ? new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 }).format(m.value)
      : new Intl.NumberFormat("es-ES").format(m.value);
  return m.unit === "EUR" ? `${valor} €` : `${valor} ${m.unit}`;
}
