"use client";

import { useCallback, useEffect, useState } from "react";
import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
import { apiFetch, type BootstrapResponse } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import {
  AsyncState,
  LoadingBlock,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBlock,
  Field,
  Heading,
  Input,
  Select,
  Textarea,
  toast,
  type Tone,
} from "@/components/ui";

type MarketingDraft = {
  id: string;
  status: "draft" | "pending_approval" | "approved" | "rejected";
  content_type: "campaign" | "flow_step" | "popup";
  summary: string;
  template_name: string;
  subject: string;
  preheader: string;
  from_name: string;
  reply_to: string | null;
  purpose: string;
  audience: string;
  locale: string;
  tone: string;
  plain_text: string;
  html: string;
  blocks: unknown[];
  personalization_tokens: string[];
  compliance_notes: string[];
  sources: unknown[];
  confidence: "low" | "medium" | "high";
  warnings: string[];
  version: number;
  created_at: string;
  updated_at: string;
  decision_reason: string | null;
};

type MarketingDraftEdit = {
  subject: string;
  preheader: string;
  from_name: string;
  reply_to: string;
  plain_text: string;
  html: string;
};

type MarketingDraftVersion = {
  id: string;
  version: number;
  change_type: "generated" | "manual";
  edited_by: string | null;
  snapshot: { subject?: string; preheader?: string };
  created_at: string;
};

const statusLabel: Record<MarketingDraft["status"], string> = {
  draft: "Borrador",
  pending_approval: "Pendiente de aprobación",
  approved: "Listo para copiar",
  rejected: "Rechazado",
};

const statusTone: Record<MarketingDraft["status"], Tone> = {
  draft: "neutral",
  pending_approval: "warn",
  approved: "success",
  rejected: "danger",
};

const contentTypeOptions = [
  { value: "campaign", label: "Campaña / broadcast" },
  { value: "flow_step", label: "Email de flow" },
  { value: "popup", label: "Popup / formulario" },
];

const confidenceLabels: Record<MarketingDraft["confidence"], string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
};

