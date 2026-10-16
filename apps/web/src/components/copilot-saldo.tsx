"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, IconChevronDown, Popover } from "@/components/ui";
import styles from "./copilot-panel.module.css";

export type CopilotModelOption = {
  id: string;
  label: string;
  description: string;
  /** Media real de tokens por pregunta (entrada + salida). */
  approx_tokens_per_message?: number;
};

export type CopilotBalance = {
  granted: number;
  used: number;
  remaining: number;
  approx_messages_left: number;
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
    <Popover isOpen={isOpen} onOpenChange={setIsOpen}>
      <Popover.Trigger>
        <button
          type="button"
          className="flex min-h-8 items-center gap-1.5 rounded px-2 text-xs text-muted tabular-nums hover:bg-surface hover:text-foreground"
          aria-label={`Saldo: quedan ${formato.format(balance.remaining)} tokens`}
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
          {degraded || agotado ? "Modo reducido · Mejorar" : poco ? `${compacto.format(balance.remaining)} · Mejorar` : compacto.format(balance.remaining)}
        </button>
      </Popover.Trigger>
      <Popover.Content placement="top end" className="w-[20rem]">
        <Popover.Dialog aria-label="Saldo del copiloto" className="space-y-3 p-4">
          <p className="text-sm font-medium">
            {agotado
              ? "Te has quedado sin saldo este mes"
              : `Te quedan ${formato.format(balance.remaining)} de ${formato.format(balance.granted)} tokens`}
          </p>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface" aria-hidden>
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-700"
              style={{ width: `${fraction * 100}%` }}
            />
          </div>
          <p className="text-xs leading-5 text-muted">
            {agotado
              ? "El copiloto sigue respondiendo, pero en modo reducido hasta que se renueve."
              : `Dan para unas ${formato.format(balance.approx_messages_left)} preguntas más.`}{" "}
            Se renueva el {fechaCorta(balance.renews_at)}
            {balance.days_to_renewal > 0 ? `, dentro de ${balance.days_to_renewal} días.` : "."}
          </p>
          {agotado || poco ? (
            balance.can_upgrade ? (
              <Link
                href="/planes"
                className="inline-flex min-h-8 items-center rounded bg-accent px-3 text-xs font-medium text-white"
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
        </Popover.Dialog>
      </Popover.Content>
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
  /** Tokens que quedan, para traducir el coste a preguntas. */
  remaining?: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  if (models.length < 2) return null;
  const current = models.find((option) => option.id === model) ?? models[0]!;

  return (
    <Popover isOpen={isOpen} onOpenChange={setIsOpen}>
      <Popover.Trigger>
        <button
          type="button"
          className="flex min-h-8 items-center gap-1 rounded px-2 text-xs font-medium text-muted hover:bg-surface hover:text-foreground"
          aria-label={`Modelo: ${current.label}`}
        >
          {current.label}
          <IconChevronDown aria-hidden className="size-3" />
        </button>
      </Popover.Trigger>
      <Popover.Content placement="top start" className="w-[18rem]">
        <Popover.Dialog aria-label="Modelo del copiloto" className="p-1.5">
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
                {option.approx_tokens_per_message ? (
                  <span className="font-mono text-[0.68rem] text-muted tabular-nums">
                    ≈ {compacto.format(option.approx_tokens_per_message)} tokens por pregunta
                    {remaining !== undefined
                      ? ` · te quedan ≈ ${formato.format(Math.floor(remaining / option.approx_tokens_per_message))}`
                      : ""}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
