"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { buildMarketingBrief } from "@/lib/marketing-brief";
import {
  Button,
  Card,
  EmptyState,
  ErrorBlock,
  Field,
  Input,
  LoadingBlock,
  Select,
  Textarea,
  toast,
} from "@/components/ui";

type BankImage = {
  id: string;
  public_url: string;
  original_filename: string;
  status: "queued" | "analyzing" | "analyzed" | "failed";
  analysis: { suggested_use?: string } | null;
};

type WeeklyMailingPlan = {
  plan_name: string;
  diagnosis: string;
  strategy_decision: string;
  alternatives_rejected: Array<{ alternative: string; reason: string }>;
  objective_rationale: string;
  audience_rationale: string;
  cadence: { recommendation: string; requested_schedule_assessment: string; requires_user_approval: boolean };
  experiment: { hypothesis: string; primary_metric: string; guardrail_metrics: string[]; design: string; decision_rule: string; evidence_status: "ready" | "insufficient_evidence" | "not_applicable" };
  success_criteria: string[];
  stop_criteria: string[];
  sequence_rationale: string;
  visual_direction: string;
  emails: Array<{
    sequence_number: number;
    title: string;
    sequence_role: string;
    objective: string;
    audience: string;
    angle: string;
    subject_direction: string;
    preheader_direction: string;
    cta: string;
    copy_brief: string;
    visual_modules: string;
  }>;
  confidence: "low" | "medium" | "high";
  warnings: string[];
};

type MailingTemplate = {
  id: string;
  name: string;
  design?: Record<string, unknown>;
  profile?: Record<string, unknown>;
};
type TemplateCursor = { created_at: string; id: string };
type TemplatePageItem = {
  id: string;
  template_name: string | null;
  subject: string | null;
  request: {
    design?: Record<string, unknown>;
    template_profile?: Record<string, unknown>;
  } | null;
};
type WeeklyMailingSequenceResponse = {
  id: string;
  status: "generating" | "failed" | "planned" | "in_progress" | "completed" | "abandoned";
  request: Record<string, unknown>;
  plan: WeeklyMailingPlan | { generation_status: "generating" };
  client_state: Record<string, unknown>;
  updated_at: string;
};

const WEEK_DAYS = [
  { value: 1, label: "L" },
  { value: 2, label: "M" },
  { value: 3, label: "X" },
  { value: 4, label: "J" },
  { value: 5, label: "V" },
  { value: 6, label: "S" },
  { value: 0, label: "D" },
] as const;

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function nextMonday() {
  const date = new Date();
  const daysUntilMonday = (8 - date.getDay()) % 7 || 7;
  date.setDate(date.getDate() + daysUntilMonday);
  return isoDate(date);
}

function scheduleDates(
  start: string,
  durationDays: number,
  weekDays: number[],
  numberOfEmails: number,
) {
  const first = new Date(`${start}T09:00:00`);
  const candidates: Date[] = [];
  for (let index = 0; index < durationDays; index += 1) {
    const date = new Date(first);
    date.setDate(first.getDate() + index);
    if (weekDays.includes(date.getDay())) candidates.push(date);
  }
  return candidates.slice(0, numberOfEmails);
}

