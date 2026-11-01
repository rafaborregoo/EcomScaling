"use client";


import { FormEvent, useCallback, useEffect, useState } from "react";
import { PortalShell } from "@/components/portal-shell";
import { AlertRulesSection } from "./alert-rules-section";
import { ClientAccessSection } from "./client-access-section";
import { WorkSplitSection } from "./work-split-section";
import { ConsultantSection } from "./consultant-section";
import { ConsultantOwnPermissions, ConsultantPortfolioPermissions } from "./consultant-permissions";
import { ActivityCard, TeamSecurityCard } from "./team-security-section";
import { ROLE_LABEL, ROLE_MATRIX, MEMBER_ROLES } from "./role-permissions";
import { BillingSection } from "./billing-section";
import { NotificationsSection } from "./notifications-section";
import { ObjectivesProgress } from "./objectives-progress";
import { PrivacySection } from "./privacy-section";
import { SecuritySection } from "./security-section";
import { SummarySection } from "./summary-section";
import { OrganizationIdentity } from "./organization-identity";
import { BusinessContextSection } from "./business-context-section";
import { ProfileSection } from "./profile-section";
import { ConsultoraSection, PortfolioSettingsMatrix } from "./consultant-settings";
import { ConsultoraBrandSection, ConsultoraRolesCard, ConsultoraTeamSection, InviteCodesSection } from "./consultora-section";
import { CopilotAiSection } from "./copilot-ai-section";
import { useActiveOrganization } from "@/components/active-organization";
import { apiFetch, type BootstrapResponse } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import {
  invalidateCachedQueries,
  useCachedQuery,
} from "@/lib/use-cached-query";
import { formatMoney } from "@/lib/money";
import { planLabel } from "@/lib/plan-labels";
import { useUrlSection } from "@/lib/use-url-section";
import {
  Badge,
  Banner,
  Button,
  EmptyState,
  ErrorBlock,
  Field,
  Input,
  Link,
  List,
  LoadingBlock,
  SearchableSelect,
  Select,
  SettingRow,
  toast,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@/components/ui";

type FinancialSettings = {
  id: string;
  currency_code: string;
  klaviyo_revenue_currency_code: string | null;
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

// Etiquetas de las claves de `OBJECTIVE_CATALOG` (strategic-plans.ts), que son
// las del panel. Los objetivos se fijan en Mi Camino; aquí solo se leen.
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
  { value: "out_of_stock_items", label: "Productos agotados", unit: "num" },
];

const FINANCIAL_CURRENCIES = ["EUR", "USD", "GBP", "MXN", "COP", "ARS", "CLP", "BRL"];

// Lo que queda de un pedido de ejemplo tras los costes que acabas de escribir:
// enseña qué hace cada número sin texto de ayuda.
function OrderExample({
  paymentFeePct,
  paymentFeeFixed,
  shippingCost,
  currency,
}: {
  paymentFeePct: string;
  paymentFeeFixed: string;
  shippingCost: string;
  currency: string;
}) {
  const [order, setOrder] = useState(60);
  const eur = (value: number) => formatMoney(value, currency);
  const fee = (order * (Number(paymentFeePct) || 0)) / 100;
  const fixed = Number(paymentFeeFixed) || 0;
  const shipping = Number(shippingCost) || 0;

  return (
    <div className="mt-5 grid gap-3 rounded-lg bg-surface p-4 text-sm">
      <label className="grid gap-2">
        <span className="text-muted">
          Así se descuenta en un pedido de{" "}
          <span className="font-mono text-foreground">{eur(order)}</span>
        </span>
        <input
          type="range"
          min={10}
          max={300}
          step={5}
          value={order}
          onChange={(event) => setOrder(Number(event.target.value))}
          aria-label="Importe del pedido de ejemplo"
          className="w-full accent-[var(--accent)]"
        />
      </label>
      <dl className="grid gap-1">
        {[
          ["Comisión de pago", `−${eur(fee)}`],
          ["Comisión fija", `−${eur(fixed)}`],
          ["Envío", `−${eur(shipping)}`],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4">
            <dt className="text-muted">{label}</dt>
            <dd className="font-mono">{value}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-4 border-t border-separator pt-2 font-medium">
          <dt>Queda antes de producto e IVA</dt>
          <dd className="font-mono">{eur(order - fee - fixed - shipping)}</dd>
        </div>
      </dl>
    </div>
  );
}

function FinancialConfigSection({
  bootstrap,
  organizationId,
  part,
}: {
  bootstrap: BootstrapResponse;
  organizationId: string;
  /** `costs`: costes, gastos y envío. `targets`: objetivos y su progreso. */
  part: "costs" | "targets";
}) {
  const membership = bootstrap.memberships.find(
    (item) => item.organization_id === organizationId,
  );
  // Mismo criterio que `assertCanManage` en el backend: el consultor asesora
  // sobre el margen, así que también lo configura.
  const isConsultantRole = ["platform_admin", "consultant"].includes(
    bootstrap.profile.platform_role,
  );
  const canManage =
    isConsultantRole || ["owner", "manager"].includes(membership?.role ?? "");
  // Los importes se escriben y se leen en la moneda de la tienda: antes salian
  // como "10271.00 /mes", sin separador de miles ni simbolo.

  const configQuery = useCachedQuery<FinancialConfigResponse>(
    `/v1/organizations/${organizationId}/financial-config`,
  );
  const config = configQuery.data ?? null;
  // Los importes se escriben y se leen en la moneda de la tienda: antes salian
  // como "10271.00 /mes", sin separador de miles ni simbolo.
  const currency =
    config?.settings?.currency_code ?? membership?.organization?.currency_code ?? "EUR";
  const money = (value: number) => formatMoney(value, currency);
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
  const [klaviyoRevenueCurrencyCode, setKlaviyoRevenueCurrencyCode] = useState("");

  const [expenseName, setExpenseName] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expensePeriod, setExpensePeriod] = useState<"monthly" | "yearly">(
    "monthly",
  );

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
    setKlaviyoRevenueCurrencyCode(config.settings?.klaviyo_revenue_currency_code ?? "");
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
      // La cobertura financiera de Klaviyo viaja en /shopify/metrics. Al
      // guardar la moneda, invalida la respuesta de dashboard para que al
      // volver no se conserve el aviso anterior durante la ventana de caché.
      invalidateCachedQueries(
        `/v1/organizations/${organizationId}/shopify/metrics`,
      );
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
          Solo lectura: la configuración financiera la cambian el propietario o
          un gestor de la tienda.
        </Banner>
      ) : null}

      {part === "costs" ? (
        <>
      <Card>
        <CardHeader>
          <CardTitle>Por cada pedido</CardTitle>
          <CardDescription>Lo que se descuenta de cada venta antes del producto y el IVA.</CardDescription>
          <CardAction>{canManage && isConsultantRole ? (
            <CopyCostsFrom
              organizationId={organizationId}
              currency={currency}
              existingRuleNames={(config?.shipping_cost_rules ?? []).map((rule) => rule.name)}
              onCopied={loadConfig}
            />
          ) : null}</CardAction>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveSettings}>
            <SettingRow
              label="Comisión de la pasarela"
              hint="Lo que se queda Shopify Payments, Stripe o PayPal: un porcentaje y, si lo hay, un fijo."
              htmlFor="fee-pct"
            >
              <div className="w-24">
              <Input
                id="fee-pct"
                aria-label="Comisión en porcentaje"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={paymentFeePct}
                onChange={(event) => setPaymentFeePct(event.target.value)}
                placeholder="2.9"
                disabled={!canManage}
                            />
              </div>
              <span className="text-sm text-muted">% +</span>
              <div className="w-24">
              <Input
                id="fee-fixed"
                aria-label={`Comisión fija por pedido en ${currency}`}
                type="number"
                step="0.01"
                min="0"
                value={paymentFeeFixed}
                onChange={(event) => setPaymentFeeFixed(event.target.value)}
                placeholder="0.30"
                disabled={!canManage}
                            />
              </div>
              <span className="text-sm text-muted">{currency} fijo</span>
            </SettingRow>
            <SettingRow
              label="Envío medio"
              hint="Lo que te cuesta a ti enviar un pedido, no lo que cobras. Las reglas por importe de abajo lo sustituyen."
              htmlFor="shipping"
            >
              <div className="w-24">
              <Input
                id="shipping"
                type="number"
                step="0.01"
                min="0"
                value={defaultShippingCost}
                onChange={(event) => setDefaultShippingCost(event.target.value)}
                placeholder="4.50"
                disabled={!canManage}
                            />
              </div>
              <span className="text-sm text-muted">{currency} por pedido</span>
            </SettingRow>
            <SettingRow
              label="Coste de producto"
              hint="Se pone por referencia en Productos: es el coste que más pesa en el margen."
            >
              <Link href="/shopify/productos">Completar en Productos</Link>
            </SettingRow>
            <div className="flex flex-wrap items-center gap-3 border-t border-separator pt-4">
              <Button type="submit" disabled={!canManage || isSaving}>
                {isSaving ? "Guardando..." : "Guardar"}
              </Button>
              {savedAt ? (
                <p className="text-xs text-muted">Guardado a las {savedAt}.</p>
              ) : null}
            </div>
          </form>
          <OrderExample
            paymentFeePct={paymentFeePct}
            paymentFeeFixed={paymentFeeFixed}
            shippingCost={defaultShippingCost}
            currency={currency}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Gastos fijos</CardTitle>
          <CardDescription>Nóminas, alquiler, herramientas. Se reparten entre los días del mes para el punto de equilibrio.</CardDescription>
          <CardAction><Badge tone="neutral" className="whitespace-nowrap text-sm">
            {money(monthlyFixedTotal)}/mes
          </Badge></CardAction>
        </CardHeader>
        <CardContent>
          <List>
            {(config?.fixed_expenses ?? []).length === 0 ? (
              <EmptyState
                title="Sin gastos fijos configurados"
                hint="Sin ellos el punto de equilibrio no es fiable."
              />
            ) : (
              (config?.fixed_expenses ?? []).map((expense) => (
                <Item key={expense.id} role="listitem">
                  <ItemContent>
                    <ItemTitle>{expense.name}</ItemTitle>
                    <ItemDescription>
                      desde {formatDate(expense.valid_from)}
                      {expense.valid_until ? ` hasta ${formatDate(expense.valid_until)}` : ""}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions className="gap-3">
                    <p className="text-sm tabular-nums">
                      {formatMoney(Number(expense.amount), expense.currency_code || currency)}
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
                  </ItemActions>
                </Item>
              ))
            )}
          </List>
          {canManage ? (
            <form
              className="mt-4 grid gap-3 border-t border-separator pt-4 md:grid-cols-[minmax(0,2fr)_8rem_8rem_auto] md:items-end"
              onSubmit={addExpense}
            >
              <Field label="Nombre del gasto">
                <Input
                  value={expenseName}
                  onChange={(event) => setExpenseName(event.target.value)}
                  placeholder="Ej.: Klaviyo, nóminas..."
                  required
                />
              </Field>
              <Field label={`Importe (${currency})`}>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={expenseAmount}
                  onChange={(event) => setExpenseAmount(event.target.value)}
                  required
                />
              </Field>
              <Field label="Periodicidad">
                <Select
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
              <Button type="submit" disabled={isAddingExpense}>
                {isAddingExpense ? "Añadiendo..." : "Añadir gasto"}
              </Button>
            </form>
          ) : null}
        </CardContent>
      </Card>
        </>
      ) : null}

      {part === "targets" ? (
      <Card>
        <CardHeader>
          <CardTitle>Objetivos</CardTitle>
          <CardDescription>La cifra a batir en cada métrica, con cómo vas en los últimos 30 días. El panel la enseña junto al dato.</CardDescription>
        </CardHeader>
        <CardContent>
          <ObjectivesProgress
            organizationId={organizationId}
            targets={config?.metric_targets ?? []}
            currency={currency}
            labelFor={(key) =>
              METRIC_TARGET_OPTIONS.find((option) => option.value === key)?.label ?? key
            }
          />
          {(config?.metric_targets ?? []).length === 0 ? (
            <EmptyState
              title="Sin objetivos fijados"
              hint="Sin objetivo, una cifra no dice si va bien o mal."
            />
          ) : null}
          {/* Mi Camino es la única fuente de objetivos (decisión 2026-10-19):
              fijarlos aquí y allí daba dos cifras para la misma métrica. */}
          <p className="mt-4 border-t border-separator pt-4 text-sm">
            Los objetivos se fijan en{" "}
            <Link href={`/camino?organizationId=${organizationId}`}>Mi Camino</Link>
            {canManage ? ", junto a la meta y los hitos que los persiguen." : "."}
          </p>
        </CardContent>
      </Card>
      ) : null}

      {part === "costs" ? (
      <Card>
        <CardHeader>
          <CardTitle>Reglas de envío</CardTitle>
          <CardDescription>Coste de envío por tramo de importe: sustituye al envío medio en los pedidos que entren en el tramo.</CardDescription>
        </CardHeader>
        <CardContent>
          <List>
            {(config?.shipping_cost_rules ?? []).length === 0 ? (
              <EmptyState
                title="Sin reglas de envío"
                hint="Sin reglas se usa el envío medio por pedido para todo el negocio."
              />
            ) : (
              (config?.shipping_cost_rules ?? []).map((rule) => (
                <Item key={rule.id} role="listitem">
                  <ItemContent>
                    <ItemTitle>{rule.name}</ItemTitle>
                    <ItemDescription>
                      {rule.country_code
                        ? `${rule.country_code} · no se aplica: el cálculo ignora el país`
                        : "cualquier país"}
                      {rule.min_order_total
                        ? ` · desde ${formatMoney(Number(rule.min_order_total), rule.currency_code || currency)}`
                        : ""}
                      {rule.max_order_total
                        ? ` hasta ${formatMoney(Number(rule.max_order_total), rule.currency_code || currency)}`
                        : ""}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions className="gap-3">
                    <p className="text-sm tabular-nums">
                      {formatMoney(Number(rule.cost_per_order), rule.currency_code || currency)}/pedido
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
                  </ItemActions>
                </Item>
              ))
            )}
          </List>
          {canManage ? (
            <form
              className="mt-4 grid gap-3 border-t border-separator pt-4 md:grid-cols-[minmax(0,2fr)_8rem_9rem_auto] md:items-end"
              onSubmit={addShippingRule}
            >
              <Field label="Nombre de la regla">
                <Input
                  value={ruleName}
                  onChange={(event) => setRuleName(event.target.value)}
                  placeholder="Ej.: Envío nacional"
                  required
                />
              </Field>
              <Field label={`Coste (${currency})`}>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={ruleCostPerOrder}
                  onChange={(event) => setRuleCostPerOrder(event.target.value)}
                  required
                />
              </Field>
              <Field label="Desde (opcional)">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={ruleMinOrderTotal}
                  onChange={(event) => setRuleMinOrderTotal(event.target.value)}
                  placeholder="0"
                />
              </Field>
              <Button type="submit" disabled={isAddingShippingRule}>
                {isAddingShippingRule ? "Añadiendo..." : "Añadir regla"}
              </Button>
            </form>
          ) : null}
        </CardContent>
      </Card>
      ) : null}

      {part === "costs" ? (
        <KlaviyoCurrencyCard
          // Se remonta cuando cambia el valor guardado: sin efecto que sincronice estado.
          key={klaviyoRevenueCurrencyCode}
          organizationId={organizationId}
          value={klaviyoRevenueCurrencyCode}
          canManage={canManage}
          onSaved={loadConfig}
        />
      ) : null}
    </div>
  );
}

