"use client";

import { useMemo, useState } from "react";
import { PlatformAdminShell } from "@/components/platform-admin-shell";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { useCachedQuery } from "@/lib/use-cached-query";
import {
  AsyncState,
  Badge,
  Banner,
  Button,
  Card,
  EYEBROW,
  Metric,
  Select,
  Table,
  toast,
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

type Proposal = {
  id: string;
  slug: string;
  kind: "sql_function" | "missing_data" | "delegated_analysis";
  title: string;
  need: string;
  benefit: string | null;
  sql_draft: string | null;
  status: "pending" | "accepted" | "rejected" | "done";
  occurrences: number;
  agent_codes: string[];
  organization_count: number;
  examples: Array<{ agent_code: string; at: string; text: string }>;
  last_seen_at: string;
};

const KIND_LABEL: Record<Proposal["kind"], string> = {
  sql_function: "Función SQL",
  missing_data: "Dato que falta",
  delegated_analysis: "Análisis delegado",
};

const STATUS_LABEL: Record<Proposal["status"], string> = {
  pending: "Pendiente",
  accepted: "Aceptada",
  rejected: "Descartada",
  done: "Hecha",
};

const STATUS_TONE: Record<Proposal["status"], Tone> = {
  pending: "warn",
  accepted: "brand",
  rejected: "neutral",
  done: "success",
};

/**
 * Bandeja de la IA: lo que los agentes piden convertir en función SQL, los
 * datos que no encuentran y las tareas que delegan cálculos al cliente.
 * Ordenada por repeticiones: lo que más se pide es lo que más tokens ahorra.
 */
function ProposalInbox() {
  const { data, error, isLoading, reload } = useCachedQuery<{ proposals: Proposal[] }>(
    "/v1/admin/capability-proposals",
  );
  const [filtro, setFiltro] = useState("abiertas");
  const [abierta, setAbierta] = useState<string | null>(null);

  async function decide(id: string, status: Proposal["status"]) {
    const response = await apiFetch(`/v1/admin/capability-proposals/${id}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!response.ok) {
      toast.danger(await readApiError(response));
      return;
    }
    toast.success(`Marcada como ${STATUS_LABEL[status].toLowerCase()}.`);
    reload();
  }

  if (isLoading || error || !data) {
    return (
      <AsyncState
        status={error ? "error" : "loading"}
        error={error}
        loadingLabel="Cargando la bandeja de la IA..."
      />
    );
  }

  const filas = data.proposals.filter((p) =>
    filtro === "abiertas" ? p.status === "pending" || p.status === "accepted" : filtro === "todas" || p.status === filtro,
  );
  const pendientes = data.proposals.filter((p) => p.status === "pending").length;

  const columns: TableColumnDef<Proposal>[] = [
    {
      key: "title",
      label: "Qué piden",
      render: (row) => (
        <div className="max-w-xl space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={row.kind === "delegated_analysis" ? "danger" : "brand"}>{KIND_LABEL[row.kind]}</Badge>
            <span className="font-medium">{row.title}</span>
          </div>
          <p className="text-sm text-muted">{row.need}</p>
          <button
            type="button"
            className="text-xs underline"
            aria-expanded={abierta === row.id}
            onClick={() => setAbierta(abierta === row.id ? null : row.id)}
          >
            {abierta === row.id ? "Ocultar casos" : `Ver casos (${row.examples.length})`}
          </button>
          {abierta === row.id ? (
            <div className="space-y-2 pt-1">
              {row.benefit ? <p className="text-sm">{row.benefit}</p> : null}
              {row.sql_draft ? (
                <pre className="max-h-48 overflow-auto rounded bg-default p-2 font-mono text-xs">{row.sql_draft}</pre>
              ) : null}
              {row.examples.map((example, index) => (
                <p key={index} className="text-xs text-muted">
                  <span className="font-mono">{agenteLegible(example.agent_code ?? "")}</span> ·{" "}
                  {new Date(example.at).toLocaleDateString("es-ES")} · {example.text}
                </p>
              ))}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      key: "occurrences",
      label: "Veces",
      render: (row) => (
        <div className="text-sm tabular-nums">
          <p className="font-medium">{row.occurrences}</p>
          <p className="text-muted">
            {row.organization_count} {row.organization_count === 1 ? "cliente" : "clientes"}
          </p>
        </div>
      ),
    },
    {
      key: "agent_codes",
      label: "Agentes",
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.agent_codes.map((code) => (
            <Badge key={code} tone="neutral">{agenteLegible(code)}</Badge>
          ))}
        </div>
      ),
    },
    {
      key: "status",
      label: "Estado",
      render: (row) => (
        <div className="flex flex-col items-start gap-2">
          <Badge tone={STATUS_TONE[row.status]}>{STATUS_LABEL[row.status]}</Badge>
          <div className="flex flex-wrap gap-1">
            {row.status === "pending" ? (
              <>
                <Button size="sm" onClick={() => decide(row.id, "accepted")}>Aceptar</Button>
                <Button size="sm" variant="secondary" onClick={() => decide(row.id, "rejected")}>Descartar</Button>
              </>
            ) : null}
            {row.status === "accepted" ? (
              <Button size="sm" onClick={() => decide(row.id, "done")}>Marcar hecha</Button>
            ) : null}
          </div>
        </div>
      ),
    },
  ];

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className={EYEBROW}>Bandeja de la IA</p>
          <h2 className="text-lg font-medium">
            Lo que piden los agentes{pendientes ? ` · ${pendientes} pendientes` : ""}
          </h2>
        </div>
        <Select
          aria-label="Filtrar propuestas"
          value={filtro}
          onChange={(value) => setFiltro(value)}
          options={[
            { value: "abiertas", label: "Abiertas" },
            { value: "done", label: "Hechas" },
            { value: "rejected", label: "Descartadas" },
            { value: "todas", label: "Todas" },
          ]}
        />
      </div>
      {filas.length ? (
        <Table ariaLabel="Propuestas de la IA" columns={columns} rows={filas} />
      ) : (
        <p className="text-sm text-muted">Nada pendiente.</p>
      )}
    </Card>
  );
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
    <div className="admin-module-body">
      <ProposalInbox />
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
