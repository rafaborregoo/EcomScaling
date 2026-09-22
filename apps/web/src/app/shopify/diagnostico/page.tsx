"use client";

import { useEffect, useState } from "react";
import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
import { useActiveConnection } from "@/components/active-connection";
import { ContextReadingsPanel } from "./context-readings";
import { CapabilityHealthPanel } from "./capability-health";
import { CausalPathsPanel } from "./causal-paths";
import { HypothesesPanel } from "./hypotheses";
import { RootCausePanel } from "./root-cause";
import { AdversarialPanel } from "./adversarial";
import { ConfidencePanel } from "./confidence-panel";
import { TemporalPanel } from "./temporal";
import { DiagnosticOutputPanel } from "./diagnostic-output";
import { PrioritizationPanel } from "./prioritization";
import { DecisionContextPanel } from "./decision-context";
import { TemporalUrgencyPanel } from "./temporal-urgency";
import { DecisionImpactPanel } from "./decision-impact";
import { ConstraintsPanel } from "./constraints";
import { FeasibilityPanel } from "./feasibility";
import { F4DimensionsPanel } from "./f4-dimensions";
import { PlaybookFrameworkPanel } from "./playbook";
import { AcquisitionPlaybookPanel } from "./acquisition";
import { PaidMediaPlaybookPanel } from "./paid-media";
import { ConversionCroPlaybookPanel } from "./conversion";
import { OfferPricingPlaybookPanel } from "./offer-pricing";
import { RetentionCrmPlaybookPanel } from "./retention-crm";
import { UnitEconomicsPlaybookPanel } from "./unit-economics";
import { ProductInventoryPlaybookPanel } from "./product-inventory";
import { OperationsCxPlaybookPanel } from "./operations-cx";
import { MeasurementExperimentationPlaybookPanel } from "./measurement-experimentation";
import { ScalabilityPlaybookPanel } from "./scalability";
import { PlaybookDiagnosticOverviewPanel } from "./playbook-overview";
import { RecoveryCrisisPlaybookPanel } from "./recovery-crisis";
import { BenchmarkGuardrailsPanel } from "./benchmark-guardrails";
import { CohortContextPanel } from "./cohort-context";
import { DataQualityReliabilityPanel } from "./data-quality-reliability";
import { AcquisitionDemandPanel } from "./acquisition-demand";
import { PaidMediaBenchmarksPanel } from "./paid-media-benchmarks";
import { ConversionCroBenchmarksPanel } from "./conversion-cro-benchmarks";
import { OfferPricingBenchmarksPanel } from "./offer-pricing-benchmarks";
import { RetentionCrmBenchmarksPanel } from "./retention-crm-benchmarks";
import { UnitEconomicsBenchmarksPanel } from "./unit-economics-benchmarks";
import { OperationsCxBenchmarksPanel } from "./operations-cx-benchmarks";
import { ProductInventoryBenchmarksPanel } from "./product-inventory-benchmarks";
import { ScalabilityBenchmarksPanel } from "./scalability-benchmarks";
import { AnomaliesRedFlagsPanel } from "./anomalies-red-flags";
import { BenchmarkConfidencePanel } from "./benchmark-confidence";
import { InterventionEligibilityPanel } from "./intervention-eligibility";
import { InterventionMatchingPanel } from "./intervention-matching";
import { InterventionPrioritizationPanel } from "./intervention-prioritization";
import { InterventionImpactPanel } from "./intervention-impact";
import { InterventionFeasibilityPanel } from "./intervention-feasibility";
import { InterventionRiskPanel } from "./intervention-risk";
import { InterventionSequencingPanel } from "./intervention-sequencing";
import { InterventionTestExecutePanel } from "./intervention-test-execute";
import { InterventionIntensityPanel } from "./intervention-intensity";
import { MaturityRecommendationsPanel } from "./maturity-recommendations";
import { ConstraintRecommendationsPanel } from "./constraint-recommendations";
import { RecommendationPortfolioPanel } from "./recommendation-portfolio";
import { DynamicDecisionPanel } from "./dynamic-decision";
import { RestraintDecisionPanel } from "./restraint-decision";
import { ExpectedOutcomePanel } from "./expected-outcome";
import { RecommendationConfidencePanel } from "./recommendation-confidence";
import { RecommendationCommunicationPanel } from "./recommendation-communication";
import { ExecutionLifecyclePanel } from "./execution-lifecycle";
import { HitlApprovalPanel } from "./hitl-approval";
import { ClosureHandoffPanel } from "./closure-handoff";
import { ExecutionPlanPanel } from "./execution-plan";
import { ReadinessPanel } from "./readiness";
import { ActionEnvelopePanel } from "./action-envelope";
import { ExecutionSupervisionPanel } from "./execution-supervision";
import { ContinuousLearningPanel } from "./continuous-learning";
import { HealthReferencesPanel } from "./health-references";
import { MaturityPanel } from "./maturity-panel";
import { SeverityPanel } from "./severity-panel";
import { SignalListPanel } from "./signal-list";
import { SymptomMapPanel } from "./symptom-map";
import { type BootstrapResponse } from "@/lib/bootstrap";
import { formatMoney } from "@/lib/money";
import {
  useShopifyOverview,
  type ShopifyOverview,
} from "@/hooks/use-shopify-overview";
import { usePaginatedUrl } from "@/hooks/use-paginated-url";
import { displayBoolean, displayValue } from "@/lib/display-labels";
import {
  AsyncState,
  LoadingBlock,
  Banner,
  Card,
  EmptyState,
  ErrorBlock,
  EYEBROW,
  IconChevronLeft,
  Link,
  Pagination,
  Table,
  Tabs,
  type TableColumnDef,
} from "@/components/ui";

