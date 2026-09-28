"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import type { MarketingDraft } from "@/hooks/use-marketing-drafts";
import { Badge, Button, EmptyState, Input } from "@/components/ui";

type TemplateFilter = "all" | "analyzed" | "pending";
type TemplateItem = Pick<
  MarketingDraft,
  "id" | "status" | "version" | "request" | "template_name" | "subject" | "scheduled_for" | "template_performance"
> & { created_at: string };
type TemplateCursor = { created_at: string; id: string };

function origin(draft: TemplateItem) {
  if (draft.request?.source === "klaviyo_import") return "Klaviyo";
  if (draft.request?.source === "visual_builder") return "Editor E-NORA";
  return "Creada con IA";
}

function deliveryState(draft: TemplateItem) {
  if (draft.status === "published") return "Enviada";
  if (draft.scheduled_for) return "Programada";
  if (draft.status === "draft") return "Borrador";
  if (draft.status === "approved") return "Aprobada";
  return "En revisión";
}

function formatMoney(value: number, currency: string | null | undefined) {
  if (!currency || !/^[A-Z]{3}$/.test(currency)) return null;
  try {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return null;
  }
}

export function TemplateLibrary({
  organizationId,
  isOpen,
  onUseTemplate,
}: {
  organizationId: string;
  isOpen: boolean;
  onUseTemplate?: (template: TemplateItem) => void;
}) {
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [cursor, setCursor] = useState<TemplateCursor | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<TemplateFilter>("all");
  const [isLoading, setIsLoading] = useState(false);
  const loadingRef = useRef(false);
  const requestVersionRef = useRef(0);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPage = useCallback(
    async (nextCursor: TemplateCursor | null, reset = false) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      const requestVersion = ++requestVersionRef.current;
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (nextCursor) {
          params.set("cursor_created_at", nextCursor.created_at);
          params.set("cursor_id", nextCursor.id);
        }
        const response = await apiFetch(
          `/v1/organizations/${organizationId}/marketing/templates?${params.toString()}`,
        );
        if (!response.ok) throw new Error(await readApiError(response));
        const payload = (await response.json()) as {
          templates?: TemplateItem[];
          next_cursor?: TemplateCursor | null;
        };
        if (requestVersion !== requestVersionRef.current) return;
        const nextTemplates = payload.templates ?? [];
        setTemplates((current) =>
          reset ? nextTemplates : [...current, ...nextTemplates],
        );
        setCursor(payload.next_cursor ?? null);
        setHasLoaded(true);
      } catch (reason) {
        if (requestVersion !== requestVersionRef.current) return;
        setError(
          reason instanceof Error
            ? reason.message
            : "No se pudo cargar la biblioteca de plantillas.",
        );
      } finally {
        if (requestVersion === requestVersionRef.current) {
          loadingRef.current = false;
          setIsLoading(false);
        }
      }
    },
    [organizationId],
  );

  useEffect(() => {
    if (!isOpen || hasLoaded) return;
    void loadPage(null, true);
  }, [hasLoaded, isOpen, loadPage]);

  useEffect(() => {
    requestVersionRef.current += 1;
    loadingRef.current = false;
    setTemplates([]);
    setCursor(null);
    setHasLoaded(false);
    setQuery("");
    setFilter("all");
  }, [organizationId]);

  const filteredTemplates = useMemo(
    () =>
      templates.filter((draft) => {
        const analyzed = Boolean(draft.request?.template_profile);
        if (filter === "analyzed" && !analyzed) return false;
        if (filter === "pending" && analyzed) return false;
        const text = `${draft.template_name} ${draft.subject} ${origin(draft)}`.toLocaleLowerCase("es");
        return text.includes(query.trim().toLocaleLowerCase("es"));
      }),
    [filter, query, templates],
  );

  if (hasLoaded && templates.length === 0 && !cursor && !isLoading && !error) {
    return (
      <EmptyState
        title="Tu biblioteca empieza aquí"
        hint="Importa una plantilla de Klaviyo o guarda un diseño desde el editor. Analizaremos su estilo una vez para reutilizarlo en futuras creaciones."
      />
    );
  }

  return (
    <section aria-label="Biblioteca de plantillas" className="mkt-template-library space-y-5">
      <div className="flex flex-col gap-3 border-b border-edge pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">
            {templates.length === 0 ? "Plantillas" : `${templates.length}${cursor ? "+" : ""} plantillas cargadas`}
          </p>
          <p className="mt-1 text-sm text-muted">Diseños guardados y referencias de Klaviyo</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            aria-label="Buscar plantillas cargadas"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nombre u origen"
          />
          <div className="flex rounded-lg border border-edge bg-surface p-1" aria-label="Filtrar plantillas">
            {([
              ["all", "Todas"],
              ["analyzed", "Analizadas"],
              ["pending", "Pendientes"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
                className={`min-h-9 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${filter === value ? "bg-subtle text-foreground shadow-sm" : "text-muted hover:text-foreground"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error ? (
        <div className="flex flex-wrap items-center justify-between gap-3" role="alert">
          <p className="text-sm text-danger">{error}</p>
          {!cursor ? (
            <Button type="button" variant="secondary" onClick={() => void loadPage(null, true)} disabled={isLoading}>
              Reintentar
            </Button>
          ) : null}
        </div>
      ) : null}
      {isLoading && templates.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted" role="status">Cargando biblioteca…</p>
      ) : filteredTemplates.length === 0 ? (
        <EmptyState title="No hay coincidencias" hint="Prueba con otro nombre o cambia el filtro." />
      ) : (
        <ul className="divide-y divide-edge">
          {filteredTemplates.map((template) => {
            const profile = template.request?.template_profile;
            const palette = Array.isArray(profile?.palette) ? profile.palette : [];
            const performance = template.template_performance;
            const openRate =
              performance && performance.delivered > 0
                ? Math.round((performance.opens_unique / performance.delivered) * 100)
                : null;
            const clickRate =
              performance && performance.delivered > 0
                ? Math.round((performance.clicks_unique / performance.delivered) * 100)
                : null;
            const revenue = performance
              ? formatMoney(performance.revenue, performance.currency_code)
              : null;

            return (
              <li key={template.id} className="py-5 first:pt-1 last:pb-1">
                <article className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(230px,0.8fr)] md:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-base font-semibold text-foreground">
                        {template.template_name || template.subject || "Plantilla sin nombre"}
                      </h3>
                      <Badge tone={profile ? "success" : "neutral"}>
                        {profile ? "Analizada" : "Pendiente de analizar"}
                      </Badge>
                    </div>
                    <p className="mt-1.5 text-sm text-muted">
                      {origin(template)} <span aria-hidden="true">·</span> {deliveryState(template)}
                      {template.subject && template.template_name ? ` · ${template.subject}` : ""}
                    </p>
                    {palette.length > 0 ? (
                      <div className="mt-3 flex items-center gap-2" aria-label="Paleta de colores detectada">
                        <span className="text-xs font-medium text-muted">Paleta</span>
                        {palette.slice(0, 6).map((color, index) => {
                          const value =
                            color && typeof color === "object" && "hex" in color
                              ? String((color as { hex: unknown }).hex)
                              : "#ffffff";
                          return (
                            <span
                              key={`${value}-${index}`}
                              className="size-5 rounded-full border border-edge shadow-sm"
                              style={{ backgroundColor: value }}
                              title={value}
                            />
                          );
                        })}
                      </div>
                    ) : null}
                    {onUseTemplate &&
                    (template.request?.design?.blocks?.length ?? 0) > 0 ? (
                      <div className="mt-4">
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => onUseTemplate(template)}
                        >
                          Usar como punto de partida
                        </Button>
                      </div>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-2 gap-x-5 gap-y-2 border-t border-edge pt-3 text-sm md:border-l md:border-t-0 md:pl-5 md:pt-0">
                    <span className="text-muted">Aperturas</span>
                    <span className="text-right font-medium tabular-nums text-foreground">{openRate === null ? "—" : `${openRate}%`}</span>
                    <span className="text-muted">Clics</span>
                    <span className="text-right font-medium tabular-nums text-foreground">{clickRate === null ? "—" : `${clickRate}%`}</span>
                    <span className="text-muted">Conversiones</span>
                    <span className="text-right font-medium tabular-nums text-foreground">{performance ? performance.conversions.toLocaleString("es-ES") : "—"}</span>
                    <span className="text-muted">Ingresos atribuidos</span>
                    <span className="text-right font-medium tabular-nums text-foreground">{revenue ?? "—"}</span>
                    <span className="text-muted">Entidades medidas</span>
                    <span className="text-right font-medium tabular-nums text-foreground">{performance ? performance.measured_entities.toLocaleString("es-ES") : "—"}</span>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}

      {cursor ? (
        <div className="flex justify-center border-t border-edge pt-4">
          <Button type="button" variant="secondary" onClick={() => void loadPage(cursor)} disabled={isLoading}>
            {isLoading ? "Cargando…" : "Cargar plantillas anteriores"}
          </Button>
        </div>
      ) : null}
      <p className="text-xs leading-5 text-muted">
        Las métricas solo se muestran cuando Klaviyo permite atribuirlas a una única plantilla; no equivalen al total de envíos.
      </p>
    </section>
  );
}
