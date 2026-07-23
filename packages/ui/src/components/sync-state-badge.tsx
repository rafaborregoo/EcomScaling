"use client";

import { Badge } from "./badge.js";
import type { Tone } from "./tone.js";

// Estado de sincronizacion unico para todas las superficies.
export type SyncState = "in_progress" | "ok" | "partial" | "failed" | "stale" | "never";

const syncStateConfig: Record<SyncState, { label: string; tone: Tone }> = {
  in_progress: { label: "Sincronizando...", tone: "brand" },
  ok: { label: "Al dia", tone: "success" },
  partial: { label: "Parcial", tone: "warn" },
  failed: { label: "Fallido", tone: "danger" },
  stale: { label: "Desactualizado", tone: "warn" },
  never: { label: "Sin sincronizar", tone: "neutral" },
};

export function SyncStateBadge({ state, detail }: { state: SyncState; detail?: string }) {
  const config = syncStateConfig[state];
  return (
    <Badge tone={config.tone}>
      {config.label}
      {detail ? ` - ${detail}` : ""}
    </Badge>
  );
}