const syncBlockLabels: Record<
  "catalog" | "inventory" | "orders" | "refunds" | "customers",
  string
> = {
  catalog: "Catalogo",
  inventory: "Inventario",
  orders: "Pedidos",
  refunds: "Reembolsos",
  customers: "Clientes",
};

function blockStatusLabel(status: string | undefined) {
  switch (status) {
    case "running":
      return "sincronizando";
    case "succeeded":
      return "ok";
    case "failed":
      return "error";
    default:
      return "sin sync";
  }
}

function blockStatusClass(status: string | undefined) {
  switch (status) {
    case "running":
      return "text-accent";
    case "succeeded":
      return "text-foreground";
    case "failed":
      return "text-danger";
    default:
      return "text-muted";
  }
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "n/a";
  }
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}


const PAGE_SIZE = 10;

type SummaryRow = { id: string; field: string; value: string; detail: string };

const summaryColumns: TableColumnDef<SummaryRow>[] = [
  {
    key: "field",
    label: "Campo",
    render: (row) => (
      <span className={EYEBROW}>{row.field}</span>
    ),
  },
  {
    key: "value",
    label: "Valor",
    render: (row) => <span className="font-medium">{row.value}</span>,
  },
  {
    key: "detail",
    label: "Detalle",
    render: (row) => <span className="text-muted">{row.detail}</span>,
  },
];

type SyncBlockRow = {
  id: string;
  label: string;
  block: ShopifyOverview["sync_blocks"][keyof ShopifyOverview["sync_blocks"]];
};

const syncBlockColumns: TableColumnDef<SyncBlockRow>[] = [
  { key: "label", label: "Bloque" },
  {
    key: "status",
    label: "Estado",
    render: (row) => (
      <span
        className={[
          "font-mono text-xs uppercase",
          blockStatusClass(row.block?.status),
        ].join(" ")}
      >
        {blockStatusLabel(row.block?.status)}
      </span>
    ),
  },
  {
    key: "records_written",
    label: "Registros",
    render: (row) => (
      <span className="font-mono">{row.block?.records_written ?? 0}</span>
    ),
  },
  {
    key: "finished_at",
    label: "Ultima corrida",
    render: (row) => formatDate(row.block?.finished_at),
  },
  {
    key: "error_message",
    label: "Error",
    render: (row) => (
      <span className="font-mono text-xs break-words text-danger">
        {row.block?.error_message ?? "—"}
      </span>
    ),
  },
];

type ScopeRow = ShopifyOverview["scope_catalog"][number] & { id: string };

