import {
  isSummaryCurrentForTranscript,
  type CurrentTranscript,
  type PublishedSummaryReference,
} from "./summary-visibility";

/**
 * En que paso del flujo esta una llamada: transcribir -> analizar (A01) ->
 * aprobar -> tareas.
 *
 * Vive fuera de la pagina porque lo usan dos sitios que tienen que coincidir:
 * la fila de la lista (el badge que dice si esa llamada te espera) y el
 * detalle (la escalera de pasos y la frase de "siguiente"). Si divergieran, la
 * lista diria "listo para analizar" y dentro el boton estaria apagado.
 */

export type CallStageTone = "neutral" | "brand" | "success" | "warn";

export type CallStage = {
  step: 1 | 2 | 3 | 4;
  label: string;
  tone: CallStageTone;
  /** Que toca hacer ahora y quien lo hace, en una frase. */
  next: string;
};

export type StagedCall = {
  call_transcripts: CurrentTranscript[];
  call_ai_summaries: Array<
    PublishedSummaryReference & { status: string; transcript_id: string | null }
  >;
};

export function callStage(call: StagedCall): CallStage {
  const transcript = call.call_transcripts[0] ?? null;

  // Un resumen pendiente de una transcripcion ANTIGUA no cuenta: si se
  // reemplazo la transcripcion, ese resumen ya no describe lo que hay.
  const pending = call.call_ai_summaries.some(
    (summary) =>
      summary.status === "pending_approval" &&
      (!transcript || summary.transcript_id === transcript.id),
  );

  const published = call.call_ai_summaries.some((summary) =>
    isSummaryCurrentForTranscript(summary, transcript),
  );

  // Lo pendiente manda sobre lo publicado: si hay algo esperando decision, ese
  // es el paso en el que esta la llamada aunque ya tenga un resumen antiguo.
  if (pending) {
    return {
      step: 3,
      label: "Resumen por aprobar",
      tone: "warn",
      next: "Revisa el resumen y elige qué tareas se crean al aprobarlo.",
    };
  }

  if (published) {
    return {
      step: 4,
      label: "Resumen publicado",
      tone: "success",
      next: "El cliente ya ve el resumen. Las tareas acordadas están en su backlog.",
    };
  }

  if (!transcript) {
    return {
      step: 1,
      label: "Falta transcripción",
      tone: "neutral",
      next: "Pega la transcripción: sin ella el agente no tiene nada que leer.",
    };
  }

  return {
    step: 2,
    label: "Listo para analizar",
    tone: "brand",
    next: "Genera el resumen con el agente A01, o redáctalo a mano.",
  };
}
