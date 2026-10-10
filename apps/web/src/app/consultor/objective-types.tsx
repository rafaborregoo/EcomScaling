"use client";

import { type FormEvent, useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { useCachedQuery } from "@/lib/use-cached-query";
import {
  Badge,
  Button,
  Card,
  Dialog,
  ErrorBlock,
  Field,
  Input,
  List,
  PencilIcon,
  Select,
  SettingsIcon,
  toast,
} from "@/components/ui";

// --- Tipos de objetivo (catalogo editable del consultor) -------------------
// El consultor define aqui "tipos" de objetivo; el valor objetivo por cliente
// se sigue poniendo 1 a 1 desde Mi Camino. Un tipo puede medirse con una
// metrica de plataforma (Shopify/Meta, la app calcula el actual) o ser de
// valor manual (el consultor teclea el actual en la card del objetivo).

type ObjectiveDefinition = {
  id: string;
  organization_id: string | null;
  slug: string;
  label: string;
  unit: "money" | "pct" | "count" | "ratio" | "number";
  direction: "up" | "down";
  source: "shopify" | "meta" | "manual";
  metric_key: string | null;
  created_at: string;
};

type ObjectiveBuiltin = {
  key: string;
  label: string;
  unit: string;
  direction: string;
  source: string;
  metric_key: string | null;
};

const OBJECTIVE_UNIT_LABELS: Record<string, string> = {
  money: "Moneda (€)",
  pct: "Porcentaje (%)",
  count: "Recuento",
  ratio: "Ratio (x)",
  number: "Número",
};

export function ObjectiveTypesCard({
  organizations,
}: {
  organizations: Array<{ id: string; display_name: string }>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const definitionsQuery = useCachedQuery<{
    definitions?: ObjectiveDefinition[];
    builtins?: ObjectiveBuiltin[];
  }>(isOpen ? "/v1/consultant/objective-definitions" : null);
  const definitions = definitionsQuery.data?.definitions ?? null;
  const builtins = definitionsQuery.data?.builtins ?? [];
  const [actionError, setActionError] = useState<string | null>(null);
  const error = actionError ?? definitionsQuery.error;
  const setError = setActionError;
  const [busyId, setBusyId] = useState<string | null>(null);
  // Renombrar en la propia fila (antes: window.prompt encima del modal).
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  // Borrar se confirma en la propia fila: sin un segundo modal encima.
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Alta
  const [label, setLabel] = useState("");
  const [source, setSource] = useState<"platform" | "manual">("platform");
  const [metricKey, setMetricKey] = useState("");
  const [unit, setUnit] = useState("number");
  const [direction, setDirection] = useState<"up" | "down">("up");
  const [scope, setScope] = useState("all");
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(() => {
    setActionError(null);
    definitionsQuery.reload();
  }, [definitionsQuery.reload]);

  useEffect(() => {
    if (isOpen && !metricKey && builtins[0]) {
      setMetricKey(builtins[0].key);
    }
  }, [builtins, isOpen, metricKey]);

  async function createDefinition(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!label.trim()) return;
    setIsSaving(true);
    try {
      const body =
        source === "platform"
          ? {
              label: label.trim(),
              source: builtins.find((b) => b.key === metricKey)?.source,
              metricKey,
              organizationId: scope === "all" ? null : scope,
            }
          : {
              label: label.trim(),
              source: "manual",
              unit,
              direction,
              organizationId: scope === "all" ? null : scope,
            };
      const response = await apiFetch("/v1/consultant/objective-definitions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      toast.success("Tipo de objetivo creado.");
      setLabel("");
      load();
    } catch {
      setError("No se pudo crear el tipo de objetivo. Reintenta.");
    } finally {
      setIsSaving(false);
    }
  }

  async function renameDefinition(id: string, nextLabel: string) {
    setBusyId(id);
    try {
      const response = await apiFetch(
        `/v1/consultant/objective-definitions/${id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label: nextLabel }),
        },
      );
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      load();
    } catch {
      setError("No se pudo actualizar el tipo de objetivo. Reintenta.");
    } finally {
      setBusyId(null);
    }
  }

  async function archiveDefinition(id: string) {
    setBusyId(id);
    try {
      const response = await apiFetch(
        `/v1/consultant/objective-definitions/${id}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      load();
    } catch {
      setError("No se pudo borrar el tipo de objetivo. Reintenta.");
    } finally {
      setBusyId(null);
    }
  }

  const orgName = (id: string | null) =>
    id === null
      ? "Toda mi cartera"
      : (organizations.find((o) => o.id === id)?.display_name ?? "Un cliente");

  return (
    <Card
      title="Tipos de objetivo"
      description="Catálogo de objetivos que puedes imponer a tus clientes desde Mi Camino. El valor objetivo se fija cliente por cliente; aquí solo defines los tipos."
      actions={
        <Button
          variant="ghost"
          size="sm"
          type="button"
          aria-label="Configurar tipos de objetivo"
          onClick={() => setIsOpen(true)}
        >
          <SettingsIcon aria-hidden /> Configurar
        </Button>
      }
    >
      <p className="text-sm text-muted">
        {definitions === null
          ? "Abre «Configurar» para gestionar tus tipos de objetivo."
          : definitions.length === 0
            ? "Solo los 8 objetivos estándar de plataforma. Añade tipos propios desde «Configurar»."
            : `${definitions.length} tipo(s) propio(s) además de los 8 estándar de plataforma.`}
      </p>

      <Dialog
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        size="lg"
        title="Tipos de objetivo"
        isBusy={isSaving}
        isDirty={Boolean(label.trim())}
        formId="objective-type-form"
        cancelLabel="Cerrar"
        primary={{
          label: "Crear tipo de objetivo",
          busyLabel: "Creando…",
          disabled: !label.trim(),
        }}
      >
        {error ? <ErrorBlock>{error}</ErrorBlock> : null}

        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-ink">
            Estándar de plataforma (siempre activos)
          </h3>
          <ul className="flex flex-wrap gap-2">
            {builtins.map((b) => (
              <li key={b.key}>
                <Badge tone="neutral">{b.label}</Badge>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-ink">Tus tipos propios</h3>
          {definitions === null ? (
            <p className="text-muted">Cargando…</p>
          ) : definitions.length === 0 ? (
            <p className="text-muted">Todavía no has creado ninguno.</p>
          ) : (
            <List as="ul" bordered>
              {definitions.map((def) => (
                <List.Item
                  as="li"
                  key={def.id}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  {renamingId === def.id ? (
                    <form
                      className="flex w-full items-center gap-2"
                      onSubmit={(event) => {
                        event.preventDefault();
                        const next = renameValue.trim();
                        setRenamingId(null);
                        if (next && next !== def.label) void renameDefinition(def.id, next);
                      }}
                    >
                      <Input
                        autoFocus
                        aria-label={`Nuevo nombre de ${def.label}`}
                        value={renameValue}
                        onChange={(event) => setRenameValue(event.target.value)}
                      />
                      <Button type="submit" size="sm" disabled={!renameValue.trim()}>
                        Guardar
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => setRenamingId(null)}>
                        Cancelar
                      </Button>
                    </form>
                  ) : confirmDeleteId === def.id ? (
                    <div className="flex w-full flex-wrap items-center justify-between gap-2">
                      <span className="text-[13px] font-medium text-ink">¿Borrar «{def.label}»?</span>
                      <span className="flex items-center gap-2">
                        <Button size="sm" variant="ghost" disabled={busyId === def.id} onClick={() => setConfirmDeleteId(null)}>
                          Cancelar
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={busyId === def.id}
                          onClick={async () => {
                            await archiveDefinition(def.id);
                            setConfirmDeleteId(null);
                          }}
                        >
                          {busyId === def.id ? "Borrando…" : "Borrar"}
                        </Button>
                      </span>
                    </div>
                  ) : (
                    <>
                      <span className="min-w-0">
                        <span className="font-medium text-ink">{def.label}</span>
                        <span className="ml-2 text-xs text-muted">
                          {def.source === "manual" ? "Manual" : "Métrica de plataforma"} · {orgName(def.organization_id)}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`Renombrar ${def.label}`}
                          disabled={busyId === def.id}
                          onClick={() => {
                            setRenameValue(def.label);
                            setRenamingId(def.id);
                          }}
                        >
                          <PencilIcon aria-hidden />
                        </Button>
                        <Button size="sm" variant="ghost" disabled={busyId === def.id} onClick={() => setConfirmDeleteId(def.id)}>
                          Borrar
                        </Button>
                      </span>
                    </>
                  )}
                </List.Item>
              ))}
            </List>
          )}
        </section>

        <form id="objective-type-form" onSubmit={createDefinition} className="space-y-4 border-t border-line pt-4">
          <h3 className="text-sm font-semibold text-ink">Nuevo tipo de objetivo</h3>
          <Field label="Nombre">
            <Input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="p. ej. Suscriptores de newsletter"
              required
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Cómo se mide">
              <Select
                value={source}
                onChange={(value) => setSource(value as "platform" | "manual")}
                options={[
                  { value: "platform", label: "Métrica de plataforma" },
                  { value: "manual", label: "Valor manual" },
                ]}
              />
            </Field>
            {source === "platform" ? (
              <Field label="Métrica">
                <Select
                  value={metricKey}
                  onChange={setMetricKey}
                  options={builtins.map((b) => ({ value: b.key, label: b.label }))}
                />
              </Field>
            ) : (
              <Field label="Unidad">
                <Select
                  value={unit}
                  onChange={setUnit}
                  options={Object.entries(OBJECTIVE_UNIT_LABELS).map(([value, label2]) => ({ value, label: label2 }))}
                />
              </Field>
            )}
            {source === "manual" ? (
              <Field label="Dirección">
                <Select
                  value={direction}
                  onChange={(value) => setDirection(value as "up" | "down")}
                  options={[
                    { value: "up", label: "Más es mejor" },
                    { value: "down", label: "Menos es mejor" },
                  ]}
                />
              </Field>
            ) : null}
            <Field label="Para quién">
              <Select
                value={scope}
                onChange={setScope}
                options={[
                  { value: "all", label: "Toda mi cartera" },
                  ...organizations.map((o) => ({ value: o.id, label: o.display_name })),
                ]}
              />
            </Field>
          </div>
          {source === "manual" ? (
            <p className="text-xs text-muted">
              Los objetivos manuales no tienen dato automático: tú introduces el valor actual en la card del objetivo, dentro de Mi Camino de cada cliente.
            </p>
          ) : null}
        </form>
      </Dialog>
    </Card>
  );
}
