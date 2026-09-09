/**
 * AI-30 (fase 4): eventos de seguridad de una ejecucion de agente.
 *
 * El audit encontro que las defensas ya existian y funcionaban -- la frontera
 * de contenido no confiable neutraliza patrones de inyeccion, el catalogo de
 * tools es cerrado, el SQL Gateway valida por AST -- pero **no dejaban rastro**:
 * `serializeUntrustedContextBlocks` contaba los patrones bloqueados y
 * `runAgentTurn` tiraba el numero. Un intento de inyeccion se neutralizaba y
 * desaparecia. No habia forma de saber si nos atacan.
 *
 * Aqui no se detecta nada nuevo. Se le pone nombre y severidad a lo que ya se
 * detectaba, para que el runtime pueda persistirlo y el panel pueda mostrarlo.
 *
 * Regla de contenido: un evento lleva METADATOS (que paso, donde, cuantas
 * veces), nunca el texto que lo provoco. El texto de un intento de inyeccion es
 * contenido no confiable y puede traer datos personales del cliente; guardarlo
 * en una tabla de auditoria es mover el problema, no resolverlo.
 */

export const AGENT_SECURITY_EVENT_TYPES = [
  /** Contenido con forma de instruccion dentro de datos no confiables. */
  "prompt_injection_detected",
  /** Un resultado de herramienta intento inyectar instrucciones. */
  "tool_poisoning_suspected",
  /** El modelo pidio una herramienta que no esta en su catalogo. */
  "unauthorized_tool_attempt",
  /** Una herramienta se rechazo por permisos insuficientes. */
  "permission_denied",
  /** Intento de acceder a datos fuera del alcance concedido. */
  "sensitive_data_access_attempt",
  /** Una politica del runtime bloqueo la ejecucion. */
  "policy_violation",
] as const;

export type AgentSecurityEventType =
  (typeof AGENT_SECURITY_EVENT_TYPES)[number];

export const AGENT_SECURITY_SEVERITIES = [
  "info",
  "low",
  "medium",
  "high",
  "critical",
] as const;

export type AgentSecuritySeverity = (typeof AGENT_SECURITY_SEVERITIES)[number];

export type AgentSecurityEvent = {
  type: AgentSecurityEventType;
  severity: AgentSecuritySeverity;
  /** Donde se detecto: `context_block`, `tool_result`, `tool_registry`... */
  source: string;
  /** Metadatos no sensibles. Nunca el contenido que provoco el evento. */
  detail: Record<string, unknown>;
};

export type AgentSecurityEventSink = (event: AgentSecurityEvent) => void;

/**
 * Acumulador en memoria de los eventos de un turno.
 *
 * `emit` es sincrono a proposito: corre en el camino caliente del turno y no
 * puede convertirse en una escritura a base de datos por evento. Quien crea el
 * colector hace `drain()` una vez al terminar -- tanto si el turno salio bien
 * como si fallo -- y persiste todo en una sola insercion.
 */
export function createSecurityEventCollector(limit = 100) {
  const events: AgentSecurityEvent[] = [];
  let dropped = 0;

  const emit: AgentSecurityEventSink = (event) => {
    // Un contexto hostil no puede convertir la telemetria en una asignacion de
    // memoria sin limite. Los descartes se declaran en el drenaje, para que
    // "no hubo mas eventos" no se confunda con "dejamos de contarlos".
    if (events.length >= limit) {
      dropped += 1;
      return;
    }
    events.push(event);
  };

  const drain = (): AgentSecurityEvent[] => {
    const drained = events.splice(0, events.length);
    if (dropped > 0) {
      drained.push({
        type: "policy_violation",
        severity: "medium",
        source: "security_event_collector",
        detail: {
          reason: "limite_de_eventos_por_turno_alcanzado",
          dropped_events: dropped,
          limit,
        },
      });
      dropped = 0;
    }
    return drained;
  };

  return { emit, drain };
}

/**
 * Tope de eventos por organizacion y ventana, aguas arriba del colector.
 *
 * El colector acota un turno (100 eventos). Lo que no acotaba nada era el
 * acumulado: un contexto hostil que dispare el tope en cada ejecucion escribe
 * 100 filas por run, y el freno de mas arriba -- el presupuesto diario de IA --
 * limita el gasto, no las filas.
 *
 * 1.000 es holgado para incidentes reales. Alcanzado el tope la senal ya esta
 * dada; las filas siguientes no anaden informacion, solo tabla.
 */
export const SECURITY_EVENTS_DAILY_CAP_PER_ORG = 1000;

/**
 * Que se escribe de verdad, dado lo que la organizacion lleva acumulado.
 *
 * Por encima del tope se escribe **una** fila por ejecucion en vez de N, nunca
 * cero. "Hubo eventos y dejamos de detallarlos" y "no hubo eventos" son hechos
 * distintos, y el panel tiene que poder distinguirlos -- confundirlos seria el
 * mismo defecto que arregla toda esta fase.
 *
 * `eventsInWindow` a `null` significa que no se pudo contar, y entonces se
 * escribe todo: un fallo del limitador no puede convertirse en perdida de
 * evidencia. El tope existe para que la tabla no crezca sin freno, no para
 * descartar eventos cuando dudamos.
 */
export function capSecurityEvents(
  events: readonly AgentSecurityEvent[],
  eventsInWindow: number | null,
  cap: number = SECURITY_EVENTS_DAILY_CAP_PER_ORG,
  windowHours = 24,
): { rows: readonly AgentSecurityEvent[]; rateLimited: boolean } {
  if (events.length === 0) {
    return { rows: events, rateLimited: false };
  }

  if (eventsInWindow === null || eventsInWindow < cap) {
    return { rows: events, rateLimited: false };
  }

  return {
    rateLimited: true,
    rows: [
      {
        type: "policy_violation",
        severity: "medium",
        source: "security_event_rate_limit",
        detail: {
          reason: "organization_daily_cap_reached",
          cap,
          window_hours: windowHours,
          events_in_window: eventsInWindow,
          dropped_events: events.length,
          dropped_types: [...new Set(events.map((event) => event.type))],
        },
      },
    ],
  };
}
