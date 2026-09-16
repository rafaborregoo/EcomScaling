"use client";

import { Banner, Field, Input, Select } from "@/components/ui";

/**
 * Quien paga, decidido en el mismo formulario que da de alta.
 *
 * Hasta ahora el alta desde /admin no preguntaba: al consultor se le concedia
 * SIEMPRE un plan activo sin limite de tiendas, y al cliente un trial. Ninguna
 * de las dos cosas se veia en pantalla ni se podia cambiar, asi que no habia
 * forma de decir "a este le doy el plan yo" ni "a este que lo pague".
 *
 * Se comparte entre el alta de consultor y la de cliente porque es la misma
 * decision y los mismos limites del backend (`buildGrantFields`): tenerlo dos
 * veces es como acaban divergiendo en cual pide el limite de tiendas.
 */

export type ConcesionDePlanValue = {
  conceder: boolean;
  planCode: string;
  storeLimit: string;
  sinLimite: boolean;
  endsAt: string;
};

/**
 * `conceder` arranca en lo que ya hacia cada alta antes de existir este
 * bloque: el consultor nacia con plan concedido y el cliente en trial. Abrir
 * la puerta no es motivo para mover el valor por defecto de nadie.
 */
export function concesionInicial(
  planCode: string,
  conceder: boolean,
): ConcesionDePlanValue {
  return {
    conceder,
    planCode,
    storeLimit: "1",
    sinLimite: false,
    endsAt: "",
  };
}

/** Lo que va en el cuerpo de la peticion. `null` = no se concede nada. */
export function grantPlanBody(valor: ConcesionDePlanValue) {
  if (!valor.conceder) return null;
  return {
    plan_code: valor.planCode.trim(),
    // Explicito a proposito, igual que en el backend: `null` es "sin limite",
    // no "no me he acordado".
    store_limit: valor.sinLimite ? null : Number.parseInt(valor.storeLimit, 10),
    ...(valor.endsAt ? { ends_at: new Date(valor.endsAt).toISOString() } : {}),
  };
}

export function concesionValida(valor: ConcesionDePlanValue) {
  if (!valor.conceder) return true;
  return (
    valor.planCode.trim() !== "" &&
    (valor.sinLimite || /^[1-9]\d*$/.test(valor.storeLimit))
  );
}

export function ConcesionDePlan({
  value,
  onChange,
  etiquetaSinPlan,
  avisoSinPlan,
}: {
  value: ConcesionDePlanValue;
  onChange: (valor: ConcesionDePlanValue) => void;
  /** Que significa no conceder aqui: "paga con tarjeta" o "empieza en trial". */
  etiquetaSinPlan: string;
  avisoSinPlan: string;
}) {
  return (
    <div className="grid gap-4">
      <Field label="Plan">
        <Select
          value={value.conceder ? "conceder" : "sin-plan"}
          onChange={(modo) => onChange({ ...value, conceder: modo === "conceder" })}
          options={[
            { value: "conceder", label: "Se lo concedo yo (no paga)" },
            { value: "sin-plan", label: etiquetaSinPlan },
          ]}
        />
      </Field>

      {value.conceder ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
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
            <Field label="Caduca (opcional)">
              <Input
                type="date"
                value={value.endsAt}
                onChange={(event) =>
                  onChange({ ...value, endsAt: event.target.value })
                }
              />
            </Field>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={value.sinLimite}
              onChange={(event) =>
                onChange({ ...value, sinLimite: event.target.checked })
              }
            />
            Sin límite de tiendas
          </label>
        </>
      ) : (
        <Banner tone="warn">{avisoSinPlan}</Banner>
      )}
    </div>
  );
}
