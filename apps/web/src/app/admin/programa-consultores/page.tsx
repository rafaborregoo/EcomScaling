"use client";

import { type FormEvent, useState } from "react";
import { PlatformAdminShell } from "@/components/platform-admin-shell";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { invalidateCachedQueries, useCachedQuery } from "@/lib/use-cached-query";
import {
  AsyncState,
  Badge,
  Button,
  Card,
  Checkbox,
  ErrorBlock,
  Field,
  Input,
  Table,
  toast,
} from "@/components/ui";

type ConsultantRow = {
  consultant_user_id: string;
  consultant_name: string | null;
  code: string | null;
  discount_percent: number | null;
  discount_months: number | null;
  is_active: boolean | null;
  registrados: number;
  activos: number;
  cancelados: number;
  leads: number;
};

type Referral = {
  referral_id: string;
  organization_name: string;
  created_at: string;
  estado: "registrado" | "activo" | "cancelado";
  contact_name: string | null;
  contact_email: string | null;
};

const KEY = "/v1/admin/referidos";

const ESTADO_TONE = {
  activo: "success",
  registrado: "neutral",
  cancelado: "danger",
} as const;

function EditarCodigo({
  row,
  onSaved,
}: {
  row: ConsultantRow;
  onSaved: () => void;
}) {
  const [code, setCode] = useState(row.code ?? "");
  const [percent, setPercent] = useState(String(row.discount_percent ?? 10));
  const [months, setMonths] = useState(String(row.discount_months ?? 3));
  const [active, setActive] = useState(row.is_active ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const response = await apiFetch(`${KEY}/${row.consultant_user_id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        discount_percent: Number(percent),
        discount_months: Number(months),
        is_active: active,
      }),
    });
    setBusy(false);
    if (!response.ok) {
      setError(await readApiError(response));
      return;
    }
    toast.success("Código guardado");
    onSaved();
  }

  const renamed = row.code !== null && code !== row.code;

  return (
    <form className="grid gap-4" onSubmit={submit}>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Código">
          <Input
            value={code}
            onChange={(event) => setCode(event.target.value.toLowerCase())}
            required
          />
        </Field>
        <Field label="Descuento (%)">
          <Input
            type="number"
            min={0}
            max={100}
            value={percent}
            onChange={(event) => setPercent(event.target.value)}
            required
          />
        </Field>
        <Field label="Durante (meses)">
          <Input
            type="number"
            min={1}
            max={36}
            value={months}
            onChange={(event) => setMonths(event.target.value)}
            required
          />
        </Field>
      </div>
      <Checkbox checked={active} onChange={setActive}>
        Código activo
      </Checkbox>
      <p className="text-sm text-muted">
        El cupón <code>referido-{percent}-{months}m</code> tiene que existir en
        Stripe. El cambio solo afecta a las altas nuevas.
        {renamed ? " Cambiar el código deja sin efecto los enlaces ya repartidos." : ""}
      </p>
      {error ? <ErrorBlock>{error}</ErrorBlock> : null}
      <div>
        <Button type="submit" disabled={busy}>
          {busy ? "Guardando..." : row.code ? "Guardar" : "Crear código"}
        </Button>
      </div>
    </form>
  );
}

function Referidos({ consultantUserId }: { consultantUserId: string }) {
  const query = useCachedQuery<{ referrals: Referral[] }>(
    `${KEY}/${consultantUserId}`,
  );
  if (query.error) return <ErrorBlock>{query.error}</ErrorBlock>;
  if (!query.data) return <AsyncState status="loading" />;
  return (
    <Table
      ariaLabel="Referidos del consultor"
      emptyLabel="Nadie se ha registrado con este código."
      rows={query.data.referrals.map((row) => ({ ...row, id: row.referral_id }))}
      columns={[
        { key: "organization_name", label: "Negocio" },
        {
          key: "created_at",
          label: "Alta",
          render: (row) => new Date(row.created_at).toLocaleDateString("es-ES"),
        },
        {
          key: "estado",
          label: "Estado",
          render: (row) => (
            <Badge tone={ESTADO_TONE[row.estado]}>{row.estado}</Badge>
          ),
        },
        {
          key: "contact_email",
          label: "Contacto consentido",
          render: (row) =>
            row.contact_email ? `${row.contact_name ?? ""} ${row.contact_email}` : "—",
        },
      ]}
    />
  );
}

function ProgramaPanel() {
  const query = useCachedQuery<{ consultants: ConsultantRow[] }>(KEY);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (query.error) return <ErrorBlock>{query.error}</ErrorBlock>;
  if (!query.data) {
    return <AsyncState status="loading" loadingLabel="Cargando programa..." />;
  }

  const selected = query.data.consultants.find(
    (row) => row.consultant_user_id === selectedId,
  );

  function reload() {
    invalidateCachedQueries(KEY);
    query.reload();
  }

  return (
    <div className="grid gap-6">
      <Card title="Consultores">
        <Table
          ariaLabel="Códigos de referido por consultor"
          emptyLabel="No hay consultores."
          rows={query.data.consultants.map((row) => ({
            ...row,
            id: row.consultant_user_id,
          }))}
          columns={[
            {
              key: "consultant_name",
              label: "Consultor",
              render: (row) => row.consultant_name ?? "Sin nombre",
            },
            {
              key: "code",
              label: "Código",
              render: (row) =>
                row.code ? (
                  <span className="flex items-center gap-2">
                    <code>{row.code}</code>
                    {row.is_active ? null : <Badge tone="warn">inactivo</Badge>}
                  </span>
                ) : (
                  "—"
                ),
            },
            {
              key: "discount_percent",
              label: "Descuento",
              render: (row) =>
                row.code
                  ? `${row.discount_percent}% · ${row.discount_months} m`
                  : "—",
            },
            { key: "registrados", label: "Registrados" },
            { key: "activos", label: "Con plan" },
            { key: "cancelados", label: "Cancelados" },
            { key: "leads", label: "Leads" },
            {
              key: "actions",
              label: "",
              render: (row) => (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setSelectedId(row.consultant_user_id)}
                >
                  {row.code ? "Gestionar" : "Crear código"}
                </Button>
              ),
            },
          ]}
        />
      </Card>

      {selected ? (
        <Card title={selected.consultant_name ?? "Consultor"}>
          <div className="grid gap-6">
            <EditarCodigo
              key={selected.consultant_user_id}
              row={selected}
              onSaved={reload}
            />
            {selected.code ? (
              <Referidos consultantUserId={selected.consultant_user_id} />
            ) : null}
          </div>
        </Card>
      ) : null}
    </div>
  );
}

export default function ProgramaConsultoresPage() {
  return (
    <PlatformAdminShell title="Programa de consultores">
      {() => (
        <div className="portal-page mx-auto max-w-5xl">
          <ProgramaPanel />
        </div>
      )}
    </PlatformAdminShell>
  );
}
