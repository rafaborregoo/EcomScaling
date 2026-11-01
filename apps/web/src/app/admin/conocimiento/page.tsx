"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { PlatformAdminShell } from "@/components/platform-admin-shell";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { displayValue } from "@/lib/display-labels";
import { useIsDesktop } from "@/hooks/use-is-desktop";
import {
  ScrollArea,
  Badge,
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  EYEBROW,
  EmptyState,
  ErrorBlock,
  Field,
  Input,
  List,
  LoadingBlock,
  Markdown,
  Textarea,
  toast,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
  const isDesktop = useIsDesktop();
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [viewing, setViewing] = useState<GlobalDocument | null>(null);
  const [viewedContent, setViewedContent] = useState<string | null>(null);
  const [viewError, setViewError] = useState<string | null>(null);

  async function openDocument(document: GlobalDocument) {
    setViewing(document);
    setViewedContent(null);
    setViewError(null);
    try {
      const response = await apiFetch(
        `/v1/organizations/global/knowledge/documents/${document.id}`,
      );
      if (!response.ok) {
        setViewError(await readApiError(response));
        return;
      }
      const payload = (await response.json()) as {
        document: { content: string | null };
      };
      setViewedContent(payload.document.content ?? "Sin contenido.");
    } catch {
      setViewError("No se pudo cargar el documento por un error de red.");
    }
  }

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
      setAdding(false);
    }
  }

  return (
    <div className="portal-page space-y-5 sm:space-y-6">
      {error ? <ErrorBlock>{error}</ErrorBlock> : null}

      <Dialog
        open={adding}
        onOpenChange={setAdding}
        busy={isSaving}
        dirty={Boolean(title.trim() || content.trim())}
      >
        <DialogContent>
        <DialogHeader>
          <DialogTitle>Añadir a la metodología</DialogTitle>
          <DialogDescription>
            Lo que subas aquí lo usa el copiloto de todos los clientes. Ni los consultores ni los clientes lo ven listado: para ellos, Conocimiento es solo el contexto de su tienda.
          </DialogDescription>
        </DialogHeader>
        <div>
          <Button
            type="button"
            variant="secondary"
            disabled={isSaving}
            onClick={() => fileInputRef.current?.click()}
          >
            Subir documento (.txt, .md)
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
        <form id="methodology-form" className="space-y-4 border-t border-line pt-4" onSubmit={submit}>
          <p className="text-sm font-medium text-ink">O pega el texto a mano</p>
          <Field label="Título">
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ej: Criterios para escalar inversión en ads"
            />
          </Field>
          <Field label="Contenido">
            <Textarea
              className="h-40"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="Pega aquí la metodología…"
            />
          </Field>
        </form>
        <DialogFooter>
          <DialogClose>Cancelar</DialogClose>
          <Button type="submit" form="methodology-form" disabled={isSaving || !title.trim() || !content.trim()}>
            {isSaving ? "Indexando…" : "Guardar texto"}
          </Button>
        </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>{`Metodología (${documents?.length ?? 0})`}</CardTitle>
          <CardDescription>Lo que el copiloto puede citar en cualquier cliente.</CardDescription>
          <CardAction><Button onClick={() => setAdding(true)}>Añadir material</Button></CardAction>
        </CardHeader>
        <CardContent>
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
                  className="grid items-center gap-2 px-4 py-3 md:grid-cols-[1fr_140px_120px_80px]"
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
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void openDocument(document)}
                  >
                    Ver
                  </Button>
                </List.Item>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      <Drawer
        open={viewing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setViewing(null);
            setViewedContent(null);
            setViewError(null);
          }
        }}
        swipeDirection={isDesktop ? "right" : "down"}
        showSwipeHandle={!isDesktop}
      >
        <DrawerContent className="sm:max-w-[44rem]">
          <DrawerHeader>
            <DrawerTitle>{viewing?.title ?? "Documento"}</DrawerTitle>
            {viewing ? (
              <DrawerDescription>{`${displayValue(viewing.authority)} · ${displayValue(viewing.status)}`}</DrawerDescription>
            ) : null}
          </DrawerHeader>
          <ScrollArea className="flex-1 p-4 sm:px-6">
          {viewError ? (
            <ErrorBlock>{viewError}</ErrorBlock>
          ) : viewedContent === null ? (
            <LoadingBlock label="Cargando documento…" />
          ) : (
            <Markdown>{viewedContent}</Markdown>
          )}
          </ScrollArea>
          <DrawerFooter>
            {viewedContent ? (
              <Button
                variant="secondary"
                onClick={() => {
                  void navigator.clipboard
                    .writeText(viewedContent)
                    .then(() => toast.success("Texto copiado"))
                    .catch(() => toast.danger("No se pudo copiar el texto"));
                }}
              >
                Copiar texto
              </Button>
            ) : null}
            <DrawerClose render={<Button variant="outline" />}>Cerrar</DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
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
