"use client";

import { useState } from "react";
import { apiFetch, type BootstrapResponse } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { useCachedQuery } from "@/lib/use-cached-query";
import { ConfirmDangerDialog } from "@/components/confirm-danger-dialog";
import {
  Badge,
  Banner,
  Button,
  Card,
  Link,
  List,
  LoadingBlock,
  toast,
} from "@/components/ui";

/**
 * Qué leemos, descargar tus datos y eliminar la cuenta. Reutiliza dos rutas que
 * ya existían (export y baja de organización); lo nuevo es que las puede usar
 * el propietario, no solo platform_admin.
 */

const DATA_READ: Record<string, string> = {
  shopify: "Pedidos, productos, inventario y devoluciones.",
  klaviyo: "Campañas, flows, listas y métricas de email.",
  meta: "Campañas, anuncios, gasto y resultados.",
};

type IntegrationsPayload = {
  providers: Array<{
    id: string;
    name: string;
    connection: { status: string } | null;
  }>;
};

function dataReadFor(provider: { id: string; name: string }) {
  const key = Object.keys(DATA_READ).find(
    (candidate) =>
      provider.id.toLowerCase().includes(candidate) ||
      provider.name.toLowerCase().includes(candidate),
  );
  return key ? DATA_READ[key] : null;
}

export function PrivacySection({
  bootstrap,
  organization,
}: {
  bootstrap: BootstrapResponse;
  organization: { id: string; display_name: string; status?: string };
}) {
  const isOwner = bootstrap.memberships.some(
    (membership) =>
      membership.organization_id === organization.id &&
      membership.role === "owner" &&
      membership.accessSource === "membership",
  );
  const integrations = useCachedQuery<IntegrationsPayload>(
    `/v1/organizations/${organization.id}/integrations`,
  );
  const [exporting, setExporting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);

  async function download() {
    setExporting(true);
    try {
      const response = await apiFetch(
        `/v1/consultant/organizations/${organization.id}/export`,
      );
      if (!response.ok) {
        toast.danger(await readApiError(response));
        return;
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `e-nora-${organization.display_name.replace(/\W+/g, "-").toLowerCase()}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.danger("No se pudo preparar la descarga por un error de red. Reintenta.");
    } finally {
      setExporting(false);
    }
  }

  async function remove() {
    setDeleting(true);
    try {
      const response = await apiFetch(
        `/v1/consultant/organizations/${organization.id}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        toast.danger(await readApiError(response));
        return;
      }
      setConfirming(false);
      setDeleted(true);
    } catch {
      toast.danger("No se pudo eliminar la cuenta por un error de red. Reintenta.");
    } finally {
      setDeleting(false);
    }
  }

  const providers = integrations.data?.providers ?? [];

  return (
    <div className="space-y-4">
      {deleted ? (
        <Banner tone="warn">
          Hemos marcado {organization.display_name} para eliminar. Se borrará a
          los 30 días; si fue un error, escribe a tu consultor antes de esa fecha.
        </Banner>
      ) : null}

      <Card
        title="Qué datos leemos de tus integraciones"
        actions={<Link href="/integraciones">Ir a Integraciones</Link>}
      >
        {!integrations.data ? (
          <LoadingBlock label="Cargando integraciones..." />
        ) : (
          <List>
            {providers.map((provider) => {
              const connected = provider.connection?.status === "connected";
              return (
                <List.Item
                  key={provider.id}
                  className="flex items-center justify-between gap-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{provider.name}</p>
                    {dataReadFor(provider) ? (
                      <p className="text-xs text-muted">{dataReadFor(provider)}</p>
                    ) : null}
                  </div>
                  <Badge tone={connected ? "success" : "neutral"}>
                    {connected ? "Conectado" : "Sin conectar"}
                  </Badge>
                </List.Item>
              );
            })}
          </List>
        )}
        <p className="mt-3 text-xs text-muted">
          Cómo tratamos estos datos y cómo pedir su borrado:{" "}
          <Link href="/eliminacion-de-datos">Eliminación de datos</Link>. Todos los documentos legales
          están en el <Link href="/legal">Centro legal</Link>.
        </p>
      </Card>

      {isOwner ? (
        <Card
          title="Descargar tus datos"
          description="Un archivo JSON con la configuración, tareas, mensajes y cifras de tu tienda. Las credenciales de las integraciones no se incluyen."
        >
          <Button
            variant="secondary"
            onClick={() => void download()}
            disabled={exporting}
          >
            {exporting ? "Preparando..." : "Descargar"}
          </Button>
        </Card>
      ) : null}

      {isOwner ? (
        <Card
          title="Eliminar la cuenta"
          className="border-danger"
          description={`Desconecta las integraciones y borra los datos de ${organization.display_name} a los 30 días. Hasta entonces se puede recuperar.`}
        >
          <Button
            variant="danger"
            onClick={() => setConfirming(true)}
            disabled={deleted}
          >
            Eliminar cuenta
          </Button>
        </Card>
      ) : (
        <p className="text-sm text-muted">
          Descargar los datos y eliminar la cuenta es cosa del propietario de la
          tienda.
        </p>
      )}

      {confirming ? (
        <ConfirmDangerDialog
          title="Eliminar la cuenta"
          note="Se marcará para borrado y se eliminará a los 30 días. Durante ese plazo se puede recuperar."
          confirmPhrase={organization.display_name}
          actionLabel="Eliminar cuenta"
          onConfirm={() => void remove()}
          onCancel={() => setConfirming(false)}
          isBusy={deleting}
        />
      ) : null}
    </div>
  );
}
