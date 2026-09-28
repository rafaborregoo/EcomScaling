"use client";

import { useState, type FormEvent } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  List,
  Select,
  Textarea,
  toast,
} from "@/components/ui";

type MailingDocument = {
  id: string;
  title: string;
  status: string;
  version: number;
  updated_at: string;
};

const MAILING_PREFIX = "Mailing · ";
const MAILING_CATEGORIES = [
  { value: "principios", label: "Principios y estrategia" },
  { value: "marca", label: "Voz y marca" },
  { value: "campanas", label: "Campañas" },
  { value: "flujos", label: "Flujos y automatizaciones" },
  { value: "segmentos", label: "Segmentos y audiencia" },
  { value: "entregabilidad", label: "Entregabilidad y cumplimiento" },
  { value: "ejemplos", label: "Ejemplos y resultados" },
] as const;

function mailingCategory(title: string) {
  const category = title.slice(MAILING_PREFIX.length).split(" · ")[0];
  return MAILING_CATEGORIES.find((item) => item.label === category)?.value ?? "principios";
}

function mailingTitle(category: string, title: string) {
  const label = MAILING_CATEGORIES.find((item) => item.value === category)?.label;
  return `${MAILING_PREFIX}${label ?? "Principios y estrategia"} · ${title}`;
}

export function MailingSection({
  organizationId,
  canManage,
  documents,
  onSaved,
}: {
  organizationId: string;
  canManage: boolean;
  documents: MailingDocument[];
  onSaved: () => void;
}) {
  const mailingDocuments = documents
    .filter((document) => document.title.startsWith(MAILING_PREFIX))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  const [category, setCategory] = useState<string>(MAILING_CATEGORIES[0].value);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [editing, setEditing] = useState<MailingDocument | null>(null);
  const [isLoadingDocument, setIsLoadingDocument] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  function resetForm() {
    setCategory(MAILING_CATEGORIES[0].value);
    setTitle("");
    setContent("");
    setEditing(null);
  }

  async function editDocument(document: MailingDocument) {
    setIsLoadingDocument(true);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/knowledge/documents/${document.id}`,
      );
      if (!response.ok) {
        toast.danger(await readApiError(response));
        return;
      }
      const body = (await response.json()) as {
        document: { content: string };
      };
      setEditing(document);
      setCategory(mailingCategory(document.title));
      setTitle(document.title.slice(MAILING_PREFIX.length).split(" · ").slice(1).join(" · "));
      setContent(body.document.content);
    } catch {
      toast.danger("No se pudo cargar el contenido de mailing. Reintenta.");
    } finally {
      setIsLoadingDocument(false);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organizationId || !title.trim() || !content.trim()) return;
    setIsSaving(true);
    try {
      const response = await apiFetch(
        editing
          ? `/v1/organizations/${organizationId}/knowledge/documents/${editing.id}`
          : `/v1/organizations/${organizationId}/knowledge/documents`,
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            editing
              ? { content: content.trim() }
              : {
                  title: mailingTitle(category, title.trim()),
                  content: content.trim(),
                  source_type: "manual",
                  audience: "client_visible",
                },
          ),
        },
      );
      if (!response.ok) {
        toast.danger(await readApiError(response));
        return;
      }
      const result = (await response.json()) as { chunk_count?: number; version?: number };
      toast.success(editing ? "Información de mailing actualizada e indexada." : "Información de mailing guardada e indexada.", {
        description: result.chunk_count
          ? `${result.chunk_count} fragmentos disponibles para búsqueda.`
          : undefined,
      });
      resetForm();
      onSaved();
    } catch {
      toast.danger("No se pudo guardar la información de mailing. Reintenta.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card
        title="Conocimiento de mailing"
        description="Añade estrategia, tono, segmentos, campañas, flujos, ejemplos y reglas de cumplimiento. Cada nota se indexa para que los agentes la encuentren al analizar o crear emails."
      >
        {canManage ? (
          <form className="space-y-4" onSubmit={(event) => void save(event)}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Tema">
                <Select
                  className="mt-2"
                  value={category}
                  onChange={(value) => setCategory(value)}
                  options={MAILING_CATEGORIES.map((item) => ({
                    value: item.value,
                    label: item.label,
                  }))}
                  disabled={Boolean(editing)}
                />
              </Field>
              <Field label="Título de esta nota">
                <Input
                  className="mt-2"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Ej.: Bienvenida a nuevos suscriptores"
                  required
                  disabled={Boolean(editing)}
                />
              </Field>
            </div>
            <Field label="Información para el copiloto y los agentes">
              <Textarea
                className="mt-2"
                rows={10}
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder={
                  "Objetivo y contexto:\nAudiencia y exclusiones:\nTono y palabras de marca:\nOferta o propuesta de valor:\nEstructura y llamada a la acción:\nFrecuencia y momento de envío:\nQué evitar / requisitos legales:\nEjemplos y resultados conocidos:"
                }
                required
              />
            </Field>
            <p className="text-xs text-muted">
              Se guardará como conocimiento visible para el cliente y los agentes, y quedará disponible en la búsqueda semántica.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={isSaving || isLoadingDocument}>
                {isSaving ? "Indexando…" : editing ? "Guardar cambios" : "Guardar en Conocimiento"}
              </Button>
              {editing ? (
                <Button type="button" variant="secondary" onClick={resetForm} disabled={isSaving}>
                  Cancelar edición
                </Button>
              ) : null}
            </div>
          </form>
        ) : (
          <p className="text-sm text-muted">
            Puedes consultar estas notas. Para añadir o editar información, pide acceso a un propietario, manager o consultor.
          </p>
        )}
      </Card>

      <Card
        title={`Información de mailing (${mailingDocuments.length})`}
        description="Cada nota se conserva como documento independiente y se puede actualizar sin perder la búsqueda semántica."
      >
        {mailingDocuments.length === 0 ? (
          <EmptyState
            title="Todavía no hay información de mailing"
            hint="Empieza con la voz de marca, los objetivos del canal o una campaña que ya os funcione."
          />
        ) : (
          <List>
            {mailingDocuments.map((document) => (
              <List.Item
                key={document.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="font-medium">{document.title.slice(MAILING_PREFIX.length)}</p>
                  <p className="mt-1 text-xs text-muted">
                    Actualizado {new Date(document.updated_at).toLocaleDateString("es-ES")} · versión {document.version}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {document.status !== "active" ? <Badge tone="neutral">{document.status}</Badge> : null}
                  {canManage && document.status === "active" ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={isLoadingDocument || isSaving}
                      onClick={() => void editDocument(document)}
                    >
                      Editar
                    </Button>
                  ) : null}
                </div>
              </List.Item>
            ))}
          </List>
        )}
      </Card>
    </div>
  );
}
