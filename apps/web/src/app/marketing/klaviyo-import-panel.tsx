"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import {
  Badge,
  Button,
  EmptyState,
  ErrorBlock,
  List,
  LoadingBlock,
  toast,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@/components/ui";
import { fmtDate } from "./format";

type KlaviyoTemplate = {
  id: string;
  name: string;
  editor_type: string | null;
  updated: string | null;
};

/**
 * Traer plantillas de la cuenta Klaviyo como borradores.
 *
 * Vivia dentro de la pagina detras de un `showKlaviyoImport` que ya no ponia
 * nadie a `true` (el atajo que lo abria desaparecio al pasar a pestañas), y la
 * carga colgaba de un boton de reintento: aunque se hubiera abierto, la lista
 * salia vacia. Aqui la carga es el montaje del panel.
 */
export function KlaviyoImportPanel({
  organizationId,
  importedTemplateIds,
  onImported,
}: {
  organizationId: string;
  /** Plantillas que ya tienen borrador, para no importarlas dos veces sin querer. */
  importedTemplateIds: string[];
  onImported: (draftId: string | null) => void;
}) {
  const [templates, setTemplates] = useState<KlaviyoTemplate[]>([]);
  const [status, setStatus] = useState<"loading" | "loaded" | "error">(
    "loading",
  );
  const [error, setError] = useState<string | null>(null);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setStatus("loading");
      setError(null);
      try {
        const response = await apiFetch(
          `/v1/organizations/${organizationId}/klaviyo/templates`,
        );
        if (cancelled) return;
        if (!response.ok) {
          setError(await readApiError(response));
          setStatus("error");
          return;
        }
        const body = (await response.json()) as { templates: KlaviyoTemplate[] };
        if (cancelled) return;
        setTemplates(body.templates);
        setStatus("loaded");
      } catch {
        if (cancelled) return;
        setError("No se pudieron cargar las plantillas de Klaviyo.");
        setStatus("error");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [organizationId, reloadToken]);

  async function togglePreview(templateId: string) {
    if (previewId === templateId) {
      setPreviewId(null);
      setPreviewHtml(null);
      return;
    }
    setPreviewId(templateId);
    setPreviewHtml(null);
    setError(null);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/klaviyo/templates/${encodeURIComponent(templateId)}/preview`,
        undefined,
        60_000,
      );
      if (!response.ok) {
        setError(await readApiError(response));
        setPreviewId(null);
        return;
      }
      const body = (await response.json()) as { html?: string };
      setPreviewHtml(body.html ?? "");
    } catch {
      setError("No se pudo cargar la vista previa por un error de red.");
      setPreviewId(null);
    }
  }

  async function importTemplate(templateId: string) {
    setImportingId(templateId);
    setError(null);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/klaviyo/templates/import`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ templateId }),
        },
        60_000,
      );
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      const body = (await response.json().catch(() => null)) as {
        draft_id?: string;
      } | null;
      toast.success("Plantilla importada como borrador");
      onImported(body?.draft_id ?? null);
    } catch {
      setError("No se pudo importar la plantilla por un error de red.");
    } finally {
      setImportingId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Importar plantillas de Klaviyo</CardTitle>
        <CardDescription>Trae plantillas de tu cuenta como borrador (solo HTML; no se abren en el editor visual).</CardDescription>
      </CardHeader>
      <CardContent>
        {status === "loading" ? (
          <LoadingBlock label="Cargando plantillas de Klaviyo…" />
        ) : status === "error" ? (
          <div className="space-y-3">
            <ErrorBlock>{error}</ErrorBlock>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setReloadToken((token) => token + 1)}
            >
              Reintentar
            </Button>
          </div>
        ) : templates.length === 0 ? (
          <EmptyState
            title="Sin plantillas"
            hint="No hay plantillas en la cuenta Klaviyo conectada."
          />
        ) : (
          <>
            {error ? <ErrorBlock>{error}</ErrorBlock> : null}
            <List as="ul">
              {templates.map((template) => {
                const alreadyImported = importedTemplateIds.includes(template.id);
                return (
                  <List.Item as="li" key={template.id} className="py-2">
                    <Collapsible open={previewId === template.id} onOpenChange={() => void togglePreview(template.id)}>
                    <Item size="xs" className="px-0">
                      <ItemContent>
                        <ItemTitle>{template.name}</ItemTitle>
                        <ItemDescription>
                          {template.editor_type ?? "—"}
                          {template.updated ? ` · ${fmtDate(template.updated)}` : ""}
                        </ItemDescription>
                      </ItemContent>
                      <ItemActions>
                        {alreadyImported ? <Badge>Ya importada</Badge> : null}
                        <CollapsibleTrigger render={<Button variant="ghost" />}>
                          {previewId === template.id ? "Ocultar" : "Ver"}
                        </CollapsibleTrigger>
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={importingId === template.id}
                          onClick={() => void importTemplate(template.id)}
                        >
                          {importingId === template.id
                            ? "Importando…"
                            : alreadyImported
                              ? "Importar otra vez"
                              : "Importar"}
                        </Button>
                      </ItemActions>
                    </Item>
                    <CollapsibleContent className="pt-2">
                    {previewId === template.id ? (
                      <div className="overflow-hidden border border-separator bg-white">
                        {previewHtml === null ? (
                          <div className="p-3">
                            <LoadingBlock label="Cargando vista previa…" />
                          </div>
                        ) : (
                          <iframe
                            title={`Vista previa de ${template.name}`}
                            srcDoc={previewHtml}
                            sandbox=""
                            loading="lazy"
                            className="h-96 w-full"
                          />
                        )}
                      </div>
                    ) : null}
                    </CollapsibleContent>
                    </Collapsible>
                  </List.Item>
                );
              })}
            </List>
          </>
        )}
      </CardContent>
    </Card>
  );
}
