"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
import { apiFetch, type BootstrapResponse } from "@/lib/bootstrap";
import { AiDiagnosticSection } from "@/components/ai-diagnostic-section";

type KnowledgeDocument = {
  id: string;
  organization_id: string | null;
  title: string;
  description: string | null;
  source_type: string;
  visibility: "global" | "organization";
  version: number;
  status: string;
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

async function readApiError(response: Response) {
  const body = (await response.json().catch(() => null)) as
    | { error?: string; message?: string; detail?: string }
    | null;
  return [body?.error ?? `HTTP ${response.status}`, body?.message, body?.detail]
    .filter(Boolean)
    .join(" - ");
}

function KnowledgeContent({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const { organizationId } = useActiveOrganization();
  const isPlatformAdmin = bootstrap.profile.platform_role === "platform_admin";

  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [visibility, setVisibility] = useState<"organization" | "global">("organization");
  const [isSaving, setIsSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [matches, setMatches] = useState<KnowledgeMatch[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const loadDocuments = useCallback(async () => {
    if (!organizationId) {
      return;
    }

    setIsLoading(true);
    const response = await apiFetch(`/v1/organizations/${organizationId}/knowledge/documents`);

    if (!response.ok) {
      setError(await readApiError(response));
      setIsLoading(false);
      return;
    }

    const payload = (await response.json()) as { documents: KnowledgeDocument[] };
    setDocuments(payload.documents);
    setError(null);
    setIsLoading(false);
  }, [organizationId]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  async function ingestDocument(documentTitle: string, documentContent: string, sourceType: string) {
    setIsSaving(true);
    setSaveFeedback(null);

    const targetPath =
      visibility === "global"
        ? "/v1/organizations/global/knowledge/documents"
        : `/v1/organizations/${organizationId}/knowledge/documents`;

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
      setSaveFeedback(await readApiError(response));
      setIsSaving(false);
      return false;
    }

    const payload = (await response.json()) as { chunk_count: number };
    setSaveFeedback(`"${documentTitle}" ingerido (${payload.chunk_count} fragmentos indexados).`);
    setIsSaving(false);
    void loadDocuments();
    return true;
  }

  // Subida con un boton: el titulo sale del nombre del archivo y el contenido
  // se lee en el navegador. Sin formularios que rellenar.
  async function handleFileUpload(file: File) {
    const text = await file.text();

    if (!text.trim()) {
      setSaveFeedback(`"${file.name}" esta vacio o no es un archivo de texto.`);
      return;
    }

    const documentTitle = file.name.replace(/\.[^.]+$/, "").replaceAll(/[-_]/g, " ").trim() || file.name;
    await ingestDocument(documentTitle, text.trim(), "upload");
  }

  async function submitDocument(event: FormEvent) {
    event.preventDefault();

    if (!title.trim() || !content.trim()) {
      setSaveFeedback("Título y contenido son obligatorios.");
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

    const response = await apiFetch(`/v1/organizations/${organizationId}/knowledge/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: searchQuery.trim() }),
    });

    if (!response.ok) {
      setSearchError(await readApiError(response));
      setMatches(null);
      setIsSearching(false);
      return;
    }

    const payload = (await response.json()) as { matches: KnowledgeMatch[] };
    setMatches(payload.matches);
    setIsSearching(false);
  }

  return (
    <div className="space-y-6">
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

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="border-t border-ink/20 pt-5">
          <h4 className="font-display text-2xl">Añadir documento</h4>

          <div className="mt-4 flex flex-wrap items-center gap-4">
            <label className="cursor-pointer bg-black px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand">
              {isSaving ? "Indexando..." : "Subir documento (.txt, .md)"}
              <input
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
            </label>
            {isPlatformAdmin ? (
              <label className="flex items-baseline gap-2 font-mono text-xs uppercase tracking-wide text-muted">
                Destino
                <select
                  className="cursor-pointer rounded-none border-0 border-b border-edge-strong bg-transparent px-0 py-1 font-sans text-sm normal-case tracking-normal text-black outline-none transition-colors focus:border-ink"
                  value={visibility}
                  onChange={(event) => setVisibility(event.target.value as "organization" | "global")}
                >
                  <option value="organization">Esta organización</option>
                  <option value="global">Global (metodología)</option>
                </select>
              </label>
            ) : null}
          </div>

          {saveFeedback ? <p className="mt-3 text-sm text-muted">{saveFeedback}</p> : null}

          <details className="mt-5 border-t border-line pt-3">
            <summary className="cursor-pointer text-sm text-muted transition hover:text-black">
              O pega el texto a mano
            </summary>
            <form className="mt-3 space-y-4" onSubmit={submitDocument}>
              <label className="block">
                <span className="block font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">
                  Título
                </span>
                <input
                  className="w-full rounded-none border-0 border-b border-edge-strong bg-transparent px-0 py-2 text-sm outline-none transition-colors focus:border-ink"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Ej: Playbook de reposición de stock"
                />
              </label>
              <label className="block">
                <span className="block font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">
                  Contenido
                </span>
                <textarea
                  className="mt-1 h-40 w-full rounded-none border border-edge-strong bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-ink"
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  placeholder="Pega aquí la metodología, guía o proceso..."
                />
              </label>
              <button
                className="bg-black px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand disabled:opacity-50"
                type="submit"
                disabled={isSaving}
              >
                Ingerir texto
              </button>
            </form>
          </details>
        </section>

        <section className="border-t border-ink/20 pt-5">
          <h4 className="font-display text-2xl">Búsqueda semántica</h4>
          <form className="mt-4 flex items-end gap-4" onSubmit={submitSearch}>
            <input
              className="w-full rounded-none border-0 border-b border-edge-strong bg-transparent px-0 py-2 text-sm outline-none transition-colors focus:border-ink"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Ej: cuándo escalar inversión en ads"
            />
            <button
              className="bg-black px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand disabled:opacity-50"
              type="submit"
              disabled={isSearching}
            >
              {isSearching ? "..." : "Buscar"}
            </button>
          </form>
          {searchError ? (
            <p className="mt-3 text-sm text-brand-deep">{searchError}</p>
          ) : null}
          {matches !== null && !searchError ? (
            <div className="mt-3 space-y-2">
              {matches.length === 0 ? (
                <p className="text-sm text-muted">Sin resultados.</p>
              ) : (
                matches.map((match) => (
                  <article key={match.chunk_id} className="border-t border-line pt-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{match.document_title}</p>
                      <span className="font-mono text-xs text-muted">
                        {(match.similarity * 100).toFixed(0)}%
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {match.visibility === "global" ? "Global" : "Organización"} - fragmento{" "}
                      {match.chunk_index + 1}
                    </p>
                    <p className="mt-2 text-sm leading-6">{match.content.slice(0, 400)}</p>
                  </article>
                ))
              )}
            </div>
          ) : null}
        </section>
      </div>

      <section className="border-t border-ink/20">
        <div className="border-b border-line px-4 py-3">
          <h4 className="font-display text-xl">Documentos ({documents.length})</h4>
        </div>
        {error ? (
          <p className="px-4 py-3 text-sm text-brand-deep">{error}</p>
        ) : isLoading ? (
          <p className="px-4 py-3 text-sm text-muted">Cargando documentos...</p>
        ) : documents.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted">
            Aún no hay documentos. Ingiere el primero con el formulario de arriba.
          </p>
        ) : (
          <div className="divide-y divide-line">
            {documents.map((document) => (
              <div key={document.id} className="grid gap-2 px-4 py-3 md:grid-cols-[1fr_140px_110px_170px]">
                <div>
                  <p className="font-medium">{document.title}</p>
                  {document.description ? (
                    <p className="text-sm text-muted">{document.description}</p>
                  ) : null}
                </div>
                <span className="font-mono text-xs text-muted">
                  {document.visibility === "global" ? "global" : "organización"}
                </span>
                <span className="font-mono text-xs text-muted">{document.status}</span>
                <span className="font-mono text-xs text-muted">
                  {new Date(document.created_at).toLocaleDateString("es-ES")}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
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
