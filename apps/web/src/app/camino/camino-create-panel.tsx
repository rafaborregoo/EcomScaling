"use client";

import { useCallback, useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { A01_CAMINO_BRIEF_KEY, parseA01BriefHandoff } from "@/lib/a01-call-handoff";
import { EvidenceChips } from "@/components/ai-proposed-tasks";
import { AiEvidence, Button, ButtonLink, ErrorBlock, Input, LoadingBlock, Select, Textarea, toast } from "@/components/ui";
import { CaminoDraftMap, CaminoDrawing, type DraftPhase } from "./camino-map";
import s from "./camino-create-panel.module.css";

/**
 * Crear un camino (cliente o consultor para su cliente). Tres formas de
 * empezar y las tres acaban igual: el mapa que verá el cliente, dibujado en
 * directo mientras se crea. El camino nace en borrador; activarlo es otro gesto.
 */

export type CaminoCreateMode = "ia" | "import" | "manual";

type CatalogEntry = { key: string; label: string; unit: "money" | "pct" | "count" | "ratio" | "number" };

export const CAMINO_CURRENCIES = ["EUR", "USD", "GBP", "MXN", "COP", "ARS", "CLP", "PEN", "CHF"] as const;

const MODES: Array<{ key: CaminoCreateMode; icon: string; label: string; hint: string }> = [
  { key: "ia", icon: "✦", label: "Que lo trace la IA", hint: "Lee los datos de la tienda y propone fases e hitos con fecha." },
  { key: "manual", icon: "✎", label: "Dibujarlo a mano", hint: "Fase a fase; cada hito con su fecha y su meta." },
  { key: "import", icon: "⇪", label: "Desde una plantilla", hint: "Sube un .md y revísalo como mapa antes de crearlo." },
];

function formatAmount(value: number, unit: string, currency: string) {
  if (unit === "money") {
    try {
      return new Intl.NumberFormat("es-ES", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
    } catch {
      return `${value} ${currency}`;
    }
  }
  if (unit === "pct") return `${value} %`;
  if (unit === "ratio") return `${value}×`;
  return new Intl.NumberFormat("es-ES").format(value);
}

function isoInDays(days: number) {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

export function CaminoCreatePanel({
  variant,
  title,
  organizationId,
  connectionId,
  defaultCurrency,
  catalog,
  onCreated,
}: {
  variant: "client" | "consultant";
  title: string;
  organizationId: string;
  connectionId?: string | null;
  defaultCurrency: string;
  catalog: CatalogEntry[];
  onCreated: () => void;
}) {
  const [mode, setMode] = useState<CaminoCreateMode>(variant === "consultant" ? "manual" : "ia");
  const [currency, setCurrency] = useState(
    (CAMINO_CURRENCIES as readonly string[]).includes(defaultCurrency) ? defaultCurrency : "EUR",
  );

  return (
    <section className={`${s.root} ${variant === "consultant" ? s.consultant : ""}`} aria-labelledby="camino-create-title">
      <div className={s.head}>
        <div className={s.headText}>
          <span className={s.eyebrow}>{variant === "consultant" ? "Mi Camino · para tu cliente" : "Mi Camino"}</span>
          <h2 id="camino-create-title" className={s.title}>
            {title}
          </h2>
        </div>
        <label className={s.currency}>
          <span>Moneda del camino</span>
          <select value={currency} onChange={(event) => setCurrency(event.target.value)} aria-label="Moneda del camino">
            {CAMINO_CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </label>
        <div className={s.modes} role="group" aria-label="Cómo crear el camino">
          {MODES.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`${s.mode} ${mode === item.key ? s.modeActive : ""}`}
              aria-pressed={mode === item.key}
              onClick={() => setMode(item.key)}
            >
              <span className={s.modeIcon} aria-hidden="true">
                {item.icon}
              </span>
              <span className={s.modeLabel}>{item.label}</span>
              <span className={s.modeHint}>{item.hint}</span>
            </button>
          ))}
        </div>
      </div>
      <div className={s.body}>
        {mode === "ia" ? (
          <IaCreator organizationId={organizationId} connectionId={connectionId} currency={currency} onCreated={onCreated} variant={variant} />
        ) : mode === "import" ? (
          <ImportCreator organizationId={organizationId} connectionId={connectionId} currency={currency} onCreated={onCreated} variant={variant} />
        ) : (
          <ManualCreator organizationId={organizationId} connectionId={connectionId} currency={currency} catalog={catalog} onCreated={onCreated} variant={variant} />
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// IA (agente A19)
// ---------------------------------------------------------------------------

type ProposalContent = {
  plan_name: string;
  horizon_months?: number;
  diagnosis: string;
  goal?: {
    metric_label: string;
    unit: "money" | "pct" | "count" | "ratio";
    currency_code: string | null;
    baseline: number | null;
    target: number | null;
    target_offset_days: number;
    rationale: string;
    assumptions: string[];
  };
  phases: Array<{
    name: string;
    description: string;
    rationale: string;
    evidence: Array<{ label: string; value: string; period: string | null; source: string }>;
    milestones: Array<{ name: string; description: string; target_offset_days: number; success_metric: string }>;
  }>;
  sources: Array<{ kind: string; reference: string; period: string | null }>;
  confidence: "low" | "medium" | "high";
  warnings: string[];
};

type Proposal = { output_id: string; status: string; horizon_months: number | null; content: ProposalContent | null };

const CONFIDENCE = { low: "Confianza baja", medium: "Confianza media", high: "Confianza alta" };

function IaCreator({ organizationId, connectionId, currency, onCreated, variant }: {
  variant: "client" | "consultant";
  organizationId: string;
  connectionId?: string | null;
  currency: string;
  onCreated: () => void;
}) {
  const searchParams = useSearchParams();
  const fromCall = searchParams.get("fromCall") === "1";
  const [horizon, setHorizon] = useState(3);
  const [brief, setBrief] = useState("");
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [goalTarget, setGoalTarget] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handoffDone = useRef(false);

  useEffect(() => {
    if (!fromCall || handoffDone.current) return;
    handoffDone.current = true;
    const staged = parseA01BriefHandoff(window.sessionStorage.getItem(A01_CAMINO_BRIEF_KEY), organizationId);
    window.sessionStorage.removeItem(A01_CAMINO_BRIEF_KEY);
    if (staged) setBrief(staged);
  }, [fromCall, organizationId]);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const query = new URLSearchParams({ horizonMonths: String(horizon) });
      if (connectionId) query.set("connectionId", connectionId);
      const response = await apiFetch(`/v1/organizations/${organizationId}/ai/camino-proposal?${query.toString()}`);
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      const payload = (await response.json()) as { proposal: Proposal | null };
      setProposal(payload.proposal);
      const target = payload.proposal?.content?.goal?.target;
      setGoalTarget(target == null ? "" : String(target));
      setError(null);
    } catch {
      setError("No se pudo cargar la propuesta de camino. Reintenta.");
    } finally {
      setIsLoading(false);
    }
  }, [organizationId, connectionId, horizon]);

  useEffect(() => {
    void load();
  }, [load]);

  async function generate() {
    setIsGenerating(true);
    setError(null);
    try {
      const query = connectionId ? `?connectionId=${encodeURIComponent(connectionId)}` : "";
      const response = await apiFetch(`/v1/organizations/${organizationId}/ai/camino-proposal/run${query}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ horizon_months: horizon, ...(brief.trim() ? { brief: brief.trim().slice(0, 2000) } : {}) }),
      });
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      await load();
    } catch {
      setError("No se pudo generar el camino. Reintenta.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function accept() {
    if (!proposal) return;
    setIsCreating(true);
    setError(null);
    try {
      const response = await apiFetch(`/v1/organizations/${organizationId}/strategic-plan/from-proposal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          output_id: proposal.output_id,
          horizon_months: horizon,
          currency_code: currency,
          ...(proposal.content?.goal ? { goal_target: goalTarget.trim() ? Number(goalTarget) : null } : {}),
        }),
      });
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      toast.success("Camino creado como borrador. Revísalo y actívalo.");
      onCreated();
    } catch {
      setError("No se pudo crear el camino. Reintenta.");
    } finally {
      setIsCreating(false);
    }
  }

  const content = proposal?.content ?? null;
  const baseHorizon = Math.max(1, content?.horizon_months ?? proposal?.horizon_months ?? horizon);
  // Misma escala que aplica el backend al aceptar con otro plazo.
  const scaled = (days: number) => Math.min(horizon * 30, Math.round((days * horizon) / baseHorizon));
  const draft: DraftPhase[] = (content?.phases ?? []).map((phase) => ({
    name: phase.name,
    milestones: phase.milestones.map((milestone) => ({
      name: milestone.name,
      date: isoInDays(scaled(milestone.target_offset_days)),
      detail: milestone.description,
      criterion: milestone.success_metric,
    })),
  }));
  const goal = content?.goal;
  const goalNumber = goalTarget.trim() ? Number(goalTarget) : null;
  const finalLabel = goal && goalNumber !== null && Number.isFinite(goalNumber) ? formatAmount(goalNumber, goal.unit, currency) : null;
  const dataCurrencyDiffers = goal?.unit === "money" && goal.currency_code && goal.currency_code !== currency;

  return (
    <div className={s.flow}>
      {error ? <ErrorBlock>{error}</ErrorBlock> : null}

      <div className={s.controls}>
        <div className={s.control}>
          <span className={s.controlLabel}>
            Horizonte · <b>{horizon === 1 ? "1 mes" : `${horizon} meses`}</b>
          </span>
          <input
            type="range"
            min={1}
            max={12}
            value={horizon}
            className={s.range}
            aria-label="Horizonte del camino en meses"
            disabled={isGenerating || isCreating}
            onChange={(event) => setHorizon(Number(event.target.value))}
          />
          <span className={s.rangeScale}>
            <span>1 mes</span>
            <span>6</span>
            <span>12 meses</span>
          </span>
        </div>
        <div className={s.control}>
          <span className={s.controlLabel}>Algo que la IA deba tener en cuenta (opcional)</span>
          <Textarea
            value={brief}
            maxLength={2000}
            rows={2}
            onChange={(event) => setBrief(event.target.value)}
            placeholder="p. ej. «en noviembre lanzamos la colección de invierno» o lo acordado en la última llamada"
          />
        </div>
        <Button type="button" variant={content ? "secondary" : "primary"} disabled={isGenerating || isCreating} onClick={() => void generate()}>
          {content ? "Trazar otro camino" : "Trazar mi camino"}
        </Button>
      </div>

      {isLoading ? (
        <LoadingBlock label="Buscando la última propuesta..." />
      ) : isGenerating ? (
        <CaminoDrawing variant={variant} />
      ) : !content ? (
        null
      ) : (
        <>
          <div className={s.proposalHead}>
            <div>
              <span className={s.aiTag}>IA</span>
              <h3 className={s.proposalName}>{content.plan_name}</h3>
            </div>
            <span className={`${s.pill} ${content.confidence === "high" ? s.pillGood : content.confidence === "low" ? s.pillWarn : ""}`}>
              {CONFIDENCE[content.confidence]}
            </span>
          </div>
          <p className={s.diagnosis}>{content.diagnosis}</p>

          {goal ? (
            <div className={s.goal}>
              <div>
                <span className={s.controlLabel}>Meta del camino · {goal.metric_label}</span>
                <p className={s.goalLine}>
                  {goal.baseline !== null ? formatAmount(goal.baseline, goal.unit, currency) : "sin punto de partida"} <span aria-hidden="true">→</span>{" "}
                  <b>{finalLabel ?? "por definir"}</b>
                </p>
                <p className={s.goalWhy}>{goal.rationale}</p>
              </div>
              <label className={s.goalInput}>
                <span>Ajustar la meta</span>
                <Input type="number" step="any" value={goalTarget} onChange={(event) => setGoalTarget(event.target.value)} placeholder="Sin cifra" disabled={isCreating} />
              </label>
            </div>
          ) : null}
          {dataCurrencyDiffers ? (
            <p className={s.hintLine}>
              La tienda informa sus cifras en {goal?.currency_code}. Elegir {currency} cambia cómo se muestran, no convierte los importes.
            </p>
          ) : null}

          <CaminoDraftMap phases={draft} finalLabel={finalLabel} variant={variant} />

          <ol className={s.phaseCards}>
            {content.phases.map((phase, index) => (
              <li key={`${phase.name}-${index}`} className={s.phaseCard}>
                <span className={s.phaseNo}>Fase {index + 1}</span>
                <b>{phase.name}</b>
                {phase.rationale ? <p>{phase.rationale}</p> : null}
                <EvidenceChips evidence={phase.evidence} />
              </li>
            ))}
          </ol>

          <AiEvidence sources={content.sources} warnings={content.warnings} />

          {proposal?.status === "published" ? (
            <p className={s.hintLine}>Esta propuesta ya se convirtió en un camino. Traza otra si quieres empezar de nuevo.</p>
          ) : (
            <div className={s.actions}>
              <Button type="button" disabled={isCreating} onClick={() => void accept()}>
                {isCreating ? "Creando..." : "Crear este camino"}
              </Button>
              <span className={s.hintLine}>Nace en borrador: podrás tocar fases e hitos antes de activarlo.</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Plantilla .md
// ---------------------------------------------------------------------------

type ImportPreview = {
  ok: boolean;
  data?: {
    name: string;
    phases: Array<{ name: string; milestones: Array<{ name: string; targetDate?: string | null; description?: string | null; tasks: Array<{ title: string }> }> }>;
  };
  errors: Array<{ line: number; message: string }>;
  warnings: Array<{ line: number; message: string }>;
  counts: { phases: number; milestones: number; tasks: number };
  fileName?: string | null;
};

function ImportCreator({ organizationId, connectionId, currency, onCreated, variant }: {
  variant: "client" | "consultant";
  organizationId: string;
  connectionId?: string | null;
  currency: string;
  onCreated: () => void;
}) {
  const [markdown, setMarkdown] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);

  async function readFile(file: File) {
    setError(null);
    if (!file.name.toLowerCase().endsWith(".md")) {
      setError("Selecciona un archivo .md con la plantilla de Mi Camino.");
      return;
    }
    try {
      const text = await file.text();
      const response = await apiFetch(`/v1/organizations/${organizationId}/strategic-plan/import/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markdown: text, fileName: file.name }),
      });
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      setMarkdown(text);
      setPreview((await response.json()) as ImportPreview);
    } catch {
      setError("No se pudo leer el archivo. Comprueba que sea un Markdown válido.");
    }
  }

  async function create() {
    if (!preview?.ok) return;
    setSaving(true);
    setError(null);
    try {
      const response = await apiFetch(`/v1/organizations/${organizationId}/strategic-plan/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markdown, fileName: preview.fileName, connectionId: connectionId || null, currencyCode: currency }),
      });
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      toast.success("Camino importado como borrador.");
      onCreated();
    } catch {
      setError("No se pudo importar el camino. Reintenta.");
    } finally {
      setSaving(false);
    }
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) void readFile(file);
  }

  const draft: DraftPhase[] = (preview?.data?.phases ?? []).map((phase) => ({
    name: phase.name,
    milestones: phase.milestones.map((milestone) => ({
      name: milestone.name,
      date: milestone.targetDate ?? null,
      detail: milestone.description ?? (milestone.tasks.length ? `${milestone.tasks.length} tareas: ${milestone.tasks.map((task) => task.title).join(" · ")}` : null),
    })),
  }));

  return (
    <div className={s.flow}>
      {error ? <ErrorBlock>{error}</ErrorBlock> : null}
      <label
        className={`${s.drop} ${dragging ? s.dropOver : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <input
          type="file"
          accept=".md,text/markdown,text/plain"
          className={s.srOnly}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void readFile(file);
            event.target.value = "";
          }}
        />
        <span className={s.dropIcon} aria-hidden="true">
          ⇪
        </span>
        <b>{preview?.fileName ?? "Arrastra aquí tu plantilla .md"}</b>
        <span>{preview ? "Suelta otro archivo para cambiarla" : "o pulsa para elegirla"}</span>
      </label>
      <p className={s.hintLine}>
        ¿No tienes plantilla?{" "}
        <ButtonLink href="/plantilla-mi-camino.md" download="plantilla-mi-camino.md" variant="ghost" size="sm">
          Descargar la plantilla
        </ButtonLink>
      </p>

      {preview && !preview.ok ? (
        <ErrorBlock>
          <ul className={s.issues}>
            {preview.errors.map((issue) => (
              <li key={`${issue.line}-${issue.message}`}>
                Línea {issue.line}: {issue.message}
              </li>
            ))}
          </ul>
        </ErrorBlock>
      ) : null}

      {preview?.ok && preview.data ? (
        <>
          <div className={s.proposalHead}>
            <h3 className={s.proposalName}>{preview.data.name}</h3>
            <span className={s.pill}>
              {preview.counts.phases} fases · {preview.counts.milestones} hitos · {preview.counts.tasks} tareas
            </span>
          </div>
          <CaminoDraftMap phases={draft} variant={variant} />
          {preview.warnings.length ? (
            <ul className={s.warnings}>
              {preview.warnings.map((warning) => (
                <li key={`${warning.line}-${warning.message}`}>{warning.message}</li>
              ))}
            </ul>
          ) : null}
          <div className={s.actions}>
            <Button type="button" disabled={saving} onClick={() => void create()}>
              {saving ? "Creando..." : "Crear este camino"}
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// A mano: el mapa se dibuja mientras escribes
// ---------------------------------------------------------------------------

type ManualMilestone = { name: string; date: string; metricKey: string; target: string };
type ManualPhase = { name: string; milestones: ManualMilestone[] };

const emptyMilestone = (): ManualMilestone => ({ name: "", date: "", metricKey: "", target: "" });

function ManualCreator({ organizationId, connectionId, currency, catalog, onCreated, variant }: {
  variant: "client" | "consultant";
  organizationId: string;
  connectionId?: string | null;
  currency: string;
  catalog: CatalogEntry[];
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [phases, setPhases] = useState<ManualPhase[]>([{ name: "", milestones: [emptyMilestone()] }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updatePhase = (pi: number, patch: Partial<ManualPhase>) =>
    setPhases((current) => current.map((phase, i) => (i === pi ? { ...phase, ...patch } : phase)));
  const updateMilestone = (pi: number, mi: number, patch: Partial<ManualMilestone>) =>
    setPhases((current) =>
      current.map((phase, i) =>
        i === pi ? { ...phase, milestones: phase.milestones.map((m, j) => (j === mi ? { ...m, ...patch } : m)) } : phase,
      ),
    );

  const unitOf = (key: string) => catalog.find((entry) => entry.key === key)?.unit;
  const unitHint = (key: string) => {
    const unit = unitOf(key);
    return unit === "money" ? currency : unit === "pct" ? "%" : unit === "ratio" ? "×" : "";
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const response = await apiFetch(`/v1/organizations/${organizationId}/strategic-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          connectionId: connectionId || null,
          currencyCode: currency,
          phases: phases
            .filter((phase) => phase.name.trim())
            .map((phase) => ({
              name: phase.name.trim(),
              milestones: phase.milestones
                .filter((milestone) => milestone.name.trim())
                .map((milestone) => ({
                  name: milestone.name.trim(),
                  targetDate: milestone.date || null,
                  objective:
                    milestone.metricKey && milestone.target.trim() && Number.isFinite(Number(milestone.target))
                      ? { metricKey: milestone.metricKey, targetValue: Number(milestone.target) }
                      : null,
                })),
            })),
        }),
      });
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      toast.success("Camino creado como borrador.");
      onCreated();
    } catch {
      setError("No se pudo crear el camino. Reintenta.");
    } finally {
      setSaving(false);
    }
  }

  const draft: DraftPhase[] = phases.map((phase) => ({
    name: phase.name,
    milestones: phase.milestones.map((milestone) => {
      const entry = catalog.find((item) => item.key === milestone.metricKey);
      const target = Number(milestone.target);
      return {
        name: milestone.name,
        date: milestone.date || null,
        criterion: entry && milestone.target.trim() && Number.isFinite(target) ? `${entry.label}: ${formatAmount(target, entry.unit, currency)}` : null,
      };
    }),
  }));

  return (
    <form className={s.flow} onSubmit={submit}>
      {error ? <ErrorBlock>{error}</ErrorBlock> : null}
      <label className={s.nameField}>
        <span className={s.controlLabel}>Nombre del camino</span>
        <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="p. ej. Escalar a 50.000 € al mes" required />
      </label>

      <div className={s.builder}>
        <ol className={s.builderPhases}>
          {phases.map((phase, pi) => (
            <li key={pi} className={s.builderPhase}>
              <div className={s.builderPhaseHead}>
                <span className={s.phaseNo}>Fase {pi + 1}</span>
                <Input
                  aria-label={`Nombre de la fase ${pi + 1}`}
                  value={phase.name}
                  onChange={(event) => updatePhase(pi, { name: event.target.value })}
                  placeholder={pi === 0 ? "p. ej. Medir bien" : "Nombre de la fase"}
                />
                {phases.length > 1 ? (
                  <button type="button" className={s.remove} aria-label={`Quitar la fase ${pi + 1}`} onClick={() => setPhases((current) => current.filter((_, i) => i !== pi))}>
                    ×
                  </button>
                ) : null}
              </div>
              <ul className={s.builderMilestones}>
                {phase.milestones.map((milestone, mi) => (
                  <li key={mi} className={s.builderMilestone}>
                    <span className={s.stopDot} aria-hidden="true">
                      {pi + 1}.{mi + 1}
                    </span>
                    <div className={s.builderFields}>
                      <Input
                        aria-label={`Hito ${pi + 1}.${mi + 1}`}
                        value={milestone.name}
                        onChange={(event) => updateMilestone(pi, mi, { name: event.target.value })}
                        placeholder="Qué se consigue en este hito"
                      />
                      <div className={s.builderRow}>
                        <Input
                          type="date"
                          aria-label={`Fecha del hito ${pi + 1}.${mi + 1}`}
                          value={milestone.date}
                          onChange={(event) => updateMilestone(pi, mi, { date: event.target.value })}
                        />
                        <Select
                          aria-label={`Métrica del hito ${pi + 1}.${mi + 1}`}
                          value={milestone.metricKey}
                          onChange={(value) => updateMilestone(pi, mi, { metricKey: value })}
                          options={[{ value: "", label: "Sin métrica" }, ...catalog.map((entry) => ({ value: entry.key, label: entry.label }))]}
                        />
                        {milestone.metricKey ? (
                          <span className={s.targetField}>
                            <Input
                              type="number"
                              step="any"
                              min="0"
                              aria-label={`Meta del hito ${pi + 1}.${mi + 1}`}
                              value={milestone.target}
                              onChange={(event) => updateMilestone(pi, mi, { target: event.target.value })}
                              placeholder="Meta"
                            />
                            {unitHint(milestone.metricKey) ? <small>{unitHint(milestone.metricKey)}</small> : null}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    {phase.milestones.length > 1 ? (
                      <button
                        type="button"
                        className={s.remove}
                        aria-label={`Quitar el hito ${pi + 1}.${mi + 1}`}
                        onClick={() => updatePhase(pi, { milestones: phase.milestones.filter((_, j) => j !== mi) })}
                      >
                        ×
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
              <button type="button" className={s.addLink} onClick={() => updatePhase(pi, { milestones: [...phase.milestones, emptyMilestone()] })}>
                + Hito
              </button>
            </li>
          ))}
        </ol>
        <button type="button" className={s.addPhase} onClick={() => setPhases((current) => [...current, { name: "", milestones: [emptyMilestone()] }])}>
          + Añadir fase
        </button>
      </div>

      <CaminoDraftMap phases={draft} variant={variant} />

      <div className={s.actions}>
        <Button type="submit" disabled={saving || !name.trim()}>
          {saving ? "Creando..." : "Crear el camino"}
        </Button>
        <span className={s.hintLine}>Las tareas se añaden después, dentro de cada hito.</span>
      </div>
    </form>
  );
}
