"use client";

import { buttonVariants } from "@/components/ui/button";
import { useEffect, useState, type KeyboardEvent } from "react";
import {
  type AnsweredDoc,
  fetchDocumentContent,
  latestByTitle,
  questionDocumentTitle,
  saveAnswer,
  STORE_QUESTION_CATEGORIES,
  STORE_QUESTIONS,
  type StoreQuestion,
} from "./store-knowledge";
import { isStaleAnswer } from "./answer-age";
import { LoadingBlock, Collapsible, CollapsibleContent, CollapsibleTrigger, IconChevronDown, ToggleGroup, ToggleGroupItem } from "@/components/ui";
import { cx } from "../dashboard/client-pulse";
import pulse from "../dashboard/client-pulse.module.css";
import q from "./cuestionario.module.css";

type Question = (typeof STORE_QUESTIONS)[number];

// Lo que más condiciona las propuestas del copiloto si falta.
const PRIORITY_GAPS = ["margen_minimo", "cac_maximo", "descuentos_prohibidos", "lineas_rojas_marca"];

// Extrae el numero de un contenido guardado ("35 %" -> "35") para poder
// volver a meterlo en un <input type="number">: el contenido se guarda con
// la unidad detras porque es lo que lee el copiloto, pero un input numerico
// solo acepta el numero.
function numericInputValue(content: string): string {
  const match = content.match(/-?\d+(\.\d+)?/);
  return match ? match[0] : "";
}

function answerContent(question: StoreQuestion, rawValue: string): string {
  const value = rawValue.trim();
  if (question.type !== "number") return value;
  return question.unit ? `${value} ${question.unit}` : value;
}

function lastChange(doc: AnsweredDoc) {
  return doc.updated_at ?? doc.created_at;
}

function ago(iso: string, now: number) {
  const days = Math.floor((now - Date.parse(iso)) / 86_400_000);
  if (days <= 0) return "hoy";
  if (days === 1) return "ayer";
  if (days < 60) return `hace ${days} días`;
  return `hace ${Math.round(days / 30)} meses`;
}

function categoryProgress(categoryId: string, answered: Map<string, AnsweredDoc>) {
  const questions = STORE_QUESTIONS.filter((item) => item.categoryId === categoryId);
  return {
    answered: questions.filter((item) => answered.has(questionDocumentTitle(item))).length,
    total: questions.length,
  };
}

export function StoreQuestionnaire({
  organizationId,
  documents,
  onSaved,
}: {
  organizationId: string;
  documents: AnsweredDoc[];
  onSaved: () => void;
}) {
  const answeredByTitle = latestByTitle(documents);
  const [now] = useState(() => Date.now());
  const [mode, setMode] = useState<"wizard" | "profile">("wizard");
  const [currentId, setCurrentId] = useState(
    () =>
      (STORE_QUESTIONS.find((item) => !answeredByTitle.has(questionDocumentTitle(item))) ?? STORE_QUESTIONS[0]).id,
  );

  const answeredCount = STORE_QUESTIONS.filter((item) =>
    answeredByTitle.has(questionDocumentTitle(item)),
  ).length;

  function goTo(id: string) {
    setCurrentId(id);
    setMode("wizard");
  }

  return (
    <div className={pulse.root} style={{ gap: 18 }}>
      <section className={cx(pulse.panel, q.prog)} aria-label="Progreso del cuestionario">
        <div className={q.progNum}>
          <span className={pulse.lbl}>Respondidas</span>
          <strong>
            {answeredCount}
            <span> / {STORE_QUESTIONS.length}</span>
          </strong>
        </div>
        <div className={q.segs}>
          <div className={q.segBar}>
            {STORE_QUESTION_CATEGORIES.map((category) => (
              <i key={category.id} title={category.label}>
                {category.questions.map((item) => (
                  <b
                    key={item.id}
                    className={cx(
                      answeredByTitle.has(questionDocumentTitle(item)) ? q.on : undefined,
                      mode === "wizard" && item.id === currentId ? q.cur : undefined,
                    )}
                  />
                ))}
              </i>
            ))}
          </div>
          <div className={q.segLbl}>
            {STORE_QUESTION_CATEGORIES.map((category) => {
              const progress = categoryProgress(category.id, answeredByTitle);
              return (
                <span key={category.id}>
                  {category.label} {progress.answered}/{progress.total}
                </span>
              );
            })}
          </div>
        </div>
        <ToggleGroup aria-label="Vista" value={mode} onValueChange={setMode}>
          <ToggleGroupItem value="wizard">Responder</ToggleGroupItem>
          <ToggleGroupItem value="profile">Perfil de la tienda</ToggleGroupItem>
        </ToggleGroup>
      </section>

      {mode === "wizard" ? (
        <div className={q.main}>
          <QuestionIndex answered={answeredByTitle} currentId={currentId} now={now} onGo={setCurrentId} />
          <QuestionCard
            key={currentId}
            organizationId={organizationId}
            question={STORE_QUESTIONS.find((item) => item.id === currentId) ?? STORE_QUESTIONS[0]}
            answered={answeredByTitle}
            now={now}
            onGo={setCurrentId}
            onSaved={onSaved}
          />
        </div>
      ) : (
        <StoreProfile
          organizationId={organizationId}
          answeredByTitle={answeredByTitle}
          now={now}
          onEdit={goTo}
        />
      )}

      <p className={pulse.muted} style={{ fontSize: 12 }}>
        Cada respuesta se guarda como un documento de conocimiento titulado «Cuestionario: …». Reeditarla actualiza
        ese mismo documento, no crea otro.
      </p>
    </div>
  );
}

