"use client";

import { useSettingsStatus } from "./settings-status";
import { Badge, Button, Card, ProgressBar, type Tone } from "@/components/ui";

/**
 * Qué falta para que las cifras de la tienda sean fiables. Cada fila sale de un
 * dato real (no de un porcentaje inventado) y lleva a la sección que lo arregla.
 */

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
  const status = useSettingsStatus(organizationId);
  const { fixedExpenses, targets, enabledAlerts, totalAlerts } = status.counts;

  const items: Item[] = [
    {
      key: "shopify",
      label: "Shopify conectado",
      done: status.shopify,
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
      done: status.costs,
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
      done: status.fixed,
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
      done: status.targets,
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
      done: status.alerts,
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
            done: status.consultant,
            section: "consultor",
            action: "Ver",
            next: {
              title: "Todavía no tienes consultor asignado",
              body: "El módulo Chats se activa solo en cuanto te asignen uno.",
            },
          } satisfies Item,
        ]),
    {
      key: "twoFactor",
      label: "Verificación en dos pasos",
      done: status.twoFactor,
      section: "seguridad",
      action: "Activar",
      next: {
        title: isConsultant
          ? "Activa la verificación en dos pasos: entras en las tiendas de todos tus clientes"
          : "Activa la verificación en dos pasos",
        body: "Con la contraseña sola, quien la consiga entra. Con el código de tu móvil, no.",
      },
    },
  ];

  const known = items.filter((item) => item.done !== null);
  const doneCount = known.filter((item) => item.done).length;
  const pending = items.filter((item) => item.done === false);
  const nextItem = pending[0] ?? null;
  const go = (item: Item) =>
    item.section.startsWith("/")
      ? window.location.assign(item.section)
      : onNavigate(item.section);

  // Cada sección con su estado en una línea: el mapa entero de Configuración.
  const tiles: Array<{ section: string; title: string; detail: string; badge: string; tone: Tone }> = [
    {
      section: "/integraciones",
      title: "Integraciones",
      detail: "Las conexiones que alimentan tus cifras.",
      badge: status.shopify === false ? "Falta Shopify" : status.shopify ? "Shopify conectado" : "…",
      tone: status.shopify === false ? "danger" : "success",
    },
    {
      section: "rentabilidad",
      title: "Costes y márgenes",
      detail: `${fixedExpenses ?? "—"} gastos fijos, comisiones y envío.`,
      badge: status.costs && status.fixed ? "Completo" : "A medias",
      tone: status.costs && status.fixed ? "success" : "warn",
    },
    {
      section: "objetivos",
      title: "Objetivos",
      detail: "La cifra a batir en cada métrica.",
      badge: `${targets ?? "—"} fijados`,
      tone: targets ? "success" : "warn",
    },
    {
      section: "alertas",
      title: "Alertas",
      detail: "Avisos de stock, ventas e integraciones.",
      badge: enabledAlerts !== null && totalAlerts !== null ? `${enabledAlerts} de ${totalAlerts}` : "…",
      tone: enabledAlerts ? "success" : "warn",
    },
    ...(isConsultant
      ? []
      : [
          {
            section: "consultor",
            title: "Tu consultor",
            detail: "Quién te asesora y qué puede tocar.",
            badge: status.consultant ? "Asignado" : "Sin asignar",
            tone: (status.consultant ? "brand" : "neutral") as Tone,
          },
        ]),
    {
      section: "notificaciones",
      title: "Notificaciones",
      detail: "Qué te avisamos y por dónde.",
      badge: "Ajustar",
      tone: "neutral",
    },
    {
      section: "seguridad",
      title: "Seguridad y actividad",
      detail: "Verificación en dos pasos y quién cambió qué.",
      badge: status.twoFactor ? "2FA activa" : "Sin 2FA",
      tone: status.twoFactor ? "success" : "warn",
    },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <div className="grid gap-8 md:grid-cols-2 md:items-center">
          <div>
            <p className="text-sm text-muted">Configuración completa</p>
            <p className="mt-1 text-5xl font-semibold tabular-nums leading-none">
              {doneCount} <span className="text-xl font-medium text-muted">de {items.length} ajustes</span>
            </p>
            <ProgressBar
              className="mt-4"
              value={items.length ? (doneCount / items.length) * 100 : 0}
              aria-label={`${doneCount} de ${items.length} ajustes listos`}
            >
              <ProgressBar.Track>
                <ProgressBar.Fill />
              </ProgressBar.Track>
            </ProgressBar>
          </div>
          {nextItem ? (
            <div className="grid justify-items-start gap-2 rounded-lg bg-surface p-6">
              <p className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted">Lo siguiente</p>
              <p className="text-base font-semibold">{nextItem.next.title}</p>
              <p className="text-sm text-muted">{nextItem.next.body}</p>
              <Button className="mt-2" onClick={() => go(nextItem)}>
                {nextItem.action}
              </Button>
            </div>
          ) : known.length === items.length ? (
            <div className="grid gap-2 rounded-lg bg-surface p-6">
              <p className="text-base font-semibold">Todo en orden</p>
              <p className="text-sm text-muted">Tus cifras se calculan con tus costes, tus gastos y tus objetivos reales.</p>
            </div>
          ) : null}
        </div>
      </Card>

      {pending.length > 1 ? (
        <Card title="Por arreglar">
          <ul className="divide-y divide-separator">
            {pending.map((item) => (
              <li key={item.key} className="flex flex-wrap items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted">{item.next.body}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => go(item)}>
                  {item.action}
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {tiles.map((tile) => (
          <button
            key={tile.section}
            type="button"
            onClick={() =>
              tile.section.startsWith("/") ? window.location.assign(tile.section) : onNavigate(tile.section)
            }
            className="grid min-h-32 content-start gap-2 rounded-lg border border-edge bg-white p-6 text-left transition-colors hover:border-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            <span className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold">{tile.title}</span>
              <Badge tone={tile.tone}>{tile.badge}</Badge>
            </span>
            <span className="text-xs text-muted">{tile.detail}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
