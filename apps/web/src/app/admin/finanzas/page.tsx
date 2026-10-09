"use client";

import { useMemo, useState } from "react";
import { PlatformAdminShell } from "@/components/platform-admin-shell";
import {
  AreaChart,
  Badge,
  Banner,
  BarChart,
  Button,
  Card,
  ErrorBlock,
  Field,
  Input,
  Metric,
  Select,
  Sheet,
  Table,
  Textarea,
  type TableColumnDef,
} from "@/components/ui";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { useCachedQuery } from "@/lib/use-cached-query";

type FinancialPayment = {
  id: string;
  status: string | null;
  substatus: string | null;
  currency: string | null;
  gross_amount: number | null;
  fee_amount: number | null;
  refunded_amount: number;
  net_amount: number | null;
  paid_at: string | null;
  created_at: string | null;
  billing_reason: string | null;
  plan_name: string | null;
  plan_code: string | null;
  product_name: string | null;
  customer_name: string | null;
  customer_email: string | null;
};

type ExpenseSummary = {
  currency: string | null;
  total: number | null;
  tax_total: number | null;
  by_currency: Array<{
    currency: string;
    amount: number;
    tax_amount: number;
    occurrences: number;
  }>;
  by_category: Array<{
    category: string;
    currency: string;
    amount: number;
    occurrences: number;
  }>;
  active_recurring: number;
};

type FinancialPayload = {
  window_days: number;
  currency: string | null;
  truncated: boolean;
  totals: {
    gross_amount: number | null;
    fee_amount: number | null;
    refunded_amount: number | null;
    net_amount: number | null;
    successful_payments: number;
    failed_payments: number;
    pending_payments: number;
  };
  by_currency: Array<{
    currency: string;
    gross_amount: number;
    fee_amount: number | null;
    refunded_amount: number;
    net_amount: number | null;
    successful_payments: number;
  }>;
  subscriptions: {
    active: number;
    trial: number;
    paid: number;
    granted: number;
  };
  timeline: Array<{
    period: string;
    gross_amount: number;
    refunded_amount: number;
    net_amount: number | null;
    payments: number;
  }>;
  by_plan: Array<{
    id: string;
    name: string;
    currency: string | null;
    gross_amount: number;
    net_amount: number | null;
    payments: number;
  }>;
  payments: FinancialPayment[];
  expenses: ExpenseSummary;
  operating_currency: string | null;
  operating_profit: number | null;
};

type Expense = {
  id: string;
  name: string;
  vendor: string | null;
  category: string;
  amount: number;
  tax_amount: number;
  currency_code: string;
  billing_period: "one_time" | "monthly" | "yearly";
  starts_on: string;
  ends_on: string | null;
  deductible: boolean;
  notes: string | null;
  document_url: string | null;
  status: "active" | "archived";
};

type ExpensesPayload = {
  expenses: Expense[];
  summary: ExpenseSummary;
  window_days: number;
};

const CATEGORY_OPTIONS = [
  { value: "software", label: "Software y plataformas" },
  { value: "hosting", label: "Hosting e infraestructura" },
  { value: "ai", label: "IA y automatización" },
  { value: "accounting", label: "Gestoría y contabilidad" },
  { value: "marketing", label: "Marketing" },
  { value: "banking", label: "Bancos y comisiones" },
  { value: "contractors", label: "Colaboradores" },
  { value: "insurance", label: "Seguros" },
  { value: "taxes", label: "Impuestos y tasas" },
  { value: "office", label: "Oficina" },
  { value: "travel", label: "Viajes" },
  { value: "other", label: "Otros" },
];

const CATEGORY_LABELS = Object.fromEntries(
  CATEGORY_OPTIONS.map((option) => [option.value, option.label]),
);

const PERIOD_OPTIONS = [
  { value: "one_time", label: "Pago único" },
  { value: "monthly", label: "Mensual" },
  { value: "yearly", label: "Anual" },
];

