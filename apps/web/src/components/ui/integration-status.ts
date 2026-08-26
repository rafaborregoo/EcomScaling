import type { Tone } from "./badge";

export type IntegrationConfigurationStatus =
  "configured" | "credentials_missing" | "feature_disabled" | "not_implemented";

export type IntegrationStatusPresentation = { label: string; tone: Tone };

/** “Preparado” describes the product contract, never a real connection. */
export function getIntegrationStatusPresentation({
  available,
  configurationStatus,
  connectionStatus,
  healthStatus,
}: {
  available: boolean;
  configurationStatus: IntegrationConfigurationStatus;
  connectionStatus?: string | null;
  healthStatus?: string | null;
}): IntegrationStatusPresentation {
  if (!available || configurationStatus === "not_implemented") {
    return { label: "No disponible todavía", tone: "neutral" };
  }
  if (configurationStatus === "credentials_missing") {
    return { label: "Credenciales pendientes", tone: "warn" };
  }
  if (configurationStatus === "feature_disabled") {
    return { label: "Desactivado", tone: "warn" };
  }
  if (!connectionStatus) return { label: "No conectado", tone: "neutral" };

  const healthLabels: Record<string, IntegrationStatusPresentation> = {
    healthy: { label: "Saludable", tone: "success" },
    stale: { label: "Desactualizado", tone: "warn" },
    degraded: { label: "Degradado", tone: "danger" },
    reauthorization_required: { label: "Reautorizar", tone: "warn" },
  };

  // A connected token can still be stale, degraded or require reauthorization.
  if (
    connectionStatus === "connected" &&
    healthStatus &&
    healthStatus !== "healthy" &&
    healthLabels[healthStatus]
  ) {
    return healthLabels[healthStatus];
  }

  const connectionLabels: Record<string, IntegrationStatusPresentation> = {
    connected: { label: "Conectado", tone: "success" },
    syncing: { label: "Sincronizando", tone: "brand" },
    error: { label: "Conexión con errores", tone: "danger" },
    revoked: { label: "Reautorizar", tone: "warn" },
    pending: { label: "Autorización pendiente", tone: "warn" },
    disconnected: { label: "Desconectado", tone: "neutral" },
  };
  if (connectionLabels[connectionStatus])
    return connectionLabels[connectionStatus];

  return (
    healthLabels[healthStatus ?? ""] ?? {
      label: connectionStatus,
      tone: "neutral",
    }
  );
}
