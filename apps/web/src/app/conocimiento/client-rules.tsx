"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { useCachedQuery } from "@/lib/use-cached-query";
import { ErrorBlock, LoadingBlock, toast } from "@/components/ui";
import { cx } from "../dashboard/client-pulse";
import pulse from "../dashboard/client-pulse.module.css";
import r from "./reglas.module.css";
import {
  addDays,
  CONTEXT_BUDGET_CHARS,
  daysUntil,
  isInUse,
  ruleState,
  ruleSuggestions,
  SOON_DAYS,
  SUGGESTION_QUESTION_IDS,
  type RuleState,
} from "./rule-state";
import {
  type AnsweredDoc,
  fetchDocumentContent,
  latestByTitle,
  questionDocumentTitle,
  STORE_QUESTIONS,
} from "./store-knowledge";

/**
 * Reglas del cliente: lo único que el copiloto tiene delante en CADA respuesta.
 *
 * La tabla (`client_constraints`) y su inyección existen desde AI-07
 * (`loadCriticalClientConstraints`). La distinción que sostiene toda la página:
 *   regla     -> siempre en contexto, no compite por el top-k.
 *   documento -> el copiloto lo usa si la conversación lo pide.
 */

export const RULE_CATEGORIES = [
  { value: "pricing", label: "Precios" },
  { value: "discounts", label: "Descuentos" },
  { value: "inventory", label: "Stock" },
  { value: "brand", label: "Marca" },
  { value: "campaigns", label: "Campañas" },
  { value: "operations", label: "Operativa" },
];

// Igual que el límite del backend: una regla entra en el prompt de cada turno.
const MAX_LENGTH = 400;
const RENEW_DAYS = 30;

type ClientRule = {
  id: string;
  category: string;
  statement: string;
  status: string;
  store_id: string | null;
  valid_from: string;
  valid_until: string | null;
  created_at: string;
};

type RulesResponse = {
  constraints: ClientRule[];
  stores?: Array<{ id: string; label: string }>;
};

type Filter = "live" | "soon" | "dead" | "all";

type Draft = {
  text: string;
  category: string;
  validUntil: string;
  storeId: string;
  editingId: string | null;
};

const EMPTY_DRAFT: Draft = { text: "", category: "discounts", validUntil: "", storeId: "", editingId: null };

const STATE_ORDER: Record<RuleState, number> = { soon: 0, live: 1, expired: 2, off: 3 };

function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

