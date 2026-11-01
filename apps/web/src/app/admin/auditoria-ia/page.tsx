"use client";

import { useState } from "react";
import { getAgentModelDecision } from "@e-nora/contracts";
import { PlatformAdminShell } from "@/components/platform-admin-shell";
import {
  AsyncState,
  Badge,
  Banner,
  Button,
  ButtonLink,
  DataTable,
  ErrorBlock,
  Field,
  Input,
  Link,
  type DataTableColumn,
} from "@/components/ui";
import { useCachedQuery } from "@/lib/use-cached-query";
import {
  AGENT_REVIEWS,
  AUDIT_DATE,
  FINDINGS,
  MODEL_OPTIONS,
  SOURCES,
} from "./audit-data";
import { READING_MODELS, readingCost } from "./reading-cost";

type Agent = {
  code: string;
  name: string;
  version_model?: string;
  runtime_default_model?: string;
  default_model: string;
  effective_model?: string;
  saved: { model: string | null; runs_per_day: number | null };
  cadence: string;
  profile: {
    input_total: number;
    cache_read: number;
    output: number;
    samples: number;
    source: string;
  };
};
type Inventory = {
  agents: Agent[];
  generated_at: string;
  prices_verified_on: string;
};
type Prices = {
  prices: Array<{
    model: string;
    input_per_mtok: number;
    output_per_mtok: number;
    source: string;
    checked_at: string;
  }>;
  in_use: { openai: string | null; anthropic: string | null };
  unpriced_runs: number;
};
const number = (n: number) =>
  n.toLocaleString("es-ES", { maximumFractionDigits: 0 });
const usd = (n: number) =>
  n.toLocaleString("es-ES", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 5,
  });
const date = (s: string) =>
  new Date(s).toLocaleString("es-ES", { timeZone: "Europe/Madrid" });
const section = "space-y-4 border-t border-line pt-6";

