"use client";

import { useRouter } from "next/navigation";
import { useActiveOrganization } from "@/components/active-organization";
import { HeroBlock, StatusStrip } from "@/components/trabajo-ui";
import { useCachedQuery } from "@/lib/use-cached-query";
import { useProfitability } from "@/app/panel/panel-data";
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  ErrorBlock,
  LoadingBlock,
  ProgressBar,
  type Tone,
} from "@/components/ui";
import { BillingSection } from "./billing-section";

type Consultora = {
  organization_id: string;
  display_name: string | null;
  role: string | null;
  capacidad: { contracted: number; occupied: number; available: number };
} | null;

/**
 * Mi consultoría › Plan y plazas. Sustituye a «Clientes y tiendas», que solo
 * contaba y repetía Cartera. La facturación es la de la consultora (no la de
 * un cliente) y solo la ve su propietario.
 */
export function ConsultoraSection() {
  const query = useCachedQuery<{ consultora: Consultora }>("/v1/consultant/consultora");

  if (query.isLoading) return <LoadingBlock label="Cargando tu plan..." />;
  if (query.error) {
    return <ErrorBlock>No se pudo cargar tu plan. Revisa la conexión e inténtalo de nuevo.</ErrorBlock>;
  }
  const consultora = query.data?.consultora ?? null;
  if (!consultora) {
    return (
      <Card title="Plan y plazas">
        <EmptyState
          title="Tu cuenta no está en ninguna consultora"
          hint="Las plazas de cartera se contratan por consultora. Si eres consultor y ves esto, avisa a soporte."
        />
      </Card>
    );
  }

  const { contracted, occupied, available } = consultora.capacidad;
  const full = contracted > 0 && available === 0;
  return (
    <div className="space-y-4">
      <HeroBlock
        label={consultora.display_name ?? "Tu consultora"}
        title={
          contracted === 0
            ? "Tu plan no incluye plazas de cartera"
            : `${occupied} de ${contracted} plazas ocupadas`
        }
      >
        {full
          ? "No puedes dar de alta más clientes hasta ampliar el plan o liberar una plaza."
          : "Cada cliente activo y cada código de alta pendiente ocupa una plaza."}
      </HeroBlock>
      {contracted > 0 ? (
        <Card title="Plazas de cartera">
          <ProgressBar
            value={Math.min(100, (occupied / contracted) * 100)}
            aria-label={`${occupied} de ${contracted} plazas ocupadas`}
          >
            <ProgressBar.Track>
              <ProgressBar.Fill />
            </ProgressBar.Track>
          </ProgressBar>
          <div className="mt-4">
            <StatusStrip
              items={[
                { value: contracted, label: "Contratadas" },
                { value: occupied, label: "Ocupadas" },
                { value: available, label: "Libres", tone: full ? "warn" : undefined },
              ]}
            />
          </div>
        </Card>
      ) : null}
      {consultora.role === "owner" ? (
        <BillingSection organizationId={consultora.organization_id} />
      ) : (
        <Card title="Facturación de la consultora">
          <p className="text-sm text-muted">La gestiona el propietario de la consultora.</p>
        </Card>
      )}
    </div>
  );
}

type Cell = { label: string; tone: Tone };
const OK: Cell = { label: "Hecho", tone: "success" };
const MISSING: Cell = { label: "Falta", tone: "danger" };

/**
 * Configuración sin cliente activo: qué le falta a cada cliente para que su
 * beneficio sea fiable. Sale de los avisos de dato del Panel de rentabilidad
 * (no recalcula nada). Antes esta pantalla solo decía «Sin tienda activa».
 */
export function PortfolioSettingsMatrix() {
  const router = useRouter();
  const { setOrganizationId } = useActiveOrganization();
  const profitability = useProfitability(30, null);
  const clients = profitability.data?.clients ?? [];

  const open = (organizationId: string, section: string) => {
    setOrganizationId(organizationId);
    router.push(`/configuracion?section=${section}`);
  };

  const cellsOf = (client: (typeof clients)[number]) => {
    const has = (key: string) => client.flags.some((flag) => flag.key === key);
    const cogs: Cell = has("no_cogs") ? MISSING : has("partial_cogs") ? { label: "Incompleto", tone: "warn" } : OK;
    return [
      { key: "cogs", title: "Coste de producto", cell: cogs, section: "rentabilidad" },
      { key: "settings", title: "Pasarela y envío", cell: has("no_settings") ? MISSING : OK, section: "rentabilidad" },
      { key: "fixed", title: "Gastos fijos", cell: has("no_fixed") ? MISSING : OK, section: "rentabilidad" },
      { key: "target", title: "Objetivo de margen", cell: client.margin_target == null ? MISSING : OK, section: "objetivos" },
    ];
  };
  const pending = clients.filter((client) => cellsOf(client).some((item) => item.cell !== OK));

  return (
    <div className="space-y-4">
      <HeroBlock
        label="Vista general"
        title={
          profitability.isLoading
            ? "Revisando tu cartera…"
            : pending.length === 0
              ? "Todos tus clientes tienen la configuración completa"
              : `${pending.length} de ${clients.length} clientes tienen la configuración a medias`
        }
      >
        Sin costes ni gastos fijos, el beneficio de un cliente no es fiable. Elige
        uno para completarlo, o cambia de cliente en la cabecera.
      </HeroBlock>
      <Card title="Qué le falta a cada cliente" description="Solo clientes con Shopify conectado: sin pedidos no hay margen que calcular.">
        {profitability.error && !profitability.data ? (
          <ErrorBlock>No se pudo leer la cartera. Revisa la conexión e inténtalo de nuevo.</ErrorBlock>
        ) : profitability.isLoading ? (
          <LoadingBlock label="Leyendo la cartera..." />
        ) : clients.length === 0 ? (
          <EmptyState title="Aún no hay clientes con tienda" hint="Cuando un cliente conecte Shopify aparecerá aquí." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="pb-2 font-medium">Cliente</th>
                  {cellsOf(clients[0]!).map((item) => (
                    <th key={item.key} className="pb-2 text-center font-medium">{item.title}</th>
                  ))}
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-separator">
                {[...clients]
                  .sort((a, b) => Number(pending.includes(b)) - Number(pending.includes(a)))
                  .map((client) => {
                    const cells = cellsOf(client);
                    const firstGap = cells.find((item) => item.cell !== OK);
                    return (
                      <tr key={client.organization_id}>
                        <td className="py-3 pr-4 font-medium">{client.name}</td>
                        {cells.map((item) => (
                          <td key={item.key} className="py-3 text-center">
                            <Badge tone={item.cell.tone}>{item.cell.label}</Badge>
                          </td>
                        ))}
                        <td className="py-3 text-right">
                          {firstGap ? (
                            <Button size="sm" onClick={() => open(client.organization_id, firstGap.section)}>
                              Completar
                            </Button>
                          ) : (
                            <Button size="sm" variant="ghost" onClick={() => open(client.organization_id, "resumen")}>
                              Abrir
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <p className="text-xs text-muted">
        Tus plazas y tu facturación están en{" "}
        <ButtonLink href="/configuracion?section=consultora" size="sm" variant="ghost">
          Plan y plazas
        </ButtonLink>
      </p>
    </div>
  );
}