/**
 * Copiar comisiones, envío medio y reglas de envío de otro cliente. Configurar
 * doce tiendas parecidas era teclear lo mismo doce veces. Usa los mismos
 * endpoints que el formulario (lectura del otro cliente + escritura en este),
 * así que la autorización es la de siempre. Los gastos fijos no se copian: son
 * de cada negocio. Solo entre clientes con la misma moneda.
 */
function CopyCostsFrom({
  organizationId,
  currency,
  existingRuleNames,
  onCopied,
}: {
  organizationId: string;
  currency: string;
  existingRuleNames: string[];
  onCopied: () => void;
}) {
  const organizationsQuery = useCachedQuery<{
    organizations?: Array<{ id: string; display_name: string; is_own_store?: boolean; currency_code?: string }>;
  }>("/v1/consultant/organizations");
  const [isOpen, setIsOpen] = useState(false);
  const [sourceId, setSourceId] = useState("");
  const [busy, setBusy] = useState(false);
  const options = (organizationsQuery.data?.organizations ?? []).filter(
    (item) => item.id !== organizationId,
  );

  async function copy() {
    if (!sourceId) return;
    setBusy(true);
    try {
      const sourceResponse = await apiFetch(`/v1/organizations/${sourceId}/financial-config`);
      if (!sourceResponse.ok) {
        toast.danger(await readApiError(sourceResponse));
        return;
      }
      const source = (await sourceResponse.json()) as FinancialConfigResponse;
      if (!source.settings) {
        toast.danger("Ese cliente todavía no tiene costes por pedido.");
        return;
      }
      if (source.settings.currency_code !== currency) {
        toast.danger(`Ese cliente trabaja en ${source.settings.currency_code} y este en ${currency}: no se copian importes entre monedas.`);
        return;
      }
      const settingsResponse = await apiFetch(
        `/v1/organizations/${organizationId}/financial-config/settings`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentFeePct: source.settings.payment_fee_pct,
            paymentFeeFixed: source.settings.payment_fee_fixed,
            defaultShippingCost: source.settings.default_shipping_cost,
          }),
        },
      );
      if (!settingsResponse.ok) {
        toast.danger(await readApiError(settingsResponse));
        return;
      }
      let rules = 0;
      for (const rule of source.shipping_cost_rules) {
        if (existingRuleNames.includes(rule.name)) continue;
        const ruleResponse = await apiFetch(
          `/v1/organizations/${organizationId}/financial-config/shipping-rules`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: rule.name,
              countryCode: null,
              costPerOrder: rule.cost_per_order,
              minOrderTotal: rule.min_order_total ?? 0,
            }),
          },
        );
        if (ruleResponse.ok) rules += 1;
      }
      toast.success(
        rules > 0
          ? `Costes copiados y ${rules} ${rules === 1 ? "regla de envío" : "reglas de envío"}.`
          : "Costes por pedido copiados.",
      );
      setIsOpen(false);
      setSourceId("");
      onCopied();
    } catch {
      toast.danger("No se pudo copiar por un error de red. Reintenta.");
    } finally {
      setBusy(false);
    }
  }

  if (!isOpen) {
    return (
      <Button size="sm" variant="ghost" onClick={() => setIsOpen(true)}>
        Copiar de otro cliente
      </Button>
    );
  }
  return (
    <div role="group" aria-label="Acciones de configuracion" className="flex flex-wrap items-center gap-2">
      <SearchableSelect
        aria-label="Cliente del que copiar"
        className="w-52"
        placeholder="Busca un cliente"
        emptyText="No hay ningún cliente con ese nombre."
        value={sourceId}
        onChange={setSourceId}
        options={options.map((item) => ({ value: item.id, label: item.display_name }))}
      />
      <Button size="sm" disabled={!sourceId || busy} onClick={() => void copy()}>
        {busy ? "Copiando…" : "Copiar"}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setIsOpen(false)} disabled={busy}>
        Cancelar
      </Button>
    </div>
  );
}