function scopeColumns(
  authorizedScopes: Set<string>,
): TableColumnDef<ScopeRow>[] {
  return [
    {
      key: "scope",
      label: "Permiso API",
      render: (row) => <span className="font-mono text-xs">{row.scope}</span>,
    },
    { key: "area", label: "Área" },
    {
      key: "authorized",
      label: "Estado",
      render: (row) => (
        <span
          className={[
            "font-mono text-xs uppercase",
            authorizedScopes.has(row.scope) ? "text-foreground" : "text-danger",
          ].join(" ")}
        >
          {authorizedScopes.has(row.scope) ? "autorizado" : "no concedido"}
        </span>
      ),
    },
    {
      key: "enables",
      label: "Permite calcular",
      render: (row) => (
        <span className="text-muted">{row.enables.join(", ")}</span>
      ),
    },
  ];
}

type DatasetRow = ShopifyOverview["datasets"][number] & { id: string };

const datasetColumns: TableColumnDef<DatasetRow>[] = [
  {
    key: "label",
    label: "Bloque de datos",
    render: (row) => <span className="font-medium">{row.label}</span>,
  },
  {
    key: "table",
    label: "Tabla",
    render: (row) => (
      <span className="font-mono text-xs text-accent">
        {row.table ?? "sin_tabla"}
      </span>
    ),
  },
  {
    key: "status",
    label: "Estado",
    render: (row) => (
      <span className="font-mono text-xs uppercase text-muted">
        {row.status === "active" ? "guardando datos" : "sin volcar"}
      </span>
    ),
  },
  {
    key: "count",
    label: "Registros",
    render: (row) => <span className="font-mono">{row.count}</span>,
  },
];

type ProductRow = ShopifyOverview["samples"]["products"][number];

const productColumns: TableColumnDef<ProductRow>[] = [
  {
    key: "title",
    label: "Producto",
    render: (row) => (
      <div>
        <p className="font-medium">{row.title}</p>
        <p className="font-mono text-xs text-muted">
          {row.handle ?? "sin_handle"}
        </p>
      </div>
    ),
  },
  { key: "vendor", label: "Vendor", render: (row) => row.vendor ?? "n/a" },
  {
    key: "product_type",
    label: "Tipo",
    render: (row) => row.product_type ?? "n/a",
  },
  {
    key: "status",
    label: "Estado",
    render: (row) => (
      <span className="font-mono text-xs text-accent">
        {displayValue(row.status)}
      </span>
    ),
  },
  {
    key: "external_updated_at",
    label: "Actualizado",
    render: (row) => formatDate(row.external_updated_at),
  },
];

type OrderRow = ShopifyOverview["samples"]["orders"][number];

function orderColumns(currency: string): TableColumnDef<OrderRow>[] {
  return [
    {
      key: "order_name",
      label: "Pedido",
      render: (row) => (
        <span className="font-medium">
          {row.order_name ?? "Pedido sin nombre"}
        </span>
      ),
    },
    {
      key: "status",
      label: "Estado",
      render: (row) => (
        <span className="text-muted">
        {displayValue(row.financial_status)} / {displayValue(row.fulfillment_status)}
        </span>
      ),
    },
    {
      key: "processed_at",
      label: "Fecha",
      render: (row) => (
        <span className="text-muted">{formatDate(row.processed_at)}</span>
      ),
    },
    {
      key: "current_total_price",
      label: "Total",
      render: (row) => (
        <span className="font-mono">
          {formatMoney(row.current_total_price, currency)}
        </span>
      ),
    },
    {
      key: "net_sales",
      label: "Neto",
      render: (row) => (
        <span className="font-mono text-accent">
          {formatMoney(row.net_sales, currency)}
        </span>
      ),
    },
  ];
}

type InventoryRow = ShopifyOverview["samples"]["inventory"][number];

function inventoryColumns(currency: string): TableColumnDef<InventoryRow>[] {
  return [
    {
      key: "sku",
      label: "SKU",
      render: (row) => (
        <span className="font-mono">{row.sku ?? "sin_sku"}</span>
      ),
    },
    {
      key: "tracked",
      label: "Tracked",
      render: (row) => (
        <span className="text-muted">{displayBoolean(row.tracked)}</span>
      ),
    },
    {
      key: "requires_shipping",
      label: "Requiere envio",
      render: (row) => (
        <span className="text-muted">{displayBoolean(row.requires_shipping)}</span>
      ),
    },
    {
      key: "current_unit_cost",
      label: "Coste unitario",
      render: (row) => (
        <span className="font-mono">
          {row.current_unit_cost
            ? formatMoney(
                row.current_unit_cost,
                row.cost_currency_code ?? currency,
              )
            : "sin_coste"}
        </span>
      ),
    },
  ];
}

