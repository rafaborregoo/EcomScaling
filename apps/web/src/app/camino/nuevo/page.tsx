"use client";


import { ArchiveIcon } from "lucide-react";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
import { useActiveConnection } from "@/components/active-connection";
import { apiFetch, type BootstrapResponse } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { invalidateCachedQueries } from "@/lib/use-cached-query";
import {
  ButtonLink,
  EmptyState,
  ErrorBlock,
  LoadingBlock,
  toast,
  Button,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui";
import { CaminoCreatePanel } from "../camino-create-panel";
import { CaminoReplan } from "../camino-replan";
import d from "../camino-desk.module.css";

/**
 * Nuevo camino: el único sitio desde el que se crea uno (con IA, a mano o
 * desde una plantilla .md). Mi Camino ya no lo ofrece en cada pantalla: con un
 * camino abierto esas opciones no se podían usar (solo puede haber uno en
 * borrador o activo por tienda) y generar con IA gastaba una llamada al modelo
 * para acabar en un 409.
 */

type OpenPlan = {
  id: string;
  name: string;
  status: string;
  version: number;
};
type Catalog = Array<{ key: string; label: string; unit: "money" | "pct" | "count" | "ratio" | "number" }>;

function NuevoCaminoContent({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const router = useRouter();
  const params = useSearchParams();
  const { organizationId: selectedOrganizationId } = useActiveOrganization();
  const { connectionId } = useActiveConnection();
  const organization =
    bootstrap.memberships.find((item) => item.organization_id === selectedOrganizationId)?.organization ??
    bootstrap.memberships[0]?.organization ??
    null;
  const membership = bootstrap.memberships.find((item) => item.organization_id === (organization?.id ?? ""));
  const isConsultantView = ["platform_admin", "consultant"].includes(bootstrap.profile.platform_role);
  const canManage = isConsultantView || ["owner", "manager"].includes(membership?.role ?? "");
  const organizationId = organization?.id ?? null;

  const [plan, setPlan] = useState<OpenPlan | null>(null);
  const [catalog, setCatalog] = useState<Catalog>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isArchiving, setIsArchiving] = useState(false);
  const [replanning, setReplanning] = useState(params.get("replan") === "1");
  const [error, setError] = useState<string | null>(null);

  // Se lee siempre fresco: decidir "ya hay un camino abierto" con una caché
  // vieja mandaba al usuario a rellenar el cuestionario para un 409 al final.
  const load = useCallback(async () => {
    if (!organizationId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const scope = connectionId ? `?connectionId=${encodeURIComponent(connectionId)}` : "";
    try {
      const [planResponse, objectivesResponse] = await Promise.all([
        apiFetch(`/v1/organizations/${organizationId}/strategic-plan${scope}`),
        apiFetch(`/v1/organizations/${organizationId}/objectives${scope}`),
      ]);
      if (!planResponse.ok) {
        setError(await readApiError(planResponse));
        return;
      }
      const planPayload = (await planResponse.json()) as { plan: OpenPlan | null };
      setPlan(planPayload.plan);
      if (objectivesResponse.ok) {
        const objectives = (await objectivesResponse.json()) as { catalog?: Catalog };
        setCatalog(objectives.catalog ?? []);
      }
      setError(null);
    } catch {
      setError("No se pudo comprobar el camino actual por un error de red. Reintenta.");
    } finally {
      setIsLoading(false);
    }
  }, [organizationId, connectionId]);

  useEffect(() => {
    void load();
  }, [load]);

  function refreshRouteViews() {
    if (organizationId) invalidateCachedQueries(`/v1/organizations/${organizationId}/strategic-plan/routes`);
    invalidateCachedQueries("/v1/consultant/plans");
  }

  async function archiveCurrent() {
    if (!organizationId || !plan) return;
    setIsArchiving(true);
    try {
      const response = await apiFetch(`/v1/organizations/${organizationId}/strategic-plan/${plan.id}/archive`, {
        method: "POST",
      });
      if (!response.ok) {
        toast.danger(await readApiError(response));
        return;
      }
      toast.success("Camino archivado. Ya puedes crear uno nuevo.");
      refreshRouteViews();
      await load();
    } catch {
      toast.danger("No se pudo archivar el camino. Comprueba la conexión e inténtalo de nuevo.");
    } finally {
      setIsArchiving(false);
    }
  }

  const theme = isConsultantView ? d.desk : d.client;
  const hasOpenPlan = plan !== null && ["draft", "active"].includes(plan.status);

  return (
    <div className={`portal-page space-y-5 sm:space-y-6 ${theme}`}>
      <div>
        <ButtonLink href="/camino" variant="ghost" size="sm">
          ← Volver a Mi Camino
        </ButtonLink>
      </div>

      {!organization ? (
        <EmptyState title="Elige primero un cliente" hint="El camino se crea para una organización: selecciónala arriba y vuelve aquí." />
      ) : !canManage ? (
        <EmptyState
          title="Solo quien gestiona el camino puede crear uno nuevo"
          hint="Pídeselo al propietario de la cuenta o a tu consultor."
        />
      ) : isLoading && !plan ? (
        <LoadingBlock label="Comprobando el camino actual..." />
      ) : error ? (
        <ErrorBlock>{error}</ErrorBlock>
      ) : hasOpenPlan && plan && replanning ? (
        <CaminoReplan
          key={plan.id}
          reviewDraft={params.get("revisar") === "1"}
          organizationId={organization.id}
          connectionId={connectionId || null}
          planId={plan.id}
          variant={isConsultantView ? "consultant" : "client"}
          onApplied={refreshRouteViews}
        />
      ) : hasOpenPlan && plan ? (
        <Card>
          <CardHeader>
            <CardTitle>{`Ya hay un camino ${plan.status === "draft" ? "en borrador" : "activo"}: «${plan.name}»`}</CardTitle>
            <CardDescription>En cada tienda solo puede haber un camino en borrador o activo.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="max-w-prose text-sm">
                Puedes pedirle a la IA que lo replanifique y decidir qué cambios aceptas, o archivarlo y empezar de cero.
                No se borra nada: sus fases, hitos, tareas y revisiones se conservan en el historial. Si solo quieres
                cambiarlo, edítalo desde Mi Camino.
              </p>
              <div role="group" aria-label="Acciones del camino" className="flex flex-wrap items-center gap-2">
                <Button type="button" onClick={() => setReplanning(true)}>
                  Replanificar con IA
                </Button>
                <ButtonLink href="/camino" variant="secondary">
                  Volver a Mi Camino
                </ButtonLink>
                <AlertDialog>
                  <AlertDialogTrigger
                    render={<Button type="button" variant="secondary" disabled={isArchiving}>Archivar este camino y crear uno nuevo</Button>}
                  />
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogMedia>
                        <ArchiveIcon />
                      </AlertDialogMedia>
                      <AlertDialogTitle>¿Archivar el camino actual?</AlertDialogTitle>
                      <AlertDialogDescription>
                        «{plan.name}» dejará de estar {plan.status === "draft" ? "en borrador" : "en marcha"}. Sus tareas siguen disponibles en Tareas. Después podrás crear uno nuevo.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => archiveCurrent()}>Archivar camino</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <CaminoCreatePanel
          variant={isConsultantView ? "consultant" : "client"}
          title={
            isConsultantView
              ? `Nuevo camino para ${organization.display_name}`
              : connectionId
                ? "Nuevo camino para esta tienda"
                : "Nuevo camino"
          }
          organizationId={organization.id}
          connectionId={connectionId || null}
          defaultCurrency={organization.currency_code ?? "EUR"}
          catalog={catalog}
          onCreated={() => {
            refreshRouteViews();
            router.push("/camino");
          }}
        />
      )}
    </div>
  );
}

export default function NuevoCaminoPage() {
  return (
    <Suspense fallback={<LoadingBlock label="Cargando..." />}>
      <PortalShell title="Nuevo camino">{(bootstrap) => <NuevoCaminoContent bootstrap={bootstrap} />}</PortalShell>
    </Suspense>
  );
}
