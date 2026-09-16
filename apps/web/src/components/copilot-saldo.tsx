"use client";

import { useState } from "react";
import { Button, Popover, Select } from "@/components/ui";

export type CopilotModelOption = {
  id: string;
  label: string;
  description: string;
};

export type CopilotBalance = {
  granted: number;
  used: number;
  remaining: number;
  approx_messages_left: number;
  renews_at: string;
  days_to_renewal: number;
  exhausted: boolean;
  tier: string;
  models?: CopilotModelOption[];
};

const formato = new Intl.NumberFormat("es-ES");

function fechaCorta(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
  });
}

/**
 * El saldo del copiloto, debajo del formulario.
 *
 * Se enseña lo que QUEDA y baja: empieza el mes en 1.000.000 y después de cada
 * respuesta muestra el nuevo número. Sin barras ni porcentajes -- un
 * porcentaje esconde justo lo que hace que esto sirva, que es ver el contador
 * moverse al preguntar.
 *
 * El popover existe porque un número suelto en pantalla da más preguntas de
 * las que responde: cuatro frases y un enlace, no un manual.
 */
export function CopilotSaldo({
  balance,
  model,
  onModelChange,
  degraded,
}: {
  balance: CopilotBalance | null;
  model: string;
  onModelChange: (model: string) => void;
  /** El último turno corrió en modo reducido por saldo agotado. */
  degraded: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);

  if (!balance) return null;

  const models = balance.models ?? [];
  const agotado = balance.exhausted;

  return (
    <div className="flex w-full items-center justify-between gap-2">
      <Popover isOpen={isOpen} onOpenChange={setIsOpen}>
        <Popover.Trigger>
          <button
            type="button"
            className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground"
            aria-label="Qué es este saldo de tokens"
          >
            <span
              aria-hidden
              className={
                agotado
                  ? "size-1.5 rounded-full bg-danger"
                  : "size-1.5 rounded-full bg-accent"
              }
            />
            {formato.format(balance.remaining)} tokens
          </button>
        </Popover.Trigger>
        <Popover.Content placement="top start" className="w-[20rem]">
          <Popover.Dialog
            aria-label="Saldo del copiloto"
            className="space-y-2 p-4"
          >
            <p className="text-sm font-medium">
              {agotado
                ? "Te has quedado sin saldo este mes"
                : `Te quedan ${formato.format(balance.remaining)} de ${formato.format(balance.granted)} tokens`}
            </p>
            <p className="text-xs text-muted">
              {agotado
                ? "El copiloto sigue respondiendo, pero en modo reducido hasta que se renueve."
                : `Dan para unas ${formato.format(balance.approx_messages_left)} preguntas más.`}
            </p>
            <p className="text-xs text-muted">
              Se renueva el {fechaCorta(balance.renews_at)}
              {balance.days_to_renewal > 0
                ? `, dentro de ${balance.days_to_renewal} días.`
                : "."}
            </p>
            {agotado ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setIsOpen(false)}
              >
                Ver planes
              </Button>
            ) : null}
          </Popover.Dialog>
        </Popover.Content>
      </Popover>

      {/* El selector va al lado del saldo, no en un menú de ajustes: elegir
          modelo y ver lo que queda son la misma decisión. */}
      {models.length > 1 ? (
        <Select
          aria-label="Modelo del copiloto"
          className="w-36"
          value={model}
          onChange={onModelChange}
          options={models.map((option) => ({
            value: option.id,
            label: option.label,
          }))}
        />
      ) : null}

      {degraded ? (
        <span className="text-xs text-muted">Modo reducido</span>
      ) : null}
    </div>
  );
}