// La moneda de los ingresos de Klaviyo no es un coste: iba dentro del
// formulario de costes por pedido y se guardaba con él. Ahora es su propio
// bloque, con su propio guardado (el PUT de ajustes acepta campos sueltos).
function KlaviyoCurrencyCard({
  organizationId,
  value,
  canManage,
  onSaved,
}: {
  organizationId: string;
  value: string;
  canManage: boolean;
  onSaved: () => void;
}) {
  const [code, setCode] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(next: string) {
    setCode(next);
    setIsSaving(true);
    setError(null);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/financial-config/settings`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ klaviyoRevenueCurrencyCode: next || null }),
        },
      );
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      toast.success(next ? `Moneda de Klaviyo: ${next}.` : "Moneda de Klaviyo sin confirmar.");
      invalidateCachedQueries(`/v1/organizations/${organizationId}/shopify/metrics`);
      onSaved();
    } catch {
      setError("No se pudo guardar la moneda por un error de red. Reintenta.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card className="scroll-mt-24">
      <CardHeader>
        <CardTitle>Moneda de los ingresos de Klaviyo</CardTitle>
      </CardHeader>
      <CardContent>
        <div id="klaviyo-revenue-currency">
          <SettingRow
            label="Moneda confirmada"
            hint="La moneda real de los ingresos que devuelve Klaviyo. Su moneda preferida solo cambia el símbolo: no sirve para confirmar ni convertir. Si no estás seguro, déjalo sin confirmar."
          >
            <SearchableSelect
              aria-label="Moneda de los ingresos de Klaviyo"
              className="max-w-xs"
              placeholder="Sin confirmar"
              emptyText="No hay ninguna moneda con ese código."
              showClear
              value={code}
              onChange={(next) => void save(next)}
              options={FINANCIAL_CURRENCIES.map((item) => ({ value: item, label: item }))}
              disabled={!canManage || isSaving}
            />
            {isSaving ? <span className="text-xs text-muted">Guardando…</span> : null}
          </SettingRow>
          {error ? <ErrorBlock>{error}</ErrorBlock> : null}
        </div>
      </CardContent>
    </Card>
  );
}

function formatDate(iso: string) {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return iso;
  return new Date(parsed).toLocaleDateString("es-ES", { month: "short", year: "numeric" });
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

type SettingsTab =
  | "cartera"
  | "consultor"
  | "resumen"
  | "tienda"
  | "rentabilidad"
  | "objetivos"
  | "negocio"
  | "alertas"
  | "notificaciones"
  | "copiloto"
  | "equipo"
  | "plan"
  | "accesos"
  | "consultora"
  | "permisos"
  | "perfil"
  | "seguridad"
  | "privacidad";
const SETTINGS_SECTIONS = [
  "cartera",
  "consultor",
  "resumen",
  "tienda",
  "rentabilidad",
  "objetivos",
  "negocio",
  "alertas",
  "notificaciones",
  "copiloto",
  "equipo",
  "plan",
  "accesos",
  "consultora",
  "permisos",
  "perfil",
  "seguridad",
  "privacidad",
] as const satisfies readonly SettingsTab[];

// Qué puede hacer cada rol: la matriz vive en role-permissions.ts, junto a la
// guarda de la API que la hace cumplir.
function RolesCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Qué puede hacer cada rol</CardTitle>
      </CardHeader>
      <CardContent>
        <Table className="min-w-[36rem]">
          <TableHeader>
            <TableRow>
              <TableHead>
                <span className="sr-only">Acción</span>
              </TableHead>
              {MEMBER_ROLES.map((role) => (
                <TableHead key={role} className="text-center">
                  {ROLE_LABEL[role]}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          {ROLE_MATRIX.map((group) => (
            <TableBody key={group.group}>
              <TableRow>
                <TableHead colSpan={MEMBER_ROLES.length + 1} scope="colgroup" className="h-auto pb-1 pt-4 text-[0.6875rem] uppercase tracking-[0.08em] text-muted">
                  {group.group}
                </TableHead>
              </TableRow>
              {group.rows.map((row) => (
                <TableRow key={row.action}>
                  <TableCell>{row.action}</TableCell>
                  {MEMBER_ROLES.map((role) => (
                    <TableCell
                      key={role}
                      className={`text-center ${row.roles[role] ? "font-semibold text-success" : "text-muted"}`}
                      aria-label={row.roles[role] ? "Puede" : "No puede"}
                    >
                      {row.roles[role] ? "✓" : "—"}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          ))}
        </Table>
      </CardContent>
    </Card>
  );
}

function SettingsContent({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const { organizationId: selectedOrganizationId } = useActiveOrganization();
  const activeMembership = bootstrap.memberships.find(
    (membership) =>
      membership.organization_id === selectedOrganizationId &&
      membership.accessSource === "membership",
  );
  const isConsultant = ["platform_admin", "consultant"].includes(
    bootstrap.profile.platform_role,
  );
  // El consultor sin cliente elegido está en vista general: no se le cuela la
  // primera organización de su lista (su consultora o una tienda propia).
  const organization =
    bootstrap.memberships.find(
      (membership) => membership.organization_id === selectedOrganizationId,
    )?.organization ??
    (isConsultant ? null : (bootstrap.memberships[0]?.organization ?? null));
  const subscription = organization
    ? bootstrap.subscriptions.find(
        (item) => item.organization_id === organization.id,
      )
    : null;
  const canManageTeam = ["owner", "manager"].includes(
    activeMembership?.role ?? "",
  );
  // Mismo criterio que el backend (`assertCanManage`): consultor incluido.
  const canManageOrganization =
    isConsultant ||
    ["owner", "manager"].includes(
      bootstrap.memberships.find(
        (membership) => membership.organization_id === organization?.id,
      )?.role ?? "",
    );
  // El consultor sin cliente activo empieza por su cartera.
  const [tab, setTab] = useUrlSection(
    "section",
    SETTINGS_SECTIONS,
    isConsultant && !organization ? "cartera" : "resumen",
  );
  const isOwner = activeMembership?.role === "owner";

  return (
    <div className="portal-page space-y-5 sm:space-y-6">
      {tab === "cartera" && isConsultant ? (
        <PortfolioSettingsMatrix />
      ) : tab === "resumen" || tab === "cartera" ? (
        organization ? (
          <SummarySection
            organizationId={organization.id}
            isConsultant={isConsultant}
            onNavigate={(section) => setTab(section as SettingsTab)}
          />
        ) : isConsultant ? (
          <PortfolioSettingsMatrix />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Sin tienda activa</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">
                Elige un cliente arriba para configurar su tienda. Tu cuenta está en{" "}
                <Link href="/configuracion?section=perfil">Perfil</Link> y{" "}
                <Link href="/configuracion?section=seguridad">Seguridad</Link>.
              </p>
            </CardContent>
          </Card>
        )
      ) : tab === "tienda" ? (
        <div className="space-y-4">
          {organization ? (
            <OrganizationIdentity
              organization={organization}
              planLabel={
                subscription
                  ? planLabel(subscription.plan_code, subscription.status)
                  : "Sin plan"
              }
              canManage={canManageOrganization}
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Organización activa</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-3 text-sm">
                  <InfoRow label="Nombre">Sin organización</InfoRow>
                </dl>
                <p className="mt-4 text-xs text-muted">
                  Tu nombre, avatar y datos de cuenta están en{" "}
                  <Link href="/configuracion?section=perfil">Perfil</Link>.
                </p>
              </CardContent>
            </Card>
          )}

        </div>
      ) : tab === "rentabilidad" || tab === "objetivos" ? (
        organization ? (
          <FinancialConfigSection
            bootstrap={bootstrap}
            organizationId={organization.id}
            part={tab === "rentabilidad" ? "costs" : "targets"}
          />
        ) : null
      ) : tab === "negocio" ? (
        organization ? (
          <BusinessContextSection
            organizationId={organization.id}
            isConsultant={isConsultant}
          />
        ) : null
      ) : tab === "notificaciones" ? (
        <NotificationsSection bootstrap={bootstrap} />
      ) : tab === "copiloto" ? (
        organization ? <CopilotAiSection organizationId={organization.id} /> : null
      ) : tab === "plan" ? (
        organization && isOwner ? (
          <BillingSection organizationId={organization.id} />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Plan y facturación</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted">
                La facturación la gestiona el propietario de la tienda.
              </p>
            </CardContent>
          </Card>
        )
      ) : tab === "consultor" ? (
        organization && !isConsultant ? (
          <ConsultantSection organizationId={organization.id} canSeeActivity={canManageTeam} />
        ) : organization ? (
          <ConsultantOwnPermissions organizationId={organization.id} storeName={organization.display_name ?? "esta tienda"} />
        ) : null
      ) : tab === "seguridad" ? (
        <div className="space-y-6">
          <SecuritySection bootstrap={bootstrap} />
          {organization && canManageTeam ? (
            <>
              <TeamSecurityCard organizationId={organization.id} />
              <ActivityCard organizationId={organization.id} />
            </>
          ) : null}
        </div>
      ) : tab === "privacidad" ? (
        organization ? (
          <PrivacySection bootstrap={bootstrap} organization={organization} />
        ) : null
      ) : tab === "accesos" ? (
        <div className="space-y-6">
          <ConsultoraTeamSection currentUserId={bootstrap.user.id} />
          <ConsultoraRolesCard />
          {/* Reparto de responsabilidades entre consultores. */}
          <WorkSplitSection />
          <InviteCodesSection />
        </div>
      ) : tab === "alertas" ? (
        organization ? (
          <AlertRulesSection
            organizationId={organization.id}
            canManage={canManageOrganization}
          />
        ) : null
      ) : tab === "permisos" && isConsultant ? (
        <ConsultantPortfolioPermissions />
      ) : tab === "consultora" ? (
        <div className="space-y-6">
          <ConsultoraSection />
          <ConsultoraBrandSection currentUserId={bootstrap.user.id} />
        </div>
      ) : tab === "perfil" ? (
        <ProfileSection bootstrap={bootstrap} />
      ) : tab === "equipo" ? (
        organization && (canManageTeam || isConsultant) ? (
          <div className="space-y-4">
            <ClientAccessSection
              organizationId={organization.id}
              canManage={canManageTeam || isConsultant}
              isOwner={isOwner || bootstrap.profile.platform_role === "platform_admin"}
              currentUserId={bootstrap.user.id}
            />
            <RolesCard />
          </div>
        ) : null
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
