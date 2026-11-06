"use client";

import type { ReactNode } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
import { EvidenceChips } from "@/components/ai-proposed-tasks";
import { WorkPageHeader } from "@/components/trabajo-ui";
import { useCachedQuery } from "@/lib/use-cached-query";
import type { BootstrapResponse } from "@/lib/bootstrap";
import { Badge, ButtonLink, ErrorBlock, LoadingBlock, type Tone, Card, CardAction, CardContent, CardHeader, CardKicker, CardTitle } from "@/components/ui";

/**
 * Una propuesta de la IA en solo lectura, explicada al detalle: quién la hizo,
 * qué proponía cada tarea y por qué, quién decidió y qué decidió. Es el
 * destino de los avisos «X ha aprobado / descartado N propuestas de la IA».
 */

type ProposalStatus = "created" | "retired" | "rejected" | "skipped" | "failed" | "pending";

type OutputDetail = {
  id: string;
  status: string;
  created_at: string;
  agent: { name: string | null; description: string | null };
  summary: string | null;
  decision: {
    receipt_id?: string;
    source_verified?: boolean;
    decision: string;
    decided_at: string | null;
    decided_by: { name: string | null; side: "client" | "consultant" } | null;
    reason: string | null;
    reason_category: string | null;
  } | null;
  proposals: Array<{
    index: number;
    kind?: "task" | "note";
    title: string;
    original_title: string | null;
    description: string | null;
    rationale: string | null;
    priority: string | null;
    completion_criteria: string | null;
    expected_metric: string | null;
    due_hint: string | null;
    owner_role: "cliente" | "consultor" | null;
    evidence: Array<{ label: string; value: string; period: string | null; source: string | null }>;
    status: ProposalStatus;
    task: { id: string; title: string | null; status: string | null } | null;
  }>;
};

const STATUS: Record<ProposalStatus, { label: string; tone: Tone }> = {
  retired: { label: "Aprobada · iniciativa retirada", tone: "neutral" },
  created: { label: "Aprobada · es una tarea", tone: "success" },
  rejected: { label: "Descartada", tone: "danger" },
  skipped: { label: "Quitada antes de aprobar", tone: "neutral" },
  failed: { label: "No se pudo crear", tone: "warn" },
  pending: { label: "Sin decidir", tone: "brand" },
};

const REASON_CATEGORY: Record<string, string> = {
  incorrecto: "Datos incorrectos",
  sin_evidencia: "Sin datos que la respalden",
  irrelevante: "No aplica a la tienda",
  incompleto: "Incompleta",
  duplicado: "Repetida",
  otro: "Otro motivo",
};

const PRIORITY: Record<string, string> = { low: "Baja", medium: "Media", high: "Alta", urgent: "Urgente", urgente: "Urgente" };

const TASK_STATUS: Record<string, string> = {
  proposed: "propuesta",
  pending: "pendiente",
  in_progress: "en curso",
  completed: "completada",
  ignored: "descartada",
  cancelled: "cancelada",
};

const when = (iso: string) =>
  new Date(iso).toLocaleString("es-ES", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

/** Quita el código interno del agente («A05 · ») si lo lleva. */
const agentLabel = (name: string | null) => (name ?? "La IA").replace(/^A\d+[\s·:_-]+/i, "").trim() || "La IA";

function DetailItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className="mt-1 whitespace-pre-line text-sm text-foreground">{children}</dd>
    </div>
  );
}

function verdict(data: OutputDetail, store: string) {
  const total = data.proposals.length;
  const count = (status: ProposalStatus) => data.proposals.filter((item) => item.status === status).length;
  if (!data.decision) return `Esta propuesta todavía no se ha decidido (${total} ${total === 1 ? "tarea" : "tareas"}).`;
  const by = data.decision.decided_by;
  const who = by?.side === "client" ? `${by.name ? `${by.name.split(" ")[0]} (${store})` : store}` : (by?.name ?? "Tu consultor");
  const date = data.decision.decided_at ? ` el ${when(data.decision.decided_at)}` : "";
  if (data.decision.decision === "approved") {
    const created = count("created") + count("retired");
    const skipped = count("skipped");
    return `${who} aprobó ${created} de ${total} ${total === 1 ? "propuesta" : "propuestas"}${date}.${skipped ? ` Quitó ${skipped} antes de aprobar.` : ""}`;
  }
  return `${who} descartó ${total === 1 ? "la propuesta" : `las ${total} tareas propuestas`}${date}.`;
}

