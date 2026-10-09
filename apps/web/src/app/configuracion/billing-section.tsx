"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { useCachedQuery } from "@/lib/use-cached-query";
import { displayValue } from "@/lib/display-labels";
import type { CopilotBalance } from "@/components/copilot-saldo";
import { StatusStrip } from "@/components/trabajo-ui";
import {
  Badge,
  Banner,
  Button,
  Card,
  EmptyState,
  ErrorBlock,
  Link,
  List,
  LoadingBlock,
  toast,
  type Tone,
} from "@/components/ui";

/**
 * Plan, cobro y facturas del propietario. Todo viene de Stripe a través de
 * `/billing`; tarjeta, datos fiscales y cancelación se hacen en el portal de
 * Stripe (no se duplica ese formulario aquí).
 */

type Billing = {
  plan_code: string | null;
  status: string | null;
  stripe_connected: boolean;
  next_payment_at: string | null;
  amount: number | null;
  currency: string | null;
  interval: string | null;
  cancel_at_period_end: boolean;
  payment_method: { brand: string; last4: string } | null;
  invoices: Array<{
    id: string;
    number: string | null;
    created_at: string | null;
    total: number;
    currency: string;
    status: string | null;
    hosted_invoice_url: string | null;
    pdf_url: string | null;
  }>;
};

const INVOICE_STATUS: Record<string, { label: string; tone: Tone }> = {
  paid: { label: "Pagada", tone: "success" },
  open: { label: "Pendiente", tone: "warn" },
  uncollectible: { label: "Impagada", tone: "danger" },
  void: { label: "Anulada", tone: "neutral" },
  draft: { label: "Borrador", tone: "neutral" },
};

const INTERVAL: Record<string, string> = { month: "al mes", year: "al año" };

function money(value: number, currency: string) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency }).format(value);
}

function date(iso: string | null) {
  return iso
    ? new Date(iso).toLocaleDateString("es-ES", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";
}

export function BillingSection({ organizationId }: { organizationId: string }) {
  const billingQuery = useCachedQuery<Billing>(
    `/v1/organizations/${organizationId}/billing`,
  );
  const balanceQuery = useCachedQuery<CopilotBalance>(
    `/v1/organizations/${organizationId}/copilot/saldo`,
  );
  const [opening, setOpening] = useState(false);

  async function openPortal() {
    setOpening(true);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/billing/portal`,
        { method: "POST" },
      );
      if (!response.ok) {
        toast.danger(await readApiError(response));
        return;
      }
      const { url } = (await response.json()) as { url: string };
      window.location.assign(url);
    } catch {
      toast.danger("No se pudo abrir el portal de facturación. Reintenta.");
    } finally {
      setOpening(false);
    }
  }

  if (billingQuery.error) {
    return (
      <ErrorBlock>
        No se pudo cargar la facturación. Revisa la conexión e inténtalo de nuevo.
      </ErrorBlock>
    );
  }
  const billing = billingQuery.data;
  if (!billing) return <LoadingBlock label="Cargando plan y facturación..." />;

  const balance = balanceQuery.data;
  const canUsePortal = billing.stripe_connected;

  return (
    <div className="space-y-4">
      {billing.cancel_at_period_end ? (
        <Banner tone="warn">
          Tu plan se cancela el {date(billing.next_payment_at)}. Puedes reactivarlo
          desde el portal de facturación.
        </Banner>
      ) : null}

      <StatusStrip
        items={[
          {
            value: billing.plan_code ?? "Sin plan",
            label: "Plan actual",
            text: true,
            hint: billing.status ? displayValue(billing.status) : undefined,
          },
          {
            value:
              billing.amount !== null && billing.currency
                ? money(billing.amount, billing.currency)
                : "—",
            label: billing.interval
              ? `${INTERVAL[billing.interval] ?? billing.interval}, IVA aparte`
              : "Cuota",
          },
          {
            value: billing.cancel_at_period_end ? "Cancelado" : date(billing.next_payment_at),
            label: billing.cancel_at_period_end ? "Fin del plan" : "Próximo cobro",
            text: true,
          },
          {
            value: billing.payment_method
              ? `${billing.payment_method.brand} ··${billing.payment_method.last4}`
              : "—",
            label: "Método de pago",
            text: true,
          },
        ]}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card title="Saldo del Consultor IA">
          {balance ? (
            <>
              <p className="text-3xl font-semibold tabular-nums">
                {new Intl.NumberFormat("es-ES").format(balance.remaining)}
              </p>
              <p className="mt-1 text-xs text-muted">
                Se renueva el{" "}
                {new Date(balance.renews_at).toLocaleDateString("es-ES", {
                  day: "numeric",
                  month: "long",
                })}
                .
              </p>
            </>
          ) : (
            <LoadingBlock label="Leyendo saldo..." />
          )}
        </Card>
        <Card title="Datos de facturación">
          <p className="text-sm">
            Tarjeta, razón social, NIF y cancelación se gestionan en el portal
            seguro de Stripe.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => void openPortal()} disabled={!canUsePortal || opening}>
              {opening ? "Abriendo..." : "Gestionar facturación"}
            </Button>
            <Link href="/planes" className="inline-flex items-center text-sm">
              Cambiar de plan
            </Link>
          </div>
          {!canUsePortal ? (
            <p className="mt-3 text-xs text-muted">
              Tu plan no se cobra por Stripe, así que no hay portal que abrir.
            </p>
          ) : null}
        </Card>
      </div>

      <Card title="Facturas">
        {billing.invoices.length === 0 ? (
          <EmptyState title="Todavía no hay facturas" />
        ) : (
          <List>
            {billing.invoices.map((invoice) => {
              const status = invoice.status ? INVOICE_STATUS[invoice.status] : null;
              return (
                <List.Item
                  key={invoice.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{date(invoice.created_at)}</p>
                    <p className="text-xs text-muted">{invoice.number ?? "Sin número"}</p>
                  </div>
                  <span className="font-mono text-sm">
                    {money(invoice.total, invoice.currency)}
                  </span>
                  {status ? <Badge tone={status.tone}>{status.label}</Badge> : null}
                  {invoice.pdf_url ? (
                    <Link href={invoice.pdf_url} className="text-sm">
                      PDF
                    </Link>
                  ) : invoice.hosted_invoice_url ? (
                    <Link href={invoice.hosted_invoice_url} className="text-sm">
                      Ver
                    </Link>
                  ) : null}
                </List.Item>
              );
            })}
          </List>
        )}
      </Card>
    </div>
  );
}
