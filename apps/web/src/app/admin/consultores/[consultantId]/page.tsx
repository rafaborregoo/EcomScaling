"use client";


import { UserXIcon } from "lucide-react";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PlatformAdminShell } from "@/components/platform-admin-shell";
import { AssignmentEditor, formatCost, type ConsultantsPayload } from "@/components/admin-consultant-detail";
import { useCachedQuery } from "@/lib/use-cached-query";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import {
  EmptyState,
  AsyncState,
  Badge,
  BarChart,
  Button,
  ButtonLink,
  ErrorBlock,
  Metric,
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
  AlertDialogTrigger,
  Card,
  CardContent,
  CardHeader,
  CardKicker,
  CardTitle,
} from "@/components/ui";

function ConsultantControlPanel({ consultantId }: { consultantId: string }) {
  const router = useRouter();
  const query = useCachedQuery<ConsultantsPayload>("/v1/admin/consultants");
  const [busy, setBusy] = useState(false);

  if (query.isLoading) {
    return <AsyncState status="loading" loadingLabel="Cargando la ficha del consultor…" />;
  }

  if (query.error && !query.data) return <ErrorBlock>{query.error}</ErrorBlock>;
  if (!query.data) return null;

  const consultant = query.data.consultants.find((item) => item.id === consultantId);
  if (!consultant) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No encontramos este consultor</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted">Puede que se haya eliminado o que ya no tengas acceso a su ficha.</p>
          <ButtonLink className="mt-4" href="/admin/consultores" variant="secondary">
            Volver al directorio
          </ButtonLink>
        </CardContent>
      </Card>
    );
  }

  const consultantRecord = consultant;

  async function toggleActive() {
    setBusy(true);
    try {
      const response = await apiFetch(`/v1/admin/consultants/${consultantRecord.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !consultantRecord.is_active }),
      });
      if (!response.ok) {
        toast.danger(await readApiError(response));
        return;
      }
      toast.success(consultantRecord.is_active ? "Consultor desactivado." : "Consultor reactivado.");
      query.reload();
    } catch {
      toast.danger("No se pudo cambiar el estado. Revisa la conexión e inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  async function resendInvite() {
    setBusy(true);
    try {
      const response = await apiFetch(`/v1/admin/consultants/${consultantRecord.id}/resend-invite`, {
        method: "POST",
      });
      if (!response.ok) {
        toast.danger(await readApiError(response));
        return;
      }
      toast.success("Invitación reenviada por email.");
    } catch {
      toast.danger("No se pudo reenviar la invitación. Revisa la conexión e inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteConsultant() {
    setBusy(true);
    try {
      const response = await apiFetch(`/v1/admin/consultants/${consultantRecord.id}`, { method: "DELETE" });
      if (!response.ok) {
        toast.danger(await readApiError(response));
        return;
      }
      toast.success("Consultor eliminado.");
      router.push("/admin/consultores");
    } catch {
      toast.danger("No se pudo eliminar. Revisa la conexión e inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-client-detail">
      <header className="admin-client-detail-header">
        <ButtonLink href="/admin/consultores" variant="ghost" size="sm">
          Directorio de consultores
        </ButtonLink>
        <div className="admin-client-detail-title-row">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1>{consultant.full_name ?? "Consultor sin nombre"}</h1>
              <Badge tone={consultant.is_active ? "success" : "neutral"}>
                {consultant.is_active ? "Activo" : "Inactivo"}
              </Badge>
            </div>
            <p>Control de acceso, cartera asignada y actividad de IA · últimos {query.data.window_days} días</p>
          </div>
          <div role="group" aria-label="Acciones del consultor" className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" disabled={busy} onClick={() => void resendInvite()}>
              Reenviar invitación
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => void toggleActive()}>
              {consultant.is_active ? "Desactivar" : "Reactivar"}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger render={<Button variant="ghost" disabled={busy}>Eliminar</Button>} />
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogMedia className="bg-danger/10 text-danger">
                    <UserXIcon />
                  </AlertDialogMedia>
                  <AlertDialogTitle>¿Eliminar a {consultant.full_name ?? consultant.id} para siempre?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Borra su cuenta y su organización consultora (con su plan). Sus clientes se quedan sin consultor; no se borran. No hay vuelta atrás.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogConfirmPhrase phrase={consultant.full_name ?? consultant.id} />
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction variant="destructive" onClick={() => deleteConsultant()}>
                    Eliminar definitivamente
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </header>

      <div className="admin-data-summary">
        <Metric card label="Clientes asignados" value={String(consultant.assignments.length)} />
        <Metric card label="Ejecuciones de IA" value={String(consultant.ai.run_count)} />
        <Metric card label="Coste de IA" value={formatCost(consultant.ai.cost_usd)} />
        <Metric
          card
          label="Plan"
          value={consultant.plan?.plan_code ?? "Sin plan"}
          hint={consultant.plan?.status ?? "Revisar acceso"}
          tone={consultant.plan ? "default" : "warn"}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.7fr)]">
        <AssignmentEditor
          consultant={consultant}
          organizations={query.data.organizations}
          organizationStats={query.data.organization_stats}
          windowDays={query.data.window_days}
          onChanged={query.reload}
        />
        <Card>
          <CardHeader>
            <CardKicker>Actividad</CardKicker>
            <CardTitle>Agentes más utilizados</CardTitle>
          </CardHeader>
          <CardContent>
            {consultant.ai.top_agents.length ? (
              <BarChart
                data={consultant.ai.top_agents.map((agent) => ({ name: agent.name, runs: agent.runs }))}
                xKey="name"
                series={[{ key: "runs", label: "Ejecuciones" }]}
                horizontal
                height={Math.max(120, consultant.ai.top_agents.length * 38)}
                valueFormatter={(value) => String(value)}
              />
            ) : (
              <EmptyState size="sm" title="Todavía no hay actividad de agentes en este periodo" />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function AdminConsultantDetailPage() {
  const params = useParams<{ consultantId: string }>();

  return (
    <PlatformAdminShell title="Consultores">
      {() => <ConsultantControlPanel consultantId={params.consultantId} />}
    </PlatformAdminShell>
  );
}
