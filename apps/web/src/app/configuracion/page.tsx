"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { PortalShell } from "@/components/portal-shell";
import { AlertRulesSection } from "./alert-rules-section";
import { ClientAccessSection } from "./client-access-section";
import { ConsultantPartnersSection } from "./consultant-partners-section";
import { WorkSplitSection } from "./work-split-section";
import { ConsultantStatusSection } from "./consultant-status-section";
import { OrganizationIdentity } from "./organization-identity";
import { useActiveOrganization } from "@/components/active-organization";
import { apiFetch, type BootstrapResponse } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { useCachedQuery } from "@/lib/use-cached-query";
import { displayValue } from "@/lib/display-labels";
import { useUrlSection } from "@/lib/use-url-section";
import {
  Badge,
  Banner,
  Button,
  Card,
  EmptyState,
  ErrorBlock,
  Field,
  Input,
  Link,
  List,
  LoadingBlock,
  Select,
  Tabs,
} from "@/components/ui";

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

type ShippingRule = {
  id: string;
  name: string;
  country_code: string | null;
  cost_per_order: number;
  currency_code: string;
  min_order_total: number | null;
  max_order_total: number | null;
};

type MetricTarget = {
  id: string;
  metric_key: string;
  target_value: number;
  period: string;
  valid_from: string;
  valid_until: string | null;
};

type FinancialConfigResponse = {
  organization_id: string;
  settings: FinancialSettings;
  fixed_expenses: FixedExpense[];
  shipping_cost_rules: ShippingRule[];
  metric_targets: MetricTarget[];
};

// Mismas claves que `METRIC_TARGET_KEYS` en la API: el panel busca el objetivo
// por la clave exacta para pintarlo junto a su cifra. La etiqueta y el sufijo
// son de aquí; la clave manda y no se traduce.
const METRIC_TARGET_OPTIONS: Array<{
  value: string;
  label: string;
  unit: "eur" | "pct" | "num";
}> = [
  { value: "net_revenue_ex_tax", label: "Ingresos sin IVA", unit: "eur" },
  { value: "net_profit", label: "Beneficio neto", unit: "eur" },
  { value: "net_margin_pct", label: "Margen neto", unit: "pct" },
  { value: "aov_ex_tax", label: "Ticket medio sin IVA", unit: "eur" },
  { value: "orders_count", label: "Pedidos", unit: "num" },
  { value: "conversion_rate", label: "Conversión", unit: "pct" },
  { value: "recurrence_pct", label: "Recurrencia", unit: "pct" },
  { value: "cac_blended", label: "CAC (todas las plataformas)", unit: "eur" },
  { value: "roas", label: "ROAS", unit: "num" },
  { value: "email_attributed_pct", label: "Facturación vía email", unit: "pct" },
];

const METRIC_TARGET_PERIOD_LABELS: Record<string, string> = {
  monthly: "al mes",
  quarterly: "al trimestre",
  yearly: "al año",
};

