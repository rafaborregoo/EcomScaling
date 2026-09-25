"use client";

import { useEffect, useMemo, useState } from "react";
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
  sequence_rationale: string;
  emails: Array<{
    sequence_number: number;
    title: string;
    objective: string;
    audience: string;
    angle: string;
    subject_direction: string;
    preheader_direction: string;
    cta: string;
    copy_brief: string;
  }>;
  confidence: "low" | "medium" | "high";
  warnings: string[];
};

type MailingTemplate = {
  id: string;
  name: string;
  design: Record<string, unknown>;
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
  onGenerated,
  templates,
}: {
  organizationId: string;
  onGenerated: () => Promise<void> | void;
  templates: MailingTemplate[];
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
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [images, setImages] = useState<BankImage[]>([]);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [isLoadingImages, setIsLoadingImages] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
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
  }, [organizationId]);

  const plannedDates = useMemo(
    () => scheduleDates(startDate, Number(durationDays), selectedDays, Number(numberOfEmails)),
    [durationDays, numberOfEmails, selectedDays, startDate],
  );
  const readyImages = images.filter((image) => image.status === "analyzed");
  const selectedTemplate =
    templates.find((template) => template.id === selectedTemplateId) ?? null;

  function toggleDay(day: number) {
    setSelectedDays((current) =>
      current.includes(day) ? current.filter((value) => value !== day) : [...current, day],
    );
  }

  function toggleImage(url: string) {
    setSelectedImages((current) =>
      current.includes(url) ? current.filter((value) => value !== url) : [...current, url],
    );
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
    setError(null);
    const created: string[] = [];
    try {
      // A27 decide el arco completo usando el historial y los especialistas.
      // A11 redacta despues cada pieza con este contexto, no como prompts
      // aislados que puedan repetirse o contradecirse.
      const planResponse = await apiFetch(
        `/v1/organizations/${organizationId}/marketing/weekly-mailing-plan`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            campaign_name: campaignName.trim(),
            objective,
            audience: audience.trim(),
            offer: offer.trim(),
            instructions: instructions.trim(),
            scheduled_dates: plannedDates.map(isoDate),
            ...(selectedTemplate
              ? {
                  selected_template: {
                    id: selectedTemplate.id,
                    name: selectedTemplate.name,
                    design: selectedTemplate.design,
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
      };
      const weeklyPlan = planPayload.output;
      if (!weeklyPlan || weeklyPlan.emails.length !== plannedDates.length) {
        throw new Error("El planificador no devolvio una secuencia completa. No se ha creado ningun borrador.");
      }

      for (const [index, scheduledFor] of plannedDates.entries()) {
        const emailPlan = weeklyPlan.emails.find(
          (email) => email.sequence_number === index + 1,
        );
        if (!emailPlan) {
          throw new Error("Falta un paso en la secuencia de mailing. No se ha creado el resto de borradores.");
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
            `Este es el email ${index + 1} de ${plannedDates.length}: ${emailPlan.title}.`,
            `Angulo: ${emailPlan.angle}. Objetivo: ${emailPlan.objective}. Audiencia: ${emailPlan.audience}.`,
            `Direccion de asunto: ${emailPlan.subject_direction}. Direccion de preheader: ${emailPlan.preheader_direction}. CTA: ${emailPlan.cta}.`,
            `Brief de copy obligatorio: ${emailPlan.copy_brief}`,
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
              brief,
              ...(selectedTemplate
                ? { base_design: selectedTemplate.design }
                : {}),
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
      }
      await onGenerated();
      toast.success(`${created.length} borrador${created.length === 1 ? "" : "es"} creado${created.length === 1 ? "" : "s"} y pendiente${created.length === 1 ? "" : "s"} de revisión.`);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? `${reason.message}${created.length ? ` Ya se crearon ${created.length} borradores; revísalos antes de reintentar.` : ""}`
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
        <Field label="Sistema de diseño">
          <Select
            value={selectedTemplateId}
            onChange={setSelectedTemplateId}
            options={[
              { value: "", label: "Dejar que la IA proponga el diseño" },
              ...templates.map((template) => ({
                value: template.id,
                label: template.name,
              })),
            ]}
          />
        </Field>
        <p className="mt-2 text-xs text-muted">
          Opcional. Una plantilla mantiene la estructura visual de toda la secuencia y A11 adapta sus bloques al plan de A27.
        </p>
        {templates.length === 0 ? (
          <p className="mt-2 text-xs text-muted">
            Guarda o importa una plantilla desde Crear para reutilizarla en la secuencia.
          </p>
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

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-separator pt-4">
        <p className="text-sm text-muted">{plannedDates.length ? `Se crearán ${plannedDates.length} borradores: ${plannedDates.map((date) => date.toLocaleDateString("es-ES", { day: "numeric", month: "short" })).join(", ")}.` : "Selecciona días para preparar la secuencia."}</p>
        <Button disabled={isGenerating} onClick={() => void generate()}>{isGenerating ? "Preparando borradores…" : "Preparar mailing"}</Button>
      </div>
      {error ? <div className="mt-4"><ErrorBlock>{error}</ErrorBlock></div> : null}
    </Card>
  );
}
