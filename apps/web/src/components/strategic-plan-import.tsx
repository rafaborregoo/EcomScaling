"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import {
  Button,
  ButtonLink,
  ErrorBlock,
  Modal,
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
  onImported,
}: {
  organizationId: string;
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
          body: JSON.stringify({ markdown, fileName: preview.fileName }),
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
      <Modal
        isOpen={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !saving) setOpen(false);
        }}
      >
        <Modal.Backdrop isDismissable={!saving}>
          <Modal.Container size="lg">
            <Modal.Dialog aria-label="Revisar importación de Mi Camino">
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>Revisar camino importado</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <div className="space-y-4">
                  {error ? <ErrorBlock>{error}</ErrorBlock> : null}
                  {preview?.fileName ? (
                    <p className="text-sm text-muted">{preview.fileName}</p>
                  ) : null}
                  {preview?.ok && preview.data ? (
                    <>
                      <div>
                        <p className="text-lg font-semibold">
                          {preview.data.name}
                        </p>
                        <p className="text-sm text-muted">
                          {preview.counts.phases} fases ·{" "}
                          {preview.counts.milestones} hitos ·{" "}
                          {preview.counts.tasks} tareas
                        </p>
                      </div>
                      <ul className="space-y-3 text-sm">
                        {preview.data.phases.map((phase) => (
                          <li key={phase.name}>
                            <p className="font-semibold">{phase.name}</p>
                            <ul className="ml-4 mt-1 list-disc space-y-1 text-muted">
                              {phase.milestones.map((milestone) => (
                                <li key={milestone.name}>
                                  {milestone.name}
                                  {milestone.tasks.length > 0
                                    ? ` · ${milestone.tasks.length} tareas`
                                    : ""}
                                </li>
                              ))}
                            </ul>
                          </li>
                        ))}
                      </ul>
                      {preview.warnings.length > 0 ? (
                        <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">
                          {preview.warnings.map((warning) => (
                            <p key={`${warning.line}-${warning.message}`}>
                              {warning.message}
                            </p>
                          ))}
                        </div>
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
                </div>
              </Modal.Body>
              <Modal.Footer>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={saving}
                  onClick={() => setOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  disabled={saving || !preview?.ok}
                  onClick={() => void importPlan()}
                >
                  {saving ? "Importando..." : "Crear camino"}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </>
  );
}