function formatTargetValue(target: MetricTarget) {
  const option = METRIC_TARGET_OPTIONS.find(
    (item) => item.value === target.metric_key,
  );
  const value = Number(target.target_value);

  if (option?.unit === "pct") return `${value.toFixed(2)} %`;
  if (option?.unit === "eur") return `${value.toFixed(2)} €`;
  return value.toFixed(2);
}

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
  // Mismo criterio que `assertCanManage` en el backend: el consultor asesora
  // sobre el margen, así que también lo configura.
  const canManage =
    ["platform_admin", "consultant"].includes(
      bootstrap.profile.platform_role,
    ) || ["owner", "manager"].includes(membership?.role ?? "");

  const configQuery = useCachedQuery<FinancialConfigResponse>(
    `/v1/organizations/${organizationId}/financial-config`,
  );
  const config = configQuery.data ?? null;
  const [actionError, setActionError] = useState<string | null>(null);
  const error = actionError ?? (configQuery.error
    ? "No se pudo cargar la configuración financiera. Revisa la conexión e inténtalo de nuevo."
    : null);
  const setError = setActionError;
  const isLoading = configQuery.isLoading;
  const [isSaving, setIsSaving] = useState(false);
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [busyExpenseId, setBusyExpenseId] = useState<string | null>(null);
  const [isAddingShippingRule, setIsAddingShippingRule] = useState(false);
  const [busyShippingRuleId, setBusyShippingRuleId] = useState<string | null>(
    null,
  );
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const [paymentFeePct, setPaymentFeePct] = useState("");
  const [paymentFeeFixed, setPaymentFeeFixed] = useState("");
  const [defaultShippingCost, setDefaultShippingCost] = useState("");

  const [expenseName, setExpenseName] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expensePeriod, setExpensePeriod] = useState<"monthly" | "yearly">(
    "monthly",
  );

  const [targetMetricKey, setTargetMetricKey] = useState(
    METRIC_TARGET_OPTIONS[0]!.value,
  );
  const [targetValue, setTargetValue] = useState("");
  const [targetPeriod, setTargetPeriod] = useState("monthly");
  const [isAddingTarget, setIsAddingTarget] = useState(false);
  const [busyTargetId, setBusyTargetId] = useState<string | null>(null);

  const [ruleName, setRuleName] = useState("");
  const [ruleCostPerOrder, setRuleCostPerOrder] = useState("");
  const [ruleMinOrderTotal, setRuleMinOrderTotal] = useState("");

  const loadConfig = useCallback(() => {
    setActionError(null);
    configQuery.reload();
  }, [configQuery.reload]);

  useEffect(() => {
    if (!config) return;
    setPaymentFeePct(String(config.settings?.payment_fee_pct ?? ""));
    setPaymentFeeFixed(String(config.settings?.payment_fee_fixed ?? ""));
    setDefaultShippingCost(String(config.settings?.default_shipping_cost ?? ""));
  }, [config]);

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

  async function addMetricTarget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsAddingTarget(true);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/financial-config/metric-targets`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            metricKey: targetMetricKey,
            targetValue: Number(targetValue),
            period: targetPeriod,
          }),
        },
      );

      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }

      setTargetValue("");
      void loadConfig();
    } catch {
      setError("No se pudo guardar el objetivo por un error de red. Reintenta.");
    } finally {
      setIsAddingTarget(false);
    }
  }

  async function removeMetricTarget(targetId: string) {
    setError(null);
    setBusyTargetId(targetId);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/financial-config/metric-targets/${targetId}`,
        { method: "DELETE" },
      );

      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }

      void loadConfig();
    } catch {
      setError("No se pudo quitar el objetivo por un error de red. Reintenta.");
    } finally {
      setBusyTargetId(null);
    }
  }

  async function addShippingRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsAddingShippingRule(true);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/financial-config/shipping-rules`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: ruleName,
            // Siempre null: el motor de margen solo puede aplicar reglas sin
            // pais, porque los pedidos no guardan el pais del cliente (se dejo
            // de pedir en 20260910130000_shopify_customers_drop_location.sql
            // por minimizacion de datos protegidos). Ofrecer el campo seria
            // prometer un calculo que no ocurre.
            countryCode: null,
            costPerOrder: Number(ruleCostPerOrder),
            minOrderTotal: ruleMinOrderTotal ? Number(ruleMinOrderTotal) : 0,
          }),
        },
      );

      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }

      setRuleName("");
      setRuleCostPerOrder("");
      setRuleMinOrderTotal("");
      void loadConfig();
    } catch {
      setError(
        "No se pudo añadir la regla de envío por un error de red. Reintenta.",
      );
    } finally {
      setIsAddingShippingRule(false);
    }
  }

  async function removeShippingRule(ruleId: string) {
    setError(null);
    setBusyShippingRuleId(ruleId);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/financial-config/shipping-rules/${ruleId}`,
        { method: "DELETE" },
      );

      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }

      void loadConfig();
    } catch {
      setError(
        "No se pudo quitar la regla de envío por un error de red. Reintenta.",
      );
    } finally {
      setBusyShippingRuleId(null);
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
    <div className="portal-page space-y-5 sm:space-y-6">
      {error ? <ErrorBlock>{error}</ErrorBlock> : null}

      {!canManage ? (
        <Banner tone="warn">
          Solo lectura: necesitas rol owner o manager para editar la
          configuración financiera.
        </Banner>
      ) : null}

      <Card title="Costes por pedido">
        <form className="grid gap-4 md:grid-cols-4" onSubmit={saveSettings}>
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
            <Button className="w-full md:w-auto" type="submit" disabled={!canManage || isSaving}>
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
          <form className="grid gap-4 md:grid-cols-4" onSubmit={addExpense}>
            <div className="md:col-span-2">
              <Field label="Nombre del gasto">
                <Input
                  className="mt-2"
                  value={expenseName}
                  onChange={(event) => setExpenseName(event.target.value)}
                  placeholder="Ej.: Klaviyo, nóminas..."
                  required
                />
              </Field>
            </div>
            <Field label="Importe">
              <Input
                className="mt-2"
                type="number"
                step="0.01"
                min="0"
                value={expenseAmount}
                onChange={(event) => setExpenseAmount(event.target.value)}
                placeholder="Importe"
                required
              />
            </Field>
            <Field label="Periodicidad">
              <Select
                className="mt-2"
                value={expensePeriod}
                onChange={(value) =>
                  setExpensePeriod(value === "yearly" ? "yearly" : "monthly")
                }
                options={[
                  { value: "monthly", label: "al mes" },
                  { value: "yearly", label: "al año" },
                ]}
              />
            </Field>
            <Button className="w-full md:w-auto" type="submit" disabled={isAddingExpense}>
              {isAddingExpense ? "Añadiendo..." : "Añadir gasto"}
            </Button>
          </form>
        ) : null}

        <List className="mt-4 border-t border-separator">
          {(config?.fixed_expenses ?? []).length === 0 ? (
            <EmptyState
              title="Sin gastos fijos configurados"
              hint="Sin ellos el break-even del dashboard no es fiable."
            />
          ) : (
            (config?.fixed_expenses ?? []).map((expense) => (
              <List.Item
                key={expense.id}
                className="flex items-center justify-between gap-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium">{expense.name}</p>
                  <p className="text-xs text-muted">
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
                      variant="ghost"
                      size="sm"
                      type="button"
                      onClick={() => void removeExpense(expense.id)}
                      disabled={busyExpenseId === expense.id}
                    >
                      {busyExpenseId === expense.id ? "Quitando..." : "Quitar"}
                    </Button>
                  ) : null}
                </div>
              </List.Item>
            ))
          )}
        </List>
      </Card>

      <Card
        title="Objetivos"
        description="La cifra a batir en cada métrica. El panel la enseña junto al dato, para que se vea si va bien o mal sin tener que recordarlo."
      >
        {canManage ? (
          <form className="grid gap-4 md:grid-cols-4" onSubmit={addMetricTarget}>
            <div className="md:col-span-2">
              <Field label="Métrica">
                <Select
                  className="mt-2"
                  value={targetMetricKey}
                  onChange={(value) => setTargetMetricKey(value)}
                  options={METRIC_TARGET_OPTIONS.map((option) => ({
                    value: option.value,
                    label: option.label,
                  }))}
                />
              </Field>
            </div>
            <Field label="Objetivo">
              <Input
                className="mt-2"
                type="number"
                step="0.01"
                min="0"
                value={targetValue}
                onChange={(event) => setTargetValue(event.target.value)}
                placeholder="30"
                required
              />
            </Field>
            <Field label="Periodicidad">
              <Select
                className="mt-2"
                value={targetPeriod}
                onChange={(value) => setTargetPeriod(value)}
                options={[
                  { value: "monthly", label: "al mes" },
                  { value: "quarterly", label: "al trimestre" },
                  { value: "yearly", label: "al año" },
                ]}
              />
            </Field>
            <Button
              className="w-full md:w-auto"
              type="submit"
              disabled={isAddingTarget}
            >
              {isAddingTarget ? "Guardando..." : "Fijar objetivo"}
            </Button>
          </form>
        ) : null}

        <List className="mt-4 border-t border-separator">
          {(config?.metric_targets ?? []).length === 0 ? (
            <EmptyState
              title="Sin objetivos fijados"
              hint="Sin objetivo, una cifra no dice si va bien o mal."
            />
          ) : (
            (config?.metric_targets ?? []).map((target) => (
              <List.Item
                key={target.id}
                className="flex items-center justify-between gap-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium">
                    {METRIC_TARGET_OPTIONS.find(
                      (option) => option.value === target.metric_key,
                    )?.label ?? target.metric_key}
                  </p>
                  <p className="text-xs text-muted">
                    desde {target.valid_from}
                    {target.valid_until ? ` hasta ${target.valid_until}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="font-mono text-sm">
                    {formatTargetValue(target)}{" "}
                    {METRIC_TARGET_PERIOD_LABELS[target.period] ?? target.period}
                  </p>
                  {canManage ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      onClick={() => void removeMetricTarget(target.id)}
                      disabled={busyTargetId === target.id}
                    >
                      {busyTargetId === target.id ? "Quitando..." : "Quitar"}
                    </Button>
                  ) : null}
                </div>
              </List.Item>
            ))
          )}
        </List>
      </Card>

      <Card
        title="Reglas de envío"
        description="Coste de envío por tramo de importe: sustituye al envío medio en los pedidos que entren en el tramo."
      >
        {canManage ? (
          <form
            className="grid gap-4 md:grid-cols-4"
            onSubmit={addShippingRule}
          >
            <div className="md:col-span-2">
              <Field label="Nombre de la regla">
                <Input
                  className="mt-2"
                  value={ruleName}
                  onChange={(event) => setRuleName(event.target.value)}
                  placeholder="Ej.: Envío nacional"
                  required
                />
              </Field>
            </div>
            <Field label="Coste por pedido">
              <Input
                className="mt-2"
                type="number"
                step="0.01"
                min="0"
                value={ruleCostPerOrder}
                onChange={(event) => setRuleCostPerOrder(event.target.value)}
                placeholder="4.50"
                required
              />
            </Field>
            <Field label="Importe mínimo (opcional)">
              <Input
                className="mt-2"
                type="number"
                step="0.01"
                min="0"
                value={ruleMinOrderTotal}
                onChange={(event) => setRuleMinOrderTotal(event.target.value)}
                placeholder="0"
              />
            </Field>
            <Button
              className="w-full md:w-auto"
              type="submit"
              disabled={isAddingShippingRule}
            >
              {isAddingShippingRule ? "Añadiendo..." : "Añadir regla"}
            </Button>
          </form>
        ) : null}

        <List className="mt-4 border-t border-separator">
          {(config?.shipping_cost_rules ?? []).length === 0 ? (
            <EmptyState
              title="Sin reglas de envío"
              hint="Sin reglas se usa el envío medio por pedido para todo el negocio."
            />
          ) : (
            (config?.shipping_cost_rules ?? []).map((rule) => (
              <List.Item
                key={rule.id}
                className="flex items-center justify-between gap-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium">{rule.name}</p>
                  <p className="text-xs text-muted">
                    {rule.country_code
                      ? `${rule.country_code} · no se aplica: el cálculo ignora el país`
                      : "cualquier país"}
                    {rule.min_order_total
                      ? ` · desde ${Number(rule.min_order_total).toFixed(2)}`
                      : ""}
                    {rule.max_order_total
                      ? ` hasta ${Number(rule.max_order_total).toFixed(2)}`
                      : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="font-mono text-sm">
                    {Number(rule.cost_per_order).toFixed(2)} /pedido
                  </p>
                  {canManage ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      onClick={() => void removeShippingRule(rule.id)}
                      disabled={busyShippingRuleId === rule.id}
                    >
                      {busyShippingRuleId === rule.id
                        ? "Quitando..."
                        : "Quitar"}
                    </Button>
                  ) : null}
                </div>
              </List.Item>
            ))
          )}
        </List>
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

type SettingsTab = "general" | "accesos" | "alertas" | "cartera";
const SETTINGS_SECTIONS = [
  "general",
  "accesos",
  "alertas",
  "cartera",
] as const satisfies readonly SettingsTab[];

// Cartera: el total de tus clientes y tus tiendas. Antes eran dos entradas de
// nav (/consultor y /tiendas) que no se operan a diario, solo se consultan. Las
// paginas siguen existiendo; aqui esta el recuento y el acceso.
function PortfolioSection() {
  const clientsQuery = useCachedQuery<{
    organizations?: Array<{ is_own_store?: boolean }>;
  }>("/v1/consultant/organizations");
  const storesQuery = useCachedQuery<{ stores?: unknown[] }>(
    "/v1/consultant/own-stores",
  );
  const counts =
    clientsQuery.data && storesQuery.data
      ? {
          // Sin filtrar, las tiendas propias se contarian dos veces: aqui y
          // en la tarjeta de al lado.
          clients: (clientsQuery.data.organizations ?? []).filter(
            (organization) => !organization.is_own_store,
          ).length,
          stores: (storesQuery.data.stores ?? []).length,
        }
      : null;
  const error = clientsQuery.error || storesQuery.error
    ? "No se pudo cargar la cartera. Revisa la conexión."
    : null;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card title="Clientes" description="Las organizaciones que asesoras.">
        {error ? (
          <ErrorBlock>{error}</ErrorBlock>
        ) : counts === null ? (
          <LoadingBlock label="Contando clientes..." />
        ) : (
          <>
            <p className="text-3xl font-semibold">{counts.clients}</p>
            <p className="mt-3 text-sm">
              <Link href="/consultor">Gestionar clientes</Link>
            </p>
          </>
        )}
      </Card>
      <Card
        title="Tiendas propias"
        description="Las tiendas que llevas tú directamente."
      >
        {error ? (
          <ErrorBlock>{error}</ErrorBlock>
        ) : counts === null ? (
          <LoadingBlock label="Contando tiendas..." />
        ) : (
          <>
            <p className="text-3xl font-semibold">{counts.stores}</p>
            <p className="mt-3 text-sm">
              <Link href="/tiendas">Gestionar tiendas</Link>
            </p>
          </>
        )}
      </Card>
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
  const isConsultant = ["platform_admin", "consultant"].includes(
    bootstrap.profile.platform_role,
  );
  // Mismo criterio que el backend (`assertCanManage`): consultor incluido.
  const canManageOrganization =
    isConsultant ||
    ["owner", "manager"].includes(
      bootstrap.memberships.find(
        (membership) => membership.organization_id === organization?.id,
      )?.role ?? "",
    );
  const [tab, setTab] = useUrlSection(
    "section",
    SETTINGS_SECTIONS,
    "general",
  );

  return (
    <div className="portal-page space-y-5 sm:space-y-6">
      <Tabs
        value={tab}
        onChange={(value) => setTab(value as SettingsTab)}
        hideNavigation
        items={[
          { value: "general", label: "General" },
          // Sin cliente activo la pestaña sigue teniendo sentido: con quién
          // compartes cartera no depende de ninguna tienda en concreto.
          ...(isConsultant ? [{ value: "accesos", label: "Accesos" }] : []),
          ...(organization ? [{ value: "alertas", label: "Alertas" }] : []),
          ...(isConsultant
            ? [{ value: "cartera", label: "Clientes y tiendas" }]
            : []),
        ]}
      />

      {tab === "general" ? (
        <div className="space-y-4">
          {organization ? (
            <OrganizationIdentity
              organization={organization}
              planLabel={
                subscription
                  ? `${subscription.plan_code} · ${displayValue(subscription.status)}`
                  : "Sin plan"
              }
              canManage={canManageOrganization}
            />
          ) : (
            <Card title="Organización activa">
              <dl className="space-y-3 text-sm">
                <InfoRow label="Nombre">Sin organización</InfoRow>
              </dl>
              <p className="mt-4 text-xs text-muted">
                Tu nombre, avatar y datos de cuenta están en{" "}
                <Link href="/perfil">Perfil</Link>.
              </p>
            </Card>
          )}

          {/* Solo al cliente: al consultor no le interesa saber si "tiene
              consultor", y es el único que ve Chats apagado sin explicación. */}
          {organization && !isConsultant ? (
            <ConsultantStatusSection organizationId={organization.id} />
          ) : null}

          {organization ? (
            <FinancialConfigSection
              bootstrap={bootstrap}
              organizationId={organization.id}
            />
          ) : null}
        </div>
      ) : tab === "accesos" ? (
        <div className="space-y-4">
          {/* Con quién compartes cartera va antes que los accesos de UN
              cliente: define quién lleva todas las tiendas, no solo esta. */}
          <ConsultantPartnersSection />
          {/* Y justo después, quién se encarga de qué: compartir cartera sin
              repartir el trabajo deja las tareas sin dueño. */}
          <WorkSplitSection />
          {organization ? (
            <ClientAccessSection
              organizationId={organization.id}
              canManage={isConsultant}
            />
          ) : null}
        </div>
      ) : tab === "alertas" ? (
        organization ? (
          <AlertRulesSection
            organizationId={organization.id}
            canManage={canManageOrganization}
          />
        ) : null
      ) : tab === "cartera" ? (
        <PortfolioSection />
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