function ReadingComparison() {
  const [input, setInput] = useState("100000");
  const [cached, setCached] = useState("0");
  const [output, setOutput] = useState("10000");
  const values = [input, output, cached].map((v) =>
    v.trim() === "" ? NaN : Number(v),
  );
  const rows = READING_MODELS.map((model) => ({
    ...model,
    cost: readingCost(model, values[0]!, values[1]!, values[2]!),
  }));
  return (
    <section className={section} aria-labelledby="reading-title">
      <h2 id="reading-title" className="text-xl font-semibold">
        Qué cuesta leer el mismo contexto
      </h2>
      <p className="max-w-3xl text-sm text-muted">
        Estos tres modelos admiten 1 M de tokens de contexto. Eso mide
        capacidad, no garantiza la misma comprensión. La tarifa se aplica a los
        tokens consumidos en cada petición.
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Tokens de entrada totales">
          <Input
            type="number"
            min={0}
            step={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
        </Field>
        <Field label="De ellos, leídos de caché">
          <Input
            type="number"
            min={0}
            step={1}
            value={cached}
            onChange={(e) => setCached(e.target.value)}
          />
        </Field>
        <Field label="Tokens de salida">
          <Input
            type="number"
            min={0}
            max={128000}
            step={1}
            value={output}
            onChange={(e) => setOutput(e.target.value)}
          />
        </Field>
      </div>
      {rows.some((r) => !r.cost) ? (
        <Banner tone="warn">
          Introduce enteros positivos o cero, caché menor o igual a entrada,
          salida de hasta 128.000 y entrada + salida de hasta 1 M.
        </Banner>
      ) : null}
      <DataTable
        ariaLabel="Comparativa ilustrativa por petición · tarifas Standard en USD, consultadas el 27/10/2026"
        rows={rows}
        columns={[
          {
            key: "name",
            label: "Modelo",
            render: (r) => (
              <Link href={r.source} target="_blank" rel="noreferrer">
                {r.name}
              </Link>
            ),
          },
          {
            key: "input",
            label: "Entrada / M",
            render: (r) => usd(r.input * (r.cost?.longHaiku ? 5 : 1)),
          },
          {
            key: "cached",
            label: "Caché / M",
            render: (r) => usd(r.cached * (r.cost?.longHaiku ? 5 : 1)),
          },
          {
            key: "output",
            label: "Salida / M",
            render: (r) => usd(r.output * (r.cost?.longHaiku ? 5 : 1)),
          },
          {
            key: "cost",
            label: "Coste de esta petición",
            sortable: false,
            render: (r) =>
              r.cost ? (
                <span className="font-semibold tabular-nums">
                  {usd(r.cost.usd)}
                  {r.cost.longHaiku ? " · tramo >100K" : ""}
                </span>
              ) : (
                "Escenario no válido"
              ),
          },
        ]}
      />
      <p className="max-w-3xl text-sm text-muted">
        Haiku 5.5 multiplica por cinco estas tarifas al superar 100.000 tokens
        de entrada. Escenario sin creación de caché, herramientas de pago,
        retries, impuestos ni descuentos Batch. La salida debe incluir el
        razonamiento facturable. La caché indicada se supone ya disponible;
        cambiar de modelo no la conserva automáticamente.
      </p>
      <p className="max-w-3xl text-sm text-muted">
        Luna también merece evaluación: es el defecto actual de muchos agentes.
        Sus tarifas y tramos se consultan en{" "}
        <Link href={SOURCES.pricing} target="_blank" rel="noreferrer">
          OpenAI
        </Link>
        . El Haiku reducido actual del copiloto es{" "}
        <Link href={SOURCES.legacyHaiku} target="_blank" rel="noreferrer">
          4.5, con 200K de contexto
        </Link>
        ; no es Haiku 5.5.
      </p>
    </section>
  );
}

function Audit() {
  const inventory = useCachedQuery<Inventory>("/v1/admin/ai-cost-model");
  const prices = useCachedQuery<Prices>("/v1/admin/ai-model-prices");
  const [search, setSearch] = useState("");
  const live = new Map(
    inventory.data?.agents.map((agent) => [agent.code, agent]) ?? [],
  );
  // También muestra agentes nuevos sin recomendación; el inventario vivo no queda limitado a esta revisión.
  const codes = [
    ...new Set([...AGENT_REVIEWS.map((a) => a.code), ...live.keys()]),
  ];
  const rows = codes
    .map((code) => {
      const review = AGENT_REVIEWS.find((a) => a.code === code);
      const agent = live.get(code);
      return {
        id: code,
        code,
        name: agent?.name ?? review?.job ?? code,
        agent,
        review,
      };
    })
    .filter((r) =>
      `${r.code} ${r.name} ${r.review?.candidate ?? ""}`
        .toLocaleLowerCase("es")
        .includes(search.toLocaleLowerCase("es")),
    );
  type Row = (typeof rows)[number];
  const columns: DataTableColumn<Row>[] = [
    {
      key: "name",
      label: "Agente y función",
      render: (r) => (
        <div className="min-w-48 space-y-1">
          <strong>{r.name}</strong>
          <p className="text-xs text-muted">{r.code}</p>
          <p className="text-sm">{r.review?.job ?? "Pendiente de revisar"}</p>
        </div>
      ),
    },
    {
      key: "current",
      label: "Configuración consultada",
      sortable: false,
      render: (r) => (
        <div className="min-w-52 space-y-2 text-sm">
          {r.agent ? (
            <>
              {!getAgentModelDecision(r.code) ? (
                <p>
                  Versión:{" "}
                  <strong>
                    {r.agent.version_model ?? "API pendiente de actualizar"}
                  </strong>
                </p>
              ) : (
                <Badge tone="success">
                  Revisión cerrada · {getAgentModelDecision(r.code)!.label}
                </Badge>
              )}
              <p>
                Base de plataforma:{" "}
                <strong>
                  {r.agent.effective_model ??
                    r.agent.saved.model ??
                    r.agent.runtime_default_model ??
                    "No disponible"}
                </strong>
              </p>
              <p className="text-xs text-muted">
                {getAgentModelDecision(r.code)
                  ? r.code === "a01_analista_llamadas"
                    ? "Modelo fijo de plataforma para todas las duraciones de llamada."
                    : "Modelo fijo de plataforma para las vistas del Monitor."
                  : r.code === "a09_copiloto_consultor"
                    ? "El modelo final depende de usuario, plan y saldo."
                    : ["a02_monitor_negocio", "a29_analista_metrica"].includes(
                          r.code,
                        )
                      ? "Sin override del cliente; puede intervenir el fallback."
                      : "Modelo fijado por plataforma; puede intervenir el fallback."}
              </p>
              <p>{r.agent.cadence}</p>
            </>
          ) : (
            <span className="text-muted">
              {inventory.data
                ? "Sin versión activa devuelta por la API"
                : "Inventario no disponible"}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "reading",
      label: "Lectura y consumo",
      sortable: false,
      render: (r) => (
        <div className="min-w-48 space-y-2 text-sm">
          <p>{r.review?.reads ?? "Pendiente"}</p>
          {r.agent ? (
            <>
              <p className="tabular-nums">
                {number(r.agent.profile.input_total)} entrada ·{" "}
                {number(r.agent.profile.cache_read)} caché ·{" "}
                {number(r.agent.profile.output)} salida
              </p>
              <p className="text-xs text-muted">
                Media por ejecución · {r.agent.profile.source} ·{" "}
                {r.agent.profile.samples} muestras. Puede sumar varias
                peticiones.
              </p>
            </>
          ) : null}
        </div>
      ),
    },
    {
      key: "candidate",
      label: "Propuesta para evaluar",
      value: (r) => r.review?.candidate,
      render: (r) => (
        <div className="min-w-52 space-y-2 text-sm">
          <strong>{r.review?.candidate ?? "Pendiente"}</strong>
          <p>{r.review?.reason}</p>
        </div>
      ),
    },
    {
      key: "validation",
      label: "Validación y alcance",
      sortable: false,
      render: (r) => (
        <p className="min-w-48 text-sm">
          {r.review?.validation ??
            "Añadir evaluación de funciones, herramientas, calidad, latencia y coste."}
        </p>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone="success">A01 cerrado con Sol · resto en revisión</Badge>
        <span className="text-sm text-muted">
          Revisión de código y documentación: {AUDIT_DATE}
        </span>
        <ButtonLink href="/admin/costes-ia" variant="outline">
          Abrir Costes de IA
        </ButtonLink>
      </div>
      <p className="max-w-3xl">
        La política objetivo es un modelo predefinido por nosotros para cada
        agente y selección del usuario para el copiloto. Esta revisión distingue
        la configuración que devuelve la API de las propuestas para mejorarla.
        A01 ya tiene GPT-6.1 Sol fijado y su revisión cerrada.
      </p>
      <nav
        aria-label="Secciones de la auditoría"
        className="flex flex-wrap gap-4 text-sm"
      >
        <Link href="#estado-actual">Estado actual</Link>
        <Link href="#hallazgos">Problemas detectados</Link>
        <Link href="#reading-title">Comparar lectura</Link>
        <Link href="#inventario">Agente a agente</Link>
        <Link href="#plan">Orden de trabajo</Link>
      </nav>

      <section
        id="estado-actual"
        className={section}
        aria-labelledby="state-title"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="state-title" className="text-xl font-semibold">
            Estado actual
          </h2>
          <Button
            variant="outline"
            onClick={() => {
              inventory.reload();
              prices.reload();
            }}
          >
            Actualizar datos
          </Button>
        </div>
        {inventory.isLoading && !inventory.data ? (
          <AsyncState
            status="loading"
            loadingLabel="Consultando configuración de agentes…"
          />
        ) : null}
        {inventory.error ? (
          <ErrorBlock>
            No se pudo consultar el inventario: {inventory.error}. Puedes seguir
            leyendo la revisión de código y volver a actualizar.
          </ErrorBlock>
        ) : null}
        {inventory.data ? (
          <p className="text-sm">
            {inventory.data.agents.length} versiones activas devueltas por la
            API · consulta generada {date(inventory.data.generated_at)}.
            Perfiles: últimos 30 días si hay al menos tres ejecuciones válidas;
            en otro caso, estimación de pruebas o sin datos.
          </p>
        ) : null}
        {prices.error ? (
          <ErrorBlock>
            No se pudieron consultar las tarifas guardadas: {prices.error}
          </ErrorBlock>
        ) : prices.data ? (
          <div className="space-y-2 text-sm">
            <p>
              Defaults de entorno: OpenAI{" "}
              <strong>
                {prices.data.in_use.openai ?? "sin modelo explícito"}
              </strong>{" "}
              · Anthropic{" "}
              <strong>
                {prices.data.in_use.anthropic ?? "sin modelo explícito"}
              </strong>
              . Esto no confirma acceso, saldo ni proveedor ejecutado.
            </p>
            <p>
              Ejecuciones sin tarifa conocida:{" "}
              <strong>{number(prices.data.unpriced_runs)}</strong>.{" "}
              <Link href="/admin/observabilidad">
                Revisar ejecuciones y tarifas
              </Link>
              .
            </p>
            <DataTable
              ariaLabel="Tarifas guardadas por el sistema · USD por millón de tokens"
              rows={prices.data.prices.map((p) => ({ ...p, id: p.model }))}
              pageSize={5}
              columns={[
                { key: "model", label: "ID exacto" },
                {
                  key: "input_per_mtok",
                  label: "Entrada",
                  render: (p) => usd(Number(p.input_per_mtok)),
                },
                {
                  key: "output_per_mtok",
                  label: "Salida",
                  render: (p) => usd(Number(p.output_per_mtok)),
                },
                { key: "source", label: "Origen" },
                {
                  key: "checked_at",
                  label: "Última comprobación",
                  render: (p) => date(p.checked_at),
                },
              ]}
            />
          </div>
        ) : (
          <p className="text-sm text-muted">
            Tarifas guardadas pendientes de consulta.
          </p>
        )}
        <Banner tone="info">
          El modelo efectivamente utilizado se comprueba en cada ejecución de
          Observabilidad. Esta vista no consulta overrides por cliente ni valida
          conectividad con proveedores. Los hallazgos son una revisión fechada
          del código; las tablas de configuración se actualizan desde la API de
          este entorno.
        </Banner>
      </section>

      <section
        id="hallazgos"
        className={section}
        aria-labelledby="findings-title"
      >
        <h2 id="findings-title" className="text-xl font-semibold">
          Problemas detectados
        </h2>
        <div className="divide-y divide-line">
          {FINDINGS.map((finding) => (
            <article key={finding.title} className="space-y-2 py-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  tone={
                    "resolved" in finding && finding.resolved
                      ? "success"
                      : finding.priority === "Alta"
                        ? "danger"
                        : "warn"
                  }
                >
                  {"resolved" in finding && finding.resolved
                    ? "Corregido en código"
                    : finding.priority}
                </Badge>
                <h3 className="font-semibold">{finding.title}</h3>
              </div>
              <p className="max-w-4xl text-sm">{finding.detail}</p>
              <p className="max-w-4xl text-sm">
                <strong>Corrección propuesta:</strong> {finding.action}
              </p>
              <p className="break-words text-xs text-muted">
                Evidencia: {finding.evidence}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className={section} aria-labelledby="catalog-title">
        <h2 id="catalog-title" className="text-xl font-semibold">
          Dos proveedores, todo el catálogo como candidato
        </h2>
        <p className="max-w-3xl text-sm">
          Claude y OpenAI serán los proveedores. El selector actual de cuatro
          modelos no limita esta evaluación. Esta es una selección inicial del
          catálogo vigente; podemos incorporar otros modelos si resuelven mejor
          una función. El acceso concreto de nuestras cuentas y la
          compatibilidad se comprueban antes de activarlos.
        </p>
        <DataTable
          ariaLabel="Candidatos de Claude y OpenAI, documentación consultada el 27/10/2026"
          rows={MODEL_OPTIONS}
          pageSize={8}
          columns={[
            { key: "provider", label: "Proveedor" },
            {
              key: "id",
              label: "Modelo",
              render: (r) => (
                <Link href={r.source} target="_blank" rel="noreferrer">
                  {r.id}
                </Link>
              ),
            },
            { key: "use", label: "Dónde merece evaluación" },
          ]}
        />
        <p className="text-sm text-muted">
          Cada asignación debe fijar modelo, esfuerzo, herramientas y fallback.
          A01 ya integra GPT-6.1 Sol mediante Responses, razonamiento medio y
          herramientas. Los demás candidatos siguen pendientes de su cierre
          individual y no sustituyen la configuración aplicada.
        </p>
      </section>

      <ReadingComparison />

      <section
        id="inventario"
        className={section}
        aria-labelledby="inventory-title"
      >
        <h2 id="inventory-title" className="text-xl font-semibold">
          Agente a agente
        </h2>
        <p className="max-w-3xl text-sm text-muted">
          A01 está cerrado con Sol tras las pruebas del laboratorio. Para los
          otros agentes, los candidatos siguen siendo hipótesis basadas en su
          función y requieren revisión individual. Las decisiones cerradas
          coinciden con el runtime y con Costes de IA.
        </p>
        <Field label="Buscar por agente, función o candidato">
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Por ejemplo: retención, a24 o Haiku"
          />
        </Field>
        <p role="status" className="text-sm text-muted">
          {rows.length} agentes visibles
        </p>
        <DataTable
          ariaLabel="Inventario y propuesta de evaluación por agente"
          rows={rows}
          columns={columns}
          pageSize={10}
        />
      </section>

      <section id="plan" className={section} aria-labelledby="plan-title">
        <h2 id="plan-title" className="text-xl font-semibold">
          Orden de trabajo
        </h2>
        <ol className="max-w-4xl list-decimal space-y-3 pl-5 text-sm">
          <li>
            <strong>Corregir la base de costes:</strong> mismo catálogo para
            selección, runtime y simulador; conservar IDs reales y avisar cuando
            falten tarifas. Reconciliar tokens y costes con facturas.
          </li>
          <li>
            <strong>Fijar la política por agente:</strong> modelo, proveedor,
            esfuerzo y fallback aprobados por plataforma. Mantener selección del
            copiloto y probar plan y saldo.
          </li>
          <li>
            <strong>Evaluar por función:</strong> A01 ya está cerrado. Continuar
            con los demás uno a uno, comparando sus resultados y costes antes de
            fijar una decisión.
          </li>
          <li>
            <strong>Comparar con casos anonimizados:</strong> mismo conjunto de
            entradas, casos incompletos, contradicciones, salidas JSON y tools.
            Medir fidelidad, utilidad, errores críticos, latencia p95, retries y
            coste por resultado aceptado, con caché fría y caliente.
          </li>
          <li>
            <strong>Promover gradualmente:</strong> usar el laboratorio y los
            controles de release existentes; aprobar un modelo solo si mantiene
            calidad y reduce coste o mejora resultados de forma medible.
          </li>
        </ol>
        <p className="text-sm text-muted">
          La auditoría no aplica modelos ni cadencias. El coste completo por
          cliente debe sumar infraestructura, almacenamiento, embeddings, audio,
          integraciones y soporte; la comparativa anterior solo estima tokens de
          una petición.
        </p>
      </section>
    </div>
  );
}

export default function AiAuditPage() {
  return (
    <PlatformAdminShell title="Auditoría de IA">
      {() => <Audit />}
    </PlatformAdminShell>
  );
}
