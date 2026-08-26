"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
import { apiFetch, type BootstrapResponse } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import {
  AsyncState,
  Badge,
  Banner,
  Button,
  Card,
  EmptyState,
  ErrorBlock,
  Field,
  Input,
  LoadingBlock,
  Select,
  Table,
  Tabs,
  type TableColumnDef,
} from "@/components/ui";

type ShopifyOverviewLite = {
  authorized_scopes: string[];
  datasets: Array<{
    key: string;
    label: string;
    table: string | null;
    status: "active" | "planned";
    scopes: string[];
    count: number;
  }>;
};

async function readShopifyOverviewError(response: Response) {
  const body = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;
  return body?.error ?? `HTTP ${response.status}`;
}

function ShopifyCoverageSection({
  organizationId,
}: {
  organizationId: string;
}) {
  const [overview, setOverview] = useState<ShopifyOverviewLite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      try {
        const response = await apiFetch(
          `/v1/organizations/${organizationId}/shopify/overview`,
        );

        if (cancelled) {
          return;
        }

        if (!response.ok) {
          setError(await readShopifyOverviewError(response));
          setOverview(null);
        } else {
          setOverview((await response.json()) as ShopifyOverviewLite);
          setError(null);
        }
      } catch {
        if (!cancelled) {
          setOverview(null);
          setError(
            "No se pudo cargar la cobertura de Shopify por un error de red. Reintenta.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  if (isLoading) {
    return (
      <AsyncState
        status="loading"
        loadingLabel="Cargando cobertura de datos..."
      />
    );
  }

  if (error) {
    return <AsyncState status="error" error={error} />;
  }

  if (!overview) {
    return (
      <Banner tone="warn">
        Conecta una tienda Shopify para ver la cobertura de datos.
      </Banner>
    );
  }

  const statusLabel = (dataset: ShopifyOverviewLite["datasets"][number]) => {
    if (dataset.status === "active") {
      return { label: "se vuelca", tone: "success" as const };
    }
    const hasScope = dataset.scopes.some((scope) =>
      overview.authorized_scopes.includes(scope),
    );
    return hasScope
      ? { label: "autorizado pendiente", tone: "brand" as const }
      : { label: "requiere permiso", tone: "neutral" as const };
  };

  const columns: TableColumnDef<
    ShopifyOverviewLite["datasets"][number] & { id: string }
  >[] = [
    {
      key: "label",
      label: "Dataset",
      render: (row) => <span className="font-medium">{row.label}</span>,
    },
    {
      key: "table",
      label: "Tabla",
      render: (row) => (
        <span className="font-mono text-xs text-muted">
          {row.table ?? "pendiente_modelo"}
        </span>
      ),
    },
    {
      key: "status",
      label: "Estado",
      render: (row) => {
        const status = statusLabel(row);
        return <Badge tone={status.tone}>{status.label}</Badge>;
      },
    },
    {
      key: "count",
      label: "Registros",
      render: (row) => <span className="font-mono">{row.count}</span>,
    },
  ];

  return (
    <Table
      ariaLabel="Cobertura de datos de Shopify"
      columns={columns}
      rows={overview.datasets.map((dataset) => ({
        id: dataset.key,
        ...dataset,
      }))}
    />
  );
}

type FinancialSettings = {
  id: string;
  currency_code: string;
  payment_fee_pct: number;
  payment_fee_fixed: number;
  default_shipping_cost: number;
  vat_pct: number;
  notes: string | null;
  updated_at: string;
} | null;

type FixedExpense = {
  id: string;
  name: string;
  category: string | null;
  amount: number;
  currency_code: string;
  billing_period: string;
  valid_from: string;
  valid_until: string | null;
};

type FinancialConfigResponse = {
  organization_id: string;
  settings: FinancialSettings;
  fixed_expenses: FixedExpense[];
  shipping_cost_rules: unknown[];
  metric_targets: unknown[];
};

function FinancialConfigSection({
  bootstrap,
  organizationId,
}: {
  bootstrap: BootstrapResponse;
  organizationId: string;
}) {
  const membership = bootstrap.memberships.find(
    (item) => item.organization_id === organizationId,
  );
  const canManage =
    bootstrap.profile.platform_role === "platform_admin" ||
    ["owner", "manager"].includes(membership?.role ?? "");

  const [config, setConfig] = useState<FinancialConfigResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [busyExpenseId, setBusyExpenseId] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const [paymentFeePct, setPaymentFeePct] = useState("");
  const [paymentFeeFixed, setPaymentFeeFixed] = useState("");
  const [defaultShippingCost, setDefaultShippingCost] = useState("");

  const [expenseName, setExpenseName] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expensePeriod, setExpensePeriod] = useState<"monthly" | "yearly">(
    "monthly",
  );

  const loadConfig = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/financial-config`,
      );

      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }

      const data = (await response.json()) as FinancialConfigResponse;
      setConfig(data);
      setPaymentFeePct(String(data.settings?.payment_fee_pct ?? ""));
      setPaymentFeeFixed(String(data.settings?.payment_fee_fixed ?? ""));
      setDefaultShippingCost(String(data.settings?.default_shipping_cost ?? ""));
      setError(null);
    } catch {
      setError(
        "No se pudo cargar la configuración financiera por un error de red. Reintenta.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    // Sincroniza la pantalla con el endpoint remoto al montar o cambiar de
    // organizacion; no es estado derivado de otro valor local.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadConfig();
  }, [loadConfig]);

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/financial-config/settings`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentFeePct: paymentFeePct === "" ? 0 : Number(paymentFeePct),
            paymentFeeFixed: paymentFeeFixed === "" ? 0 : Number(paymentFeeFixed),
            defaultShippingCost:
              defaultShippingCost === "" ? 0 : Number(defaultShippingCost),
          }),
        },
      );

      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }

      setSavedAt(new Date().toLocaleTimeString());
      void loadConfig();
    } catch {
      setError(
        "No se pudo guardar la configuración financiera por un error de red. Reintenta.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function addExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsAddingExpense(true);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/financial-config/fixed-expenses`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: expenseName,
            amount: Number(expenseAmount),
            billingPeriod: expensePeriod,
          }),
        },
      );

      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }

      setExpenseName("");
      setExpenseAmount("");
      void loadConfig();
    } catch {
      setError("No se pudo añadir el gasto por un error de red. Reintenta.");
    } finally {
      setIsAddingExpense(false);
    }
  }

  async function removeExpense(expenseId: string) {
    setError(null);
    setBusyExpenseId(expenseId);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/financial-config/fixed-expenses/${expenseId}`,
        { method: "DELETE" },
      );

      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }

      void loadConfig();
    } catch {
      setError("No se pudo quitar el gasto por un error de red. Reintenta.");
    } finally {
      setBusyExpenseId(null);
    }
  }

  if (isLoading) {
    return <LoadingBlock label="Cargando configuración financiera..." />;
  }

  const monthlyFixedTotal = (config?.fixed_expenses ?? []).reduce(
    (total, expense) =>
      total +
      (expense.billing_period === "yearly"
        ? expense.amount / 12
        : expense.amount),
    0,
  );

  return (
    <div className="space-y-4">
      {error ? <ErrorBlock>{error}</ErrorBlock> : null}

      {!canManage ? (
        <Banner tone="warn">
          Solo lectura: necesitas rol owner o manager para editar la
          configuración financiera.
        </Banner>
      ) : null}

      <Card title="Costes por pedido">
        <form className="grid gap-3 md:grid-cols-4" onSubmit={saveSettings}>
          <Field label="Comisión pago (%)">
            <Input
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={paymentFeePct}
              onChange={(event) => setPaymentFeePct(event.target.value)}
              placeholder="2.9"
              disabled={!canManage}
            />
          </Field>
          <Field label="Comisión fija por pedido">
            <Input
              type="number"
              step="0.01"
              min="0"
              value={paymentFeeFixed}
              onChange={(event) => setPaymentFeeFixed(event.target.value)}
              placeholder="0.30"
              disabled={!canManage}
            />
          </Field>
          <Field label="Envío medio por pedido">
            <Input
              type="number"
              step="0.01"
              min="0"
              value={defaultShippingCost}
              onChange={(event) => setDefaultShippingCost(event.target.value)}
              placeholder="4.50"
              disabled={!canManage}
            />
          </Field>
          <div className="flex items-end">
            <Button type="submit" disabled={!canManage || isSaving}>
              {isSaving ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </form>
        {savedAt ? (
          <p className="mt-2 text-xs text-muted">Guardado a las {savedAt}.</p>
        ) : null}
      </Card>

      <Card
        title="Gastos fijos"
        actions={
          <Badge tone="neutral" className="whitespace-nowrap text-sm">
            {monthlyFixedTotal.toFixed(2)} /mes
          </Badge>
        }
      >
        {canManage ? (
          <form className="grid gap-3 md:grid-cols-4" onSubmit={addExpense}>
            <Input
              className="md:col-span-2"
              value={expenseName}
              onChange={(event) => setExpenseName(event.target.value)}
              placeholder="Nombre (p. ej. Klaviyo, nóminas...)"
              required
            />
            <div className="flex gap-2">
              <Input
                className="min-w-0 flex-1"
                type="number"
                step="0.01"
                min="0"
                value={expenseAmount}
                onChange={(event) => setExpenseAmount(event.target.value)}
                placeholder="Importe"
                required
              />
              <Select
                aria-label="Periodicidad del gasto"
                value={expensePeriod}
                onChange={(value) =>
                  setExpensePeriod(value === "yearly" ? "yearly" : "monthly")
                }
                options={[
                  { value: "monthly", label: "al mes" },
                  { value: "yearly", label: "al año" },
                ]}
              />
            </div>
            <Button type="submit" disabled={isAddingExpense}>
              {isAddingExpense ? "Añadiendo..." : "Añadir gasto"}
            </Button>
          </form>
        ) : null}

        <div className="mt-4 divide-y divide-line border-t border-line">
          {(config?.fixed_expenses ?? []).length === 0 ? (
            <EmptyState
              title="Sin gastos fijos configurados"
              hint="Sin ellos el break-even del dashboard no es fiable."
            />
          ) : (
            (config?.fixed_expenses ?? []).map((expense) => (
              <div
                key={expense.id}
                className="flex items-center justify-between gap-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium">{expense.name}</p>
                  <p className="font-mono text-xs text-muted">
                    desde {expense.valid_from}
                    {expense.valid_until ? ` hasta ${expense.valid_until}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="font-mono text-sm">
                    {Number(expense.amount).toFixed(2)}{" "}
                    {expense.billing_period === "yearly" ? "/año" : "/mes"}
                  </p>
                  {canManage ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      type="button"
                      onClick={() => void removeExpense(expense.id)}
                      disabled={busyExpenseId === expense.id}
                    >
                      {busyExpenseId === expense.id ? "Quitando..." : "Quitar"}
                    </Button>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}

function InfoRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

function SettingsContent({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const { organizationId: selectedOrganizationId } = useActiveOrganization();
  const organization =
    bootstrap.memberships.find(
      (membership) => membership.organization_id === selectedOrganizationId,
    )?.organization ??
    bootstrap.memberships[0]?.organization ??
    null;
  const subscription = organization
    ? bootstrap.subscriptions.find(
        (item) => item.organization_id === organization.id,
      )
    : null;
  const [tab, setTab] = useState<"general" | "shopify">("general");

  return (
    <div className="space-y-4">
      <Tabs
        value={tab}
        onChange={(value) => setTab(value as "general" | "shopify")}
        items={[
          { value: "general", label: "General" },
          { value: "shopify", label: "Cobertura Shopify" },
        ]}
      />

      {tab === "general" ? (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Perfil">
              <dl className="space-y-3 text-sm">
                <InfoRow label="Nombre">
                  {bootstrap.profile.full_name ?? "Sin nombre"}
                </InfoRow>
                <InfoRow label="Email">
                  {bootstrap.user.email ?? "Sin email"}
                </InfoRow>
                <InfoRow label="Rol plataforma">
                  <span className="font-mono text-brand">
                    {bootstrap.profile.platform_role}
                  </span>
                </InfoRow>
              </dl>
            </Card>

            <Card title="Organización activa">
              <dl className="space-y-3 text-sm">
                <InfoRow label="Nombre">
                  {organization?.display_name ?? "Sin organización"}
                </InfoRow>
                <InfoRow label="Zona horaria">
                  <span className="font-mono">
                    {organization?.timezone ?? "n/a"}
                  </span>
                </InfoRow>
                <InfoRow label="Moneda">
                  <span className="font-mono">
                    {organization?.currency_code ?? "n/a"}
                  </span>
                </InfoRow>
                <InfoRow label="Plan">
                  <span className="font-mono text-brand">
                    {subscription
                      ? `${subscription.plan_code}/${subscription.status}`
                      : "sin_plan"}
                  </span>
                </InfoRow>
              </dl>
            </Card>
          </div>

          {organization ? (
            <FinancialConfigSection
              bootstrap={bootstrap}
              organizationId={organization.id}
            />
          ) : null}
        </div>
      ) : organization ? (
        <ShopifyCoverageSection organizationId={organization.id} />
      ) : null}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <PortalShell title="Configuración">
      {(bootstrap) => <SettingsContent bootstrap={bootstrap} />}
    </PortalShell>
  );
}