function MarketingContent({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const { organizationId } = useActiveOrganization();
  const canView = ["platform_admin", "consultant"].includes(
    bootstrap.profile.platform_role,
  );
  const [drafts, setDrafts] = useState<MarketingDraft[]>([]);
  const [contentType, setContentType] = useState("campaign");
  const [brief, setBrief] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [busyDraftId, setBusyDraftId] = useState<string | null>(null);
  const [decisionDraft, setDecisionDraft] = useState<{
    id: string;
    decision: "approved" | "rejected";
  } | null>(null);
  const [decisionReason, setDecisionReason] = useState("");
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<MarketingDraftEdit | null>(null);
  const [historyDraftId, setHistoryDraftId] = useState<string | null>(null);
  const [versionHistory, setVersionHistory] = useState<MarketingDraftVersion[]>(
    [],
  );
  const [error, setError] = useState<string | null>(null);

  const loadDrafts = useCallback(async () => {
    if (!organizationId || !canView) {
      setDrafts([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/marketing/drafts`,
      );
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      const payload = (await response.json()) as {
        drafts?: MarketingDraft[];
      };
      setDrafts(payload.drafts ?? []);
    } catch {
      setError(
        "No se pudieron cargar los borradores por un error de red. Reintenta.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [canView, organizationId]);

  useEffect(() => {
    void loadDrafts();
  }, [loadDrafts]);

  async function generateDraft(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organizationId || !brief.trim()) return;
    setIsGenerating(true);
    setError(null);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/marketing/drafts`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content_type: contentType,
            brief: brief.trim(),
          }),
        },
      );
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      setBrief("");
      toast.success("Borrador generado y pendiente de revisión");
      await loadDrafts();
    } catch {
      setError(
        "No se pudo generar el borrador por un error de red. Reintenta.",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  async function decideDraft(
    draftId: string,
    decision: "approved" | "rejected",
    reason: string,
  ) {
    if (!organizationId) return;
    setBusyDraftId(draftId);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/marketing/drafts/${draftId}/decision`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            decision,
            reason: reason.trim() || undefined,
          }),
        },
      );
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      toast.success(
        decision === "approved"
          ? "Borrador aprobado para copiar"
          : "Borrador rechazado",
      );
      setDecisionDraft(null);
      setDecisionReason("");
      await loadDrafts();
    } catch {
      setError(
        "No se pudo guardar la decisión del borrador por un error de red. Reintenta.",
      );
    } finally {
      setBusyDraftId(null);
    }
  }

  function openDecision(draftId: string, decision: "approved" | "rejected") {
    setDecisionDraft({ id: draftId, decision });
    setDecisionReason("");
  }

  function startEditing(draft: MarketingDraft) {
    setEditingDraftId(draft.id);
    setEditForm({
      subject: draft.subject,
      preheader: draft.preheader,
      from_name: draft.from_name,
      reply_to: draft.reply_to ?? "",
      plain_text: draft.plain_text,
      html: draft.html,
    });
    setError(null);
  }

  function cancelEditing() {
    setEditingDraftId(null);
    setEditForm(null);
  }

  async function saveEditing(draftId: string) {
    if (!organizationId || !editForm) return;
    setBusyDraftId(draftId);
    setError(null);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/marketing/drafts/${draftId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...editForm,
            reply_to: editForm.reply_to.trim() || null,
          }),
        },
      );
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      toast.success("Cambios guardados; el borrador vuelve a revisión");
      cancelEditing();
      await loadDrafts();
    } catch {
      setError(
        "No se pudieron guardar los cambios por un error de red. Reintenta.",
      );
    } finally {
      setBusyDraftId(null);
    }
  }

  async function toggleVersionHistory(draftId: string) {
    if (historyDraftId === draftId) {
      setHistoryDraftId(null);
      return;
    }
    if (!organizationId) return;
    setHistoryDraftId(draftId);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/marketing/drafts/${draftId}/versions`,
      );
      if (!response.ok) {
        setError(await readApiError(response));
        setHistoryDraftId(null);
        return;
      }
      const payload = (await response.json()) as {
        versions?: MarketingDraftVersion[];
      };
      setVersionHistory(payload.versions ?? []);
    } catch {
      setHistoryDraftId(null);
      setError(
        "No se pudo cargar el historial del borrador por un error de red. Reintenta.",
      );
    }
  }

  async function copyHtml(html: string) {
    try {
      await navigator.clipboard.writeText(html);
      toast.success("HTML copiado al portapapeles");
    } catch {
      setError(
        "No se pudo copiar el HTML al portapapeles. Selecciónalo manualmente.",
      );
    }
  }

  if (!canView) {
    return (
      <EmptyState
        title="Sin acceso"
        hint="Los borradores de marketing son un espacio técnico para consultores."
      />
    );
  }

  return (
    <div className="portal-page space-y-8">
      <div>
        <Heading size="lg">Contenido para Klaviyo</Heading>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          Genera borradores portables con IA para revisarlos y copiarlos
          manualmente. Klaviyo no está conectado y este módulo nunca envía ni
          publica campañas.
        </p>
      </div>

      <Card
        kicker="AI-11 · Fase A"
        title="Crear borrador"
        description="El brief es la única fuente de contexto que debes aportar. Si falta un dato, el agente lo marcará como warning."
      >
        <form className="space-y-5" onSubmit={generateDraft}>
          <div className="grid gap-5 md:grid-cols-[240px_1fr]">
            <Field label="Tipo de contenido">
              <Select
                aria-label="Tipo de contenido"
                className="mt-2"
                value={contentType}
                onChange={setContentType}
                options={contentTypeOptions}
              />
            </Field>
            <Field label="Brief de campaña, audiencia y oferta">
              <Textarea
                aria-label="Brief de contenido"
                className="mt-2 min-h-32"
                placeholder="Ej.: Email de bienvenida para nuevos clientes de España. Presenta la marca, explica el beneficio principal y termina con un CTA hacia la colección de verano. No inventar descuentos."
                value={brief}
                onChange={(event) => setBrief(event.target.value)}
                maxLength={12000}
                required
              />
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={isGenerating || !brief.trim()}>
              {isGenerating ? "Generando…" : "Generar borrador"}
            </Button>
            <span className="text-xs text-muted">
              Siempre requiere revisión humana · sin envío automático
            </span>
          </div>
        </form>
      </Card>

      {error ? <ErrorBlock>{error}</ErrorBlock> : null}

      <Card>
        <Heading level={2} size="md">
          Borradores recientes
        </Heading>
        {isLoading ? (
          <LoadingBlock label="Cargando borradores…" />
        ) : drafts.length === 0 ? (
          <EmptyState
            title="Sin borradores"
            hint="Crea el primero para revisar el preview y el HTML sanitizado."
          />
        ) : (
          <div className="space-y-6">
            {drafts.map((draft) => (
              <Card
                key={draft.id}
                kicker={`${draft.content_type} · ${new Date(draft.created_at).toLocaleString("es-ES")}`}
                title={draft.subject}
                description={draft.summary}
                actions={
                  <Badge tone={statusTone[draft.status]}>
                    {statusLabel[draft.status]}
                  </Badge>
                }
              >
                <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-edge pb-3">
                      <span className="text-xs text-muted">
                        Versión {draft.version}
                      </span>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() =>
                          editingDraftId === draft.id
                            ? cancelEditing()
                            : startEditing(draft)
                        }
                        disabled={busyDraftId === draft.id}
                      >
                        {editingDraftId === draft.id
                          ? "Cancelar edición"
                          : "Editar draft"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => void toggleVersionHistory(draft.id)}
                      >
                        {historyDraftId === draft.id
                          ? "Ocultar historial"
                          : "Historial"}
                      </Button>
                    </div>
                    {historyDraftId === draft.id ? (
                      <div className="rounded-md border border-edge bg-surface p-4 text-sm">
                        <p className="font-medium">Versiones auditables</p>
                        <ol className="mt-2 space-y-2">
                          {versionHistory.map((version) => (
                            <li
                              key={version.id}
                              className="flex flex-wrap justify-between gap-2 border-b border-edge pb-2 last:border-0 last:pb-0"
                            >
                              <span>
                                v{version.version} ·{" "}
                                {version.change_type === "manual"
                                  ? "edición humana"
                                  : "generada por IA"}
                              </span>
                              <span className="text-muted">
                                {new Date(version.created_at).toLocaleString(
                                  "es-ES",
                                )}
                              </span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    ) : null}
                    {editingDraftId === draft.id && editForm ? (
                      <div className="space-y-4 rounded-md border border-warning/40 bg-warning/10 p-4">
                        <p className="text-sm font-medium">
                          Editar contenido · al guardar volverá a requerir
                          aprobación
                        </p>
                        <Field label="Asunto">
                          <Input
                            className="mt-2"
                            value={editForm.subject}
                            onChange={(event) =>
                              setEditForm({
                                ...editForm,
                                subject: event.target.value,
                              })
                            }
                            maxLength={255}
                          />
                        </Field>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <Field label="Preheader">
                            <Input
                              className="mt-2"
                              value={editForm.preheader}
                              onChange={(event) =>
                                setEditForm({
                                  ...editForm,
                                  preheader: event.target.value,
                                })
                              }
                              maxLength={255}
                            />
                          </Field>
                          <Field label="Remitente">
                            <Input
                              className="mt-2"
                              value={editForm.from_name}
                              onChange={(event) =>
                                setEditForm({
                                  ...editForm,
                                  from_name: event.target.value,
                                })
                              }
                              maxLength={160}
                            />
                          </Field>
                        </div>
                        <Field label="Reply-to (opcional)">
                          <Input
                            className="mt-2"
                            type="email"
                            value={editForm.reply_to}
                            onChange={(event) =>
                              setEditForm({
                                ...editForm,
                                reply_to: event.target.value,
                              })
                            }
                          />
                        </Field>
                        <Field label="Texto plano">
                          <Textarea
                            className="mt-2 min-h-32"
                            value={editForm.plain_text}
                            onChange={(event) =>
                              setEditForm({
                                ...editForm,
                                plain_text: event.target.value,
                              })
                            }
                            maxLength={100000}
                          />
                        </Field>
                        <Field label="HTML sanitizado">
                          <Textarea
                            className="mt-2 min-h-48 font-mono text-xs"
                            value={editForm.html}
                            onChange={(event) =>
                              setEditForm({
                                ...editForm,
                                html: event.target.value,
                              })
                            }
                            maxLength={200000}
                          />
                        </Field>
                        <Button
                          type="button"
                          onClick={() => void saveEditing(draft.id)}
                          disabled={busyDraftId === draft.id}
                        >
                          {busyDraftId === draft.id
                            ? "Guardando…"
                            : "Guardar nueva versión"}
                        </Button>
                      </div>
                    ) : null}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">
                          Preheader
                        </p>
                        <p className="text-sm">{draft.preheader || "—"}</p>
                      </div>
                      <div>
                        <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">
                          Audiencia
                        </p>
                        <p className="text-sm">{draft.audience}</p>
                      </div>
                      <div>
                        <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">
                          Tono
                        </p>
                        <p className="text-sm">{draft.tone}</p>
                      </div>
                      <div>
                        <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">
                          Confianza de la generación
                        </p>
                        <p className="text-sm">{confidenceLabels[draft.confidence]}</p>
                      </div>
                    </div>
                    {draft.warnings.length > 0 ? (
                      <div className="rounded-md border border-warning/40 bg-warning/10 p-4 text-sm">
                        <p className="font-medium">Avisos</p>
                        <ul className="mt-1 list-disc pl-5">
                          {draft.warnings.map((warning) => (
                            <li key={warning}>{warning}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    <div>
                      <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">
                        Texto plano
                      </p>
                      <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap border border-edge bg-surface p-3 text-sm">
                        {draft.plain_text}
                      </pre>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {draft.status === "pending_approval" ? (
                        <>
                          <Button
                            type="button"
                            onClick={() => openDecision(draft.id, "approved")}
                            disabled={busyDraftId === draft.id}
                          >
                            Aprobar para copiar
                          </Button>
                          <Button
                            variant="secondary"
                            type="button"
                            onClick={() => openDecision(draft.id, "rejected")}
                            disabled={busyDraftId === draft.id}
                          >
                            Rechazar
                          </Button>
                        </>
                      ) : null}
                      {decisionDraft?.id === draft.id ? (
                        <div className="basis-full space-y-3 rounded-md border border-edge bg-surface p-4">
                          <Field
                            label={
                              decisionDraft.decision === "approved"
                                ? "Nota de aprobación (opcional)"
                                : "Motivo del rechazo (opcional)"
                            }
                          >
                            <Textarea
                              aria-label="Razón de la decisión"
                              className="mt-2 min-h-20"
                              value={decisionReason}
                              onChange={(event) =>
                                setDecisionReason(event.target.value)
                              }
                              maxLength={2000}
                              placeholder="Deja contexto para el siguiente revisor…"
                            />
                          </Field>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              onClick={() =>
                                void decideDraft(
                                  draft.id,
                                  decisionDraft.decision,
                                  decisionReason,
                                )
                              }
                              disabled={busyDraftId === draft.id}
                            >
                              {busyDraftId === draft.id
                                ? "Guardando…"
                                : "Confirmar decisión"}
                            </Button>
                            <Button
                              variant="ghost"
                              type="button"
                              onClick={() => setDecisionDraft(null)}
                              disabled={busyDraftId === draft.id}
                            >
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      ) : null}
                      <Button
                        variant="ghost"
                        type="button"
                        onClick={() => void copyHtml(draft.html)}
                        disabled={draft.status !== "approved"}
                      >
                        Copiar HTML
                      </Button>
                    </div>
                  </div>
                  <div>
                    <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">
                      Preview seguro
                    </p>
                    <div className="mt-2 overflow-hidden border border-edge bg-white">
                      <iframe
                        title={`Preview de ${draft.subject}`}
                        srcDoc={draft.html}
                        sandbox=""
                        className="h-[480px] w-full"
                      />
                    </div>
                    <p className="mt-2 text-xs text-muted">
                      El preview está aislado y el botón de copiar solo se
                      habilita tras aprobación.
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

export default function MarketingPage() {
  return (
    <PortalShell title="Marketing IA">
      {(bootstrap) => <MarketingContent bootstrap={bootstrap} />}
    </PortalShell>
  );
}
