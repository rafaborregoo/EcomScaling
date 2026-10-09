"use client";

import { useState } from "react";
import { useCachedQuery } from "@/lib/use-cached-query";
import { PlatformAdminShell } from "@/components/platform-admin-shell";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { displayValue, organizationStatusTone } from "@/lib/display-labels";
import {
  AssignmentEditor,
  formatCost,
  topAgentsLabel,
  type Consultant,
  type ConsultantsPayload,
} from "@/components/admin-consultant-detail";
import {
  ConcesionDePlan,
  concesionInicial,
  concesionValida,
  grantPlanBody,
  PlanEditor,
} from "@/components/concesion-de-plan";
import { VerComoButton } from "@/components/ver-como-button";
import {
  AsyncState,
  Badge,
  Banner,
  BarChart,
  Button,
  ButtonLink,
  Card,
  ConfirmDialog,
  ErrorBlock,
  EYEBROW,
  Field,
  Input,
  Metric,
  Select,
  Sheet,
  Table,
  type TableColumnDef,
} from "@/components/ui";

function ConsultantsPanel() {
  const {
    data,
    error: loadError,
    isLoading,
    reload: load,
  } = useCachedQuery<ConsultantsPayload>("/v1/admin/consultants");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function deleteConsultant(consultant: Consultant) {
    setBusyId(consultant.id);
    setError(null);
    setNotice(null);
    try {
      const response = await apiFetch(`/v1/admin/consultants/${consultant.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      setNotice("Consultor eliminado.");
      load();
    } catch {
      setError("No se pudo eliminar. Revisa la conexión e inténtalo de nuevo.");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleActive(consultant: Consultant) {
    setBusyId(consultant.id);
    setError(null);
    setNotice(null);
    try {
      const response = await apiFetch(`/v1/admin/consultants/${consultant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !consultant.is_active }),
      });
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      setNotice(
        consultant.is_active
          ? "Consultor desactivado."
          : "Consultor reactivado.",
      );
      load();
    } catch {
      setError("No se pudo cambiar el estado. Revisa la conexión e inténtalo de nuevo.");
    } finally {
      setBusyId(null);
    }
  }

  async function resendInvite(consultant: Consultant) {
    setBusyId(consultant.id);
    setError(null);
    setNotice(null);
    try {
      const response = await apiFetch(
        `/v1/admin/consultants/${consultant.id}/resend-invite`,
        { method: "POST" },
      );
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      setNotice("Invitación reenviada por email.");
    } catch {
      setError("No se pudo reenviar la invitación. Revisa la conexión e inténtalo de nuevo.");
    } finally {
      setBusyId(null);
    }
  }

  if (isLoading) {
    return <AsyncState status="loading" loadingLabel="Cargando consultores..." />;
  }

  if (loadError && !data) {
    return <ErrorBlock>{loadError}</ErrorBlock>;
  }

  if (!data) {
    return null;
  }

  const columns: TableColumnDef<Consultant>[] = [
    {
      key: "full_name",
      label: "Consultor",
      render: (row) => row.full_name ?? row.id,
    },
    {
      key: "is_active",
      label: "Estado",
      render: (row) => (
        <Badge tone={row.is_active ? "success" : "neutral"}>
          {row.is_active ? "activo" : "inactivo"}
        </Badge>
      ),
    },
    {
      key: "clients",
      label: "Clientes",
      render: (row) => String(row.assignments.length),
    },
    {
      key: "cost",
      label: "Coste IA",
      render: (row) => formatCost(row.ai.cost_usd),
    },
    {
      key: "runs",
      label: "Ejecuciones",
      render: (row) => String(row.ai.run_count),
    },
    {
      key: "agents",
      label: "Agentes más usados",
      render: (row) => (
        <span className="text-xs text-muted">
          {topAgentsLabel(row.ai.top_agents)}
        </span>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (row) => (
        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            variant="ghost"
            disabled={busyId === row.id}
            onClick={() => void toggleActive(row)}
          >
            {row.is_active ? "Desactivar" : "Reactivar"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={busyId === row.id}
            onClick={() => void resendInvite(row)}
          >
            Reenviar
          </Button>
          <ButtonLink
            href={`/admin/consultores/${row.id}`}
            size="sm"
            variant="ghost"
            aria-label={`Abrir ficha de ${row.full_name ?? row.id}`}
          >
            Abrir ficha
          </ButtonLink>
          <ConfirmDialog
            trigger={
              <Button size="sm" variant="ghost" disabled={busyId === row.id}>
                Eliminar
              </Button>
            }
            title={`Eliminar a ${row.full_name ?? row.id} para siempre`}
            note="Borra su cuenta y su organización consultora (con su plan). Sus clientes se quedan sin consultor, no se borran: se reasignan desde aquí. No hay vuelta atrás."
            irreversible
            confirmPhrase={row.full_name ?? row.id}
            confirmLabel="Eliminar definitivamente"
            onConfirm={() => deleteConsultant(row)}
          />
        </div>
      ),
    },
  ];

  // El gráfico solo aporta comparando: 2+ consultores y algún coste real.
  const costChartData = data.consultants
    .filter((consultant) => consultant.ai.cost_usd > 0)
    .sort((a, b) => b.ai.cost_usd - a.ai.cost_usd)
    .map((consultant) => ({
      name: consultant.full_name ?? consultant.id,
      cost: Number(consultant.ai.cost_usd.toFixed(2)),
    }));
  const activeConsultants = data.consultants.filter((consultant) => consultant.is_active).length;
  const assignmentCount = data.consultants.reduce(
    (total, consultant) => total + consultant.assignments.length,
    0,
  );

  return (
    <div className="admin-module-body">
      {notice ? <Banner tone="success">{notice}</Banner> : null}
      {error ? <ErrorBlock>{error}</ErrorBlock> : null}

      <div className="admin-data-summary">
        <Metric card label="Consultores" value={String(data.consultants.length)} />
        <Metric card label="Con acceso activo" value={String(activeConsultants)} tone="success" />
        <Metric card label="Desactivados" value={String(data.consultants.length - activeConsultants)} />
        <Metric card label="Asignaciones de clientes" value={String(assignmentCount)} />
      </div>

      <Card
        kicker="Panel platform admin"
        title="Directorio de consultores"
        description={`Acceso, cartera y uso de IA · últimos ${data.window_days} días.`}
        actions={
          <Button onClick={() => setCreating((value) => !value)}>
            {creating ? "Cerrar alta" : "Invitar consultor"}
          </Button>
        }
      >
        {costChartData.length >= 2 ? (
          <div className="mb-6">
            <p className={EYEBROW}>Coste IA por consultor (USD)</p>
            <div className="mt-2">
              <BarChart
                data={costChartData}
                xKey="name"
                series={[{ key: "cost", label: "Coste IA" }]}
                horizontal
                height={Math.min(280, Math.max(88, costChartData.length * 30))}
                valueFormatter={formatCost}
              />
            </div>
          </div>
        ) : null}

        <Table
          ariaLabel="Consultores"
          columns={columns}
          rows={data.consultants}
          emptyLabel="No hay consultores todavía."
        />
      </Card>

      <ConsultantCreateSheet
        isOpen={creating}
        onOpenChange={setCreating}
        onCreated={async (msg) => {
          setNotice(msg);
          setCreating(false);
          load();
        }}
        // Si el correo falla, la hoja se queda abierta para que se vea y se copie el enlace.
        onInvitedManually={async (msg) => {
          setNotice(msg);
          load();
        }}
      />

    </div>
  );
}

function ConsultantCreateSheet({
  isOpen,
  onOpenChange,
  onCreated,
  onInvitedManually,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (message: string) => Promise<void>;
  onInvitedManually: (message: string) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [plan, setPlan] = useState(() => concesionInicial("consultant", true));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualInvite, setManualInvite] = useState<{ email: string; url: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (wasOpen !== isOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setEmail("");
      setFullName("");
      setPlan(concesionInicial("consultant", true));
      setError(null);
      setManualInvite(null);
    }
  }

  async function submit() {
    setBusy(true);
    setError(null);
    setManualInvite(null);
    const targetEmail = email.trim().toLowerCase();
    try {
      const response = await apiFetch("/v1/admin/consultants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          full_name: fullName || undefined,
          grant_plan: grantPlanBody(plan),
        }),
      });
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      const payload = (await response.json()) as {
        delivery?: "email" | "manual_link";
        invite_url?: string | null;
      };
      setEmail("");
      setFullName("");
      if (payload.delivery === "manual_link" && payload.invite_url) {
        setManualInvite({ email: targetEmail, url: payload.invite_url });
        await onInvitedManually("Consultor creado. Supabase alcanzó el límite de correo; copia y comparte el enlace de acceso.");
      } else {
        await onCreated(`Invitación enviada por email a ${targetEmail}.`);
      }
    } catch {
      setError("No se pudo invitar al consultor. Revisa la conexión e inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  const canSubmit =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && concesionValida(plan);

  return (
    <Sheet
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      size="md"
      title="Invitar consultor"
      isBusy={busy}
      isDirty={Boolean(email.trim() || fullName.trim())}
      formId="create-consultant-form"
      cancelLabel={manualInvite ? "Cerrar" : "Cancelar"}
      primary={manualInvite ? undefined : { label: "Invitar consultor", busyLabel: "Invitando…", disabled: !canSubmit }}
    >
      <form
        id="create-consultant-form"
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <p className="text-muted">
          Invita a un consultor por email y decide si le concedes el plan o lo paga él.
        </p>
        {error ? <ErrorBlock>{error}</ErrorBlock> : null}
        {manualInvite ? (
          <div className="space-y-3 rounded-md border border-line bg-surface p-4">
            <p className="text-sm font-medium">Enlace de acceso para {manualInvite.email}</p>
            <p className="text-xs text-muted">
              El correo de Supabase está temporalmente limitado. Comparte este enlace únicamente con el consultor invitado.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input readOnly value={manualInvite.url} aria-label="Enlace de invitación" />
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  void navigator.clipboard.writeText(manualInvite.url).then(() => {
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 2000);
                  });
                }}
              >
                {copied ? "Copiado" : "Copiar enlace"}
              </Button>
            </div>
          </div>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="consultor@empresa.com" />
          </Field>
          <Field label="Nombre (opcional)">
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nombre Apellido" />
          </Field>
        </div>
        <ConcesionDePlan
          value={plan}
          onChange={setPlan}
          etiquetaSinPlan="Lo paga él con tarjeta"
          avisoSinPlan="Hasta que pague no será consultor: entrará, pero sin cartera de clientes. El rol sale del plan, así que lo verá en /planes al entrar."
        />
      </form>
    </Sheet>
  );
}

export default function AdminConsultoresPage() {
  return (
    <PlatformAdminShell title="Consultores">
      {() => <ConsultantsPanel />}
    </PlatformAdminShell>
  );
}
