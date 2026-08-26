"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
import { apiFetch, type BootstrapResponse } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { displayValue } from "@/lib/display-labels";
import { AiDiagnosticSection } from "@/components/ai-diagnostic-section";
import {
    LoadingBlock,
  Heading,
  Accordion,
  Button,
  Card,
  EmptyState,
  ErrorBlock,
  Field,
  Input,
  Select,
  Textarea,
  toast,
} from "@/components/ui";

type KnowledgeDocument = {
  id: string;
  organization_id: string | null;
  title: string;
  description: string | null;
  source_type: string;
  visibility: "global" | "organization";
  version: number;
  status: string;
  audience: "client_visible" | "consultant_only" | "system_only";
  origin: "human_authored" | "human_approved_ai" | "human_decision";
  authority: "canonical" | "operational" | "contextual";
  created_at: string;
  updated_at: string;
};

type KnowledgeMatch = {
  chunk_id: string;
  document_id: string;
  document_title: string;
  visibility: string;
  chunk_index: number;
  content: string;
  similarity: number;
};

function KnowledgeContent({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const { organizationId } = useActiveOrganization();
  const isPlatformAdmin = bootstrap.profile.platform_role === "platform_admin";
  const activeMembership = bootstrap.memberships.find(
    (membership) => membership.organization_id === organizationId,
  );
  const canManageKnowledge =
    ["platform_admin", "consultant"].includes(
      bootstrap.profile.platform_role,
    ) || ["owner", "manager"].includes(activeMembership?.role ?? "");

  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [documentView, setDocumentView] = useState<"workspace" | "memory">(
    "workspace",
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [visibility, setVisibility] = useState<"organization" | "global">(
    "organization",
  );
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [matches, setMatches] = useState<KnowledgeMatch[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const loadDocuments = useCallback(async () => {
    if (!organizationId) {
      setDocuments([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/knowledge/documents`,
      );

      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }

      const payload = (await response.json()) as {
        documents: KnowledgeDocument[];
      };
      setDocuments(payload.documents);
      setError(null);
    } catch {
      setError(
        "No se pudieron cargar los documentos por un error de red. Reintenta.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    // Este efecto sincroniza la vista con el endpoint remoto al montar; no es
    // una actualización derivada de otro estado local.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadDocuments();
  }, [loadDocuments]);

  const workspaceDocuments = documents.filter(
    (document) => document.origin === "human_authored",
  );
  const generatedMemory = documents.filter(
    (document) => document.origin !== "human_authored",
  );
  const visibleDocuments =
    documentView === "workspace" ? workspaceDocuments : generatedMemory;

  async function ingestDocument(
    documentTitle: string,
    documentContent: string,
    sourceType: string,
  ) {
    setIsSaving(true);

    const targetPath =
      visibility === "global"
        ? "/v1/organizations/global/knowledge/documents"
        : `/v1/organizations/${organizationId}/knowledge/documents`;
    try {
      const response = await apiFetch(targetPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: documentTitle,
          content: documentContent,
          source_type: sourceType,
        }),
      });

      if (!response.ok) {
        toast.danger(await readApiError(response));
        return false;
      }

      const payload = (await response.json()) as { chunk_count: number };
      toast.success(`"${documentTitle}" ingerido`, {
        description: `${payload.chunk_count} fragmentos indexados`,
      });
      void loadDocuments();
      return true;
    } catch {
      toast.danger(
        `No se pudo ingerir "${documentTitle}" por un error de red. Reintenta.`,
      );
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  // Subida con un boton: el titulo sale del nombre del archivo y el contenido
  // se lee en el navegador. Sin formularios que rellenar.
  async function handleFileUpload(file: File) {
    let text: string;
    try {
      text = await file.text();
    } catch {
      toast.danger(
        `No se pudo leer "${file.name}". Comprueba que sea un archivo de texto válido.`,
      );
      return;
    }

    if (!text.trim()) {
      toast.danger(`"${file.name}" esta vacio o no es un archivo de texto.`);
      return;
    }

    const documentTitle =
      file.name
        .replace(/\.[^.]+$/, "")
        .replaceAll(/[-_]/g, " ")
        .trim() || file.name;
    await ingestDocument(documentTitle, text.trim(), "upload");
  }

  async function submitDocument(event: FormEvent) {
    event.preventDefault();

    if (!title.trim() || !content.trim()) {
      toast.danger("Título y contenido son obligatorios.");
      return;
    }

    const saved = await ingestDocument(title.trim(), content.trim(), "manual");

    if (saved) {
      setTitle("");
      setContent("");
    }
  }

  async function submitSearch(event: FormEvent) {
    event.preventDefault();

    if (!searchQuery.trim() || !organizationId) {
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/knowledge/search`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: searchQuery.trim() }),
        },
      );

      if (!response.ok) {
        setSearchError(await readApiError(response));
        setMatches(null);
        return;
      }

      const payload = (await response.json()) as {
        matches: KnowledgeMatch[];
      };
      setMatches(payload.matches);
    } catch {
      setSearchError(
        "No se pudo buscar en el conocimiento por un error de red. Reintenta.",
      );
      setMatches(null);
    } finally {
      setIsSearching(false);
    }
  }

  return (
    <div className="portal-page space-y-8">
      {organizationId ? (
        <AiDiagnosticSection
          organizationId={organizationId}
          title="Gestor de conocimiento IA"
          getPath="/ai/knowledge-manager"
          runPath="/ai/knowledge-manager-run"
          loadingLabel="Revisando el catalogo de conocimiento con IA..."
          tasksLabelSingular="tarea de redacción"
        />
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <Heading level={3} size="lg">
            Añadir documento
          </Heading>

          {canManageKnowledge ? (
            <>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  disabled={isSaving}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {isSaving ? "Indexando..." : "Subir documento (.txt, .md)"}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.md,.markdown,.csv,text/plain,text/markdown"
                  className="sr-only"
                  disabled={isSaving}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      void handleFileUpload(file);
                    }
                    event.target.value = "";
                  }}
                />
                {isPlatformAdmin ? (
                  <div className="flex items-baseline gap-2 font-mono text-xs uppercase tracking-wide text-muted">
                    Destino
                    <Select
                      aria-label="Destino"
                      className="font-sans normal-case tracking-normal text-black"
                      value={visibility}
                      onChange={(value) =>
                        setVisibility(value as "organization" | "global")
                      }
                      options={[
                        { value: "organization", label: "Esta organización" },
                        { value: "global", label: "Global (metodología)" },
                      ]}
                    />
                  </div>
                ) : null}
              </div>

              <Accordion
                className="mt-5 border-t border-line pt-3"
                items={[
                  {
                    id: "paste-form",
                    title: "O pega el texto a mano",
                    content: (
                      <form className="space-y-4" onSubmit={submitDocument}>
                        <Field label="Título">
                          <Input
                            value={title}
                            onChange={(event) => setTitle(event.target.value)}
                            placeholder="Ej: Playbook de reposición de stock"
                          />
                        </Field>
                        <Field label="Contenido">
                          <Textarea
                            className="mt-1 h-40"
                            value={content}
                            onChange={(event) => setContent(event.target.value)}
                            placeholder="Pega aquí la metodología, guía o proceso..."
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
            </>
          ) : (
            <div className="mt-4 rounded-md border border-line bg-surface px-4 py-4 text-sm leading-6 text-muted">
              Solo los propietarios, managers, consultores y administradores de
              plataforma pueden añadir o indexar documentos. Puedes consultar el
              conocimiento y utilizar la búsqueda semántica.
            </div>
          )}
        </Card>

        <Card>
          <Heading level={3} size="lg">
            Búsqueda semántica
          </Heading>
          <form
            className="mt-5 flex flex-col items-stretch gap-3 sm:flex-row sm:items-end"
            onSubmit={submitSearch}
          >
            <Input
              className="w-full"
              aria-label="Buscar en el conocimiento"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Ej: cuándo escalar inversión en ads"
            />
            <Button type="submit" disabled={isSearching}>
              {isSearching ? "..." : "Buscar"}
            </Button>
          </form>
          {searchError ? (
            <div className="mt-3">
              <ErrorBlock>{searchError}</ErrorBlock>
            </div>
          ) : null}
          {matches !== null && !searchError ? (
            <div className="mt-3 space-y-2">
              {matches.length === 0 ? (
                <p className="text-sm text-muted">Sin resultados.</p>
              ) : (
                matches.map((match) => (
                  <article
                    key={match.chunk_id}
                    className="border-t border-line pt-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">
                        {match.document_title}
                      </p>
                      <span className="font-mono text-xs text-muted">
                        {(match.similarity * 100).toFixed(0)}%
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {match.visibility === "global"
                        ? "Global"
                        : "Organización"}{" "}
                      - fragmento {match.chunk_index + 1}
                    </p>
                    <p className="mt-2 text-sm leading-6">
                      {match.content.slice(0, 400)}
                    </p>
                  </article>
                ))
              )}
            </div>
          ) : null}
        </Card>
      </div>

      <Card>
        <div className="border-b border-line px-4 py-3">
          <Heading level={3} size="md">
            Documentos ({documents.length})
          </Heading>
        </div>
        <div className="flex flex-wrap gap-2 border-b border-line px-4 py-3">
          <Button
            type="button"
            variant={documentView === "workspace" ? "primary" : "secondary"}
            onClick={() => setDocumentView("workspace")}
          >
            Workspace ({workspaceDocuments.length})
          </Button>
          <Button
            type="button"
            variant={documentView === "memory" ? "primary" : "secondary"}
            onClick={() => setDocumentView("memory")}
          >
            Memoria ({generatedMemory.length})
          </Button>
        </div>
        {error ? (
          <div className="px-4 py-3">
            <ErrorBlock>{error}</ErrorBlock>
          </div>
        ) : isLoading ? (
          <div className="px-4 py-3">
                <LoadingBlock label="Cargando documentos..." />
          </div>
        ) : documents.length === 0 ? (
          <EmptyState
            title="Aún no hay documentos"
            hint="Ingiere el primero con el formulario de arriba para activar el conocimiento del workspace."
          />
        ) : (
          <div className="divide-y divide-line">
            {visibleDocuments.map((document) => (
              <div
                key={document.id}
                className="grid gap-2 px-4 py-3 md:grid-cols-[1fr_140px_110px_170px]"
              >
                <div>
                  <p className="font-medium">{document.title}</p>
                  {document.description ? (
                    <p className="text-sm text-muted">{document.description}</p>
                  ) : null}
                </div>
                <span className="font-mono text-xs text-muted">
                  {document.visibility === "global" ? "global" : "organización"}
                </span>
                <span className="font-mono text-xs text-muted">
                  {displayValue(document.status)} · {displayValue(document.authority)}
                </span>
                <span className="font-mono text-xs text-muted">
                  {new Date(document.created_at).toLocaleDateString("es-ES")}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

export default function KnowledgePage() {
  return (
    <PortalShell title="Conocimiento">
      {(bootstrap) => <KnowledgeContent bootstrap={bootstrap} />}
    </PortalShell>
  );
}
