"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBlock,
  Field,
  Input,
  List,
  LoadingBlock,
  Select,
  Textarea,
  toast,
} from "@/components/ui";

/**
 * Reglas del cliente: lo único que el copiloto tiene delante en CADA respuesta.
 *
 * La tabla (`client_constraints`) y su inyección existen desde AI-07 -- la
 * lectura estaba en `loadCriticalClientConstraints` y era la única referencia
 * en todo el repo. No había forma de crear una fila: la capacidad estaba
 * construida y sin puerta. Esto es la puerta.
 *
 * La distinción que sostiene toda la página:
 *   regla     -> siempre en contexto, no compite por el top-k.
 *   documento -> el copiloto lo usa si la conversación lo pide.
 */

export const RULE_CATEGORIES = [
  { value: "pricing", label: "Precios" },
  { value: "discounts", label: "Descuentos" },
  { value: "inventory", label: "Stock" },
  { value: "brand", label: "Marca" },
  { value: "campaigns", label: "Campañas" },
  { value: "operations", label: "Operativa" },
];

const CATEGORY_LABEL = Object.fromEntries(
  RULE_CATEGORIES.map((category) => [category.value, category.label]),
);

// Igual que el límite del backend: una regla entra en el prompt de cada turno.
const MAX_LENGTH = 400;

type ClientRule = {
  id: string;
  category: string;
  statement: string;
  status: string;
  valid_from: string;
  valid_until: string | null;
};

function expiryLabel(rule: ClientRule, today: string): string | null {
  if (!rule.valid_until) return null;
  return rule.valid_until < today
    ? `caducó el ${rule.valid_until}`
    : `hasta el ${rule.valid_until}`;
}

export function ClientRules({
  organizationId,
  canManage,
}: {
  organizationId: string;
  canManage: boolean;
}) {
  const [rules, setRules] = useState<ClientRule[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statement, setStatement] = useState("");
  const [category, setCategory] = useState("operations");
  const [validUntil, setValidUntil] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  // Fecha de referencia fija por montaje: el render se mantiene puro.
  const [today] = useState(() => new Date().toISOString().slice(0, 10));

  const load = useCallback(async () => {
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/knowledge/constraints`,
      );
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      const payload = (await response.json()) as { constraints: ClientRule[] };
      setRules(payload.constraints);
      setError(null);
    } catch {
      setError("No se pudieron cargar las reglas por un error de red.");
    }
  }, [organizationId]);

  useEffect(() => {
    // Sincroniza con el endpoint al montar; no deriva de otro estado local.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const text = statement.trim();
    if (!text) return;

    setIsSaving(true);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/knowledge/constraints`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            category,
            statement: text,
            validUntil: validUntil || null,
          }),
        },
      );
      if (!response.ok) {
        toast.danger(await readApiError(response));
        return;
      }
      setStatement("");
      setValidUntil("");
      toast.success("Regla añadida", {
        description: "El copiloto la tendrá delante desde la próxima respuesta.",
      });
      await load();
    } catch {
      toast.danger("No se pudo guardar la regla por un error de red.");
    } finally {
      setIsSaving(false);
    }
  }

  async function toggle(rule: ClientRule) {
    const next = rule.status === "active" ? "inactive" : "active";
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/knowledge/constraints/${rule.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: next }),
        },
      );
      if (!response.ok) {
        toast.danger(await readApiError(response));
        return;
      }
      await load();
    } catch {
      toast.danger("No se pudo cambiar la regla por un error de red.");
    }
  }

  const active = (rules ?? []).filter((rule) => rule.status === "active");
  const inactive = (rules ?? []).filter((rule) => rule.status !== "active");
  const remaining = MAX_LENGTH - statement.length;

  return (
    <Card
      title="Reglas de este cliente"
      description="El copiloto las tiene delante en cada respuesta, sin depender de que la conversación las saque."
      actions={
        active.length > 0 ? (
          <Badge tone="success">{active.length} activas</Badge>
        ) : undefined
      }
    >
      {error ? (
        <div className="mb-4">
          <ErrorBlock>{error}</ErrorBlock>
        </div>
      ) : null}

      {canManage ? (
        <form className="space-y-3" onSubmit={submit}>
          <Field label="Regla">
            <Textarea
              className="mt-1 h-20"
              maxLength={MAX_LENGTH}
              value={statement}
              onChange={(event) => setStatement(event.target.value)}
              placeholder="Ej: Nunca propongas descuentos por encima del 20%."
            />
            {remaining < 80 ? (
              <p className="mt-1 text-xs text-muted">
                {remaining} caracteres. Si necesitas más, es un documento: una
                regla entra entera en cada respuesta.
              </p>
            ) : null}
          </Field>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Tema">
              <Select
                className="mt-1 w-44"
                aria-label="Tema de la regla"
                value={category}
                onChange={setCategory}
                options={RULE_CATEGORIES}
              />
            </Field>
            <Field label="Deja de aplicar (opcional)">
              <Input
                className="mt-1 w-44"
                type="date"
                min={today}
                value={validUntil}
                onChange={(event) => setValidUntil(event.target.value)}
              />
            </Field>
            <Button type="submit" disabled={isSaving || !statement.trim()}>
              {isSaving ? "Guardando…" : "Añadir regla"}
            </Button>
          </div>
        </form>
      ) : null}

      <div className="mt-6">
        {rules === null ? (
          <LoadingBlock label="Cargando reglas…" />
        ) : rules.length === 0 ? (
          <EmptyState
            title="Sin reglas todavía"
            hint="Una regla es lo que el copiloto no puede olvidar en ninguna respuesta: un margen mínimo, una colección que no se promociona, un tono que la marca no usa."
          />
        ) : (
          <List as="ul">
            {[...active, ...inactive].map((rule) => {
              const expiry = expiryLabel(rule, today);
              const expired = Boolean(
                rule.valid_until && rule.valid_until < today,
              );
              const live = rule.status === "active" && !expired;
              return (
                <List.Item
                  as="li"
                  key={rule.id}
                  className="flex flex-wrap items-start gap-3 py-3"
                >
                  <Badge tone={live ? "success" : "neutral"}>
                    {CATEGORY_LABEL[rule.category] ?? rule.category}
                  </Badge>
                  <span className="min-w-0 flex-1">
                    <span
                      className={
                        live
                          ? "block text-sm"
                          : "block text-sm text-muted line-through"
                      }
                    >
                      {rule.statement}
                    </span>
                    {expiry ? (
                      <span className="mt-0.5 block text-xs text-muted">
                        {expiry}
                      </span>
                    ) : null}
                  </span>
                  {canManage ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void toggle(rule)}
                    >
                      {rule.status === "active" ? "Desactivar" : "Reactivar"}
                    </Button>
                  ) : null}
                </List.Item>
              );
            })}
          </List>
        )}
      </div>
    </Card>
  );
}
