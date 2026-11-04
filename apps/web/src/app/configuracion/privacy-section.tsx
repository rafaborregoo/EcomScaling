"use client";

import { Trash2Icon } from "lucide-react";
import { useState } from "react";
import { apiFetch, type BootstrapResponse } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { scheduledDeletionLabel } from "@/lib/scheduled-deletion";
import { useCachedQuery } from "@/lib/use-cached-query";
import {
  Badge,
  Banner,
  Button,
  Link,
  List,
  LoadingBlock,
  toast,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogConfirmPhrase,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
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
  organization: {
    id: string;
    display_name: string;
    status?: string;
    scheduled_purge_at?: string | null;
  };
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
  const [erasing, setErasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const pendingDeletion = organization.status === "pending_deletion";

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

  // Recarga tras cada paso: el estado de la cuenta manda en todo el portal y sale
  // del arranque, no de esta pantalla.
  async function remove() {
    try {
      const response = await apiFetch(
        `/v1/consultant/organizations/${organization.id}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        toast.danger(await readApiError(response));
        return;
      }
      window.location.reload();
    } catch {
      toast.danger("No se pudo eliminar la cuenta por un error de red. Reintenta.");
    }
  }

  async function restore() {
    setRestoring(true);
    try {
      const response = await apiFetch(
        `/v1/consultant/organizations/${organization.id}/restore`,
        { method: "POST" },
      );
      if (!response.ok) {
        toast.danger(await readApiError(response));
        setRestoring(false);
        return;
      }
      window.location.reload();
    } catch {
      toast.danger("No se pudo recuperar la cuenta por un error de red. Reintenta.");
      setRestoring(false);
    }
  }

  async function eraseNow() {
    try {
      const response = await apiFetch(
        `/v1/consultant/organizations/${organization.id}/hard-delete`,
        { method: "POST" },
      );
      if (!response.ok) {
        toast.danger(await readApiError(response));
        return;
      }
      // Si era tu única tienda el usuario ya no existe: el arranque manda al login.
      window.location.assign("/");
    } catch {
      toast.danger("No se pudo eliminar la cuenta por un error de red. Reintenta.");
    }
  }

  const providers = integrations.data?.providers ?? [];

  return (
    <div className="space-y-4">
      {pendingDeletion ? (
        <Banner tone="warn" title={`${organization.display_name} está marcada para eliminar`}>
          {scheduledDeletionLabel(organization.scheduled_purge_at)}. Hasta entonces se puede recuperar.
        </Banner>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Qué datos leemos de tus integraciones</CardTitle>
          <CardAction><Link href="/integraciones">Ir a Integraciones</Link></CardAction>
        </CardHeader>
        <CardContent>
          {!integrations.data ? (
            <LoadingBlock label="Cargando integraciones..." />
          ) : (
            <List>
              {providers.map((provider) => {
                const connected = provider.connection?.status === "connected";
                return (
                  <Item key={provider.id} role="listitem">
                    <ItemContent>
                      <ItemTitle>{provider.name}</ItemTitle>
                      {dataReadFor(provider) ? (
                        <ItemDescription>{dataReadFor(provider)}</ItemDescription>
                      ) : null}
                    </ItemContent>
                    <ItemActions>
                      <Badge tone={connected ? "success" : "neutral"}>
                        {connected ? "Conectado" : "Sin conectar"}
                      </Badge>
                    </ItemActions>
                  </Item>
                );
              })}
            </List>
          )}
          <p className="mt-3 text-xs text-muted">
            Cómo tratamos estos datos y cómo pedir su borrado:{" "}
            <Link href="/eliminacion-de-datos">Eliminación de datos</Link>. Todos los documentos legales
            están en el <Link href="/legal">Centro legal</Link>.
          </p>
        </CardContent>
      </Card>

      {isOwner ? (
        <Card>
          <CardHeader>
            <CardTitle>Descargar tus datos</CardTitle>
            <CardDescription>Un archivo JSON con la configuración, tareas, mensajes y cifras de tu tienda. Las credenciales de las integraciones no se incluyen.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="secondary"
              onClick={() => void download()}
              disabled={exporting}
            >
              {exporting ? "Preparando..." : "Descargar"}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {isOwner ? (
        <Card className="border-danger">
          <CardHeader>
            <CardTitle>Eliminar la cuenta</CardTitle>
            <CardDescription>{`Borra los datos de ${organization.display_name} a los 30 días, y tu usuario si no tienes otras tiendas. Hasta entonces se puede recuperar.`}</CardDescription>
          </CardHeader>
          <CardContent>
            {pendingDeletion ? (
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => void restore()} disabled={restoring}>
                  {restoring ? "Recuperando…" : "Recuperar cuenta"}
                </Button>
                <Button variant="destructive" onClick={() => setErasing(true)}>
                  Eliminar ya
                </Button>
              </div>
            ) : (
              <Button variant="destructive" onClick={() => setConfirming(true)}>
                Eliminar cuenta
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted">
          Descargar los datos y eliminar la cuenta es cosa del propietario de la
          tienda.
        </p>
      )}

      {/* `remove` cierra el diálogo al acabar bien; si falla, sigue abierto. */}
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-danger/10 text-danger">
              <Trash2Icon />
            </AlertDialogMedia>
            <AlertDialogTitle>¿Eliminar la cuenta?</AlertDialogTitle>
            <AlertDialogDescription>
              Se marcará para borrado y se eliminará a los 30 días. Durante ese plazo se puede recuperar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogConfirmPhrase phrase={organization.display_name} />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              busyLabel="Eliminando…"
              onClick={async () => {
                await remove();
                return false;
              }}
            >
              Eliminar cuenta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={erasing} onOpenChange={setErasing}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-danger/10 text-danger">
              <Trash2Icon />
            </AlertDialogMedia>
            <AlertDialogTitle>¿Eliminar la cuenta definitivamente?</AlertDialogTitle>
            <AlertDialogDescription>
              Borra todo al momento, sin esperar a la fecha programada. No hay vuelta atrás.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogConfirmPhrase phrase={organization.display_name} />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              busyLabel="Eliminando…"
              onClick={async () => {
                await eraseNow();
                return false;
              }}
            >
              Eliminar definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
