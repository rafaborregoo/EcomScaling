/**
 * FASE 3 / D05 — de la senal a lo que se lee en pantalla.
 *
 * Aparte del componente, como `D01`, `D02`, `D03` y `D06`: aqui estan las
 * decisiones, y las decisiones se prueban sin montar React.
 *
 * LA DECISION DE FONDO: **una lista de desviaciones ordenada de mayor a menor
 * se lee como una lista de prioridades**, y D05 no tiene prioridades. El
 * guardrail 8 separa magnitud de impacto justamente porque un +200% sobre una
 * base minuscula no es la primera cosa que mirar, y el guardrail 2 dice que no
 * toda senal es un problema. Por eso aqui:
 *
 *   - se ordena por **cuando termina la ventana**, no por magnitud
 *     (`sortSignals`);
 *   - magnitud y relevancia de negocio se dicen por separado, y cuando no
 *     coinciden se dice en voz alta (`magnitudeCaveat`);
 *   - una senal que no formo sintoma se etiqueta "aun no forma patron", nunca
 *     "sin importancia": puede ser la primera de un patron que todavia no
 *     existe, o la unica que hay porque falta la metrica que la acompanaria;
 *   - lo que debilita la senal --muestra corta, baseline en conflicto, metodo
 *     sin fuerza-- va en la propia fila y no escondido en un tooltip.
 */

export type SignalTone = "neutral" | "brand" | "success" | "warn" | "danger";

export type SignalView = {
  id: string;
  organization_name: string | null;
  signal_type: string;
  anomaly_type: string | null;
  capability: string | null;
  metric: string;
  scope: string;
  scope_detail: Record<string, unknown>;
  direction: string;
  observed_value: number | null;
  baseline_value: number | null;
  magnitude_absolute: number | null;
  magnitude_relative: number | null;
  expected_low: number | null;
  expected_high: number | null;
  window_start: string;
  window_end: string;
  detected_at: string;
  persistence: string;
  trajectory: string | null;
  regime: string;
  baseline_kind: string | null;
  baseline_conflict: boolean;
  sample_size: number | null;
  low_sample: boolean;
  statistical_method: string | null;
  statistical_strength: string | null;
  business_relevance: string;
  business_exposure: string | null;
  data_confidence: string;
  signal_confidence: string;
  suppression: string;
  description: string;
  in_symptom: boolean;
};

/**
 * El orden de la lista.
 *
 * Por fin de ventana descendente. **No por magnitud**: ordenar por tamano de la
 * desviacion es pintar una prioridad que este bloque no calcula, y quien lea la
 * pantalla la tomaria por una. El desempate es el id, para que dos senales del
 * mismo dia no bailen entre recargas.
 */
export function sortSignals(signals: SignalView[]): SignalView[] {
  return [...signals].sort((a, b) => {
    const diferencia =
      new Date(b.window_end).getTime() - new Date(a.window_end).getTime();
    return diferencia !== 0 ? diferencia : a.id.localeCompare(b.id);
  });
}

const METRICA_EN_PALABRAS: Record<string, string> = {
  net_sales: "Ventas netas",
  orders_count: "Número de pedidos",
  average_order_value: "Ticket medio",
  sessions: "Sesiones",
  conversion_rate: "Tasa de conversión",
};

export function metricLabel(metric: string): string {
  return METRICA_EN_PALABRAS[metric] ?? metric;
}

/**
 * Que ha pasado, en una linea y sin interpretar.
 *
 * El guardrail 49 y su ejemplo: se puede decir "las ventas netas bajan", no se
 * puede decir por que. Esta funcion es la frontera del bloque puesta en texto.
 */
export function headline(signal: SignalView): string {
  const direccion =
    signal.direction === "up"
      ? "sube"
      : signal.direction === "down"
        ? "baja"
        : signal.direction === "flat"
          ? "se aplana"
          : signal.direction === "diverging"
            ? "se separa de su referencia"
            : "va inestable";

  return `${metricLabel(signal.metric)} ${direccion}`;
}

/** La magnitud, en porcentaje, sin adjetivos. */
export function magnitudeText(signal: SignalView): string | null {
  if (typeof signal.magnitude_relative !== "number") return null;
  const porcentaje = signal.magnitude_relative * 100;
  const signo = porcentaje > 0 ? "+" : "";
  return `${signo}${porcentaje.toFixed(1)}%`;
}

/**
 * Cuando la magnitud y la relevancia no dicen lo mismo.
 *
 * Guardrail 8 con su ejemplo del 57: un +200% en una campana minuscula puede
 * ser irrelevante. Si la pantalla ensena el 200% y se calla la exposicion, el
 * motor grita mas fuerte cuanto menos importa lo que mira -- que es exactamente
 * el fallo que el guardrail viene a impedir. Devuelve `null` cuando no hay nada
 * que advertir, para no llenar la lista de ruido.
 */
