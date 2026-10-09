"use client";

import { useCallback, useEffect, useState } from "react";
import {
  MAILING_EMAIL_STATUS_LABELS,
  MAILING_GRAPH_MAX_AUTO_RETRIES,
  type MailingCampaignEmailView,
  type MailingCampaignView,
  type MailingEmailStatus,
} from "@e-nora/contracts";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import {
  Badge,
  Banner,
  Button,
  Card,
  ErrorBlock,
  LoadingBlock,
  Table,
  Textarea,
  toast,
  type TableColumnDef,
  type Tone,
} from "@/components/ui";

// ADR-0025: estado de cada email de una campaña orquestada por el grafo.
// Consultor primero: arriba lo que espera a alguien, en la tabla el motivo de
// cada rechazo. Aprobar un borrador se hace donde siempre (Contenido).

const STATUS_TONE: Record<MailingEmailStatus, Tone> = {
  queued: "neutral",
  drafting: "brand",
  reviewing: "brand",
  awaiting_approval: "warn",
  awaiting_consultant_review: "warn",
  approved: "success",
  scheduled: "success",
  rejected: "danger",
  failed: "danger",
};

const SOURCE_LABEL = {
  auto_review: "Revisión automática",
  human: "Aprobador",
  consultant_review: "Consultor",
} as const;

const WORKING: MailingEmailStatus[] = ["queued", "drafting", "reviewing"];

type Row = MailingCampaignEmailView & { id: string };