function ProposalDetail({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const params = useParams<{ outputId: string }>();
  const searchParams = useSearchParams();
  const active = useActiveOrganization();
  const requested = searchParams.get("organizationId");
  const organizationId = requested && bootstrap.memberships.some((item) => item.organization_id === requested)
    ? requested
    : active.organizationId;
  const store =
    bootstrap.memberships.find((item) => item.organization_id === organizationId)?.organization?.display_name ?? "La tienda";
  const query = useCachedQuery<OutputDetail>(
    organizationId ? `/v1/organizations/${organizationId}/ai/outputs/${encodeURIComponent(params.outputId)}` : null,
  );
  const data = query.data;

  if (query.error && !data) {
    return (
      <div className="portal-page">
        <Card>
          <CardHeader>
            <CardTitle>No se pudo abrir la propuesta</CardTitle>
          </CardHeader>
          <CardContent>
            <ErrorBlock>{query.error}</ErrorBlock>
          </CardContent>
        </Card>
      </div>
    );
  }
  if (!data) return <div className="portal-page"><LoadingBlock label="Cargando la propuesta…" /></div>;

  const tasksHref = `/tareas?organizationId=${organizationId}`;

  return (
    <div className="portal-page space-y-5">
      <WorkPageHeader title="Propuesta de la IA">
        {agentLabel(data.agent.name)} · {store} · {when(data.created_at)}
      </WorkPageHeader>

      <Card>
        <CardHeader>
          <CardTitle>{verdict(data, store)}</CardTitle>
          <CardAction><ButtonLink href={tasksHref} size="sm" variant="secondary">Ir a Tareas</ButtonLink></CardAction>
        </CardHeader>
        <CardContent>
          {data.decision?.receipt_id ? (
            <p className="mb-3 text-sm text-muted">
              Decisión registrada · {data.decision.source_verified ? "Contenido y ámbito vinculados al recibo." : "Registro histórico sin verificación del contenido original."}
              <span className="mt-1 block break-all text-xs">Referencia: {data.decision.receipt_id}</span>
            </p>
          ) : null}
          {data.decision && (data.decision.reason || data.decision.reason_category) ? (
            <dl className="grid gap-4 sm:grid-cols-[12rem_1fr]">
              {data.decision.reason_category ? (
                <DetailItem label="Tipo de motivo">{REASON_CATEGORY[data.decision.reason_category] ?? data.decision.reason_category}</DetailItem>
              ) : null}
              {data.decision.reason ? <DetailItem label="Lo que dijo">«{data.decision.reason}»</DetailItem> : null}
            </dl>
          ) : data.decision ? (
            <p className="text-sm text-muted">No dejó motivo.</p>
          ) : null}
        </CardContent>
      </Card>

      {data.summary || data.agent.description ? (
        <Card>
          <CardHeader>
            <CardTitle>Qué vio la IA</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-line text-sm text-foreground">{data.summary ?? data.agent.description}</p>
          </CardContent>
        </Card>
      ) : null}

      <section className="space-y-3" aria-label="Tareas propuestas">
        <h2 className="text-sm font-semibold text-foreground">
          {data.proposals.length === 1 ? "La tarea que proponía" : `Las ${data.proposals.length} tareas que proponía`}
        </h2>
        {data.proposals.map((proposal) => (
          <Card key={proposal.index}>
            <CardHeader>
              <CardKicker><Badge tone={STATUS[proposal.status].tone}>{proposal.status === "created" && proposal.kind === "note" ? "Aprobada · nota guardada" : STATUS[proposal.status].label}</Badge></CardKicker>
              <CardTitle>{proposal.title}</CardTitle>
              <CardAction>{proposal.task ? (
                <ButtonLink href={`/tareas?organizationId=${organizationId}&task=${proposal.task.id}`} size="sm" variant="ghost">
                  Ver la tarea{proposal.task.status ? ` (${TASK_STATUS[proposal.task.status] ?? proposal.task.status})` : ""}
                </ButtonLink>
              ) : undefined}</CardAction>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4">
                {proposal.original_title && proposal.original_title !== proposal.title ? (
                  <DetailItem label="Título original de la IA">{proposal.original_title}</DetailItem>
                ) : null}
                {proposal.description ? <DetailItem label="Qué proponía">{proposal.description}</DetailItem> : null}
                {proposal.rationale ? <DetailItem label="Por qué">{proposal.rationale}</DetailItem> : null}
                {proposal.evidence.length ? (
                  <DetailItem label="Los datos en que se apoya">
                    <EvidenceChips
                      evidence={proposal.evidence.map((item) => ({ ...item, source: item.source ?? "interno" }))}
                    />
                  </DetailItem>
                ) : null}
                <div className="grid gap-4 sm:grid-cols-3">
                  {proposal.expected_metric ? <DetailItem label="Qué debería mejorar">{proposal.expected_metric}</DetailItem> : null}
                  {proposal.completion_criteria ? <DetailItem label="Cuándo está hecha">{proposal.completion_criteria}</DetailItem> : null}
                  {proposal.due_hint ? <DetailItem label="Plazo">{proposal.due_hint}</DetailItem> : null}
                  {proposal.priority ? <DetailItem label="Prioridad">{PRIORITY[proposal.priority] ?? proposal.priority}</DetailItem> : null}
                  {proposal.owner_role ? <DetailItem label="La haría">{proposal.owner_role === "cliente" ? "El cliente" : "El consultor"}</DetailItem> : null}
                </div>
              </dl>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}

export default function ProposalPage() {
  return (
    <PortalShell title="Propuesta de la IA">
      {(bootstrap) => <ProposalDetail bootstrap={bootstrap} />}
    </PortalShell>
  );
}
