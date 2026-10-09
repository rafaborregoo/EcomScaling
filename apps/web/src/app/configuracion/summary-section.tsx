"use client";

import { useCachedQuery } from "@/lib/use-cached-query";
import { useAssignedConsultant } from "@/hooks/use-assigned-consultant";
import { HeroBlock, StatusStrip, heroPrimary } from "@/components/trabajo-ui";
import { Button, Card, List } from "@/components/ui";

/**
 * Qué falta para que las cifras de la tienda sean fiables. Cada fila sale de un
 * dato real (no de un porcentaje inventado) y lleva a la sección que lo arregla.
 */

type Config = {
  settings: unknown;
  fixed_expenses: unknown[];
  metric_targets: unknown[];
};

type Item = {
  key: string;
  label: string;
  /** null = todavía no se sabe. */
  done: boolean | null;
  section: string;
  action: string;
  /** Frase del hero cuando es lo siguiente que falta. */
  next: { title: string; body: string };
};

export function SummarySection({
  organizationId,
  isConsultant,
  onNavigate,
}: {
  organizationId: string;
  isConsultant: boolean;
  onNavigate: (section: string) => void;
}) {
  const base = `/v1/organizations/${organizationId}`;
  const config = useCachedQuery<Config>(`${base}/financial-config`);
  const rules = useCachedQuery<{ rules: Array<{ is_enabled: boolean }> }>(`${base}/alert-rules`);
  const integrations = useCachedQuery<{
    providers: Array<{ id: string; connection: { status: string } | null }>;
  }>(`${base}/integrations`);
  const { consultant, resolved } = useAssignedConsultant(organizationId);

  const shopifyConnected = integrations.data
    ? integrations.data.providers.some(
        (provider) =>
          provider.id.toLowerCase().includes("shopify") &&
          provider.connection?.status === "connected",
      )
    : null;
  const enabledAlerts = rules.data
    ? rules.data.rules.filter((rule) => rule.is_enabled).length
    : null;
  const totalAlerts = rules.data?.rules.length ?? null;
  const fixedExpenses = config.data ? config.data.fixed_expenses.length : null;
  const targets = config.data ? config.data.metric_targets.length : null;

  const items: Item[] = [
    {
      key: "shopify",
      label: "Shopify conectado",
      done: shopifyConnected,
      section: "/integraciones",
      action: "Conectar",
      next: {
        title: "Conecta Shopify para tener tus cifras reales",
        body: "Sin la tienda conectada no hay pedidos ni productos con los que calcular nada.",
      },
    },
    {
      key: "costs",
      label: "Comisión de pago y envío medio",
      done: config.data ? config.data.settings !== null : null,
      section: "rentabilidad",
      action: "Configurar",
      next: {
        title: "Indica tus costes por pedido",
        body: "La comisión de pago y el envío medio son lo que separa ingresos de margen real.",
      },
    },
    {
      key: "fixed",
      label: "Gastos fijos del mes",
      done: fixedExpenses === null ? null : fixedExpenses > 0,
      section: "rentabilidad",
      action: "Añadir",
      next: {
        title:
          "Añade tus gastos fijos: sin ellos el punto de equilibrio es una estimación",
        body: "Nóminas, alquiler, herramientas como Klaviyo o Shopify. Con un importe mensual por gasto basta.",
      },
    },
    {
      key: "targets",
      label: "Objetivos de tus métricas",
      done: targets === null ? null : targets > 0,
      section: "objetivos",
      action: "Fijar",
      next: {
        title: "Fija un objetivo para tus cifras clave",
        body: "Con un objetivo, el panel enseña si una cifra va bien o mal sin que tengas que recordarlo.",
      },
    },
    {
      key: "alerts",
      label: "Alertas encendidas",
      done: enabledAlerts === null ? null : enabledAlerts > 0,
      section: "alertas",
      action: "Revisar",
      next: {
        title: "Enciende al menos una alerta",
        body: "Te avisamos cuando el stock baja o las ventas caen, antes de que lo notes en la caja.",
      },
    },
    ...(isConsultant
      ? []
      : [
          {
            key: "consultant",
            label: "Consultor asignado",
            done: resolved ? Boolean(consultant) : null,
            section: "tienda",
            action: "Ver",
            next: {
              title: "Todavía no tienes consultor asignado",
              body: "El módulo Chats se activa solo en cuanto te asignen uno.",
            },
          } satisfies Item,
        ]),
  ];

  const known = items.filter((item) => item.done !== null);
  const doneCount = known.filter((item) => item.done).length;
  const nextItem = items.find((item) => item.done === false) ?? null;
  const go = (item: Item) =>
    item.section.startsWith("/")
      ? window.location.assign(item.section)
      : onNavigate(item.section);

  return (
    <div className="space-y-4">
      {nextItem ? (
        <HeroBlock
          label="Lo siguiente"
          title={nextItem.next.title}
          actions={
            <button
              type="button"
              className={heroPrimary}
              onClick={() => go(nextItem)}
            >
              {nextItem.action}
            </button>
          }
        >
          {nextItem.next.body}
        </HeroBlock>
      ) : known.length === items.length ? (
        <HeroBlock label="Todo en orden" title="Tu configuración está completa">
          Tus cifras se calculan con tus costes, tus gastos y tus objetivos reales.
        </HeroBlock>
      ) : null}

      <StatusStrip
        items={[
          {
            value: `${doneCount} de ${items.length}`,
            label: "Pasos completos",
            tone: doneCount === items.length ? "good" : undefined,
          },
          {
            value: fixedExpenses ?? "—",
            label: "Gastos fijos",
            tone: fixedExpenses === 0 ? "warn" : undefined,
          },
          { value: targets ?? "—", label: "Objetivos activos" },
          {
            value:
              enabledAlerts !== null && totalAlerts !== null
                ? `${enabledAlerts} de ${totalAlerts}`
                : "—",
            label: "Alertas encendidas",
          },
        ]}
      />

      <Card title="Para que tus cifras sean fiables">
        <List>
          {items.map((item) => (
            <List.Item
              key={item.key}
              className="flex items-center justify-between gap-4 py-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  aria-hidden
                  className={
                    item.done
                      ? "grid size-5 shrink-0 place-items-center rounded-full bg-success text-xs font-bold text-white"
                      : "grid size-5 shrink-0 place-items-center rounded-full border border-dashed border-warning text-xs font-bold text-warning"
                  }
                >
                  {item.done ? "✓" : item.done === false ? "!" : ""}
                </span>
                <span className="text-sm">{item.label}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => go(item)}>
                {item.done ? "Ver" : item.action}
              </Button>
            </List.Item>
          ))}
        </List>
      </Card>
    </div>
  );
}