function QuestionIndex({
  answered,
  currentId,
  now,
  onGo,
}: {
  answered: Map<string, AnsweredDoc>;
  currentId: string;
  now: number;
  onGo: (id: string) => void;
}) {
  return (
    <aside className={cx(pulse.panel, q.idx)} aria-label="Preguntas">
      {STORE_QUESTION_CATEGORIES.map((category) => {
        const progress = categoryProgress(category.id, answered);
        return (
          <div key={category.id} className={q.idxCat}>
            <div className={q.idxH}>
              {category.label}
              <span>
                {progress.answered}/{progress.total}
              </span>
            </div>
            {category.questions.map((item) => {
              const doc = answered.get(questionDocumentTitle(item));
              const stale = doc ? isStaleAnswer(doc, now) : false;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={q.idxQ}
                  aria-current={item.id === currentId ? "step" : undefined}
                  onClick={() => onGo(item.id)}
                >
                  <span className={cx(q.dot, stale ? q.old : doc ? q.on : undefined)} aria-hidden="true" />
                  <span>
                    {item.question}
                    {stale ? (
                      <>
                        {" "}
                        <span className={cx(pulse.chip, pulse.chipWarn)}>revisar</span>
                      </>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        );
      })}
    </aside>
  );
}

function QuestionCard({
  organizationId,
  question,
  answered,
  now,
  onGo,
  onSaved,
}: {
  organizationId: string;
  question: Question;
  answered: Map<string, AnsweredDoc>;
  now: number;
  onGo: (id: string) => void;
  onSaved: () => void;
}) {
  const doc = answered.get(questionDocumentTitle(question));
  const docId = doc?.id;
  const [value, setValue] = useState("");
  const [isLoading, setIsLoading] = useState(Boolean(docId));
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Sincroniza el campo con la respuesta guardada al abrir la pregunta;
    // no deriva de otro estado local.
    let cancelled = false;
    if (!docId) return;
    void fetchDocumentContent(organizationId, docId).then((content) => {
      if (cancelled) return;
      setValue(content === null ? "" : question.type === "number" ? numericInputValue(content) : content);
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [organizationId, docId, question.type]);

  const categoryQuestions = STORE_QUESTIONS.filter((item) => item.categoryId === question.categoryId);
  const position = categoryQuestions.findIndex((item) => item.id === question.id) + 1;
  const flat = STORE_QUESTIONS.findIndex((item) => item.id === question.id);
  const previous = STORE_QUESTIONS[flat - 1];
  const next = STORE_QUESTIONS[flat + 1];
  const stale = doc ? isStaleAnswer(doc, now) : false;
  const words = value.trim() ? value.trim().split(/\s+/).length : 0;
  const tooShort = question.type === "textarea" && words > 0 && words < 8;
  const preview = value.trim() ? answerContent(question, value) : null;

  async function save() {
    if (!value.trim() || isSaving || isLoading) return;
    setIsSaving(true);
    const ok = await saveAnswer(organizationId, doc?.id, questionDocumentTitle(question), answerContent(question, value));
    setIsSaving(false);
    if (!ok) return;
    onSaved();
    // Siguiente sin responder; si no queda ninguna, la siguiente a secas.
    const following =
      STORE_QUESTIONS.slice(flat + 1).find((item) => !answered.has(questionDocumentTitle(item))) ?? next;
    if (following) onGo(following.id);
  }

  function onKeyDown(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      void save();
    }
  }

  return (
    <article className={cx(pulse.panel, q.q)} aria-labelledby="pregunta-titulo">
      <div className={q.qHead}>
        <span className={pulse.lbl}>
          {question.categoryLabel} · {position} de {categoryQuestions.length}
        </span>
        {doc ? (
          <span className={cx(pulse.chip, stale ? pulse.chipWarn : pulse.chipGood)}>
            {stale ? `Respondida ${ago(lastChange(doc), now)} · revisar` : `Respondida ${ago(lastChange(doc), now)}`}
          </span>
        ) : (
          <span className={pulse.chip}>Sin responder</span>
        )}
      </div>

      <h2 id="pregunta-titulo">{question.question}</h2>
      {question.why ? (
        <p className={q.why}>
          <span className={pulse.ia} aria-hidden="true">
            IA
          </span>
          <span>{question.why}</span>
        </p>
      ) : null}

      {isLoading ? (
        <LoadingBlock label="Cargando respuesta..." />
      ) : (
        <div className={q.field}>
          {question.type === "number" ? (
            <label className={q.numIn}>
              <input
                type="number"
                inputMode="decimal"
                aria-label={question.question}
                value={value}
                placeholder={question.example}
                onChange={(event) => setValue(event.target.value)}
                onKeyDown={onKeyDown}
              />
              <span>{question.unit}</span>
            </label>
          ) : question.type === "text" ? (
            <input
              className={q.txt}
              type="text"
              aria-label={question.question}
              value={value}
              placeholder={question.example ?? question.placeholder}
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={onKeyDown}
            />
          ) : (
            <textarea
              className={q.txt}
              aria-label={question.question}
              value={value}
              placeholder="Escribe con el detalle real de tu tienda…"
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={onKeyDown}
            />
          )}
          <div className={q.fieldFoot}>
            <span className={tooShort ? q.short : undefined}>
              {question.type === "textarea"
                ? tooShort
                  ? "Muy corta: con nombres, cifras y ejemplos el copiloto acierta más."
                  : words
                    ? `${words} palabras`
                    : "Con nombres, cifras y ejemplos reales."
                : question.type === "number"
                  ? "Solo el número; la unidad se añade al guardar."
                  : ""}
            </span>
            <span>
              <kbd className={q.kbd}>Ctrl</kbd> + <kbd className={q.kbd}>Enter</kbd> guarda
            </span>
          </div>
        </div>
      )}

      {question.example ? (
        <Collapsible className={q.ex}>
          <CollapsibleTrigger>Ver un ejemplo de buena respuesta<IconChevronDown aria-hidden className="ui-collapsible__chevron" /></CollapsibleTrigger>
          <CollapsibleContent>
          <p>{question.type === "number" && question.unit ? `${question.example} ${question.unit}` : question.example}</p>
        </CollapsibleContent>
        </Collapsible>
      ) : null}

      <div className={q.reads}>
        <span className={cx(pulse.lbl, q.lbl)}>Así lo leerá el copiloto</span>
        <code>
          <i>{questionDocumentTitle(question)}</i>
          {"\n"}
          {preview ?? <i>(vacío: todavía no lo sabe)</i>}
        </code>
        <small>Lo ve el cliente y lo usan los agentes. Guardar de nuevo actualiza este mismo documento.</small>
      </div>

      <div className={q.acts}>
        <button
          type="button"
          className={buttonVariants({ variant: "secondary" })}
          disabled={!previous}
          onClick={() => previous && onGo(previous.id)}
        >
          Anterior
        </button>
        <div>
          {next ? (
            <button type="button" className={buttonVariants({ variant: "ghost" })} onClick={() => onGo(next.id)}>
              Saltar
            </button>
          ) : null}
          <button
            type="button"
            className={buttonVariants()}
            disabled={isSaving || isLoading || !value.trim()}
            onClick={() => void save()}
          >
            {isSaving ? "Guardando..." : doc ? "Actualizar y siguiente" : "Guardar y siguiente"}
          </button>
        </div>
      </div>
    </article>
  );
}

function StoreProfile({
  organizationId,
  answeredByTitle,
  now,
  onEdit,
}: {
  organizationId: string;
  answeredByTitle: Map<string, AnsweredDoc>;
  now: number;
  onEdit: (id: string) => void;
}) {
  const [contentByDocId, setContentByDocId] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const answeredSize = answeredByTitle.size;

  useEffect(() => {
    // Trae el contenido de cada respuesta al abrir el perfil. Se vuelve a
    // pedir cuando cambia cuántas hay, no en cada render del padre.
    let cancelled = false;
    void Promise.all(
      Array.from(answeredByTitle.values()).map(async (doc) => {
        const content = await fetchDocumentContent(organizationId, doc.id);
        return [doc.id, content ?? ""] as const;
      }),
    ).then((entries) => {
      if (cancelled) return;
      setContentByDocId(Object.fromEntries(entries));
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, answeredSize]);

  if (isLoading) {
    return (
      <section className={pulse.panel}>
        <LoadingBlock label="Componiendo el perfil de la tienda..." />
      </section>
    );
  }

  const gaps = PRIORITY_GAPS.filter((id) => {
    const item = STORE_QUESTIONS.find((candidate) => candidate.id === id);
    return item ? !answeredByTitle.has(questionDocumentTitle(item)) : false;
  });
  const pending = STORE_QUESTIONS.length - answeredSize;

  return (
    <div className={q.prof}>
      {STORE_QUESTION_CATEGORIES.map((category) => {
        const progress = categoryProgress(category.id, answeredByTitle);
        return (
          <section key={category.id} className={pulse.panel} aria-labelledby={`perfil-${category.id}`}>
            <div className={q.pCatH}>
              <h3 id={`perfil-${category.id}`}>{category.label}</h3>
              <span className={cx(pulse.chip, progress.answered === progress.total ? pulse.chipGood : undefined)}>
                {progress.answered}/{progress.total}
              </span>
            </div>
            <dl>
              {category.questions.map((item) => {
                const doc = answeredByTitle.get(questionDocumentTitle(item));
                return (
                  <div key={item.id} className={cx(q.pRow, doc ? undefined : q.miss)}>
                    <dt>{item.question}</dt>
                    <dd>{doc ? contentByDocId[doc.id] || "—" : "El copiloto aún no lo sabe"}</dd>
                    <div className={q.pSide}>
                      {doc ? (
                        <span className={cx(pulse.chip, isStaleAnswer(doc, now) ? pulse.chipWarn : undefined)}>
                          {ago(lastChange(doc), now)}
                        </span>
                      ) : null}
                      <button type="button" className={buttonVariants({ variant: "secondary", size: "sm" })} onClick={() => onEdit(item.id)}>
                        {doc ? "Editar" : "Responder"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </dl>
          </section>
        );
      })}

      <section className={cx(pulse.panel, q.gaps)} aria-labelledby="perfil-huecos">
        <div className={q.pCatH}>
          <h3 id="perfil-huecos">Lo que más le falta</h3>
          <span className={cx(pulse.chip, pulse.chipAcc)}>{pending} sin responder</span>
        </div>
        <p>Sin estas respuestas, el copiloto propone promociones y campañas sin saber dónde está tu límite.</p>
        <ul>
          {gaps.length === 0 ? (
            <li>Nada importante pendiente.</li>
          ) : (
            gaps.map((id) => {
              const item = STORE_QUESTIONS.find((candidate) => candidate.id === id);
              if (!item) return null;
              return (
                <li key={id}>
                  <span>{item.question}</span>
                  <button type="button" className={buttonVariants({ size: "sm" })} onClick={() => onEdit(id)}>
                    Responder
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </section>
    </div>
  );
}