const tabs = [
  { value: "resumen", label: "Resumen" },
  { value: "sincronizacion", label: "Sincronización" },
  { value: "permisos", label: "Permisos y datos" },
  { value: "muestras", label: "Muestras" },
];

function ShopifyDiagnosticoView({
  bootstrap,
}: {
  bootstrap: BootstrapResponse;
}) {
  const { organizationId: selectedOrganizationId } = useActiveOrganization();
  const { connectionId: selectedConnectionId } = useActiveConnection();
  const [tab, setTab] = useState("resumen");

  // Auditoria estructural 2026-07-29 (peticion de Rafa, "tiene que estar
  // masticado para cliente"): esta pagina es un panel tecnico (scopes de
  // API, estado interno de sincronizacion por bloque, muestras crudas de
  // filas) sin ningun filtro de rol -- cualquier cliente que siguiera el
  // enlace "Diagnostico tecnico" desde /shopify caia aqui. Mismo patron que
  // ya usa /agentes (`canView`): solo consultor/platform_admin.
  const canView = ["platform_admin", "consultant"].includes(
    bootstrap.profile.platform_role,
  );

  const organization =
    bootstrap.memberships.find(
      (membership) => membership.organization_id === selectedOrganizationId,
    )?.organization ??
    bootstrap.memberships[0]?.organization ??
    null;

  const { overview, isLoading, error } = useShopifyOverview(
    canView ? organization?.id : undefined,
    selectedConnectionId,
  );

  const products = usePaginatedUrl(
    overview?.samples.products ?? [],
    PAGE_SIZE,
    "page_productos",
  );
  const orders = usePaginatedUrl(
    overview?.samples.orders ?? [],
    PAGE_SIZE,
    "page_pedidos",
  );
  const inventory = usePaginatedUrl(
    overview?.samples.inventory ?? [],
    PAGE_SIZE,
    "page_inventario",
  );

  if (!canView) {
    return (
      <EmptyState
        title="Sin acceso"
        hint="El diagnóstico técnico de Shopify es un panel para consultor/platform admin. Para ver el resumen de tu tienda, vuelve a Shopify."
        action={
          <Link className="inline-flex items-center gap-1" href="/shopify">
            <IconChevronLeft aria-hidden /> Volver a Shopify
          </Link>
        }
      />
    );
  }

  if (isLoading) {
    return (
      <div className="border-t border-ink/20 pt-5">
        <LoadingBlock label="Cargando diagnóstico..." />
      </div>
    );
  }

  if (error) {
    return <ErrorBlock>{error}</ErrorBlock>;
  }

  if (!overview) {
    return (
      <AsyncState
        status="empty"
        emptyTitle="No hay diagnóstico disponible"
        emptyHint="Conecta Shopify para revisar la cobertura de datos."
      />
    );
  }

  const currency = overview.store?.currency_code ?? "EUR";
  const authorizedScopes = new Set(overview.authorized_scopes);
  const activeDatasets = overview.datasets.filter(
    (dataset) => dataset.status === "active",
  );
  const plannedDatasets = overview.datasets.filter(
    (dataset) => dataset.status === "planned",
  );
  const authorizedPlannedDatasets = plannedDatasets.filter((dataset) =>
    dataset.scopes.some((scope) => authorizedScopes.has(scope)),
  );
  const notAuthorizedPlannedDatasets = plannedDatasets.filter(
    (dataset) => !dataset.scopes.some((scope) => authorizedScopes.has(scope)),
  );
  const activeRecordCount = activeDatasets.reduce(
    (total, dataset) => total + dataset.count,
    0,
  );

  return (
    <div className="portal-page space-y-5 sm:space-y-6">
      <div className="flex items-center justify-between">
        <Link className="inline-flex items-center gap-1" href="/shopify">
          <IconChevronLeft aria-hidden /> Volver a Shopify
        </Link>
      </div>

      <Tabs items={tabs} value={tab} onChange={setTab} />

      {tab === "resumen" ? (
        <div className="space-y-6">
          {/* F3/D03, D05, D06, D04, D10, D11 y D02, en el orden en que se
              leen: de que es capaz el negocio, que ha cambiado, que patron
              forman esos cambios juntos, como deja eso a cada capacidad, cuanto
              dano hay medido, de cuanto de todo eso nos podemos fiar y contra
              que se compara cada movimiento. Cada uno lee al anterior, asi que
              leerlo al reves es empezar por la conclusion. */}
          <MaturityPanel />
          <SignalListPanel />
          <SymptomMapPanel />
          {/* La declaracion va JUSTO ENCIMA de la salud, no en otra pantalla:
              quien lee "no hay guardrail declarado para adquisicion" lo declara
              aqui mismo. Un hueco que te dice que falta algo y no te deja
              arreglarlo es una queja, no una herramienta. */}
          <HealthReferencesPanel />
          <CapabilityHealthPanel />
          <SeverityPanel />
          {/* D07 va detras de la severidad y delante de la confianza: primero
              cuanto duele, luego por donde puede ir la cosa, y al final de
              cuanto de todo eso nos podemos fiar. */}
          <CausalPathsPanel />
          {/* D08 va justo detras: las rutas de arriba, convertidas en
              explicaciones con nombre, y con las descartadas conservadas. */}
          <HypothesesPanel />
          {/* D09 va justo detras: de las hipotesis vivas a una conclusion
              calibrada, casi siempre sin cerrar -- y el limite candidato,
              por separado, sin ninguna clave que los ate. */}
          <RootCausePanel />
          <AdversarialPanel />
          {/* D11 va el ultimo a proposito: le pone freno a todo lo de arriba.
              Con senal, patron e impacto medido, un caso parece cerrado hasta
              que se lee la fila que dice que nadie sabe por que pasa. */}
          <ConfidencePanel />
          <ContextReadingsPanel />
          <TemporalPanel />
          <DiagnosticOutputPanel />
          <DecisionContextPanel />
          <TemporalUrgencyPanel />
          <DecisionImpactPanel />
          <ConstraintsPanel />
          <FeasibilityPanel />
          <F4DimensionsPanel />
          <PlaybookFrameworkPanel />
          <PlaybookDiagnosticOverviewPanel />
          <AcquisitionPlaybookPanel />
          <PaidMediaPlaybookPanel />
          <ConversionCroPlaybookPanel />
          <OfferPricingPlaybookPanel />
          <RetentionCrmPlaybookPanel />
          <UnitEconomicsPlaybookPanel />
          <ProductInventoryPlaybookPanel />
          <OperationsCxPlaybookPanel />
          <MeasurementExperimentationPlaybookPanel />
          <ScalabilityPlaybookPanel />
          <RecoveryCrisisPlaybookPanel />
          <BenchmarkGuardrailsPanel />
          <CohortContextPanel />
          <DataQualityReliabilityPanel />
          <AcquisitionDemandPanel />
          <PaidMediaBenchmarksPanel />
          <ConversionCroBenchmarksPanel />
          <OfferPricingBenchmarksPanel />
          <RetentionCrmBenchmarksPanel />
          <UnitEconomicsBenchmarksPanel />
          <OperationsCxBenchmarksPanel />
          <ProductInventoryBenchmarksPanel />
          <ScalabilityBenchmarksPanel />
          <AnomaliesRedFlagsPanel />
          <BenchmarkConfidencePanel />
      <InterventionEligibilityPanel organizationId={selectedOrganizationId} />
      <InterventionMatchingPanel organizationId={selectedOrganizationId} />
      <InterventionPrioritizationPanel organizationId={selectedOrganizationId} />
      <InterventionImpactPanel organizationId={selectedOrganizationId} />
      <InterventionFeasibilityPanel organizationId={selectedOrganizationId} />
      <InterventionRiskPanel organizationId={selectedOrganizationId} />
      <InterventionSequencingPanel organizationId={selectedOrganizationId} />
      <InterventionTestExecutePanel organizationId={selectedOrganizationId} />
      <InterventionIntensityPanel organizationId={selectedOrganizationId} />
      <MaturityRecommendationsPanel organizationId={selectedOrganizationId} />
      <ConstraintRecommendationsPanel organizationId={selectedOrganizationId} />
      <RecommendationPortfolioPanel organizationId={selectedOrganizationId} />
      <DynamicDecisionPanel organizationId={selectedOrganizationId} />
      <RestraintDecisionPanel organizationId={selectedOrganizationId} />
      <ExpectedOutcomePanel organizationId={selectedOrganizationId} />
      <RecommendationConfidencePanel organizationId={selectedOrganizationId} />
      <RecommendationCommunicationPanel organizationId={selectedOrganizationId} />
      <ExecutionLifecyclePanel organizationId={selectedOrganizationId} />
      <HitlApprovalPanel organizationId={selectedOrganizationId} />
      <ClosureHandoffPanel organizationId={selectedOrganizationId} />
      <ExecutionPlanPanel organizationId={selectedOrganizationId} />
      <ReadinessPanel organizationId={selectedOrganizationId} />
      <ActionEnvelopePanel organizationId={selectedOrganizationId} />
      <ExecutionSupervisionPanel organizationId={selectedOrganizationId} />
      <ContinuousLearningPanel organizationId={selectedOrganizationId} />
          <PrioritizationPanel />
          {overview.connection?.last_error_message ? (
            <Banner tone="danger">
              <span className="font-medium">Ultimo error Shopify:</span>{" "}
              <span className="font-mono break-words">
                {overview.connection.last_error_message}
              </span>
            </Banner>
          ) : null}

          <Card
            title="Resumen de la conexión"
            description="Estado actual de la tienda y del último proceso de sincronización."
          >
            <Table
              ariaLabel="Resumen de la conexion Shopify"
              columns={summaryColumns}
              rows={[
                {
                  id: "conexion",
                  field: "Conexion",
                  value: displayValue(overview.connection?.status ?? "sin_conexion"),
                  detail:
                    overview.connection?.provider_account_id ??
                    "Tienda pendiente",
                },
                {
                  id: "tienda",
                  field: "Tienda",
                  value: overview.store?.shop_name ?? "Sin tienda",
                  detail:
                    overview.store?.primary_domain ?? "sin dominio primario",
                },
                {
                  id: "ultimo-sync",
                  field: "Ultimo sync",
                  value: displayValue(overview.sync_runs[0]?.status ?? "sin_sync"),
                  detail: formatDate(overview.sync_runs[0]?.finished_at),
                },
                {
                  id: "registros",
                  field: "Registros escritos",
                  value: String(overview.sync_runs[0]?.records_written ?? 0),
                  detail: "en el último sync",
                },
              ]}
            />
          </Card>
        </div>
      ) : null}

      {tab === "sincronizacion" ? (
        <div className="space-y-6">
          <div className="grid gap-0 overflow-hidden rounded-lg bg-surface shadow-surface md:grid-cols-4">
            <article className="border-b border-separator p-4 md:border-r">
              <p className={EYEBROW}>
                Se vuelcan ahora
              </p>
              <p className="mt-2 font-mono text-2xl">{activeDatasets.length}</p>
              <p className="mt-1 text-xs text-muted">
                {activeRecordCount} registros
              </p>
            </article>
            <article className="border-b border-separator p-4 md:border-r">
              <p className={EYEBROW}>
                Autorizados pendientes
              </p>
              <p className="mt-2 font-mono text-2xl">
                {authorizedPlannedDatasets.length}
              </p>
            </article>
            <article className="border-b border-separator p-4 md:border-r">
              <p className={EYEBROW}>
                Sin permiso
              </p>
              <p className="mt-2 font-mono text-2xl">
                {notAuthorizedPlannedDatasets.length}
              </p>
            </article>
            <article className="border-b border-separator p-4">
              <p className={EYEBROW}>
                Permisos concedidos
              </p>
              <p className="mt-2 font-mono text-2xl">
                {overview.authorized_scopes.length}
              </p>
            </article>
          </div>

          <Table
            ariaLabel="Estado de sincronizacion por bloque"
            columns={syncBlockColumns}
            rows={(
              Object.keys(syncBlockLabels) as Array<
                keyof typeof syncBlockLabels
              >
            ).map((blockKey) => ({
              id: blockKey,
              label: syncBlockLabels[blockKey],
              block: overview.sync_blocks?.[blockKey] ?? null,
            }))}
          />
        </div>
      ) : null}

      {tab === "permisos" ? (
        <div className="space-y-6">
          <Card
            title="Permisos concedidos"
            description="Scopes disponibles para esta conexión y su estado de autorización."
          >
            <Table
              ariaLabel="Permisos de Shopify concedidos"
              columns={scopeColumns(authorizedScopes)}
              rows={overview.scope_catalog.map((item) => ({
                id: item.scope,
                ...item,
              }))}
            />
          </Card>

          <Card
            title="Datasets de Shopify"
            description="Bloques de datos que la conexión puede importar."
          >
            <Table
              ariaLabel="Datasets de Shopify"
              columns={datasetColumns}
              rows={overview.datasets.map((dataset) => ({
                id: dataset.key,
                ...dataset,
              }))}
            />
          </Card>
        </div>
      ) : null}

      {tab === "muestras" ? (
        <div className="space-y-6">
          <Card title={`Productos (${overview.samples.products.length})`}>
            <Table
              className="mt-3"
              ariaLabel="Muestra de productos"
              columns={productColumns}
              rows={products.pageItems}
              emptyLabel="Sin productos sincronizados todavia."
            />
            <Pagination
              className="mt-3"
              page={products.page}
              pageCount={products.pageCount}
              onChange={products.setPage}
            />
          </Card>

          <Card title={`Pedidos (${overview.samples.orders.length})`}>
            <Table
              className="mt-3"
              ariaLabel="Muestra de pedidos"
              columns={orderColumns(currency)}
              rows={orders.pageItems}
              emptyLabel="Sin pedidos sincronizados todavia."
            />
            <Pagination
              className="mt-3"
              page={orders.page}
              pageCount={orders.pageCount}
              onChange={orders.setPage}
            />
          </Card>

          <Card title={`Elementos de inventario (${overview.samples.inventory.length})`}>
            <Table
              className="mt-3"
              ariaLabel="Muestra de inventario"
              columns={inventoryColumns(currency)}
              rows={inventory.pageItems}
              emptyLabel="Sin items de inventario sincronizados todavia."
            />
            <Pagination
              className="mt-3"
              page={inventory.page}
              pageCount={inventory.pageCount}
              onChange={inventory.setPage}
            />
          </Card>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Reintenta el anclaje cuando el panel enlazado todavia no existia.
 *
 * Al llegar desde el menu de IA con `#insight-<slug>`, el navegador busca el
 * ancla en cuanto cambia la URL; pero cada panel de esta pagina pinta despues
 * de resolver su propia consulta, asi que en ese instante el elemento no esta
 * en el DOM y no pasa nada. El resultado desde fuera es un enlace que no
 * funciona.
 *
 * Se reintenta unas cuantas veces y se para: si a los ~3 s el panel no ha
 * aparecido es que esa evaluacion no existe para esta tienda, y seguir
 * buscando solo gastaria bateria. Se cancela al primer scroll del usuario
 * para no robarle la pagina si decidio leer otra cosa.
 */
function useAnclaDeInsight() {
  useEffect(() => {
    const slug = window.location.hash;
    if (!slug.startsWith("#insight-")) return;
    if (document.querySelector(slug)) return;

    let cancelado = false;
    const parar = () => {
      cancelado = true;
    };
    window.addEventListener("wheel", parar, { once: true, passive: true });
    window.addEventListener("touchmove", parar, { once: true, passive: true });

    let intentos = 0;
    const id = window.setInterval(() => {
      intentos += 1;
      const destino = cancelado ? null : document.querySelector(slug);
      if (destino) destino.scrollIntoView({ behavior: "smooth" });
      if (destino || cancelado || intentos >= 12) window.clearInterval(id);
    }, 250);

    return () => {
      window.clearInterval(id);
      window.removeEventListener("wheel", parar);
      window.removeEventListener("touchmove", parar);
    };
  }, []);
}

export default function ShopifyDiagnosticoPage() {
  useAnclaDeInsight();
  return (
    <PortalShell title="Diagnóstico Shopify">
      {(bootstrap) => <ShopifyDiagnosticoView bootstrap={bootstrap} />}
    </PortalShell>
  );
}
