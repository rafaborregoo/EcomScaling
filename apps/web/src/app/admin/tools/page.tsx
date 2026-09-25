"use client";

import { useMemo, useState } from "react";
import { PlatformAdminShell } from "@/components/platform-admin-shell";
import { useCachedQuery } from "@/lib/use-cached-query";
import {
  AsyncState,
  Badge,
  Banner,
  Card,
  EYEBROW,
  Metric,
  Select,
  Table,
  type TableColumnDef,
  type Tone,
} from "@/components/ui";

/**
 * Catalogo de tools del copiloto.
 *
 * Contesta dos preguntas que hasta ahora exigian abrir `tool-layer.ts` y tres
 * migraciones a la vez: que sabe hacer un agente, y que agente puede hacerlo.
 *
 * La descripcion que se lee aqui es **la misma** que recibe el modelo
 * (`TOOL_DESCRIPTIONS` en packages/ai): si fueran dos textos se separarian, y
 * el panel acabaria describiendo una tool que ya no se comporta asi.
 */

type ToolRow = {
  name: string;
  version: string;
  permission: "read" | "propose" | "write" | "admin";
  status: "implemented_partial" | "planned" | "disabled";
  description: string;
  connector: "core" | "shopify" | "meta" | "klaviyo" | "instagram" | null;
  requires_approval: boolean;
  granted_to: string[];
};

type ToolCatalog = {
  tools: ToolRow[];
  totals: { total: number; implementadas: number; sin_agente: number };
};

const PERMISSION_LABEL: Record<ToolRow["permission"], string> = {
  read: "Lee",
  propose: "Propone",
  write: "Escribe",
  admin: "Admin",
};

// `propose` y `write` en ambar/rojo no es decoracion: es la diferencia entre
// una tool que mira y una que toca la tienda del cliente.
const PERMISSION_TONE: Record<ToolRow["permission"], Tone> = {
  read: "neutral",
  propose: "brand",
  write: "warn",
  admin: "danger",
};

const CONNECTOR_LABEL: Record<string, string> = {
  core: "E-NORA",
  shopify: "Shopify",
  meta: "Meta",
  klaviyo: "Klaviyo",
  instagram: "Instagram",
};

/** El nombre del agente sin el prefijo tecnico: `a09_copiloto_consultor` -> `a09 copiloto consultor`. */
function agenteLegible(code: string) {
  return code.replace(/_/g, " ");
}

function ToolCatalogPanel() {
  const { data, error, isLoading } = useCachedQuery<ToolCatalog>(
    "/v1/admin/tools",
  );
  const [filtro, setFiltro] = useState("implementadas");

  const filas = useMemo(() => {
    const todas = data?.tools ?? [];
    if (filtro === "implementadas") {
      return todas.filter((t) => t.status === "implemented_partial");
    }
    if (filtro === "sin_agente") {
      return todas.filter(
        (t) => t.status === "implemented_partial" && t.granted_to.length === 0,
      );
    }
    if (filtro === "planned") return todas.filter((t) => t.status === "planned");
    return todas;
  }, [data?.tools, filtro]);

  const columns: TableColumnDef<ToolRow & { id: string }>[] = [
    {
      key: "name",
      label: "Tool",
      render: (row) => (
        <div className="max-w-md space-y-1">
          <p className="font-mono text-xs">{row.name}</p>
          <p className="text-sm text-muted">{row.description}</p>
        </div>
      ),
    },
    {
      key: "connector",
      label: "Fuente",
      render: (row) => (
        <span className="text-sm">
          {row.connector ? CONNECTOR_LABEL[row.connector] : "—"}
        </span>
      ),
    },
    {
      key: "permission",
      label: "Qué hace",
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          <Badge tone={PERMISSION_TONE[row.permission]}>
            {PERMISSION_LABEL[row.permission]}
          </Badge>
          {row.requires_approval ? <Badge tone="warn">Pide aprobación</Badge> : null}
        </div>
      ),
    },
    {
      key: "granted_to",
      label: "Quién la usa",
      render: (row) =>
        row.granted_to.length === 0 ? (
          // Construida y sin agente que la llame: es la fila que justifica
          // esta pantalla, porque no se ve desde ningun otro sitio.
          <span className="text-sm text-muted">
            {row.status === "implemented_partial" ? "Ningún agente" : "—"}
          </span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {row.granted_to.map((code) => (
              <Badge key={code} tone="neutral">
                {agenteLegible(code)}
              </Badge>
            ))}
          </div>
        ),
    },
  ];

  if (isLoading || error || !data) {
    return (
      <AsyncState
        status={error ? "error" : "loading"}
        error={error}
        loadingLabel="Cargando catálogo de tools..."
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Metric card label="Tools en el catálogo" value={String(data.totals.total)} />
        <Metric
          card
          label="Construidas"
          value={String(data.totals.implementadas)}
          hint="El resto está declarado pero sin implementar"
        />
        <Metric
          card
          label="Sin agente que las use"
          value={String(data.totals.sin_agente)}
          tone={data.totals.sin_agente > 0 ? "warn" : "default"}
          hint="Construidas y que ningún agente puede llamar"
        />
      </div>

      {data.totals.sin_agente > 0 ? (
        <Banner tone="warn">
          Hay {data.totals.sin_agente}{" "}
          {data.totals.sin_agente === 1 ? "tool construida" : "tools construidas"}{" "}
          que ningún agente tiene concedida. Se conceden en la versión activa del
          agente (<span className="font-mono text-xs">allowed_tools</span>), con
          una migración.
        </Banner>
      ) : null}

      <Card>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className={EYEBROW}>Catálogo</p>
            <h2 className="text-lg font-medium">Qué sabe hacer el copiloto</h2>
          </div>
          <Select
            aria-label="Filtrar tools"
            value={filtro}
            onChange={(value) => setFiltro(value)}
            options={[
              { value: "implementadas", label: "Construidas" },
              { value: "sin_agente", label: "Sin agente" },
              { value: "planned", label: "Solo declaradas" },
              { value: "todas", label: "Todas" },
            ]}
          />
        </div>
        <Table
          ariaLabel="Catálogo de tools"
          columns={columns}
          rows={filas.map((tool) => ({ id: tool.name, ...tool }))}
        />
      </Card>
    </div>
  );
}

export default function ToolsPage() {
  return (
    <PlatformAdminShell title="Tools del copiloto">
      {() => <ToolCatalogPanel />}
    </PlatformAdminShell>
  );
}