export function magnitudeCaveat(signal: SignalView): string | null {
  const relativa = signal.magnitude_relative;
  const grande = typeof relativa === "number" && Math.abs(relativa) >= 0.5;
  const pocaExposicion =
    signal.business_exposure === "minimal" || signal.business_exposure === "low";

  if (grande && pocaExposicion) {
    return "Mucho movimiento sobre una base pequeña: la magnitud no mide lo que está en juego.";
  }
  if (grande && signal.business_relevance === "low") {
    return "La desviación es grande, pero la exposición del negocio no está medida como material.";
  }
  return null;
}

/**
 * La relevancia de negocio, que es una columna distinta de la magnitud.
 *
 * El check constraint del esquema no deja que sea `high` o `critical` sin
 * exposicion material, asi que lo que se lee aqui ya paso por esa puerta.
 */
export function relevanceLabel(signal: SignalView): {
  label: string;
  tone: SignalTone;
} {
  switch (signal.business_relevance) {
    case "critical":
      return { label: "Exposición crítica", tone: "danger" };
    case "high":
      return { label: "Exposición alta", tone: "warn" };
    case "medium":
      return { label: "Exposición media", tone: "brand" };
    default:
      return { label: "Exposición baja", tone: "neutral" };
  }
}

/**
 * Lo que debilita la senal, en frases y solo cuando hay algo que decir.
 *
 * Lo que se cumple no cambia ninguna decision; lo que falla, si. Mismo criterio
 * que `coherenceReasons` en el mapa de sintomas de D06.
 */
export function weaknesses(signal: SignalView): string[] {
  const avisos: string[] = [];

  if (signal.low_sample) {
    avisos.push(
      signal.sample_size === null
        ? "Muestra corta: la desviación puede ser ruido."
        : `Muestra corta (${signal.sample_size}): la desviación puede ser ruido.`,
    );
  }
  if (signal.baseline_conflict) {
    avisos.push("Los baselines disponibles no coinciden entre sí.");
  }
  if (signal.statistical_strength === "weak" || signal.statistical_strength === "none") {
    avisos.push("El método estadístico no la sostiene con fuerza.");
  }
  if (signal.data_confidence === "insufficient_data") {
    avisos.push("D01 no da por utilizable el dato que la sostiene.");
  }

  return avisos;
}

/**
 * Contra que se compara.
 *
 * Una desviacion sin decir respecto a que es media frase. `null` cuando el
 * motor no dejo constancia, que es distinto de no haber baseline.
 */
export function baselineNote(signal: SignalView): string | null {
  const EN_PALABRAS: Record<string, string> = {
    own_history: "su propio histórico",
    target: "el objetivo declarado",
    guardrail: "el guardrail económico",
    seasonal: "el mismo periodo de otro año",
    peer: "tiendas comparables",
  };
  if (!signal.baseline_kind) return null;
  return `Comparada contra ${EN_PALABRAS[signal.baseline_kind] ?? signal.baseline_kind}`;
}

/**
 * Si la senal llego a formar un sintoma.
 *
 * "Aun no forma patron" y no "sin importancia": una senal sola puede ser la
 * primera de un patron que todavia no existe, o la unica que hay porque falta
 * la metrica que la acompanaria. Decir lo segundo seria afirmar una ausencia
 * que nadie ha comprobado.
 */
export function patternNote(signal: SignalView): { label: string; tone: SignalTone } {
  return signal.in_symptom
    ? { label: "Forma parte de un patrón", tone: "brand" }
    : { label: "Aún no forma patrón", tone: "neutral" };
}

/** Cuanto lleva pasando. */
export function persistenceLabel(signal: SignalView): string {
  switch (signal.persistence) {
    case "chronic":
      return "Crónica";
    case "persistent":
      return "Persistente";
    case "emerging":
      return "Emergente";
    default:
      return "Puntual";
  }
}

/** La ventana medida, en fechas cortas. */
export function windowLabel(signal: SignalView): string {
  const formato = new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
  });
  return `${formato.format(new Date(signal.window_start))} – ${formato.format(new Date(signal.window_end))}`;
}

/**
 * Las senales que el motor pide mirar menos.
 *
 * Se apartan de la lista principal en vez de esconderse: `tenant_signal_patterns`
 * esta vacia hoy, asi que nada se silencia, pero cuando se declare un patron el
 * consultor tiene que poder ver que se aparto y comprobar si estuvo bien.
 */
export function splitBySuppression(signals: SignalView[]): {
  visibles: SignalView[];
  apartadas: SignalView[];
} {
  return {
    visibles: signals.filter((s) => s.suppression === "none"),
    apartadas: signals.filter((s) => s.suppression !== "none"),
  };
}
