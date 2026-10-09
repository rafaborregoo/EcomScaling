"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { CopilotEvidenceReference } from "@e-nora/contracts";

export type CopilotAskTarget = Partial<Pick<CopilotEvidenceReference, "kind" | "entity" | "metric" | "period" | "period_label" | "filters">>;

/**
 * Abrir el Consultor IA sobre UNA cosa concreta.
 *
 * El copiloto ya existía como panel global: se abría vacío y había que
 * escribirle el contexto a mano. Analizar una plantilla así significaba
 * copiar el asunto y el cuerpo dentro del chat, y nadie lo hace. Esto deja
 * que un módulo diga "analiza ESTO" con la pieza ya dentro de la pregunta.
 *
 * `saveAnswer` es lo que convierte el análisis en parte de la conversación en
 * vez de un chat que se pierde al cerrar el panel: cuando el artefacto tiene
 * hilo (un borrador de marketing, por ejemplo), la respuesta se puede dejar
 * ahí firmada como IA, y la ve también el otro lado.
 */
export type CopilotAsk = {
  /** Nonce: cambia en cada petición para relanzar la pregunta aunque el texto sea el mismo. */
  key: number;
  question: string;
  /** Qué se está analizando, para el encabezado del panel. */
  focusLabel?: string;
  /** Target typed by the button; route/store/filter context is added by the shell. */
  reference?: CopilotAskTarget;
  saveAnswer?: (text: string) => Promise<void>;
  /** Texto del botón de guardar y de su confirmación, si no es el hilo de la pieza. */
  saveLabel?: string;
  savedLabel?: string;
};

type Ask = (ask: Omit<CopilotAsk, "key">) => void;

const CopilotAskContext = createContext<Ask>(() => {});

export function CopilotAskProvider({
  ask,
  children,
}: {
  ask: Ask;
  children: ReactNode;
}) {
  return (
    <CopilotAskContext.Provider value={ask}>
      {children}
    </CopilotAskContext.Provider>
  );
}

export function useCopilotAsk() {
  return useContext(CopilotAskContext);
}
