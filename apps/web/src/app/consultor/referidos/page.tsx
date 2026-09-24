"use client";

import { type FormEvent, useState } from "react";
import { PortalShell } from "@/components/portal-shell";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { useCachedQuery } from "@/lib/use-cached-query";
import {
  AsyncState,
  Badge,
  Button,
  Card,
  ErrorBlock,
  Field,
  Input,
  Metric,
  Table,
  toast,
} from "@/components/ui";

type Referral = {
  referral_id: string;
  organization_name: string;
  created_at: string;
  estado: "registrado" | "activo" | "cancelado";
  contact_name: string | null;
  contact_email: string | null;
  contact_consent_at: string | null;
};

type Program = {
  code: {
    code: string;
    discount_percent: number;
    discount_months: number;
    is_active: boolean;
  } | null;
  summary: {
    registrados: number;
    activos: number;
    cancelados: number;
    leads: number;
  } | null;
  referrals: Referral[];
};

const KEY = "/v1/consultant/referidos";

const ESTADO_TONE = {
  activo: "success",
  registrado: "neutral",
  cancelado: "danger",
} as const;

function CrearCodigo({ onCreated }: { onCreated: () => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const response = await apiFetch(KEY, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    setBusy(false);
    if (!response.ok) {
      setError(await readApiError(response));
      return;
    }
    onCreated();
  }

  return (
    <Card title="Crea tu código">
      <form className="grid gap-4" onSubmit={submit}>
        <Field label="Código">
          <Input
            value={code}
            onChange={(event) => setCode(event.target.value.toLowerCase())}
            placeholder="ricardo"
            required
          />
        </Field>
        <p className="text-sm text-muted">
          No se puede cambiar: rompería los enlaces que ya hayas compartido.
        </p>
        {error ? <ErrorBlock>{error}</ErrorBlock> : null}
        <div>
          <Button type="submit" disabled={busy || code.length < 3}>
            {busy ? "Creando..." : "Crear código"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function ReferidosContent() {
  const query = useCachedQuery<Program>(KEY);

  if (query.data) return <Programa data={query.data} reload={query.reload} />;
  if (query.error) return <ErrorBlock>{query.error}</ErrorBlock>;
  return <AsyncState status="loading" loadingLabel="Cargando programa..." />;
}

function Programa({ data, reload }: { data: Program; reload: () => void }) {
  if (!data.code) return <CrearCodigo onCreated={reload} />;

  const link = `${window.location.origin}/r/${data.code.code}`;
  const summary = data.summary;
  const leads = data.referrals.filter((row) => row.contact_email);

  return (
    <div className="grid gap-6">
      <Card title="Tu enlace">
        <div className="flex flex-wrap items-center gap-4">
          <code className="text-sm">{link}</code>
          <Button
            variant="secondary"
            onClick={() => {
              void navigator.clipboard.writeText(link);
              toast.success("Enlace copiado");
            }}
          >
            Copiar
          </Button>
        </div>
        <p className="mt-4 text-sm text-muted">
          Código <strong>{data.code.code}</strong> ·{" "}
          {data.code.discount_percent}% durante {data.code.discount_months}{" "}
          meses para quien se registre
          {data.code.is_active ? "" : " · desactivado"}
        </p>
      </Card>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Metric card label="Registrados" value={summary?.registrados ?? 0} />
        <Metric card label="Con plan" value={summary?.activos ?? 0} tone="success" />
        <Metric card label="Cancelados" value={summary?.cancelados ?? 0} />
        <Metric card label="Quieren contacto" value={summary?.leads ?? 0} />
      </div>

      <Card title="Quieren conocer tu consultoría">
        <Table
          ariaLabel="Leads de consultoría"
          emptyLabel="Nadie ha pedido contacto todavía."
          rows={leads.map((row) => ({ ...row, id: row.referral_id }))}
          columns={[
            { key: "contact_name", label: "Nombre" },
            {
              key: "contact_email",
              label: "Email",
              render: (row) => (
                <a className="underline" href={`mailto:${row.contact_email}`}>
                  {row.contact_email}
                </a>
              ),
            },
            { key: "organization_name", label: "Negocio" },
            {
              key: "contact_consent_at",
              label: "Desde",
              render: (row) =>
                row.contact_consent_at
                  ? new Date(row.contact_consent_at).toLocaleDateString("es-ES")
                  : "",
            },
          ]}
        />
      </Card>

      <Card title="Referidos">
        <Table
          ariaLabel="Clientes referidos"
          emptyLabel="Aún no se ha registrado nadie con tu código."
          rows={data.referrals.map((row) => ({ ...row, id: row.referral_id }))}
          columns={[
            { key: "organization_name", label: "Negocio" },
            {
              key: "created_at",
              label: "Alta",
              render: (row) =>
                new Date(row.created_at).toLocaleDateString("es-ES"),
            },
            {
              key: "estado",
              label: "Estado",
              render: (row) => (
                <Badge tone={ESTADO_TONE[row.estado]}>{row.estado}</Badge>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}

export default function ReferidosPage() {
  return (
    <PortalShell title="Programa de consultores">
      {() => (
        <div className="portal-page mx-auto max-w-4xl">
          <ReferidosContent />
        </div>
      )}
    </PortalShell>
  );
}