export function ClientRules({
  organizationId,
  canManage,
  documents,
}: {
  organizationId: string;
  canManage: boolean;
  documents: AnsweredDoc[];
}) {
  const query = useCachedQuery<RulesResponse>(`/v1/organizations/${organizationId}/knowledge/constraints`);
  const rules = query.data?.constraints ?? null;
  const stores = query.data?.stores ?? [];
  const storeLabel = (id: string | null) => (id ? (stores.find((store) => store.id === id)?.label ?? "Otra tienda") : "Todas las tiendas");

  // Fecha de referencia fija por montaje: el render se mantiene puro.
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  const [filter, setFilter] = useState<Filter>("live");
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [isSaving, setIsSaving] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);

  // Respuestas del cuestionario que podrían ser reglas. Se piden solo las
  // cuatro que tienen plantilla y solo si están respondidas.
  const answeredByTitle = latestByTitle(documents);
  const answerDocs = SUGGESTION_QUESTION_IDS.flatMap((questionId) => {
    const question = STORE_QUESTIONS.find((item) => item.id === questionId);
    const doc = question ? answeredByTitle.get(questionDocumentTitle(question)) : undefined;
    return doc ? [{ questionId, docId: doc.id }] : [];
  });
  const answerKey = answerDocs.map((item) => item.docId).join(",");
  const [answers, setAnswers] = useState<Record<string, string>>({});

  useEffect(() => {
    // Trae el contenido de las respuestas candidatas; no deriva de otro estado.
    let cancelled = false;
    void Promise.all(
      answerDocs.map(async (item) => [item.questionId, (await fetchDocumentContent(organizationId, item.docId)) ?? ""] as const),
    ).then((entries) => {
      if (!cancelled) setAnswers(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- answerKey resume answerDocs
  }, [organizationId, answerKey]);

  const withState = useMemo(
    () => (rules ?? []).map((rule) => ({ rule, state: ruleState(rule, today) })),
    [rules, today],
  );
  const inUse = withState.filter((item) => isInUse(item.state));
  const soonCount = withState.filter((item) => item.state === "soon").length;
  const deadCount = withState.length - inUse.length;
  const contextChars = inUse.reduce((total, item) => total + item.rule.statement.length, 0);
  const suggestions = canManage && !draft.editingId
    ? ruleSuggestions(answers, inUse.map((item) => item.rule.statement), MAX_LENGTH)
    : [];

  const shown = withState.filter((item) =>
    filter === "all" ? true : filter === "live" ? isInUse(item.state) : filter === "soon" ? item.state === "soon" : !isInUse(item.state),
  );

  function startDraft(next: Partial<Draft>) {
    setDraft({ ...EMPTY_DRAFT, category: draft.category, ...next });
    textRef.current?.focus();
  }

  async function send(path: string, init: RequestInit, success: string) {
    try {
      const response = await apiFetch(`/v1/organizations/${organizationId}/knowledge/constraints${path}`, {
        ...init,
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        toast.danger(await readApiError(response));
        return false;
      }
      toast.success(success);
      query.reload();
      return true;
    } catch {
      toast.danger("No se pudo guardar la regla por un error de red.");
      return false;
    }
  }

  async function save() {
    const statement = draft.text.trim();
    if (!statement || isSaving) return;
    setIsSaving(true);
    const ok = draft.editingId
      ? await send(
          `/${draft.editingId}`,
          { method: "PATCH", body: JSON.stringify({ statement, category: draft.category, validUntil: draft.validUntil || null }) },
          "Regla actualizada",
        )
      : await send(
          "",
          {
            method: "POST",
            body: JSON.stringify({
              category: draft.category,
              statement,
              storeId: draft.storeId || null,
              validUntil: draft.validUntil || null,
            }),
          },
          "Regla añadida: la tendrá delante desde la próxima respuesta",
        );
    setIsSaving(false);
    if (!ok) return;
    setDraft({ ...EMPTY_DRAFT, category: draft.category });
    if (filter === "dead" || filter === "soon") setFilter("live");
  }

  function onKeyDown(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      void save();
    }
  }

  const left = MAX_LENGTH - draft.text.length;
  const previewData = inUse.map((item) => ({ category: item.rule.category, statement: item.rule.statement }));
  const scoped = inUse.filter((item) => item.rule.store_id).length;

  const filters: Array<[Filter, string, number]> = [
    ["live", "Vigentes", inUse.length],
    ["soon", "Caducan pronto", soonCount],
    ["dead", "Fuera de uso", deadCount],
    ["all", "Todas", withState.length],
  ];

  return (
    <div className={pulse.root} style={{ gap: 18 }}>
      {query.error ? <ErrorBlock>No se pudieron cargar las reglas. Revisa la conexión e inténtalo de nuevo.</ErrorBlock> : null}

      <section className={r.sum} aria-label="Resumen de reglas">
        <button type="button" className={r.sumC} aria-pressed={filter === "live"} onClick={() => setFilter("live")}>
          <span className={pulse.lbl}>Vigentes</span>
          <strong>{inUse.length}</strong>
          <small>las lee en cada respuesta</small>
        </button>
        <button type="button" className={r.sumC} aria-pressed={filter === "soon"} onClick={() => setFilter("soon")}>
          <span className={pulse.lbl}>Caducan pronto</span>
          <strong style={{ color: soonCount ? "var(--warn)" : undefined }}>{soonCount}</strong>
          <small>en {SOON_DAYS} días o menos</small>
        </button>
        <button type="button" className={r.sumC} aria-pressed={filter === "dead"} onClick={() => setFilter("dead")}>
          <span className={pulse.lbl}>Fuera de uso</span>
          <strong>{deadCount}</strong>
          <small>desactivadas o caducadas</small>
        </button>
        <div className={r.sumC}>
          <span className={pulse.lbl}>Peso en cada respuesta</span>
          <strong>
            {contextChars.toLocaleString("es-ES")} <small>car.</small>
          </strong>
          <span className={r.meter}>
            <b
              style={{
                width: `${Math.min(100, (contextChars / CONTEXT_BUDGET_CHARS) * 100)}%`,
                background: contextChars > CONTEXT_BUDGET_CHARS ? "var(--warn)" : "var(--store)",
              }}
            />
          </span>
          <small>
            {contextChars > CONTEXT_BUDGET_CHARS
              ? "Muchas reglas: pasa lo largo a documentos."
              : `≈ ${Math.round(contextChars / 4).toLocaleString("es-ES")} tokens por turno`}
          </small>
        </div>
      </section>

      <div className={r.main}>
        <div className={r.list}>
          <div className={r.bar}>
            <div className={pulse.seg} role="group" aria-label="Filtrar por estado">
              {filters.map(([value, label, count]) => (
                <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>
                  {label}
                  <b>{count}</b>
                </button>
              ))}
            </div>
          </div>

          {rules === null && !query.error ? (
            <section className={pulse.panel}>
              <LoadingBlock label="Cargando reglas…" />
            </section>
          ) : shown.length === 0 ? (
            <section className={cx(pulse.panel, r.emptyMsg)}>
              {withState.length === 0
                ? "Sin reglas todavía. Una regla es lo que el copiloto no puede olvidar en ninguna respuesta: un margen mínimo, una colección que no se promociona, un tono que la marca no usa."
                : filter === "soon"
                  ? `Ninguna regla caduca en los próximos ${SOON_DAYS} días.`
                  : filter === "dead"
                    ? "No hay reglas desactivadas ni caducadas."
                    : "No hay reglas vigentes."}
            </section>
          ) : (
            RULE_CATEGORIES.map((category) => {
              const items = shown
                .filter((item) => item.rule.category === category.value)
                .sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state]);
              if (items.length === 0) return null;
              return (
                <section key={category.value} className={cx(pulse.panel, r.group)} aria-labelledby={`regla-tema-${category.value}`}>
                  <div className={r.groupH}>
                    <h3 id={`regla-tema-${category.value}`}>
                      {category.label} <span>{items.length}</span>
                    </h3>
                    {canManage ? (
                      <button
                        type="button"
                        className={cx(pulse.btn, r.link, pulse.sm)}
                        onClick={() => startDraft({ category: category.value })}
                      >
                        + Añadir en {category.label.toLowerCase()}
                      </button>
                    ) : null}
                  </div>
                  <ul>
                    {items.map(({ rule, state }) => (
                      <li key={rule.id} className={cx(r.rule, state === "live" ? undefined : r[state])}>
                        <span className={r.stripe} aria-hidden="true" />
                        <div>
                          <p>{rule.statement}</p>
                          <div className={r.ruleMeta}>
                            {state === "soon" ? (
                              <span className={cx(pulse.chip, pulse.chipWarn)}>
                                {rule.valid_until && daysUntil(rule.valid_until, today) === 0
                                  ? "caduca hoy"
                                  : `caduca en ${rule.valid_until ? daysUntil(rule.valid_until, today) : 0} días`}
                              </span>
                            ) : state === "expired" ? (
                              <span className={pulse.chip}>caducó el {formatDate(rule.valid_until ?? today)}</span>
                            ) : state === "off" ? (
                              <span className={pulse.chip}>desactivada</span>
                            ) : rule.valid_until ? (
                              <span className={pulse.chip}>hasta el {formatDate(rule.valid_until)}</span>
                            ) : (
                              <span className={cx(pulse.chip, pulse.chipGood)}>sin fecha de fin</span>
                            )}
                            <span className={pulse.chip}>{storeLabel(rule.store_id)}</span>
                            <span>creada el {formatDate(rule.created_at.slice(0, 10))}</span>
                          </div>
                        </div>
                        {canManage ? (
                          <div className={r.ruleActs}>
                            {state === "expired" ? (
                              <button
                                type="button"
                                className={cx(pulse.btn, pulse.ghost, pulse.sm)}
                                onClick={() =>
                                  void send(
                                    `/${rule.id}`,
                                    { method: "PATCH", body: JSON.stringify({ validUntil: addDays(today, RENEW_DAYS) }) },
                                    `Renovada ${RENEW_DAYS} días`,
                                  )
                                }
                              >
                                Renovar {RENEW_DAYS} días
                              </button>
                            ) : null}
                            {rule.status === "active" && state !== "expired" ? (
                              <button
                                type="button"
                                className={cx(pulse.btn, r.link, pulse.sm)}
                                onClick={() =>
                                  startDraft({
                                    text: rule.statement,
                                    category: rule.category,
                                    validUntil: rule.valid_until ?? "",
                                    storeId: rule.store_id ?? "",
                                    editingId: rule.id,
                                  })
                                }
                              >
                                Editar
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className={cx(pulse.btn, rule.status === "active" ? r.link : pulse.ghost, pulse.sm)}
                              onClick={() =>
                                void send(
                                  `/${rule.id}`,
                                  { method: "PATCH", body: JSON.stringify({ status: rule.status === "active" ? "inactive" : "active" }) },
                                  rule.status === "active" ? "Regla desactivada: deja de entrar en las respuestas" : "Regla reactivada",
                                )
                              }
                            >
                              {rule.status === "active" ? "Desactivar" : "Reactivar"}
                            </button>
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })
          )}
        </div>

        <aside className={r.side}>
          {canManage ? (
            <section className={cx(pulse.panel, r.composer)} aria-labelledby="regla-redactor">
              <h3 id="regla-redactor">{draft.editingId ? "Editar regla" : "Nueva regla"}</h3>
              <textarea
                ref={textRef}
                className={r.txt}
                maxLength={MAX_LENGTH}
                aria-label="Texto de la regla"
                value={draft.text}
                placeholder="Ej: Nunca propongas descuentos por encima del 20 %."
                onChange={(event) => setDraft({ ...draft, text: event.target.value })}
                onKeyDown={onKeyDown}
              />
              <div className={r.cnt}>
                <span className={left < 80 ? r.warnTxt : undefined}>
                  {left < 80
                    ? "Si necesitas más, es un documento: una regla entra entera en cada respuesta."
                    : "Corta y en imperativo: «Nunca…», «Siempre…»."}
                </span>
                <span>
                  {draft.text.length}/{MAX_LENGTH}
                </span>
              </div>
              <div className={r.topics} role="group" aria-label="Tema">
                {RULE_CATEGORIES.map((category) => (
                  <button
                    key={category.value}
                    type="button"
                    aria-pressed={draft.category === category.value}
                    onClick={() => setDraft({ ...draft, category: category.value })}
                  >
                    {category.label}
                  </button>
                ))}
              </div>
              <div className={r.row2}>
                <label className={r.fld}>
                  Deja de aplicar (opcional)
                  <input
                    type="date"
                    min={today}
                    value={draft.validUntil}
                    onChange={(event) => setDraft({ ...draft, validUntil: event.target.value })}
                  />
                </label>
                {stores.length > 1 ? (
                  <label className={r.fld}>
                    Aplica a
                    <select
                      value={draft.storeId}
                      disabled={Boolean(draft.editingId)}
                      onChange={(event) => setDraft({ ...draft, storeId: event.target.value })}
                    >
                      <option value="">Todas las tiendas</option>
                      {stores.map((store) => (
                        <option key={store.id} value={store.id}>
                          {store.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>
              <div className={r.formActs}>
                {draft.editingId ? (
                  <button type="button" className={cx(pulse.btn, pulse.ghost)} onClick={() => setDraft({ ...EMPTY_DRAFT, category: draft.category })}>
                    Cancelar
                  </button>
                ) : null}
                <button type="button" className={cx(pulse.btn, pulse.acc)} disabled={isSaving || !draft.text.trim()} onClick={() => void save()}>
                  {isSaving ? "Guardando…" : draft.editingId ? "Guardar cambios" : "Añadir regla"}
                </button>
              </div>
              {suggestions.length > 0 ? (
                <div className={r.sugs}>
                  <span className={pulse.lbl}>Del cuestionario, para tenerlo siempre delante</span>
                  {suggestions.map((suggestion) => (
                    <div key={suggestion.key} className={r.sug}>
                      <span>
                        {suggestion.text}
                        <small>{suggestion.from}</small>
                      </span>
                      <button
                        type="button"
                        className={cx(pulse.btn, pulse.ghost, pulse.sm)}
                        onClick={() => startDraft({ text: suggestion.text, category: suggestion.category })}
                      >
                        Usar
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

          <section className={r.reads} aria-label="Lo que lee el copiloto">
            <span className={cx(pulse.lbl, r.lbl)}>Lo que lee el copiloto en cada respuesta</span>
            <code>
              {previewData.length > 0 ? (
                <>
                  <i>Restricciones criticas del cliente (siempre vigentes, no negociables)</i>
                  {"\n"}
                  {JSON.stringify(previewData, null, 2)}
                </>
              ) : (
                <i>(sin reglas vigentes: el copiloto no recibe ninguna restricción)</i>
              )}
            </code>
            <small>
              Va al copiloto y a todos los agentes. Las desactivadas y las caducadas no entran
              {scoped > 0 ? "; las de una tienda solo entran cuando se trabaja con esa tienda" : ""}.
            </small>
          </section>

          <div className={r.vs}>
            <div>
              <b>Regla</b>Entra entera en cada respuesta y en cada agente. Corta y tajante.
            </div>
            <div>
              <b>Documento</b>Se consulta cuando la conversación lo pide. Para lo largo o con matices.
            </div>
          </div>
        </aside>
      </div>

      <p className={pulse.muted} style={{ fontSize: 12 }}>
        Las reglas no se borran: desactivarlas deja constancia de qué se le pidió al copiloto y cuándo dejó de pedirse.
      </p>
    </div>
  );
}
