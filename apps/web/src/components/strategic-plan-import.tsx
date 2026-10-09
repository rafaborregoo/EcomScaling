"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import {
  Accordion,
  Banner,
  ButtonLink,
  Dialog,
  ErrorBlock,
  Metric,
  UploadButton,
  toast,
} from "@/components/ui";

type Preview = {
  ok: boolean;
  data?: {
    name: string;
    description?: string | null;
    phases: Array<{
      name: string;
      milestones: Array<{
        name: string;
        tasks: Array<{ title: string }>;
      }>;
    }>;
  };
  errors: Array<{ line: number; message: string }>;
  warnings: Array<{ line: number; message: string }>;
  counts: { phases: number; milestones: number; tasks: number };
  fileName?: string | null;
};

export function StrategicPlanImport({
  organizationId,
  connectionId,
  onImported,
}: {
  organizationId: string;
  /** Tienda para la que se importa el camino; sin ella, el camino general. */
  connectionId?: string | null;
  onImported: () => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [markdown, setMarkdown] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function previewFile(file: File) {
    setError(null);
    if (!file.name.toLowerCase().endsWith(".md")) {
      setError("Selecciona un archivo .md con la plantilla de Mi Camino.");
      return;
    }
    try {
      const content = await file.text();
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/strategic-plan/import/preview`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ markdown: content, fileName: file.name }),
        },
      );
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      setMarkdown(content);
      setPreview((await response.json()) as Preview);
      setOpen(true);
    } catch {
      setError(
        "No se pudo leer el archivo. Comprueba que sea un Markdown válido.",
      );
    }
  }

  async function importPlan() {
    if (!preview?.ok || !markdown) return;
    setSaving(true);
    setError(null);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/strategic-plan/import`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ markdown, fileName: preview.fileName, connectionId: connectionId || null }),
        },
      );
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      setOpen(false);
      setPreview(null);
      setMarkdown("");
      toast.success("Camino importado como borrador.");
      await onImported();
    } catch {
      setError("No se pudo importar el camino. Reintenta.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <UploadButton
          accept=".md,text/markdown,text/plain"
          variant="secondary"
          onFile={previewFile}
        >
          Importar .md
        </UploadButton>
        <ButtonLink
          href="/plantilla-mi-camino.md"
          download="plantilla-mi-camino.md"
          variant="secondary"
        >
          Descargar plantilla
        </ButtonLink>
      </div>
      {error && !open ? (
        <p className="mt-2 text-sm text-danger">{error}</p>
      ) : null}
      <Dialog
        isOpen={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !saving) setOpen(false);
        }}
        size="lg"
        title="Revisar camino importado"
        isBusy={saving}
        primary={{
          label: "Crear camino",
          busyLabel: "Importando…",
          disabled: !preview?.ok,
          onClick: () => void importPlan(),
        }}
      >
        {error ? <ErrorBlock>{error}</ErrorBlock> : null}
        {preview?.ok && preview.data ? (
          <>
            <div>
              {preview.fileName ? (
                <p className="text-xs text-muted">{preview.fileName}</p>
              ) : null}
              <p className="text-sm font-medium text-ink">{preview.data.name}</p>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Metric size="sm" label="Fases" value={preview.counts.phases} />
              <Metric size="sm" label="Hitos" value={preview.counts.milestones} />
              <Metric size="sm" label="Tareas" value={preview.counts.tasks} />
            </div>
            <Accordion
              items={preview.data.phases.map((phase) => ({
                id: phase.name,
                title: phase.name,
                content: (
                  <ul className="list-disc space-y-1 pl-4 text-muted">
                    {phase.milestones.map((milestone) => (
                      <li key={milestone.name}>
                        {milestone.name}
                        {milestone.tasks.length > 0
                          ? ` · ${milestone.tasks.length} tareas`
                          : ""}
                      </li>
                    ))}
                  </ul>
                ),
              }))}
            />
            {preview.warnings.length > 0 ? (
              <Banner tone="warn">
                {preview.warnings.map((warning) => (
                  <span key={`${warning.line}-${warning.message}`} className="block">
                    {warning.message}
                  </span>
                ))}
              </Banner>
            ) : null}
          </>
        ) : (
          <ErrorBlock>
            <ul className="space-y-1">
              {(preview?.errors ?? []).map((issue) => (
                <li key={`${issue.line}-${issue.message}`}>
                  Línea {issue.line}: {issue.message}
                </li>
              ))}
            </ul>
          </ErrorBlock>
        )}
      </Dialog>
    </>
  );
}
