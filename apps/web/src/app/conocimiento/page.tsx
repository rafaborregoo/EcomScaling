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
import { ModuleSummary } from "@/components/module-summary";
import { ClientRules } from "./client-rules";
import {
  LoadingBlock,
  Heading,
  Accordion,
  Badge,
  Button,
  Banner,
  Card,
  EmptyState,
  ErrorBlock,
  Field,
  Input,
  List,
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
  /**
   * Puntuacion de fusion RRF: decide el ORDEN, pero su escala es ~0.03 y no
   * significa nada para una persona. No la pintes como porcentaje.
   */
  similarity: number;
  /** Similitud coseno 0..1: esto si se puede leer como "cuanto se parece". */
  semantic_similarity?: number;
};

function KnowledgeContent({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const { organizationId } = useActiveOrganization();
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
  // Quién puede leer lo que se sube. `consultant_only` no llega nunca al
  // cliente ni a los agentes automáticos; sí al Consultor IA cuando pregunta
  // un consultor. Solo consultor/platform_admin pueden marcarlo (el backend
  // lo vuelve a comprobar).
  const canMarkInternal = ["platform_admin", "consultant"].includes(
    bootstrap.profile.platform_role,
  );
  const [audience, setAudience] = useState<
    "client_visible" | "consultant_only"
  >("client_visible");
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

    // Siempre el cliente activo. La metodología de plataforma (`global`) se
    // ingiere desde /admin/conocimiento: es nuestra, no de este cliente.
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/knowledge/documents`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: documentTitle,
            content: documentContent,
            source_type: sourceType,
            audience,
          }),
        },
      );

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
    <div className="portal-page space-y-6 sm:space-y-8">
      {/* El modelo entero en dos frases. Sin esto, "regla" y "documento" son
          dos formularios parecidos y nadie sabe cuál usar: la diferencia no es
          de formato, es de si el copiloto lo tiene siempre o solo a veces. */}
      <div>
        <Heading>Lo que el copiloto sabe de este cliente</Heading>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Las <strong>reglas</strong> las tiene delante en cada respuesta. Los{" "}
          <strong>documentos</strong> los usa cuando la conversación los pide.
        </p>
      </div>

      {/* Qué sabe realmente el Consultor IA de este cliente, y qué parte de
          eso ve también el cliente. `search_knowledge` devuelve los internos
          solo cuando quien pregunta es un consultor; los agentes automáticos
          nunca los ven. Esa diferencia se decide al subir el documento y se
          comprueba aquí, no abriendo la lista uno a uno. */}
      {documents.length > 0 ? (
        <ModuleSummary
          metrics={[
            {
              label: "Documentos activos",
              value: documents
                .filter((document) => document.status === "active")
                .length.toLocaleString("es-ES"),
            },
            {
              label: "Los ve el cliente",
              value: documents
                .filter(
                  (document) =>
                    document.status === "active" &&
                    document.audience === "client_visible",
                )
                .length.toLocaleString("es-ES"),
            },
            {
              label: "Internos del consultor",
              value: documents
                .filter(
                  (document) =>
                    document.status === "active" &&
                    document.audience === "consultant_only",
                )
                .length.toLocaleString("es-ES"),
              hint: "Fuera del portal del cliente y de los agentes automáticos",
            },
          ]}
        />
      ) : null}

      {/* Primero las reglas y después los documentos, porque ese es el orden
          del modelo: lo que el copiloto tiene SIEMPRE delante, y luego lo que
          usa si la conversación lo pide. */}
      {organizationId ? (
        <ClientRules
          organizationId={organizationId}
          canManage={canManageKnowledge}
        />
      ) : null}

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
        <Card
          title="Añadir documento"
          description="Playbooks, procesos y contexto de este cliente. El copiloto los usa cuando la conversación los pide, a diferencia de una regla."
        >

          {canManageKnowledge ? (
            <>
              <div className="mt-6 flex flex-wrap items-center gap-3">
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
                {canMarkInternal ? (
                  <Field label="Quién puede leerlo">
                    <Select
                      aria-label="Quién puede leerlo"
                      className="mt-2"
                      value={audience}
                      onChange={(value) =>
                        setAudience(
                          value as "client_visible" | "consultant_only",
                        )
                      }
                      options={[
                        { value: "client_visible", label: "Cliente y agentes" },
                        {
                          value: "consultant_only",
                          label: "Solo consultores",
                        },
                      ]}
                    />
                    {audience === "consultant_only" ? (
                      <p className="mt-1 text-xs text-muted">
                        No aparece en el portal del cliente ni en las salidas
                        de los agentes automáticos. El Consultor IA sí lo usa
                        cuando pregunta un consultor.
                      </p>
                    ) : null}
                  </Field>
                ) : null}
              </div>

              <Accordion
                className="mt-6 border-t border-separator pt-3"
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
            <Banner tone="warn" className="mt-4 text-sm">
              Solo los propietarios, managers, consultores y administradores de
              plataforma pueden añadir o indexar documentos. Puedes consultar el
              conocimiento y utilizar la búsqueda semántica.
            </Banner>
          )}
        </Card>

        {/* Se llamaba "búsqueda semántica" y describía la implementación. Lo
            que responde es otra cosa: qué encontrará el copiloto si le
            preguntan esto. */}
        <Card
          title="Probar qué encontrará el copiloto"
          description="Escribe una pregunta como se la haría el cliente y mira qué documentos suyos saldrían."
        >
          <form
            className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-end"
            onSubmit={submitSearch}
          >
            <Field label="Consulta">
              <Input
                className="mt-2 w-full"
                aria-label="Buscar en el conocimiento"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Ej: cuándo escalar inversión en ads"
              />
            </Field>
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
                    className="border-t border-separator pt-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">
                        {match.document_title}
                      </p>
                      {/* El porcentaje sale de la similitud semantica, no del
                          score de fusion: desde que el orden lo decide RRF,
                          `similarity` vive en ~0.03 y se pintaba como "3%". */}
                      {match.semantic_similarity !== undefined ? (
                        <span className="text-xs text-muted">
                          {(match.semantic_similarity * 100).toFixed(0)}%
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      fragmento {match.chunk_index + 1}
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

      <Card
        title={`Documentos (${documents.length})`}
        description="Separa el workspace humano de la memoria generada por los agentes."
        actions={
          <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={documentView === "workspace" ? "primary" : "ghost"}
            onClick={() => setDocumentView("workspace")}
          >
            Workspace ({workspaceDocuments.length})
          </Button>
          <Button
            type="button"
            variant={documentView === "memory" ? "primary" : "ghost"}
            onClick={() => setDocumentView("memory")}
          >
            Memoria ({generatedMemory.length})
          </Button>
          </div>
        }
      >
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
          <List>
            {visibleDocuments.map((document) => (
              <List.Item
                key={document.id}
                className="grid gap-2 px-4 py-3 md:grid-cols-[1fr_140px_110px_170px]"
              >
                <div>
                  <p className="font-medium">{document.title}</p>
                  {document.description ? (
                    <p className="text-sm text-muted">{document.description}</p>
                  ) : null}
                </div>
                {/* Antes ponía "global | organización": ahora todo lo listado
                    es de este cliente, así que la columna decía siempre lo
                    mismo. Lo que sí cambia de fila a fila es quién lo lee. */}
                <span className="text-xs text-muted">
                  {document.audience === "consultant_only"
                    ? "solo consultores"
                    : "lo ve el cliente"}
                </span>
                <span className="text-xs text-muted">
                  {displayValue(document.status)} · {displayValue(document.authority)}
                </span>
                <span className="text-xs text-muted">
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

// --- Estado "vista general" de /conocimiento (consultor sin cliente activo):
// cobertura de la base de conocimiento por cliente. ---

type ConsultantKnowledgeRow = {
  organization_id: string;
  display_name: string;
  doc_count: number;
  last_updated_at: string | null;
};

const KNOWLEDGE_STALE_DAYS = 30;

function ConsultantKnowledgeView() {
  const { setOrganizationId } = useActiveOrganization();
  const [rows, setRows] = useState<ConsultantKnowledgeRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Capture the reference time once per mounted view; render stays pure.
  const [currentTime] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    apiFetch("/v1/consultant/knowledge")
      .then(async (response) => {
        if (cancelled) return;
        if (!response.ok) {
          setError(await readApiError(response));
          return;
        }
        const payload = (await response.json()) as {
          portfolio: ConsultantKnowledgeRow[];
        };
        setRows(payload.portfolio);
        setError(null);
      })
      .catch(() => {
        if (!cancelled)
          setError("No se pudo cargar el conocimiento por un error de red.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading && !rows) {
    return (
      <div className="portal-page">
        <LoadingBlock label="Cargando conocimiento de la cartera..." />
      </div>
    );
  }
  if (error) {
    return (
      <div className="portal-page">
        <ErrorBlock>{error}</ErrorBlock>
      </div>
    );
  }
  if (!rows) return null;

  const staleOrEmpty = (row: ConsultantKnowledgeRow) => {
    if (row.doc_count === 0) return true;
    if (!row.last_updated_at) return true;
    const days = Math.floor(
      (currentTime - Date.parse(row.last_updated_at)) / (24 * 60 * 60 * 1000),
    );
    return days > KNOWLEDGE_STALE_DAYS;
  };
  const attentionCount = rows.filter(staleOrEmpty).length;
  const sorted = [...rows].sort((a, b) => a.doc_count - b.doc_count);

  return (
    <div className="portal-page space-y-5 sm:space-y-6">
      <Card
        title="Conocimiento · toda la cartera"
        description={`${rows.length} clientes · ${attentionCount} sin documentos o sin actualizar en ${KNOWLEDGE_STALE_DAYS}+ días.`}
      >
        {sorted.length === 0 ? (
          <EmptyState
            title="Sin clientes"
            hint="Cuando se te asigne un cliente, la cobertura de su conocimiento aparecerá aquí."
          />
        ) : (
          <List>
            {sorted.map((row) => {
              const days = row.last_updated_at
                ? Math.floor(
                    (currentTime - Date.parse(row.last_updated_at)) /
                      (24 * 60 * 60 * 1000),
                  )
                : null;
              return (
                <List.Item
                  as="button"
                  key={row.organization_id}
                  type="button"
                  onClick={() => setOrganizationId(row.organization_id)}
                  className="flex w-full items-center justify-between gap-4 py-3 text-left hover:bg-surface"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{row.display_name}</span>
                    {row.doc_count === 0 ? (
                      <Badge tone="danger">Sin documentos</Badge>
                    ) : null}
                  </div>
                  <span className="text-xs text-muted">
                    {row.doc_count} doc{row.doc_count === 1 ? "" : "s"}
                    {" · "}
                    {days === null
                      ? "nunca actualizado"
                      : days <= 0
                        ? "actualizado hoy"
                        : `hace ${days} días`}
                    {days !== null && days > KNOWLEDGE_STALE_DAYS ? (
                      <span className="ml-2 text-warn-deep">desactualizado</span>
                    ) : null}
                  </span>
                </List.Item>
              );
            })}
          </List>
        )}
      </Card>
    </div>
  );
}

function KnowledgeRouter({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const { organizationId } = useActiveOrganization();
  const isConsultant = ["platform_admin", "consultant"].includes(
    bootstrap.profile.platform_role,
  );

  if (isConsultant && !organizationId) {
    return <ConsultantKnowledgeView />;
  }

  return <KnowledgeContent bootstrap={bootstrap} />;
}

export default function KnowledgePage() {
  return (
    <PortalShell title="Conocimiento">
      {(bootstrap) => <KnowledgeRouter bootstrap={bootstrap} />}
    </PortalShell>
  );
}
