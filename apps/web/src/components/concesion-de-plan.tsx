"use client";
import { DatePicker } from "@/components/ui";

import { useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { Banner, Button, Checkbox, ErrorBlock, Field, Input, Select } from "@/components/ui";
import {
  concesionDesde,
  concesionInicial,
  concesionValida,
  grantPlanBody,
  type ConcesionDePlanValue } from "./concesion-de-plan-model";

// La logica pura vive en concesion-de-plan-model.ts; se reexporta para que
// nadie tenga que saber que esta partida en dos ficheros.
export {
  concesionDesde,
  concesionInicial,
  concesionValida,
  grantPlanBody,
  type ConcesionDePlanValue,
};

export function ConcesionDePlan({
  value,
  onChange,
  etiquetaSinPlan,
  avisoSinPlan,
  soloEdicion = false,
}: {
  value: ConcesionDePlanValue;
  onChange: (valor: ConcesionDePlanValue) => void;
  /** Que significa no conceder aqui: "paga con tarjeta" o "empieza en trial". */
  etiquetaSinPlan?: string;
  avisoSinPlan?: string;
  /** Editando un plan que ya existe: sin el selector de "concedo o no", los
   *  campos van directos -- aqui siempre hay un plan que ajustar. */
  soloEdicion?: boolean;
}) {
  return (
    <div className="grid gap-4">
      {!soloEdicion ? (
        <Field label="Plan">
          <Select
            value={value.conceder ? "conceder" : "sin-plan"}
            onChange={(modo) =>
              onChange({ ...value, conceder: modo === "conceder" })
            }
            options={[
              { value: "conceder", label: "Se lo concedo yo (no paga)" },
              { value: "sin-plan", label: etiquetaSinPlan ?? "No" },
            ]}
          />
        </Field>
      ) : null}

      {value.conceder ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Código de plan">
              <Input
                value={value.planCode}
                onChange={(event) =>
                  onChange({ ...value, planCode: event.target.value })
                }
                placeholder="consultant"
              />
            </Field>
            <Field label="Tiendas incluidas">
              <Input
                value={value.storeLimit}
                onChange={(event) =>
                  onChange({ ...value, storeLimit: event.target.value })
                }
                placeholder="1"
                disabled={value.sinLimite}
                inputMode="numeric"
              />
            </Field>
            <Field label="Usuarios incluidos">
              <Input
                value={value.memberLimit}
                onChange={(event) =>
                  onChange({ ...value, memberLimit: event.target.value })
                }
                placeholder="1"
                disabled={value.sinLimiteUsuarios}
                inputMode="numeric"
              />
            </Field>
            <Field label="Caduca (opcional)">
              <DatePicker
                value={value.endsAt}
                onChange={(date) =>
                  onChange({ ...value, endsAt: date })
                }
              />
            </Field>
          </div>

          <Checkbox
            checked={value.sinLimite}
            onCheckedChange={(sinLimite) => onChange({ ...value, sinLimite })}
          >
            Sin límite de tiendas
          </Checkbox>
          <Checkbox
            checked={value.sinLimiteUsuarios}
            onCheckedChange={(sinLimiteUsuarios) => onChange({ ...value, sinLimiteUsuarios })}
          >
            Sin límite de usuarios
          </Checkbox>
        </>
      ) : (
        <Banner tone="warn">{avisoSinPlan}</Banner>
      )}
    </div>
  );
}

/**
 * La ficha de un consultor o un cliente ya dado de alta: mostrar su plan de
 * hoy y ajustarlo, sin salir a /admin/facturacion.
 *
 * Reusa `/v1/admin/subscriptions` (`grantSubscription`) tal cual -- es la
 * misma operacion que conceder un plan al dar de alta, solo que el sujeto ya
 * existe. Ojo con `subjectId` para un consultor: tiene que ser el id de su
 * organizacion consultora (`subjectType: "organization"`), no el suyo propio
 * -- desde Fase 1 el plan que de verdad cuenta para el rol y la capacidad
 * vive ahi, no en una fila a nombre del usuario.
 */
export function PlanEditor({
  subjectType,
  subjectId,
  plan,
  onSaved,
}: {
  subjectType: "user" | "organization";
  subjectId: string;
  plan: { plan_code: string; store_limit: number | null; member_limit?: number | null; ends_at: string | null } | null;
  onSaved: (message: string) => void;
}) {
  const [value, setValue] = useState(() =>
    plan ? concesionDesde(plan) : concesionInicial("", true),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    setBusy(true);
    setError(null);
    try {
      const response = await apiFetch("/v1/admin/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject_type: subjectType,
          subject_id: subjectId,
          ...grantPlanBody(value),
        }),
      });
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      onSaved("Plan actualizado.");
    } catch {
      setError("No se pudo guardar el plan. Revisa la conexión e inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-3 border-t border-separator pt-4">
      <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted">
        Plan {plan ? `actual: ${plan.plan_code}` : "(sin plan concedido todavía)"}
      </p>
      {error ? <ErrorBlock>{error}</ErrorBlock> : null}
      <ConcesionDePlan value={value} onChange={setValue} soloEdicion />
      <div>
        <Button
          size="sm"
          disabled={busy || !concesionValida(value)}
          onClick={() => void guardar()}
        >
          {busy ? "Guardando..." : "Guardar plan"}
        </Button>
      </div>
    </div>
  );
}