export function WeeklyMailingPlanner({
  organizationId,
  storeConnectionId,
  onGenerated,
  isOpen,
}: {
  organizationId: string;
  storeConnectionId: string | null;
  onGenerated: () => Promise<void> | void;
  isOpen: boolean;
}) {
  const [campaignName, setCampaignName] = useState("");
  const [objective, setObjective] = useState("conversion");
  const [audience, setAudience] = useState("");
  const [offer, setOffer] = useState("");
  const [instructions, setInstructions] = useState("");
  const [startDate, setStartDate] = useState(nextMonday);
  const [durationDays, setDurationDays] = useState("7");
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 3, 5]);
  const [numberOfEmails, setNumberOfEmails] = useState("3");
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  const [templates, setTemplates] = useState<MailingTemplate[]>([]);
  const [templateCursor, setTemplateCursor] = useState<TemplateCursor | null>(null);
  const [templateSearch, setTemplateSearch] = useState("");
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [hasLoadedTemplates, setHasLoadedTemplates] = useState(false);
  const [templateLoadError, setTemplateLoadError] = useState<string | null>(null);
  const templateLoadingRef = useRef(false);
  const templateRequestVersionRef = useRef(0);
  const [images, setImages] = useState<BankImage[]>([]);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [isLoadingImages, setIsLoadingImages] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyMailingPlan | null>(null);
  const [planSignature, setPlanSignature] = useState<string | null>(null);
  const [sequenceIdempotencyId, setSequenceIdempotencyId] = useState<string | null>(null);
  const [sequenceRequestSignature, setSequenceRequestSignature] = useState<string | null>(null);
  const [sequenceStatus, setSequenceStatus] = useState<WeeklyMailingSequenceResponse["status"] | null>(null);
  const [sequenceUpdatedAt, setSequenceUpdatedAt] = useState<string | null>(null);
  const [generationLeaseExpired, setGenerationLeaseExpired] = useState(false);
  const [isRestoringSequence, setIsRestoringSequence] = useState(false);
  const [restoredBaseDesignTemplateId, setRestoredBaseDesignTemplateId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadTemplatePage = useCallback(
    async (cursor: TemplateCursor | null, reset = false) => {
      if (templateLoadingRef.current) return;
      templateLoadingRef.current = true;
      const requestVersion = ++templateRequestVersionRef.current;
      setIsLoadingTemplates(true);
      setTemplateLoadError(null);
      try {
        const params = new URLSearchParams();
        if (cursor) {
          params.set("cursor_created_at", cursor.created_at);
          params.set("cursor_id", cursor.id);
        }
        const response = await apiFetch(
          `/v1/organizations/${organizationId}/marketing/templates?${params.toString()}`,
        );
        if (!response.ok) throw new Error(await readApiError(response));
        const payload = (await response.json()) as {
          templates?: TemplatePageItem[];
          next_cursor?: TemplateCursor | null;
        };
        if (requestVersion !== templateRequestVersionRef.current) return;
        const loaded = (payload.templates ?? [])
          .filter((item) => item.request?.design || item.request?.template_profile)
          .map((item) => ({
            id: item.id,
            name: item.template_name || item.subject || "Plantilla sin nombre",
            ...(item.request?.design ? { design: item.request.design } : {}),
            ...(item.request?.template_profile
              ? { profile: item.request.template_profile }
              : {}),
          }));
        setTemplates((current) => (reset ? loaded : [...current, ...loaded]));
        setTemplateCursor(payload.next_cursor ?? null);
        setHasLoadedTemplates(true);
      } catch (reason) {
        if (requestVersion !== templateRequestVersionRef.current) return;
        setTemplateLoadError(
          reason instanceof Error
            ? reason.message
            : "No se pudieron cargar las plantillas.",
        );
      } finally {
        if (requestVersion === templateRequestVersionRef.current) {
          templateLoadingRef.current = false;
          setIsLoadingTemplates(false);
        }
      }
    },
    [organizationId],
  );

  useEffect(() => {
    if (!isOpen || hasLoadedTemplates) return;
    void loadTemplatePage(null, true);
  }, [hasLoadedTemplates, isOpen, loadTemplatePage]);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setIsLoadingImages(true);
    void apiFetch(`/v1/organizations/${organizationId}/instagram/image-bank`)
      .then(async (response) => {
        if (!response.ok) throw new Error(await readApiError(response));
        const payload = (await response.json()) as { images?: BankImage[] };
        if (active) setImages(payload.images ?? []);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "No se pudo cargar el banco de imágenes.");
      })
      .finally(() => {
        if (active) setIsLoadingImages(false);
      });
    return () => {
      active = false;
    };
  }, [isOpen, organizationId]);

  const sequenceStorageKey = `e-nora:weekly-mailing-sequence:${organizationId}:${storeConnectionId ?? "organization"}`;
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setWeeklyPlan(null);
    setPlanSignature(null);
    setSequenceRequestSignature(null);
    setSequenceIdempotencyId(null);
    setSequenceStatus(null);
    setSequenceUpdatedAt(null);
    setGenerationLeaseExpired(false);
    try {
      const sequenceId = window.localStorage.getItem(sequenceStorageKey);
      if (!sequenceId) return;
      setIsRestoringSequence(true);
      void apiFetch(
        `/v1/organizations/${organizationId}/marketing/weekly-mailing-plan/${sequenceId}`,
      )
        .then(async (response) => {
          if (response.status === 404) {
            window.localStorage.removeItem(sequenceStorageKey);
            return;
          }
          if (!response.ok) throw new Error(await readApiError(response));
          const saved = (await response.json()) as WeeklyMailingSequenceResponse;
          if (!active || saved.status === "completed" || saved.status === "abandoned") {
            if (saved.status === "completed" || saved.status === "abandoned") {
              window.localStorage.removeItem(sequenceStorageKey);
            }
            return;
          }
          const state = saved.client_state ?? {};
          const readText = (key: string, fallback: string) =>
            typeof state[key] === "string" ? state[key] as string : fallback;
          setCampaignName(readText("campaign_name", ""));
          setObjective(readText("objective", "conversion"));
          setAudience(readText("audience", ""));
          setOffer(readText("offer", ""));
          setInstructions(readText("instructions", ""));
          setStartDate(readText("start_date", nextMonday()));
          setDurationDays(readText("duration_days", "7"));
          const restoredPlan = "emails" in saved.plan ? saved.plan : null;
          setNumberOfEmails(readText("number_of_emails", String(restoredPlan?.emails.length ?? 3)));
          setSelectedDays(Array.isArray(state.selected_days)
            ? state.selected_days.filter((day): day is number => Number.isInteger(day) && day >= 0 && day <= 6)
            : [1, 3, 5]);
          setSelectedTemplateIds(Array.isArray(state.selected_template_ids)
            ? state.selected_template_ids.filter((id): id is string => typeof id === "string")
            : []);
          setSelectedImages(Array.isArray(state.selected_image_urls)
            ? state.selected_image_urls.filter((url): url is string => typeof url === "string")
            : []);
          setRestoredBaseDesignTemplateId(
            typeof state.base_design_template_id === "string" ? state.base_design_template_id : null,
          );
          setWeeklyPlan(restoredPlan);
          const signature = readText("plan_signature", "");
          setPlanSignature(restoredPlan ? signature : null);
          setSequenceRequestSignature(signature);
          setSequenceIdempotencyId(saved.id);
          setSequenceStatus(saved.status);
          setSequenceUpdatedAt(saved.updated_at);
          setGenerationLeaseExpired(saved.status !== "generating" ||
            !Number.isFinite(Date.parse(saved.updated_at)) ||
            Date.now() - Date.parse(saved.updated_at) >= 15 * 60 * 1_000);
        })
        .catch((reason: unknown) => {
          if (active) setError(reason instanceof Error ? reason.message : "No se pudo recuperar la secuencia guardada.");
        })
        .finally(() => {
          if (active) setIsRestoringSequence(false);
        });
    } catch {
      setError("No se pudo acceder a la secuencia guardada en este navegador.");
    }
    return () => { active = false; };
  }, [isOpen, organizationId, sequenceStorageKey]);

  useEffect(() => {
    if (sequenceStatus !== "generating" || !sequenceUpdatedAt) return;
    const remaining = 15 * 60 * 1_000 - (Date.now() - Date.parse(sequenceUpdatedAt));
    if (!Number.isFinite(remaining) || remaining <= 0) return;
    const timeout = window.setTimeout(() => setGenerationLeaseExpired(true), remaining);
    return () => window.clearTimeout(timeout);
  }, [sequenceStatus, sequenceUpdatedAt]);

  useEffect(() => {
    templateRequestVersionRef.current += 1;
    templateLoadingRef.current = false;
    setTemplates([]);
    setTemplateCursor(null);
    setHasLoadedTemplates(false);
    setTemplateSearch("");
    setTemplateLoadError(null);
  }, [organizationId]);

  const plannedDates = useMemo(
    () => scheduleDates(startDate, Number(durationDays), selectedDays, Number(numberOfEmails)),
    [durationDays, numberOfEmails, selectedDays, startDate],
  );
  const readyImages = images.filter((image) => image.status === "analyzed");
  const selectedTemplates = templates.filter((template) =>
    selectedTemplateIds.includes(template.id),
  );
  const visibleTemplates = templates.filter((template) =>
    template.name.toLocaleLowerCase("es").includes(templateSearch.trim().toLocaleLowerCase("es")),
  );
  const selectedTemplate = selectedTemplates[0] ?? null;
  const baseDesignTemplate = selectedTemplates.find((template) => template.design) ?? null;
  const planTemplate = baseDesignTemplate ?? selectedTemplate;
  const currentPlanSignature = JSON.stringify({
    campaignName: campaignName.trim(), objective, audience: audience.trim(),
    offer: offer.trim(), instructions: instructions.trim(), storeConnectionId,
    scheduledDates: plannedDates.map(isoDate), templateIds: selectedTemplateIds,
    selectedImages: selectedImages.map((url) =>
      url.length > 256 ? `${url.slice(0, 128)}${url.slice(-128)}` : url,
    ),
  });
  const planIsCurrent = Boolean(weeklyPlan && planSignature === currentPlanSignature);
  const baseDesignTemplateId = baseDesignTemplate?.id ??
    (restoredBaseDesignTemplateId && selectedTemplateIds.includes(restoredBaseDesignTemplateId)
      ? restoredBaseDesignTemplateId
      : null);

  function toggleTemplate(templateId: string) {
    setSelectedTemplateIds((current) =>
      current.includes(templateId)
        ? current.filter((id) => id !== templateId)
        : current.length >= 3
          ? current
          : [...current, templateId],
    );
    if (templateId === restoredBaseDesignTemplateId) setRestoredBaseDesignTemplateId(null);
  }

  function toggleDay(day: number) {
    setSelectedDays((current) =>
      current.includes(day) ? current.filter((value) => value !== day) : [...current, day],
    );
  }

  function toggleImage(url: string) {
    if (!selectedImages.includes(url) && selectedImages.length >= 7) {
      setError("Puedes seleccionar hasta 7 imágenes para la secuencia (una por email como máximo).");
      return;
    }
    setSelectedImages((current) =>
      current.includes(url) ? current.filter((value) => value !== url) : [...current, url],
    );
  }

  async function discardSequence() {
    if (sequenceIdempotencyId && sequenceStatus &&
      (sequenceStatus === "planned" || sequenceStatus === "in_progress" || sequenceStatus === "failed")) {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/marketing/weekly-mailing-plan/${sequenceIdempotencyId}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "abandoned" }),
        },
      );
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
    }
    try { window.localStorage.removeItem(sequenceStorageKey); } catch { /* storage may be disabled */ }
    setWeeklyPlan(null);
    setPlanSignature(null);
    setSequenceRequestSignature(null);
    setSequenceIdempotencyId(null);
    setSequenceStatus(null);
    setSequenceUpdatedAt(null);
    setGenerationLeaseExpired(false);
    setRestoredBaseDesignTemplateId(null);
  }

  async function generate() {
    if (!campaignName.trim() || !audience.trim()) {
      setError("Indica el nombre de campaña y a quién va dirigido el mailing.");
      return;
    }
    if (selectedDays.length === 0) {
      setError("Elige al menos un día de envío.");
      return;
    }
    if (plannedDates.length !== Number(numberOfEmails)) {
      setError("No caben todos los emails en los días seleccionados. Amplía la duración, elige más días o reduce los envíos.");
      return;
    }

    setIsGenerating(true);
    setGenerationProgress(0);
    setError(null);
    const created: string[] = [];
    try {
      // A27 decide el arco completo usando el historial y los especialistas.
      // A11 redacta despues cada pieza con este contexto, no como prompts
      // aislados que puedan repetirse o contradecirse.
      if (!planIsCurrent) {
      const sequenceId = sequenceRequestSignature === currentPlanSignature && sequenceIdempotencyId
        ? sequenceIdempotencyId
        : crypto.randomUUID();
      setSequenceIdempotencyId(sequenceId);
      setSequenceRequestSignature(currentPlanSignature);
      setSequenceStatus("generating");
      setSequenceUpdatedAt(new Date().toISOString());
      setGenerationLeaseExpired(false);
      try { window.localStorage.setItem(sequenceStorageKey, sequenceId); } catch { /* server recovery remains available if storage is disabled */ }
      const planResponse = await apiFetch(
        `/v1/organizations/${organizationId}/marketing/weekly-mailing-plan`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sequence_id: sequenceId,
            client_state: {
              campaign_name: campaignName.trim(),
              objective,
              audience: audience.trim(),
              offer: offer.trim(),
              instructions: instructions.trim(),
              start_date: startDate,
              duration_days: durationDays,
              selected_days: selectedDays,
              number_of_emails: numberOfEmails,
              selected_template_ids: selectedTemplateIds,
              selected_image_urls: selectedImages,
              base_design_template_id: baseDesignTemplateId,
              plan_signature: currentPlanSignature,
            },
            campaign_name: campaignName.trim(),
            objective,
            audience: audience.trim(),
            offer: offer.trim(),
            instructions: instructions.trim(),
            store_connection_id: storeConnectionId,
            scheduled_dates: plannedDates.map(isoDate),
            ...(planTemplate
              ? {
                  selected_template: {
                    id: planTemplate.id,
                    name: planTemplate.name,
                  },
                }
              : {}),
          }),
        },
        180_000,
      );
      if (!planResponse.ok) throw new Error(await readApiError(planResponse));
      const planPayload = (await planResponse.json()) as {
        output?: WeeklyMailingPlan;
        sequence_id?: string;
        sequence_status?: WeeklyMailingSequenceResponse["status"];
      };
      const generatedPlan = planPayload.output;
      if (!generatedPlan || generatedPlan.emails.length !== plannedDates.length || !planPayload.sequence_id) {
        throw new Error("El planificador no devolvio una secuencia completa. No se ha creado ningun borrador.");
      }
      setWeeklyPlan(generatedPlan);
      setPlanSignature(currentPlanSignature);
      setSequenceIdempotencyId(planPayload.sequence_id);
      setSequenceRequestSignature(currentPlanSignature);
      setSequenceStatus(planPayload.sequence_status ?? "planned");
      setSequenceUpdatedAt(new Date().toISOString());
      setGenerationLeaseExpired(true);
      toast.success("Estrategia lista para revisar. Aún no se ha creado ningún borrador.");
      return;
      }
      if (!weeklyPlan) throw new Error("Genera primero una estrategia de mailing.");
      if (sequenceIdempotencyId && sequenceStatus === "planned") {
        const statusResponse = await apiFetch(
          `/v1/organizations/${organizationId}/marketing/weekly-mailing-plan/${sequenceIdempotencyId}/status`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "in_progress" }),
          },
        );
        if (!statusResponse.ok) throw new Error(await readApiError(statusResponse));
        setSequenceStatus("in_progress");
      }

      for (const [index, scheduledFor] of plannedDates.entries()) {
        const emailPlan = weeklyPlan.emails.find(
          (email) => email.sequence_number === index + 1,
        );
        if (!emailPlan) {
          throw new Error("Falta un paso en la secuencia de mailing. No se ha creado el resto de borradores.");
        }
        if (!sequenceIdempotencyId) {
          throw new Error("La secuencia no tiene una clave segura de reintento. Regenera la estrategia antes de crear borradores.");
        }
        const imageUrl = selectedImages.length
          ? selectedImages[index % selectedImages.length]
          : undefined;
        const brief = buildMarketingBrief({
          channel: "email_klaviyo",
          objective,
          audience,
          offer,
          tone: "brand",
          cta: "",
          instructions: [
            "PLAN ESTRATEGICO A27: usa lo siguiente como restricciones de trabajo basadas en el historial de esta organizacion.",
          `Diagnostico: ${weeklyPlan.diagnosis}`,
          `Arco de secuencia: ${weeklyPlan.sequence_rationale}`,
          `Dirección visual común propuesta por A27: ${weeklyPlan.visual_direction}`,
            `Este es el email ${index + 1} de ${plannedDates.length}: ${emailPlan.title}.`,
            `Angulo: ${emailPlan.angle}. Objetivo: ${emailPlan.objective}. Audiencia: ${emailPlan.audience}.`,
            `Direccion de asunto: ${emailPlan.subject_direction}. Direccion de preheader: ${emailPlan.preheader_direction}. CTA: ${emailPlan.cta}.`,
            `Brief de copy obligatorio: ${emailPlan.copy_brief}`,
            `Módulos visuales de esta pieza dentro del sistema común: ${emailPlan.visual_modules}`,
            `CAMPAÑA DE MAILING: ${campaignName.trim()}.`,
            `Este es el email ${index + 1} de ${plannedDates.length}; debe aportar un ángulo distinto y no repetir el anterior.`,
            `Fecha prevista de envío: ${isoDate(scheduledFor)} a las 09:00.`,
            instructions.trim(),
          ]
            .filter(Boolean)
            .join("\n"),
        });
        const response = await apiFetch(
          `/v1/organizations/${organizationId}/marketing/drafts`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              content_type: "campaign",
              channel: "email_klaviyo",
              idempotency_key: `${sequenceIdempotencyId}:${emailPlan.sequence_number}`,
              store_id: storeConnectionId,
              brief,
              ...(selectedTemplateIds.length
                ? { template_ids: selectedTemplateIds }
                : {}),
              ...(baseDesignTemplateId ? { base_design_template_id: baseDesignTemplateId } : {}),
              ...(imageUrl ? { content_image_urls: [imageUrl] } : {}),
            }),
          },
          180_000,
        );
        if (!response.ok) throw new Error(await readApiError(response));
        const payload = (await response.json()) as { draft?: { id?: string } };
        if (!payload.draft?.id) throw new Error("La IA no devolvió el borrador esperado.");
        created.push(payload.draft.id);

        const scheduleResponse = await apiFetch(
          `/v1/organizations/${organizationId}/marketing/drafts/${payload.draft.id}/schedule`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ scheduled_for: scheduledFor.toISOString() }),
          },
        );
        if (!scheduleResponse.ok) throw new Error(await readApiError(scheduleResponse));
        setGenerationProgress(created.length);
      }
      await onGenerated();
      if (sequenceIdempotencyId) {
        const completeResponse = await apiFetch(
          `/v1/organizations/${organizationId}/marketing/weekly-mailing-plan/${sequenceIdempotencyId}/status`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "completed" }),
          },
        );
        if (!completeResponse.ok) throw new Error(await readApiError(completeResponse));
      }
      toast.success(`${created.length} borrador${created.length === 1 ? "" : "es"} preparado${created.length === 1 ? "" : "s"} y pendiente${created.length === 1 ? "" : "s"} de revisión.`);
      try { window.localStorage.removeItem(sequenceStorageKey); } catch { /* ignore */ }
      setWeeklyPlan(null);
      setPlanSignature(null);
      setSequenceRequestSignature(null);
      setSequenceIdempotencyId(null);
      setSequenceStatus(null);
      setSequenceUpdatedAt(null);
      setGenerationLeaseExpired(false);
      setRestoredBaseDesignTemplateId(null);
    } catch (reason) {
      // Keep the approved plan and its stable idempotency keys. The server
      // returns already-created drafts on retry and continues the remaining
      // sequence instead of forcing a fresh plan that could duplicate them.
      setError(
        reason instanceof Error
          ? `${reason.message}${created.length ? ` Ya hay ${created.length} borradores de esta secuencia; puedes reintentar sin duplicarlos.` : ""}`
          : "No se pudo preparar el mailing.",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <Card
      title="Planificador de mailing"
      description="Prepara una secuencia de emails para revisar. No envía ni publica nada automáticamente."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Field label="Nombre de campaña">
          <Input value={campaignName} onChange={(event) => setCampaignName(event.target.value)} placeholder="Ej. Semana de reposición" />
        </Field>
        <Field label="Objetivo">
          <Select value={objective} onChange={setObjective} options={[
            { value: "conversion", label: "Conversión / ventas" },
            { value: "retention", label: "Retención / recompra" },
            { value: "launch", label: "Lanzamiento" },
            { value: "winback", label: "Reactivación" },
          ]} />
        </Field>
        <Field label="Audiencia">
          <Input value={audience} onChange={(event) => setAudience(event.target.value)} placeholder="Ej. Clientes que no compran desde hace 60 días" />
        </Field>
        <Field label="Oferta o mensaje principal">
          <Input value={offer} onChange={(event) => setOffer(event.target.value)} placeholder="Opcional; no se inventarán descuentos" />
        </Field>
        <Field label="Empieza el">
          <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
        </Field>
        <Field label="Duración de la campaña">
          <Select value={durationDays} onChange={setDurationDays} options={[
            { value: "3", label: "3 días" }, { value: "5", label: "5 días" },
            { value: "7", label: "7 días" }, { value: "10", label: "10 días" },
            { value: "14", label: "14 días" }, { value: "21", label: "21 días" },
          ]} />
        </Field>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div>
          <p className="text-sm font-medium">Días de envío</p>
          <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Días de envío">
            {WEEK_DAYS.map((day) => (
              <Button key={day.value} size="sm" variant={selectedDays.includes(day.value) ? "primary" : "secondary"} onClick={() => toggleDay(day.value)}>{day.label}</Button>
            ))}
          </div>
        </div>
        <Field label="Número de emails">
          <Select value={numberOfEmails} onChange={setNumberOfEmails} options={["1", "2", "3", "4", "5", "6", "7"].map((value) => ({ value, label: `${value} email${value === "1" ? "" : "s"}` }))} />
        </Field>
      </div>

      <div className="mt-5">
        <Field label="Indicaciones para la IA">
          <Textarea value={instructions} onChange={(event) => setInstructions(event.target.value)} placeholder="Producto a priorizar, límites de tono, prueba social disponible o cualquier contexto de esta campaña." />
        </Field>
      </div>

      <div className="mt-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Referencias de diseño</p>
            <p className="mt-1 text-xs text-muted">{templates.length ? `${templates.length}${templateCursor ? "+" : ""} disponibles` : "Opcional"}</p>
          </div>
          {templates.length > 6 ? (
            <Input
              aria-label="Buscar plantillas de referencia"
              value={templateSearch}
              onChange={(event) => setTemplateSearch(event.target.value)}
              placeholder="Filtrar plantillas"
            />
          ) : null}
        </div>
        <div className="mt-3 max-h-44 overflow-y-auto rounded-lg border border-edge bg-surface p-2">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Plantillas de referencia">
          {visibleTemplates.map((template) => {
            const selected = selectedTemplateIds.includes(template.id);
            return (
              <Button
                key={template.id}
                type="button"
                size="sm"
                variant={selected ? "primary" : "secondary"}
                aria-pressed={selected}
                disabled={!selected && selectedTemplateIds.length >= 3}
                onClick={() => toggleTemplate(template.id)}
              >
                {template.name}
              </Button>
            );
          })}
          {visibleTemplates.length === 0 && templates.length > 0 ? (
            <p className="px-2 py-3 text-sm text-muted">No hay plantillas con ese nombre.</p>
          ) : null}
          {templates.length === 0 && !isLoadingTemplates && !templateLoadError ? (
            <p className="px-2 py-3 text-sm text-muted">
              {templateCursor
                ? "No hay referencias listas en este tramo. Carga plantillas anteriores o analiza una desde Crear."
                : "Guarda un diseño o analiza una plantilla desde Crear para reutilizarla."}
            </p>
          ) : null}
          {isLoadingTemplates && templates.length === 0 ? (
            <p className="px-2 py-3 text-sm text-muted" role="status">Cargando tus plantillas…</p>
          ) : null}
          </div>
        </div>
        <p className="mt-2 text-xs text-muted">
          Opcional. Elige hasta tres plantillas con diseño o ficha analizada. La primera con diseño editable fija la estructura visual; las fichas aportan referencias de copy, CTA y composición.
        </p>
        {templateLoadError ? (
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <p className="text-sm text-danger" role="alert">{templateLoadError}</p>
            {!templateCursor ? (
              <Button type="button" size="sm" variant="secondary" onClick={() => void loadTemplatePage(null, true)} disabled={isLoadingTemplates}>
                Reintentar
              </Button>
            ) : null}
          </div>
        ) : null}
        {templateCursor ? (
          <div className="mt-3">
            <Button type="button" size="sm" variant="secondary" onClick={() => void loadTemplatePage(templateCursor)} disabled={isLoadingTemplates}>
              {isLoadingTemplates ? "Cargando…" : "Cargar plantillas anteriores"}
            </Button>
          </div>
        ) : null}
      </div>

      <div className="mt-5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-medium">Imágenes del banco</p>
          <span className="text-xs text-muted">Opcional · solo imágenes ya analizadas</span>
        </div>
        {isLoadingImages ? <LoadingBlock label="Cargando el banco de imágenes…" /> : readyImages.length === 0 ? (
          <EmptyState title="No hay imágenes analizadas todavía" hint="Puedes crear los borradores sin imagen o analizar imágenes desde Crear." />
        ) : (
          <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4 xl:grid-cols-6">
            {readyImages.slice(0, 12).map((image) => {
              const selected = selectedImages.includes(image.public_url);
              return <button key={image.id} type="button" onClick={() => toggleImage(image.public_url)} aria-pressed={selected} className={`overflow-hidden rounded-md border text-left ${selected ? "border-accent ring-2 ring-accent/30" : "border-separator hover:border-muted"}`}>
                {/* El banco usa URLs firmadas/públicas de Supabase que pueden cambiar
                    por organización; no pasan por el optimizador de Next. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.public_url} alt="" className="aspect-square w-full object-cover" />
                <span className="block truncate px-2 py-1 text-xs">{image.original_filename}</span>
              </button>;
            })}
          </div>
        )}
      </div>

      {weeklyPlan ? (
        <section className="mt-5 rounded-lg border border-edge bg-surface p-4" aria-labelledby="mailing-strategy-title">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 id="mailing-strategy-title" className="text-base font-semibold">Revisión de estrategia · {weeklyPlan.plan_name}</h3>
              <p className="mt-1 text-sm text-muted">A27 propone el enfoque; los borradores solo se crean después de tu aprobación.</p>
            </div>
            <span className="rounded-full border border-edge px-2.5 py-1 text-xs">Confianza: {weeklyPlan.confidence}</span>
          </div>
          {!planIsCurrent ? <p className="mt-3 text-sm text-warning" role="status">Has cambiado datos de la campaña. Regenera la estrategia antes de aprobarla.</p> : null}
          <p className="mt-4 text-sm leading-6">{weeklyPlan.diagnosis}</p>
          <p className="mt-2 text-sm"><span className="font-medium">Decisión:</span> {weeklyPlan.strategy_decision}</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div><h4 className="text-sm font-semibold">Por qué encaja</h4><p className="mt-1 text-sm text-muted">{weeklyPlan.objective_rationale} {weeklyPlan.audience_rationale}</p></div>
            <div><h4 className="text-sm font-semibold">Cadencia</h4><p className="mt-1 text-sm text-muted">{weeklyPlan.cadence.recommendation} {weeklyPlan.cadence.requested_schedule_assessment}</p></div>
            <div><h4 className="text-sm font-semibold">Hipótesis y medición</h4><p className="mt-1 text-sm text-muted">{weeklyPlan.experiment.hypothesis} Métrica principal: {weeklyPlan.experiment.primary_metric}. {weeklyPlan.experiment.decision_rule}</p><p className="mt-1 text-xs text-muted">Evidencia: {weeklyPlan.experiment.evidence_status}. Diseño: {weeklyPlan.experiment.design}</p></div>
            <div><h4 className="text-sm font-semibold">Dirección visual</h4><p className="mt-1 text-sm text-muted">{weeklyPlan.visual_direction}</p></div>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div><h4 className="text-sm font-semibold">Secuencia</h4><ol className="mt-2 space-y-2">{weeklyPlan.emails.map((email) => <li key={email.sequence_number} className="rounded-md border border-edge p-3"><p className="text-sm font-medium">{email.sequence_number}. {email.title} · {email.sequence_role}</p><p className="mt-1 text-sm text-muted">{email.objective} — {email.angle}</p></li>)}</ol></div>
            <div><h4 className="text-sm font-semibold">Alternativas descartadas</h4><ul className="mt-2 space-y-2">{weeklyPlan.alternatives_rejected.map((alternative, index) => <li key={`${alternative.alternative}-${index}`} className="text-sm text-muted"><span className="font-medium text-foreground">{alternative.alternative}:</span> {alternative.reason}</li>)}</ul><h4 className="mt-4 text-sm font-semibold">Éxito y parada</h4><p className="mt-1 text-sm text-muted">Éxito: {weeklyPlan.success_criteria.join(" · ")}</p><p className="mt-1 text-sm text-muted">Parada: {weeklyPlan.stop_criteria.join(" · ")}</p></div>
          </div>
          {weeklyPlan.warnings.length ? <ul className="mt-4 list-disc pl-5 text-sm text-warning">{weeklyPlan.warnings.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}</ul> : null}
        </section>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-separator pt-4">
        <p className="text-sm text-muted">{plannedDates.length ? `${planIsCurrent ? `Al aprobar, se crearán ${plannedDates.length} borradores` : `Se proponen ${plannedDates.length} envíos`}: ${plannedDates.map((date) => date.toLocaleDateString("es-ES", { day: "numeric", month: "short" })).join(", ")}.` : "Selecciona días para preparar la secuencia."}</p>
        <div className="flex flex-col items-end gap-2">
          {sequenceStatus === "generating" ? (
            <p className="max-w-sm text-right text-xs text-muted" role="status">
              {generationLeaseExpired
                ? "La reserva superó 15 minutos. Puedes reintentar con la misma secuencia; el servidor comprobará si ya terminó."
                : "La estrategia sigue generándose. El identificador ya está guardado y podrás recuperarla al volver a abrir esta ventana."}
            </p>
          ) : sequenceStatus === "failed" ? (
            <p className="max-w-sm text-right text-xs text-warning" role="status">
              La generación anterior falló. Puedes reintentar con el mismo identificador o descartar esta secuencia.
            </p>
          ) : null}
          {isGenerating ? (
            <p className="text-xs text-muted" role="status" aria-live="polite">
              {generationProgress === 0
                ? "Diseñando la secuencia…"
                : `Borrador ${generationProgress} de ${plannedDates.length} preparado`}
            </p>
          ) : null}
          {weeklyPlan && !planIsCurrent ? <Button variant="secondary" disabled={isGenerating} onClick={() => void discardSequence()}>Descartar estrategia desactualizada</Button> : null}
          {weeklyPlan && planIsCurrent ? <Button variant="secondary" disabled={isGenerating} onClick={() => void discardSequence()}>Descartar estrategia</Button> : null}
          <Button disabled={isGenerating || isRestoringSequence ||
            (sequenceStatus === "generating" && !generationLeaseExpired) ||
            Boolean(weeklyPlan && !planIsCurrent)} onClick={() => void generate()}>
            {isRestoringSequence ? "Recuperando estrategia…" : isGenerating ? (planIsCurrent ? "Creando borradores…" : "Diseñando estrategia…") : planIsCurrent ? "Aprobar estrategia y crear borradores" : "Generar estrategia para revisar"}
          </Button>
        </div>
      </div>
      {error ? <div className="mt-4"><ErrorBlock>{error}</ErrorBlock></div> : null}
    </Card>
  );
}
