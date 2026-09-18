"use client";

import { useCallback, useEffect, useState } from "react";
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
import {
  Badge,
  Button,
  Card,
  CheckIcon,
  EYEBROW,
  Input,
  LoadingBlock,
  Textarea,
} from "@/components/ui";

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
  const firstUnanswered = STORE_QUESTIONS.find(
    (question) => !answeredByTitle.has(questionDocumentTitle(question)),
  );
  const [mode, setMode] = useState<"wizard" | "profile">("wizard");
  const [categoryId, setCategoryId] = useState(
    firstUnanswered?.categoryId ?? STORE_QUESTION_CATEGORIES[0].id,
  );
  const [questionIndex, setQuestionIndex] = useState(
    firstUnanswered
      ? STORE_QUESTIONS.filter((q) => q.categoryId === firstUnanswered.categoryId).findIndex(
          (q) => q.id === firstUnanswered.id,
        )
      : 0,
  );

  function goToQuestion(question: StoreQuestion & { categoryId: string }) {
    const categoryQuestions = STORE_QUESTIONS.filter(
      (item) => item.categoryId === question.categoryId,
    );
    setCategoryId(question.categoryId);
    setQuestionIndex(categoryQuestions.findIndex((item) => item.id === question.id));
    setMode("wizard");
  }

  const answeredCount = STORE_QUESTIONS.filter((question) =>
    answeredByTitle.has(questionDocumentTitle(question)),
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          Cada respuesta se guarda como conocimiento del copiloto: responde
          con el contexto real de tu negocio, no con generalidades.
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <Badge tone={answeredCount === STORE_QUESTIONS.length ? "success" : "neutral"}>
            {answeredCount}/{STORE_QUESTIONS.length}
          </Badge>
          <Button
            type="button"
            size="sm"
            variant={mode === "wizard" ? "primary" : "ghost"}
            onClick={() => setMode("wizard")}
          >
            Responder
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === "profile" ? "primary" : "ghost"}
            onClick={() => setMode("profile")}
          >
            Perfil de la tienda
          </Button>
        </div>
      </div>

      {mode === "wizard" ? (
        <QuestionnaireWizard
          organizationId={organizationId}
          answeredByTitle={answeredByTitle}
          categoryId={categoryId}
          questionIndex={questionIndex}
          setCategoryId={setCategoryId}
          setQuestionIndex={setQuestionIndex}
          onSaved={onSaved}
        />
      ) : (
        <StoreProfile
          organizationId={organizationId}
          answeredByTitle={answeredByTitle}
          onEdit={goToQuestion}
        />
      )}
    </div>
  );
}