export function MailingCampaignPanel({
  organizationId,
  sequenceId,
  viewerIsStaff,
  onNotGraph,
}: {
  organizationId: string;
  sequenceId: string;
  viewerIsStaff: boolean;
  /** La secuencia la lleva el navegador: el planificador recupera su boton. */
  onNotGraph: () => void;
}) {
  const [view, setView] = useState<MailingCampaignView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    const response = await apiFetch(
      `/v1/organizations/${organizationId}/marketing/weekly-mailing-plan/${sequenceId}/campaign`,
    );
    if (!response.ok) throw new Error(await readApiError(response));
    setView((await response.json()) as MailingCampaignView);
    setError(null);
  }, [organizationId, sequenceId]);

  const notGraph = view?.orchestrator === "browser";
  useEffect(() => {
    if (notGraph) onNotGraph();
  }, [notGraph, onNotGraph]);

  const working = Boolean(view?.emails.some((email) => WORKING.includes(email.status)));
  useEffect(() => {
    let active = true;
    const tick = () => load().catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : "No se pudo cargar la campaña.");
    });
    void tick();
    // Mientras la IA redacta o revisa, se refresca solo; despues espera a una persona.
    const interval = working || !view ? window.setInterval(tick, 5_000) : null;
    return () => {
      active = false;
      if (interval) window.clearInterval(interval);
    };
  }, [load, working, view === null]); // eslint-disable-line react-hooks/exhaustive-deps

  async function post(path: string, body?: unknown, label = "Hecho") {
    setBusy(path);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/marketing/weekly-mailing-plan/${sequenceId}/${path}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body ?? {}),
        },
      );
      if (!response.ok) throw new Error(await readApiError(response));
      toast.success(label);
      await load();
    } catch (reason) {
      toast.danger(reason instanceof Error ? reason.message : "No se pudo completar la acción.");
    } finally {
      setBusy(null);
    }
  }

  if (notGraph) return null;
  if (!view) return error ? <ErrorBlock>{error}</ErrorBlock> : <LoadingBlock label="Cargando la campaña…" />;

  const waitingApproval = view.emails.filter((email) => email.status === "awaiting_approval");
  const waitingReview = view.emails.filter((email) => email.status === "awaiting_consultant_review");
  const autoFlagged = waitingApproval.filter((email) => email.auto_review_passed === false);
  const failedNow = view.emails.filter((email) => email.status === "failed");
  const failed = view.emails.filter((email) => email.status === "failed" || email.status === "rejected");
  const scheduled = view.emails.filter((email) => email.status === "scheduled");
  const rows: Row[] = view.emails.map((email) => ({ ...email, id: String(email.sequence_number) }));

  const columns: TableColumnDef<Row>[] = [
    {
      key: "email",
      label: "Email",
      render: (row) => (
        <span>
          {row.sequence_number}. {row.draft_subject || row.title}
        </span>
      ),
    },
    {
      key: "scheduled_for",
      label: "Envío previsto",
      render: (row) => new Date(row.scheduled_for).toLocaleDateString("es-ES", { day: "numeric", month: "short" }),
    },
    {
      key: "status",
      label: "Estado",
      render: (row) => (
        <Badge tone={STATUS_TONE[row.status]} variant="solid">
          {MAILING_EMAIL_STATUS_LABELS[row.status]}
        </Badge>
      ),
    },
    {
      key: "attempt",
      label: "Versión",
      render: (row) => `Versión ${row.attempt + 1}`,
    },
    {
      key: "auto_review",
      label: "Revisión automática",
      render: (row) =>
        row.auto_review_passed === null ? (
          <Badge>Pendiente</Badge>
        ) : row.auto_review_passed ? (
          <Badge tone="success">Sin avisos</Badge>
        ) : (
          <Badge tone="warn">Con avisos</Badge>
        ),
    },
    {
      key: "rejections",
      label: "Motivos de rechazo",
      render: (row) => {
        const latest = row.rejections.at(-1);
        if (row.last_error) return <span className="text-danger">{row.last_error}</span>;
        if (!latest) return "—";
        return (
          <span className="flex flex-col gap-1">
            <Badge tone="danger" title={`${row.rejections.length} rechazo(s) en total`}>
              {SOURCE_LABEL[latest.source]} · versión {latest.attempt + 1}
            </Badge>
            <span>{latest.reasons.join(" · ")}</span>
          </span>
        );
      },
    },
  ];

  return (
    <Card
      title={`Campaña en marcha · ${view.campaign_name}`}
      actions={
        <Button size="sm" variant="secondary" onClick={() => void load()}>
          Actualizar
        </Button>
      }
    >
      <div className="flex flex-wrap gap-2" aria-label="Resumen de la campaña">
        <Badge tone={waitingApproval.length ? "warn" : "neutral"}>{waitingApproval.length} esperan aprobación</Badge>
        {waitingReview.length ? <Badge tone="warn">{waitingReview.length} esperan al consultor</Badge> : null}
        {autoFlagged.length ? <Badge tone="warn">{autoFlagged.length} con avisos tras {MAILING_GRAPH_MAX_AUTO_RETRIES} reintentos</Badge> : null}
        <Badge tone="success">{scheduled.length} programados</Badge>
        {failed.length ? <Badge tone="danger">{failed.length} fallidos o rechazados</Badge> : null}
      </div>

      {waitingApproval.length ? (
        <p className="mt-3 text-sm">
          Los borradores se aprueban o rechazan en Contenido; al decidir, la campaña continúa sola. Un rechazo con
          motivo vuelve a la IA para una nueva versión.
        </p>
      ) : null}
      {failedNow.length ? (
        <div className="mt-3 grid gap-3">
          {failedNow.map((email) => (
            <Banner key={email.sequence_number} tone="danger">
              <span className="block">
                El email {email.sequence_number} “{email.draft_subject || email.title}” falló
                {email.last_error ? `: ${email.last_error}` : "."} La campaña no se cierra hasta que decidas.
              </span>
              <span className="mt-2 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={busy !== null}
                  onClick={() => void post(`emails/${email.sequence_number}/retry`, { decision: "retry" }, "Reintentando el email")}
                >
                  Reintentar
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy !== null}
                  onClick={() => void post(`emails/${email.sequence_number}/retry`, { decision: "discard" }, "Email descartado")}
                >
                  Descartar
                </Button>
              </span>
            </Banner>
          ))}
        </div>
      ) : null}
      {view.needs_resume ? (
        <div className="mt-3">
          <Banner tone="warn">
            Hay emails con la decisión tomada o detenidos a mitad.{" "}
            <Button size="sm" variant="secondary" disabled={busy !== null} onClick={() => void post("resume", {}, "Campaña reanudada")}>
              Reanudar
            </Button>
          </Banner>
        </div>
      ) : null}

      <div className="mt-4">
        <Table ariaLabel="Emails de la campaña" columns={columns} rows={rows} />
      </div>

      {viewerIsStaff && waitingReview.length ? (
        <div className="mt-4 grid gap-3">
          {waitingReview.map((email) => (
            <Card key={email.sequence_number} title={`Revisión del consultor · email ${email.sequence_number}`}>
              <p className="text-sm">El cliente aprobó “{email.draft_subject || email.title}”. Revísalo antes de que se programe.</p>
              <div className="mt-3">
                <Textarea
                  aria-label="Motivo si pides cambios"
                  value={reasons[email.sequence_number] ?? ""}
                  onChange={(event) => setReasons((current) => ({ ...current, [email.sequence_number]: event.target.value }))}
                  placeholder="Qué debe cambiar (obligatorio para pedir cambios)"
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={busy !== null}
                  onClick={() => void post(`emails/${email.sequence_number}/review`, { decision: "approved" }, "Email revisado")}
                >
                  Dar por revisado
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy !== null || !(reasons[email.sequence_number] ?? "").trim()}
                  onClick={() =>
                    void post(
                      `emails/${email.sequence_number}/review`,
                      { decision: "rejected", reason: reasons[email.sequence_number] },
                      "Cambios pedidos: la IA prepara otra versión",
                    )
                  }
                >
                  Pedir cambios
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : null}
      {error ? <div className="mt-3"><ErrorBlock>{error}</ErrorBlock></div> : null}
    </Card>
  );
}
