"use client";

import { buttonVariants } from "@/components/ui/button";
import Link from "next/link";
import { useState } from "react";
import { Button, IconChevronDown, Popover, PopoverContent, PopoverTrigger, Progress } from "@/components/ui";
import styles from "./copilot-panel.module.css";

export type CopilotModelOption = {
  id: string;
  label: string;
  description: string;
  input_credits_per_1k?: number | null;
  output_credits_per_1k?: number | null;
  example_credits?: number | null;
};

export type CopilotBalance = {
  granted: number;
  used: number;
  remaining: number;
  approx_messages_left: number | null;
  unit?: "credits";
  by_model?: Array<{ model: string; runs: number; credits: number; cost_usd: number }>;
  renews_at: string;
  days_to_renewal: number;
  exhausted: boolean;
  /** Solo el propietario del plan que paga el saldo puede subirlo. */
  can_upgrade?: boolean;
  tier: string;
  models?: CopilotModelOption[];
};

const formato = new Intl.NumberFormat("es-ES");
const compacto = new Intl.NumberFormat("es-ES", { notation: "compact", maximumFractionDigits: 0 });

function fechaCorta(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
  });
}

// Circunferencia del anillo de 16 px (r = 8).
const RING = 2 * Math.PI * 8;

/**
 * El saldo del copiloto, dentro de la barra del compositor.
 *
 * Un anillo que se vacía y la cifra de lo que QUEDA en compacto ("812 k"):
 * se ve bajar al preguntar sin ocupar una fila. El detalle (cuánto queda,
 * para cuántas preguntas da, cuándo se renueva) está a un clic.
 */
export function CopilotSaldo({
  balance,
  degraded,
}: {
  balance: CopilotBalance | null;
  /** El último turno corrió en modo reducido por saldo agotado. */
  degraded: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);

  if (!balance) return null;

  const agotado = balance.exhausted;
  const fraction = balance.granted > 0 ? Math.max(0, Math.min(1, balance.remaining / balance.granted)) : 0;
  const poco = !agotado && fraction < 0.2;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger
        render={<button
          type="button"
          className="flex min-h-8 items-center gap-1.5 rounded px-2 text-xs text-muted tabular-nums hover:bg-surface hover:text-foreground"
          aria-label={`Saldo: quedan ${formato.format(balance.remaining)} créditos`}
        >
          <svg viewBox="0 0 20 20" className={`size-4 ${styles.ring}`} aria-hidden>
            <circle cx="10" cy="10" r="8" fill="none" stroke="var(--color-line, #e2e2e2)" strokeWidth="3" />
            <circle
              cx="10"
              cy="10"
              r="8"
              fill="none"
              stroke={agotado ? "var(--danger)" : poco ? "var(--warning)" : "var(--accent)"}
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={RING}
              strokeDashoffset={RING * (1 - fraction)}
            />
          </svg>
          {degraded || agotado ? "Modo reducido · Mejorar" : poco ? `${compacto.format(balance.remaining)} créditos · Mejorar` : `${compacto.format(balance.remaining)} créditos`}
        </button>}
      />
      <PopoverContent side="top" align="end" className="w-[20rem]" aria-label="Saldo del copiloto">
        <div className="space-y-3">
          <p className="text-sm font-medium">
            {agotado
              ? "Te has quedado sin saldo este mes"
              : `Te quedan ${formato.format(balance.remaining)} de ${formato.format(balance.granted)} créditos`}
          </p>
          <Progress value={fraction * 100} aria-label="Saldo restante del copiloto" />
          <p className="text-xs leading-5 text-muted">
            {agotado
              ? "El copiloto sigue respondiendo, pero en modo reducido hasta que se renueve."
              : "Los modelos más caros consumen más créditos. Se suman entrada, salida y caché según su coste."}{" "}
            Se renueva el {fechaCorta(balance.renews_at)}
            {balance.days_to_renewal > 0 ? `, dentro de ${balance.days_to_renewal} días.` : "."}
          </p>
          {balance.by_model?.length ? (
            <div className="space-y-1 text-xs text-muted">
              <p className="font-medium">Consumo del mes por modelo</p>
              {balance.by_model.map((item) => <p key={item.model}>{item.model}: {formato.format(item.credits)} créditos</p>)}
            </div>
          ) : null}
          {agotado || poco ? (
            balance.can_upgrade ? (
              <Link
                href="/planes"
                className={buttonVariants({ size: "sm" })}
              >
                Mejorar plan
              </Link>
            ) : (
              <p className="text-xs leading-5 text-muted">
                Para ampliar el saldo, avisa al propietario del plan o a tu consultor.
              </p>
            )
          ) : null}
          {agotado ? (
            <Button size="sm" variant="secondary" onClick={() => setIsOpen(false)}>
              Entendido
            </Button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Selector de modelo junto al saldo: elegir modelo y ver lo que queda son la misma decisión. */
export function CopilotModelMenu({
  models,
  model,
  onModelChange,
  remaining,
}: {
  models: CopilotModelOption[];
  model: string;
  onModelChange: (model: string) => void;
  /** Créditos que quedan en el banco compartido. */
  remaining?: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  if (models.length < 2) return null;
  const current = models.find((option) => option.id === model) ?? models[0]!;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger
        render={<button
          type="button"
          className="flex min-h-8 items-center gap-1 rounded px-2 text-xs font-medium text-muted hover:bg-surface hover:text-foreground"
          aria-label={`Modelo: ${current.label}`}
        >
          {current.label}
          <IconChevronDown aria-hidden className="size-3" />
        </button>}
      />
      <PopoverContent side="top" align="start" className="w-[18rem] p-1.5" aria-label="Modelo del copiloto">
        <div>
          <div role="radiogroup" aria-label="Modelo del copiloto" className="grid gap-0.5">
            {models.map((option) => (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={option.id === model}
                onClick={() => {
                  onModelChange(option.id);
                  setIsOpen(false);
                }}
                className="grid gap-0.5 rounded px-3 py-2 text-left hover:bg-surface aria-checked:bg-accent-soft"
              >
                <span className={`text-sm font-semibold ${option.id === model ? "text-accent" : "text-foreground"}`}>
                  {option.label}
                </span>
                {option.description ? (
                  <span className="text-xs text-muted">{option.description}</span>
                ) : null}
                {option.example_credits != null ? (
                  <span className="font-mono text-[0.68rem] text-muted tabular-nums">
                    {formato.format(option.example_credits)} créditos: ejemplo de 10.000 tokens de entrada + 1.000 de salida, sin caché
                  </span>
                ) : null}
              </button>
            ))}
          </div>
          <p className="px-3 py-2 text-xs text-muted">El consumo real depende del contexto, la respuesta y las llamadas a herramientas. La caché se descuenta a su tarifa reducida.{remaining !== undefined ? ` Saldo: ${formato.format(remaining)} créditos.` : ""}</p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
