"use client";

import { useParams } from "next/navigation";
import { PlatformAdminShell } from "@/components/platform-admin-shell";
import {
  ClientOverviewPanel,
  EditClientForm,
  type Client,
} from "@/components/admin-client-detail";
import { VerComoButton } from "@/components/ver-como-button";
import { useCachedQuery } from "@/lib/use-cached-query";
import { displayValue, organizationStatusTone } from "@/lib/display-labels";
import {
  AsyncState,
  Badge,
  ButtonLink,
  Card,
  ErrorBlock,
  Metric,
  toast,
} from "@/components/ui";

function ClientControlPanel({ clientId }: { clientId: string }) {
  const { data, error, isLoading, reload } = useCachedQuery<{ clients: Client[] }>(
    "/v1/admin/clients",
  );
  const client = data?.clients.find((item) => item.id === clientId) ?? null;

  if (isLoading) {
    return <AsyncState status="loading" loadingLabel="Cargando la ficha del cliente…" />;
  }

  if (error && !data) {
    return <ErrorBlock>{error}</ErrorBlock>;
  }

  if (!client) {
    return (
      <Card title="No encontramos este cliente">
        <p className="text-sm text-muted">
          Puede que se haya eliminado o que ya no tengas acceso a su ficha.
        </p>
        <ButtonLink className="mt-4" href="/admin/clientes" variant="secondary">
          Volver al directorio
        </ButtonLink>
      </Card>
    );
  }

  const onSaved = async (message: string) => {
    toast.success(message);
    reload();
  };

  return (
    <div className="admin-client-detail">
      <header className="admin-client-detail-header">
        <ButtonLink href="/admin/clientes" variant="ghost" size="sm">
          Directorio de clientes
        </ButtonLink>
        <div className="admin-client-detail-title-row">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1>{client.display_name}</h1>
              <Badge tone={organizationStatusTone(client.status)}>
                {displayValue(client.status)}
              </Badge>
            </div>
            <p>
              Ficha de control · alta el {new Date(client.created_at).toLocaleDateString("es-ES")}
            </p>
          </div>
          <VerComoButton organizationId={client.id} displayName={client.display_name} />
        </div>
      </header>

      <div className="admin-data-summary">
        <Metric card label="Miembros" value={String(client.member_count)} />
        <Metric
          card
          label="Consultores asignados"
          value={String(client.consultants.length)}
          tone={client.consultants.length ? "success" : "warn"}
        />
        <Metric
          card
          label="Plan"
          value={client.plan?.plan_code ?? "Sin plan"}
          hint={client.plan ? displayValue(client.plan.status) : "Requiere revisar acceso"}
          tone={client.plan ? "default" : "warn"}
        />
        <Metric card label="Moneda" value={client.currency_code} />
      </div>

      <section className="admin-client-detail-section" aria-labelledby="client-operations-title">
        <div className="admin-client-detail-section-heading">
          <div>
            <h2 id="client-operations-title">Operación de la cuenta</h2>
            <p>Conexiones, sincronizaciones, accesos y actividad reciente.</p>
          </div>
        </div>
        <ClientOverviewPanel organizationId={client.id} />
      </section>

      <section className="admin-client-detail-section" aria-labelledby="client-settings-title">
        <div className="admin-client-detail-section-heading">
          <div>
            <h2 id="client-settings-title">Configuración y plan</h2>
            <p>Actualiza los datos de la organización, el acceso comercial o exporta su información.</p>
          </div>
        </div>
        <EditClientForm client={client} onSaved={onSaved} />
      </section>
    </div>
  );
}

export default function AdminClientDetailPage() {
  const params = useParams<{ clientId: string }>();

  return (
    <PlatformAdminShell title="Clientes">
      {() => <ClientControlPanel clientId={params.clientId} />}
    </PlatformAdminShell>
  );
}
