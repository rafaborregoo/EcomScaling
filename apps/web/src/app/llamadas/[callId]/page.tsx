"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
import { apiFetch, type BootstrapResponse } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import {
  EmptyState,
  ErrorBlock,
  IconChevronLeft,
  Link,
  LoadingBlock,
} from "@/components/ui";
import { CallDetail, type ConsultingCall } from "../calls-client";

function CallPageContent({
  bootstrap,
  callId,
}: {
  bootstrap: BootstrapResponse;
  callId: string;
}) {
  const { organizationId } = useActiveOrganization();
  const [calls, setCalls] = useState<ConsultingCall[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCalls = useCallback(async () => {
    if (!organizationId) {
      setCalls([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/calls`,
      );
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }

      const payload = (await response.json()) as { calls: ConsultingCall[] };
      setCalls(payload.calls);
      setError(null);
    } catch {
      setError("No se pudo cargar la llamada por un error de red. Reintenta.");
    } finally {
      setIsLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    void loadCalls();
  }, [loadCalls]);

  const call = calls.find((item) => item.id === callId) ?? null;
  const isConsultant = ["platform_admin", "consultant"].includes(
    bootstrap.profile.platform_role,
  );

  return (
    <div className="portal-page space-y-4 sm:space-y-5">
      <Link
        href="/llamadas"
        className="inline-flex items-center gap-1 text-sm text-muted"
      >
        <IconChevronLeft aria-hidden /> Todas las llamadas
      </Link>

      {!organizationId ? (
        <EmptyState
          title="Elige un cliente"
          hint="Selecciona la tienda a la que pertenece esta llamada para abrirla."
        />
      ) : isLoading ? (
        <LoadingBlock label="Cargando llamada..." />
      ) : error ? (
        <ErrorBlock>{error}</ErrorBlock>
      ) : !call ? (
        <EmptyState
          title="No encontramos esta llamada"
          hint="Puede haberse eliminado o pertenecer a otro cliente."
        />
      ) : (
        <CallDetail
          call={call}
          isConsultant={isConsultant}
          onChanged={loadCalls}
          priorCalls={calls}
        />
      )}
    </div>
  );
}

export default function CallPage() {
  const params = useParams<{ callId: string }>();
  const callId = String(params?.callId ?? "");

  return (
    <PortalShell title="Detalle de llamada">
      {(bootstrap) => <CallPageContent bootstrap={bootstrap} callId={callId} />}
    </PortalShell>
  );
}
