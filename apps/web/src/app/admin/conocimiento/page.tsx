"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { PlatformAdminShell } from "@/components/platform-admin-shell";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { displayValue } from "@/lib/display-labels";
import {
  Accordion,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBlock,
  Field,
  Input,
  List,
  LoadingBlock,
  Textarea,
  toast,
} from "@/components/ui";

/**
 * Metodología de plataforma: lo nuestro, no de un cliente.
 *
 * Antes se gestionaba desde /conocimiento con un selector "Destino: Global"
 * escondido dentro del formulario del consultor, y se listaba mezclada con los
 * documentos del cliente -- que además veía el propio cliente final. Aquí es
 * lo único que hay, así que no hace falta explicar de quién es cada fila.
 *
 * Sigue alimentando al copiloto de todos los clientes: lo que cambia es quién
 * puede verla y tocarla, no el retrieval.
 */

type GlobalDocument = {
  id: string;
  title: string;
  description: string | null;
  source_type: string;
  version: number;
  status: string;
  authority: string;
  created_at: string;
};

function PlatformKnowledgePanel() {
  const [documents, setDocuments] = useState<GlobalDocument[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const response = await apiFetch(
        "/v1/organizations/global/knowledge/documents",
      );
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      const payload = (await response.json()) as { documents: GlobalDocument[] };
      setDocuments(payload.documents);
      setError(null);
    } catch {
      setError("No se pudo cargar la metodología por un error de red.");
    }
  }, []);

  useEffect(() => {
    // Carga inicial desde el endpoint; no deriva de otro estado local.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function ingest(
    documentTitle: string,
    documentContent: string,
    sourceType: string,
  ) {
    setIsSaving(true);
    try {
      const response = await apiFetch(
        "/v1/organizations/global/knowledge/documents",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: documentTitle,
            content: documentContent,
            source_type: sourceType,
          }),
        },
      );
      if (!response.ok) {
        toast.danger(await readApiError(response));
        return false;
      }
      const payload = (await response.json()) as { chunk_count: number };
      toast.success(`"${documentTitle}" ingerido`, {
        description: `${payload.chunk_count} fragmentos · disponible para todos los clientes`,
      });
      await load();
      return true;
    } catch {
      toast.danger(`No se pudo ingerir "${documentTitle}" por un error de red.`);
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function handleFile(file: File) {
    let text: string;
    try {
      text = await file.text();
    } catch {
      toast.danger(`No se pudo leer "${file.name}".`);
      return;
    }
    if (!text.trim()) {
      toast.danger(`"${file.name}" está vacío o no es un archivo de texto.`);
      return;
    }
    const documentTitle =
      file.name
        .replace(/\.[^.]+$/, "")
        .replaceAll(/[-_]/g, " ")
        .trim() || file.name;
    await ingest(documentTitle, text.trim(), "upload");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim() || !content.trim()) {
      toast.danger("Título y contenido son obligatorios.");
      return;
    }
    if (await ingest(title.trim(), content.trim(), "manual")) {
      setTitle("");
      setContent("");
    }
  }

  return (
    <div className="portal-page space-y-5 sm:space-y-6">
      {error ? <ErrorBlock>{error}</ErrorBlock> : null}

      <Card
        title="Añadir a la metodología"
        description="Lo que subas aquí lo usa el copiloto de todos los clientes. Ni los consultores ni los clientes lo ven listado: para ellos, Conocimiento es solo el contexto de su tienda."
      >
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            disabled={isSaving}
            onClick={() => fileInputRef.current?.click()}
          >
            {isSaving ? "Indexando…" : "Subir documento (.txt, .md)"}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.markdown,.csv,text/plain,text/markdown"
            className="sr-only"
            disabled={isSaving}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
              event.target.value = "";
            }}
          />
        </div>

        <Accordion
          className="mt-6 border-t border-separator pt-3"
          items={[
            {
              id: "paste",
              title: "O pega el texto a mano",
              content: (
                <form className="space-y-4" onSubmit={submit}>
                  <Field label="Título">
                    <Input
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      placeholder="Ej: Criterios para escalar inversión en ads"
                    />
                  </Field>
                  <Field label="Contenido">
                    <Textarea
                      className="mt-1 h-40"
                      value={content}
                      onChange={(event) => setContent(event.target.value)}
                      placeholder="Pega aquí la metodología…"
                    />
                  </Field>
                  <Button type="submit" disabled={isSaving}>
                    Ingerir texto
                  </Button>
                </form>
              ),
            },
          ]}
        />
      </Card>

      <Card
        title={`Metodología (${documents?.length ?? 0})`}
        description="Lo que el copiloto puede citar en cualquier cliente."
      >
        {documents === null ? (
          <LoadingBlock label="Cargando metodología…" />
        ) : documents.length === 0 ? (
          <EmptyState
            title="Todavía no hay metodología"
            hint="Sube el primer playbook: es la base que comparten los copilotos de todos los clientes."
          />
        ) : (
          <List>
            {documents.map((document) => (
              <List.Item
                key={document.id}
                className="grid gap-2 px-4 py-3 md:grid-cols-[1fr_140px_120px]"
              >
                <div>
                  <p className="font-medium">{document.title}</p>
                  {document.description ? (
                    <p className="text-sm text-muted">{document.description}</p>
                  ) : null}
                </div>
                <span>
                  <Badge
                    tone={document.authority === "canonical" ? "brand" : "neutral"}
                  >
                    {displayValue(document.authority)}
                  </Badge>
                </span>
                <span className="text-xs text-muted">
                  {displayValue(document.status)} ·{" "}
                  {new Date(document.created_at).toLocaleDateString("es-ES")}
                </span>
              </List.Item>
            ))}
          </List>
        )}
      </Card>
    </div>
  );
}

export default function AdminKnowledgePage() {
  return (
    <PlatformAdminShell title="Metodología">
      {() => <PlatformKnowledgePanel />}
    </PlatformAdminShell>
  );
}
