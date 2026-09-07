"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  ErrorBlock,
  Field,
  Input,
  List,
  LoadingBlock,
  Select,
  toast,
} from "@/components/ui";
import {
  SEVERITY_OPTIONS,
  SEVERITY_TONE,
  thresholdLabel,
  toDisplayThreshold,
  toStoredThreshold,
} from "./alert-threshold";

/**
 * Avisos por cliente.
 *
 * `organization_alert_rules` existe desde DB-07 con is_enabled,
 * severity_override y condition_override, y el motor no la miraba: las tres
 * plantillas activas se evaluaban igual para toda la cartera. Ahora la lee
 * (`runAlertRules`), y esto es la puerta para escribirla.
 */

type AlertRule = {
  template_id: string;
  code: string;
  name: string;
  description: string | null;
  is_enabled: boolean;
  severity: string;
  threshold: number | null;
  default_severity: string;
  default_threshold: number | null;
  is_customized: boolean;
};

/** Una fila con su propio borrador: guardar una regla no toca las demás. */
function RuleRow({
  rule,
  canManage,
  onSave,
}: {
  rule: AlertRule;
  canManage: boolean;
  onSave: (
    templateId: string,
    body: { isEnabled: boolean; severity: string; threshold: number | null },
  ) => Promise<void>;
}) {
  const [enabled, setEnabled] = useState(rule.is_enabled);
  const [severity, setSeverity] = useState(rule.severity);
  const [threshold, setThreshold] = useState(
    toDisplayThreshold(rule.code, rule.threshold),
  );
  const [saving, setSaving] = useState(false);

  const dirty =
    enabled !== rule.is_enabled ||
    severity !== rule.severity ||
    threshold !== toDisplayThreshold(rule.code, rule.threshold);

  async function save() {
    setSaving(true);
    try {
      await onSave(rule.template_id, {
        isEnabled: enabled,
        severity,
        threshold: toStoredThreshold(rule.code, threshold),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <List.Item as="li" className="space-y-3 py-4">
      <div className="flex flex-wrap items-center gap-3">
        <Checkbox
          checked={enabled}
          onChange={setEnabled}
          disabled={!canManage}
          className="min-w-0 flex-1"
        >
          <span className="text-sm font-medium">{rule.name}</span>
        </Checkbox>
        <Badge tone={SEVERITY_TONE[severity] ?? "neutral"}>
          {SEVERITY_OPTIONS.find((option) => option.value === severity)?.label ??
            severity}
        </Badge>
        {rule.is_customized ? <Badge>personalizada</Badge> : null}
      </div>

      {rule.description ? (
        <p className="text-sm text-muted">{rule.description}</p>
      ) : null}

      {enabled ? (
        <div className="flex flex-wrap items-end gap-3">
          <Field label={thresholdLabel(rule.code)}>
            <Input
              className="mt-1 w-56"
              type="number"
              inputMode="decimal"
              disabled={!canManage}
              value={threshold}
              onChange={(event) => setThreshold(event.target.value)}
              placeholder={
                toDisplayThreshold(rule.code, rule.default_threshold) ||
                "por defecto"
              }
            />
          </Field>
          <Field label="Importancia">
            <Select
              className="mt-1 w-40"
              aria-label={`Importancia de ${rule.name}`}
              value={severity}
              onChange={setSeverity}
              options={SEVERITY_OPTIONS}
              disabled={!canManage}
            />
          </Field>
          {canManage && dirty ? (
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          ) : null}
        </div>
      ) : canManage && dirty ? (
        <Button onClick={() => void save()} disabled={saving}>
          {saving ? "Guardando…" : "Guardar"}
        </Button>
      ) : null}
    </List.Item>
  );
}

export function AlertRulesSection({
  organizationId,
  canManage,
}: {
  organizationId: string;
  canManage: boolean;
}) {
  const [rules, setRules] = useState<AlertRule[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/alert-rules`,
      );
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      const payload = (await response.json()) as { rules: AlertRule[] };
      setRules(payload.rules);
      setError(null);
    } catch {
      setError("No se pudieron cargar los avisos por un error de red.");
    }
  }, [organizationId]);

  useEffect(() => {
    // Carga inicial desde el endpoint; no deriva de otro estado local.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function save(
    templateId: string,
    body: { isEnabled: boolean; severity: string; threshold: number | null },
  ) {
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/alert-rules/${templateId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!response.ok) {
        toast.danger(await readApiError(response));
        return;
      }
      toast.success("Aviso actualizado");
      await load();
    } catch {
      toast.danger("No se pudo guardar el aviso por un error de red.");
    }
  }

  const activeCount = (rules ?? []).filter((rule) => rule.is_enabled).length;

  return (
    <Card
      title="Avisos de este cliente"
      description="Qué vigila el sistema por su cuenta y a partir de qué punto avisa. Cada cliente puede tener los suyos."
      actions={
        rules ? <Badge tone="success">{activeCount} activos</Badge> : undefined
      }
    >
      {error ? <ErrorBlock>{error}</ErrorBlock> : null}

      {rules === null && !error ? (
        <LoadingBlock label="Cargando avisos…" />
      ) : rules && rules.length === 0 ? (
        <EmptyState
          title="No hay avisos disponibles"
          hint="Las plantillas de aviso las define la plataforma; cuando haya alguna activa, aparecerá aquí para ajustarla."
        />
      ) : rules ? (
        <List as="ul">
          {rules.map((rule) => (
            <RuleRow
              // La key incluye lo guardado: al recargar tras guardar, la fila
              // se remonta con los valores nuevos en vez de quedarse con el
              // borrador anterior.
              key={`${rule.template_id}:${rule.is_enabled}:${rule.severity}:${rule.threshold}`}
              rule={rule}
              canManage={canManage}
              onSave={save}
            />
          ))}
        </List>
      ) : null}
    </Card>
  );
}