function money(value: number | null, currency: string | null) {
  if (value === null) return "—";
  if (!currency) return "Varias monedas";
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function dateTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function paymentStatus(payment: FinancialPayment) {
  if (payment.substatus === "succeeded" || payment.status === "paid") {
    return { label: "Cobrado", tone: "success" as const };
  }
  if (
    ["failed", "blocked", "uncollectible", "void", "canceled"].includes(
      payment.substatus ?? "",
    )
  ) {
    return { label: "Fallido", tone: "danger" as const };
  }
  return { label: "Pendiente", tone: "warn" as const };
}

function periodLabel(value: Expense["billing_period"]) {
  return (
    PERIOD_OPTIONS.find((option) => option.value === value)?.label ?? value
  );
}

function ExpenseSheet({
  isOpen,
  onOpenChange,
  expense,
  onSaved,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  expense: Expense | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState(expense?.name ?? "");
  const [vendor, setVendor] = useState(expense?.vendor ?? "");
  const [category, setCategory] = useState(expense?.category ?? "software");
  const [amount, setAmount] = useState(expense ? String(expense.amount) : "");
  const [taxAmount, setTaxAmount] = useState(
    expense ? String(expense.tax_amount) : "0",
  );
  const [currency, setCurrency] = useState(expense?.currency_code ?? "EUR");
  const [period, setPeriod] = useState<Expense["billing_period"]>(
    expense?.billing_period ?? "monthly",
  );
  const [startsOn, setStartsOn] = useState(
    expense?.starts_on ?? new Date().toISOString().slice(0, 10),
  );
  const [endsOn, setEndsOn] = useState(expense?.ends_on ?? "");
  const [deductible, setDeductible] = useState(expense?.deductible ?? true);
  const [documentUrl, setDocumentUrl] = useState(expense?.document_url ?? "");
  const [notes, setNotes] = useState(expense?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const response = await apiFetch(
        expense ? `/v1/admin/expenses/${expense.id}` : "/v1/admin/expenses",
        {
          method: expense ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            vendor: vendor || null,
            category,
            amount: Number(amount),
            tax_amount: Number(taxAmount || 0),
            currency_code: currency,
            billing_period: period,
            starts_on: startsOn,
            ends_on: endsOn || null,
            deductible,
            document_url: documentUrl || null,
            notes: notes || null,
          }),
        },
      );
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      onSaved();
    } catch {
      setError("No se pudo guardar el gasto.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      size="md"
      title={expense ? "Editar gasto" : "Registrar gasto"}
      isBusy={busy}
      isDirty={expense ? name !== expense.name || amount !== String(expense.amount) : Boolean(name.trim() || amount)}
      formId="expense-form"
      primary={{
        label: expense ? "Guardar cambios" : "Añadir gasto",
        busyLabel: "Guardando…",
        disabled: !name.trim() || !amount || !startsOn,
      }}
    >
      <form
        id="expense-form"
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        {error ? <ErrorBlock>{error}</ErrorBlock> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Concepto">
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. Vercel Pro" />
          </Field>
          <Field label="Proveedor">
            <Input value={vendor} onChange={(event) => setVendor(event.target.value)} placeholder="Vercel" />
          </Field>
          <Field label="Categoría">
            <Select value={category} onChange={setCategory} options={CATEGORY_OPTIONS} />
          </Field>
          <Field label="Periodicidad">
            <Select
              value={period}
              onChange={(value) => setPeriod(value as Expense["billing_period"])}
              options={PERIOD_OPTIONS}
            />
          </Field>
          <Field label="Total pagado">
            <Input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="29.00" />
          </Field>
          <Field label="IVA incluido">
            <Input inputMode="decimal" value={taxAmount} onChange={(event) => setTaxAmount(event.target.value)} placeholder="0.00" />
          </Field>
          <Field label="Moneda">
            <Input value={currency} maxLength={3} onChange={(event) => setCurrency(event.target.value.toUpperCase())} />
          </Field>
          <Field label="Primer cargo">
            <Input type="date" value={startsOn} onChange={(event) => setStartsOn(event.target.value)} />
          </Field>
          <Field label="Fin opcional">
            <Input type="date" value={endsOn} onChange={(event) => setEndsOn(event.target.value)} />
          </Field>
        </div>
        <Field label="Factura o justificante (URL)">
          <Input type="url" value={documentUrl} onChange={(event) => setDocumentUrl(event.target.value)} placeholder="https://..." />
        </Field>
        <Field label="Notas">
          <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={deductible} onChange={(event) => setDeductible(event.target.checked)} />
          Gasto fiscalmente deducible
        </label>
      </form>
    </Sheet>
  );
}

function FinancePanel() {
  const [days, setDays] = useState(30);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [expenseFormOpen, setExpenseFormOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const finance = useCachedQuery<FinancialPayload>(
    `/v1/admin/financial-dashboard?days=${days}`,
  );
  const expenseQuery = useCachedQuery<ExpensesPayload>(
    `/v1/admin/expenses?days=${days}`,
  );

  const currency = finance.data?.operating_currency ?? null;
  const timeline = useMemo(
    () =>
      finance.data?.currency
        ? finance.data.timeline.map((point) => ({
            period: new Date(`${point.period}T12:00:00Z`).toLocaleDateString(
              "es-ES",
              { day: "2-digit", month: "short" },
            ),
            gross: point.gross_amount,
            refunds: point.refunded_amount,
          }))
        : [],
    [finance.data],
  );
  const categoryChart = useMemo(
    () =>
      finance.data?.expenses.currency
        ? finance.data.expenses.by_category
            .filter((row) => row.currency === finance.data?.expenses.currency)
            .slice(0, 8)
            .map((row) => ({
              name: CATEGORY_LABELS[row.category] ?? row.category,
              amount: row.amount,
            }))
        : [],
    [finance.data],
  );

  function reloadAll() {
    finance.reload();
    expenseQuery.reload();
  }

  function saved() {
    setExpenseFormOpen(false);
    setEditing(null);
    setFormKey((value) => value + 1);
    reloadAll();
  }

  async function archive(expense: Expense) {
    setMutationError(null);
    try {
      const response = await apiFetch(`/v1/admin/expenses/${expense.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        setMutationError(await readApiError(response));
        return;
      }
      reloadAll();
    } catch {
      setMutationError("No se pudo archivar el gasto.");
    }
  }

  if (finance.isLoading || expenseQuery.isLoading) {
    return (
      <Card kicker="Ledger" title="Cargando finanzas...">
        <p className="text-sm text-muted">
          Consultando Stripe y el libro de gastos.
        </p>
      </Card>
    );
  }
  if (
    (finance.error && !finance.data) ||
    (expenseQuery.error && !expenseQuery.data)
  ) {
    return (
      <ErrorBlock>
        {finance.error ??
          expenseQuery.error ??
          "No se pudieron cargar las finanzas."}
      </ErrorBlock>
    );
  }
  if (!finance.data || !expenseQuery.data) return null;

  const data = finance.data;
  const expenses = expenseQuery.data.expenses.filter(
    (expense) => expense.status === "active",
  );
  const multipleCurrencies =
    (!data.currency && data.by_currency.length > 1) ||
    data.expenses.by_currency.length > 1;
  const paymentColumns: TableColumnDef<FinancialPayment>[] = [
    {
      key: "date",
      label: "Fecha",
      render: (row) => (
        <span className="whitespace-nowrap text-xs text-muted">
          {dateTime(row.paid_at ?? row.created_at)}
        </span>
      ),
    },
    {
      key: "customer",
      label: "Cliente",
      render: (row) =>
        row.customer_name ?? row.customer_email ?? "Sin identificar",
    },
    {
      key: "plan",
      label: "Plan",
      render: (row) =>
        row.plan_name ?? row.plan_code ?? row.product_name ?? "—",
    },
    {
      key: "status",
      label: "Estado",
      render: (row) => {
        const status = paymentStatus(row);
        return <Badge tone={status.tone}>{status.label}</Badge>;
      },
    },
    {
      key: "amount",
      label: "Importe",
      render: (row) => money(row.gross_amount, row.currency),
    },
  ];
  const expenseColumns: TableColumnDef<Expense>[] = [
    {
      key: "name",
      label: "Gasto",
      render: (row) => (
        <div>
          <div className="font-medium">{row.name}</div>
          <span className="text-xs text-muted">
            {row.vendor ?? CATEGORY_LABELS[row.category] ?? row.category}
          </span>
        </div>
      ),
    },
    {
      key: "period",
      label: "Periodicidad",
      render: (row) => periodLabel(row.billing_period),
    },
    {
      key: "amount",
      label: "Importe",
      render: (row) => (
        <div>
          {money(row.amount, row.currency_code)}
          <div className="text-xs text-muted">
            IVA: {money(row.tax_amount, row.currency_code)}
          </div>
        </div>
      ),
    },
    {
      key: "tax",
      label: "Fiscal",
      render: (row) => (
        <Badge tone={row.deductible ? "success" : "neutral"}>
          {row.deductible ? "Deducible" : "No deducible"}
        </Badge>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (row) => (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setEditing(row);
              setExpenseFormOpen(true);
            }}
          >
            Editar
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void archive(row)}>
            Archivar
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="grid gap-6">
      <Card
        kicker="Ledger Stripe + gastos"
        title="Dashboard financiero"
        description={`Resultado real de los últimos ${days} días${finance.isValidating || expenseQuery.isValidating ? " · actualizando" : ""}`}
        actions={
          <div className="flex items-center gap-2">
            <Select
              aria-label="Periodo financiero"
              value={String(days)}
              onChange={(value) => setDays(Number(value))}
              options={[
                { value: "7", label: "7 días" },
                { value: "30", label: "30 días" },
                { value: "90", label: "90 días" },
                { value: "365", label: "1 año" },
              ]}
            />
            <Button size="sm" variant="ghost" onClick={reloadAll}>
              Actualizar
            </Button>
          </div>
        }
      >
        {multipleCurrencies ? (
          <Banner tone="warn">
            Hay movimientos en varias monedas. Se muestran por separado y no se
            aplica conversión automática.
          </Banner>
        ) : null}
        {data.truncated ? (
          <Banner tone="warn">
            Stripe tiene más movimientos que los cargados. Reduce el periodo para
            ver el detalle completo.
          </Banner>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Metric
            card
            label="Ingresos brutos"
            value={money(data.totals.gross_amount, data.currency)}
            hint={`${data.totals.successful_payments} cobros confirmados`}
          />
          <Metric
            card
            label="Comisiones Stripe"
            value={money(data.totals.fee_amount, data.currency)}
            tone="warn"
          />
          <Metric
            card
            label="Reembolsos"
            value={money(data.totals.refunded_amount, data.currency)}
            tone="danger"
          />
          <Metric
            card
            label="Neto recibido"
            value={money(data.totals.net_amount, data.currency)}
            tone="success"
          />
          <Metric
            card
            label="Gastos del periodo"
            value={money(data.expenses.total, data.expenses.currency)}
            hint={`${data.expenses.active_recurring} costes recurrentes activos`}
            tone="warn"
          />
          <Metric
            card
            label="Beneficio operativo"
            value={money(data.operating_profit, currency)}
            hint="Neto Stripe menos gastos, antes de IRPF"
            tone={
              data.operating_profit !== null && data.operating_profit < 0
                ? "danger"
                : "success"
            }
          />
        </div>
        {data.totals.failed_payments || data.totals.pending_payments ? (
          <p className="mt-4 text-sm text-muted">
            {data.totals.failed_payments} pagos fallidos ·{" "}
            {data.totals.pending_payments} pendientes
          </p>
        ) : null}
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card kicker="Ingresos" title="Cobros y reembolsos">
          <AreaChart
            data={timeline}
            xKey="period"
            series={[
              { key: "gross", label: "Bruto" },
              {
                key: "refunds",
                label: "Reembolsos",
                color: "var(--color-danger)",
              },
            ]}
            valueFormatter={(value) => money(value, data.currency)}
            height={250}
          />
        </Card>
        <Card kicker="Costes" title="Gastos por categoría">
          {categoryChart.length ? (
            <BarChart
              data={categoryChart}
              xKey="name"
              series={[{ key: "amount", label: "Gasto" }]}
              horizontal
              height={Math.max(150, categoryChart.length * 42)}
              valueFormatter={(value) => money(value, data.expenses.currency)}
            />
          ) : (
            <p className="text-sm text-muted">
              Registra gastos para ver su distribución.
            </p>
          )}
        </Card>
      </div>

      {mutationError ? <ErrorBlock>{mutationError}</ErrorBlock> : null}
      <Card
        kicker="Libro de gastos"
        title="Costes activos"
        description="Los gastos archivados se conservan en base de datos, pero dejan de proyectarse."
        actions={
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setFormKey((value) => value + 1);
              setExpenseFormOpen(true);
            }}
          >
            Registrar gasto
          </Button>
        }
      >
        <Table
          ariaLabel="Gastos de plataforma"
          columns={expenseColumns}
          rows={expenses}
          emptyLabel="Todavía no hay gastos registrados."
        />
      </Card>

      <ExpenseSheet
        key={`${editing?.id ?? "new"}-${formKey}`}
        isOpen={expenseFormOpen}
        onOpenChange={(open) => {
          setExpenseFormOpen(open);
          if (!open) setEditing(null);
        }}
        expense={editing}
        onSaved={saved}
      />

      <Card kicker="Acceso comercial" title="Suscripciones">
        <div className="grid gap-4 sm:grid-cols-4">
          <Metric
            label="Activas"
            value={data.subscriptions.active}
            tone="success"
          />
          <Metric label="En prueba" value={data.subscriptions.trial} />
          <Metric label="Pagadas" value={data.subscriptions.paid} />
          <Metric
            label="Concedidas"
            value={data.subscriptions.granted}
            tone="warn"
          />
        </div>
      </Card>
      <Card kicker="Stripe" title="Últimos movimientos">
        <Table
          ariaLabel="Movimientos financieros de Stripe"
          columns={paymentColumns}
          rows={data.payments}
          emptyLabel="No hay movimientos en este periodo."
        />
      </Card>
    </div>
  );
}

export default function AdminFinanzasPage() {
  return (
    <PlatformAdminShell title="Finanzas">
      {() => <FinancePanel />}
    </PlatformAdminShell>
  );
}
