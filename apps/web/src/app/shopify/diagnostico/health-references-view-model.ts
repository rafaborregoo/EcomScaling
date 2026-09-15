/**
 * FASE 3 / D04 — declarar contra que se juzga una metrica, en pantalla.
 *
 * POR QUE EXISTE. `D04` y `D10` estan implementados y los dos contestaban
 * `unknown` en todo por el mismo motivo: nadie podia decir "el CAC maximo de
 * esta tienda son 32 EUR". El guardrail 11 prohibe el umbral universal y el 13
 * depender de benchmarks externos, asi que la vara **la pone el tenant** -- y no
 * habia donde ponerla. Esta es esa pantalla.
 *
 * LA DECISION DE FONDO: **la declaracion va donde se reporta la ausencia**. Quien
 * lee "no hay guardrail economico declarado para adquisicion" tiene que poder
 * declararlo ahi mismo, sin buscar otra pantalla. Un hueco que te dice que falta
 * algo y no te deja arreglarlo es una queja, no una herramienta.
 *
 * Y la segunda: **una referencia no se borra, se retira**. Cambiar la vara
 * explica por que una capacidad paso de `bad` a `healthy` sin que el negocio se
 * moviera. Borrarla dejaria ese salto sin explicacion.
 */

export type HealthReferenceView = {
  id: string;
  organization_id: string;
  organization_name: string | null;
  capability: string;
  metric: string;
  scope: string;
  reference_type: string;
  value: number | null;
  value_text: string | null;
  unit: string | null;
  direction: string | null;
  source: string | null;
  effective_from: string;
};

export type ReferenceTone = "neutral" | "brand" | "success" | "warn" | "danger";

/**
 * Los cinco tipos, dichos como lo que son para quien los declara.
 *
 * `economic_guardrail` es el unico que hace que una capacidad pueda salir
 * `bad` o `critical`, porque es el unico que dice "a partir de aqui, duele".
 * Los otros sirven para comparar, no para juzgar, y la pantalla lo dice.
 */
export const REFERENCE_TYPES: {
  value: string;
  label: string;
  hint: string;
}[] = [
  {
    value: "economic_guardrail",
    label: "Guardrail económico",
    hint: "El límite a partir del cual el negocio deja de sostenerlo. Es el único que hace que una capacidad pueda salir en mal estado.",
  },
  {
    value: "business_target",
    label: "Objetivo de negocio",
    hint: "Lo que la tienda quiere conseguir. No juzga: quedarse corto de un objetivo no es estar enfermo.",
  },
  {
    value: "self_baseline",
    label: "Su propio histórico",
    hint: "Lo normal en esta tienda. Sirve para comparar contra sí misma.",
  },
  {
    value: "adjusted_baseline",
    label: "Histórico ajustado",
    hint: "Su histórico corregido por algo conocido: una campaña, un cambio de precios, una temporada.",
  },
  {
    value: "external_benchmark",
    label: "Referencia externa",
    hint: "Un dato de fuera. Hay que decir de dónde sale para poder discutirlo, y por sí solo no debería decidir nada.",
  },
];

export function referenceTypeLabel(type: string): string {
  return REFERENCE_TYPES.find((t) => t.value === type)?.label ?? type;
}

/**
 * Si un tipo de referencia sirve para juzgar o solo para comparar.
 *
 * Es la diferencia que hace que la pantalla no mienta: declarar el histórico no
 * desbloquea el diagnóstico, declarar el guardrail sí.
 */
export function judges(type: string): boolean {
  return type === "economic_guardrail";
}

/**
 * Como se lee una referencia declarada, en una linea.
 *
 * La direccion importa tanto como el numero: un CAC sostenible es un techo y una
 * cobertura de stock es un suelo, y el mismo 32 significa lo contrario en cada
 * caso.
 */
export function referenceSentence(reference: HealthReferenceView): string {
  const cifra =
    reference.value != null
      ? `${reference.value.toLocaleString("es-ES")}${reference.unit ? ` ${reference.unit}` : ""}`
      : (reference.value_text ?? "sin valor");

  const direccion =
    reference.direction === "max"
      ? "como máximo"
      : reference.direction === "min"
        ? "como mínimo"
        : reference.direction === "range"
          ? "dentro de"
          : "";

  return `${reference.metric} ${direccion} ${cifra}`.replace(/\s+/g, " ").trim();
}

/**
 * Lo que falta por declarar, sacado de lo que los motores dicen que les falta.
 *
 * No es una lista de capacidades a rellenar "porque si": son exactamente las que
 * hoy salen `not_assessable`. Pedir mas seria inventarse trabajo, y pedir menos
 * dejaria el diagnostico a medias.
 */
export function missingCapabilities(
  blockedCapabilities: readonly string[],
  references: readonly HealthReferenceView[],
): string[] {
  const declaradas = new Set(
    references.filter((r) => judges(r.reference_type)).map((r) => r.capability),
  );
  return blockedCapabilities.filter((c) => !declaradas.has(c));
}

/**
 * Si el formulario esta listo para enviarse, y si no, que falta.
 *
 * Devuelve el motivo en vez de un booleano para que el boton pueda decir por que
 * esta apagado. Un control desactivado sin explicacion es una pared.
 */
export function validateDraft(draft: {
  organization_id: string;
  capability: string;
  metric: string;
  reference_type: string;
  value: string;
  source: string;
}): string | null {
  if (!draft.organization_id) return "Elige la tienda.";
  if (!draft.capability) return "Elige la capacidad.";
  if (!draft.metric.trim()) return "Escribe la métrica, tal y como la emite el motor de señales.";
  if (!draft.value.trim()) return "Una referencia sin valor no sirve para juzgar nada.";
  if (Number.isNaN(Number(draft.value))) return "El valor tiene que ser un número.";
  if (draft.reference_type === "external_benchmark" && !draft.source.trim()) {
    return "Una referencia externa tiene que decir de dónde sale para poder discutirla.";
  }
  return null;
}