function QuestionnaireWizard({
  organizationId,
  answeredByTitle,
  categoryId,
  questionIndex,
  setCategoryId,
  setQuestionIndex,
  onSaved,
}: {
  organizationId: string;
  answeredByTitle: Map<string, AnsweredDoc>;
  categoryId: string;
  questionIndex: number;
  setCategoryId: (id: string) => void;
  setQuestionIndex: (index: number) => void;
  onSaved: () => void;
}) {
  const categoryQuestions = STORE_QUESTIONS.filter(
    (question) => question.categoryId === categoryId,
  );
  const current = categoryQuestions[questionIndex] ?? categoryQuestions[0];
  const currentDoc = answeredByTitle.get(questionDocumentTitle(current));

  const [value, setValue] = useState("");
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const currentDocId = currentDoc?.id;

  useEffect(() => {
    // Sincroniza el input con la respuesta guardada al cambiar de pregunta;
    // no deriva de otro estado local.
    let cancelled = false;
    if (!currentDocId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValue("");
      return;
    }
    setIsLoadingContent(true);
    void fetchDocumentContent(organizationId, currentDocId).then((content) => {
      if (cancelled) return;
      setValue(
        content === null
          ? ""
          : current.type === "number"
            ? numericInputValue(content)
            : content,
      );
      setIsLoadingContent(false);
    });
    return () => {
      cancelled = true;
    };
  }, [organizationId, currentDocId, current.type]);

  function categoryProgress(catId: string) {
    const questions = STORE_QUESTIONS.filter((question) => question.categoryId === catId);
    const answered = questions.filter((question) =>
      answeredByTitle.has(questionDocumentTitle(question)),
    ).length;
    return { answered, total: questions.length };
  }

  function stepBy(delta: 1 | -1) {
    const flatIndex = STORE_QUESTIONS.findIndex((question) => question.id === current.id);
    const nextFlatIndex = flatIndex + delta;
    const next = STORE_QUESTIONS[nextFlatIndex];
    if (!next) return;
    const nextCategoryQuestions = STORE_QUESTIONS.filter(
      (question) => question.categoryId === next.categoryId,
    );
    setCategoryId(next.categoryId);
    setQuestionIndex(nextCategoryQuestions.findIndex((question) => question.id === next.id));
  }

  async function handleSave() {
    if (!value.trim()) return;
    setIsSaving(true);
    const ok = await saveAnswer(
      organizationId,
      currentDoc?.id,
      questionDocumentTitle(current),
      answerContent(current, value),
    );
    setIsSaving(false);
    if (ok) {
      onSaved();
      stepBy(1);
    }
  }

  const isFirst = STORE_QUESTIONS[0].id === current.id;
  const isLast = STORE_QUESTIONS[STORE_QUESTIONS.length - 1].id === current.id;
  const overallAnswered = STORE_QUESTIONS.filter((question) =>
    answeredByTitle.has(questionDocumentTitle(question)),
  ).length;

  return (
    <Card>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-edge">
        <div
          className="h-full rounded-full bg-accent transition-[width]"
          style={{ width: `${(overallAnswered / STORE_QUESTIONS.length) * 100}%` }}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {STORE_QUESTION_CATEGORIES.map((category) => {
          const progress = categoryProgress(category.id);
          const complete = progress.answered === progress.total;
          return (
            <Button
              key={category.id}
              type="button"
              size="sm"
              variant={category.id === categoryId ? "primary" : "ghost"}
              onClick={() => {
                setCategoryId(category.id);
                setQuestionIndex(0);
              }}
            >
              {complete ? <CheckIcon aria-hidden className="size-3.5" /> : null}
              {category.label} ({progress.answered}/{progress.total})
            </Button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {categoryQuestions.map((question, index) => {
          const done = answeredByTitle.has(questionDocumentTitle(question));
          return (
            <button
              key={question.id}
              type="button"
              onClick={() => setQuestionIndex(index)}
              aria-current={index === questionIndex ? "step" : undefined}
              aria-label={`Pregunta ${index + 1} de ${categoryQuestions.length}${done ? ", respondida" : ""}`}
              className={[
                "size-3 rounded-full transition-colors",
                index === questionIndex
                  ? "bg-accent"
                  : done
                    ? "bg-success"
                    : "bg-edge hover:bg-edge-strong",
              ].join(" ")}
            />
          );
        })}
      </div>

      <p className={`mt-5 ${EYEBROW}`}>
        {current.categoryLabel} · pregunta {questionIndex + 1} de{" "}
        {categoryQuestions.length}
      </p>
      <p className="mt-1 text-base font-medium">{current.question}</p>
      {currentDoc && !isLoadingContent ? (
        <p className="mt-1 text-xs text-muted">
          Respondida el{" "}
          {new Date(currentDoc.created_at).toLocaleDateString("es-ES")}.
          Guarda para actualizarla.
        </p>
      ) : null}

      {isLoadingContent ? (
        <div className="mt-3">
          <LoadingBlock label="Cargando respuesta..." />
        </div>
      ) : current.type === "textarea" ? (
        <Textarea
          className="mt-3 h-28"
          aria-label={current.question}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Escribe tu respuesta..."
        />
      ) : (
        <div className="mt-3 flex items-center gap-2">
          <Input
            className="max-w-xs"
            type={current.type === "number" ? "number" : "text"}
            aria-label={current.question}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={current.placeholder ?? "Escribe tu respuesta..."}
          />
          {current.unit ? (
            <span className="text-sm text-muted">{current.unit}</span>
          ) : null}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          disabled={isFirst}
          onClick={() => stepBy(-1)}
        >
          Anterior
        </Button>
        <Button
          type="button"
          disabled={isSaving || isLoadingContent || !value.trim()}
          onClick={() => void handleSave()}
        >
          {isSaving
            ? "Guardando..."
            : currentDoc
              ? "Actualizar y siguiente"
              : "Guardar y siguiente"}
        </Button>
        {!isLast ? (
          <Button type="button" variant="ghost" onClick={() => stepBy(1)}>
            Saltar
          </Button>
        ) : null}
      </div>
    </Card>
  );
}

function StoreProfile({
  organizationId,
  answeredByTitle,
  onEdit,
}: {
  organizationId: string;
  answeredByTitle: Map<string, AnsweredDoc>;
  onEdit: (question: StoreQuestion & { categoryId: string }) => void;
}) {
  const [contentByDocId, setContentByDocId] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);

  const loadContents = useCallback(async () => {
    setIsLoading(true);
    const entries = await Promise.all(
      Array.from(answeredByTitle.values()).map(async (doc) => {
        const content = await fetchDocumentContent(organizationId, doc.id);
        return [doc.id, content ?? ""] as const;
      }),
    );
    setContentByDocId(Object.fromEntries(entries));
    setIsLoading(false);
    // answeredByTitle se reconstruye en cada render del padre; su tamaño (no
    // su identidad) es lo que de verdad cambia cuando hay algo nuevo que traer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, answeredByTitle.size]);

  useEffect(() => {
    // Trae el contenido de cada respuesta al abrir el perfil; no deriva de
    // otro estado local.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadContents();
  }, [loadContents]);

  if (isLoading) {
    return (
      <Card>
        <LoadingBlock label="Componiendo el perfil de la tienda..." />
      </Card>
    );
  }

  if (answeredByTitle.size === 0) {
    return (
      <Card>
        <p className="text-sm text-muted">
          Todavía no hay respuestas. Responde al menos una pregunta para
          empezar a ver aquí el perfil de la tienda.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {STORE_QUESTION_CATEGORIES.map((category) => {
        const answered = category.questions.filter((question) =>
          answeredByTitle.has(questionDocumentTitle(question)),
        );
        if (answered.length === 0) return null;
        return (
          <Card key={category.id} title={category.label}>
            <dl className="divide-y divide-separator">
              {answered.map((question) => {
                const doc = answeredByTitle.get(questionDocumentTitle(question));
                if (!doc) return null;
                return (
                  <div
                    key={question.id}
                    className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0 flex-1">
                      <dt className="text-sm font-medium">{question.question}</dt>
                      <dd className="mt-1 text-sm text-muted">
                        {contentByDocId[doc.id] || "—"}
                      </dd>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => onEdit({ ...question, categoryId: category.id })}
                    >
                      Editar
                    </Button>
                  </div>
                );
              })}
            </dl>
          </Card>
        );
      })}
    </div>
  );
}
