"use client";

import { type FormEvent, useState } from "react";
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

// Captacion: lo que trae clientes nuevos. Antes vivia en /consultor/referidos
// ("Mi codigo"); ahora es una pestana de Clientes. El contrato de la API no
// cambia: /v1/consultant/referidos, mas dos escrituras del propio consultor
// (pausar su codigo y marcar un lead como contactado).

type Referral = {
  referral_id: string;
  organization_name: string;
  created_at: string;
  estado: "registrado" | "activo" | "cancelado";
  contact_name: string | null;
  contact_email: string | null;
  contact_consent_at: string | null;
  contacted_at: string | null;
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
    leads_pendientes: number;
  } | null;
  referrals: Referral[];
};

const KEY = "/v1/consultant/referidos";

const ESTADO_TONE = {
  activo: "success",
  registrado: "neutral",
  cancelado: "danger",
} as const;

const dayFormat = (iso: string) => new Date(iso).toLocaleDateString("es-ES");

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

function Programa({ data, reload }: { data: Program; reload: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  if (!data.code) return <CrearCodigo onCreated={reload} />;

  const link = `${window.location.origin}/r/${data.code.code}`;
  const summary = data.summary;
  const leads = data.referrals.filter((row) => row.contact_email);

  async function patch(url: string, body: Record<string, unknown>, key: string) {
    setBusy(key);
    try {
      const response = await apiFetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        toast.danger(await readApiError(response));
        return;
      }
      reload();
    } catch {
      toast.danger("No se pudo guardar por un error de red.");
    } finally {
      setBusy(null);
    }
  }

  const active = data.code.is_active;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Metric card label="Registrados" value={summary?.registrados ?? 0} hint="con tu enlace" />
        <Metric card label="Con plan" value={summary?.activos ?? 0} tone="success" />
        <Metric card label="Cancelados" value={summary?.cancelados ?? 0} />
        <Metric
          card
          label="Leads sin llamar"
          value={summary?.leads_pendientes ?? 0}
          tone={(summary?.leads_pendientes ?? 0) > 0 ? "warn" : "default"}
          hint={"de " + (summary?.leads ?? 0) + " que piden contacto"}
        />
      </div>

      <Card title="Tu código de referido">
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
          <Badge tone={active ? "success" : "neutral"}>{active ? "Activo" : "Pausado"}</Badge>
        </div>
        <p className="mt-4 text-sm text-muted">
          Código <strong>{data.code.code}</strong> · {data.code.discount_percent}% durante{" "}
          {data.code.discount_months} meses para quien se registre. No se puede cambiar: rompería los enlaces ya
          compartidos.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            disabled={busy === "code"}
            onClick={() => patch(`${KEY}/code`, { is_active: !active }, "code")}
          >
            {active ? "Pausar el código" : "Reactivar el código"}
          </Button>
          {active ? null : (
            <span className="text-sm text-muted">Mientras esté pausado, el enlace no da descuento.</span>
          )}
        </div>
      </Card>


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
              render: (row) => (row.contact_consent_at ? dayFormat(row.contact_consent_at) : ""),
            },
            {
              key: "contacted_at",
              label: "Estado",
              render: (row) => (
                <Button
                  variant="secondary"
                  disabled={busy === row.referral_id}
                  onClick={() =>
                    patch(`${KEY}/${row.referral_id}/contacted`, { contacted: !row.contacted_at }, row.referral_id)
                  }
                >
                  {row.contacted_at ? `Contactado el ${dayFormat(row.contacted_at)}` : "Marcar contactado"}
                </Button>
              ),
            },
          ]}
        />
      </Card>

      <Card title="Clientes referidos">
        <Table
          ariaLabel="Clientes referidos"
          emptyLabel="Aún no se ha registrado nadie con tu código."
          rows={data.referrals.map((row) => ({ ...row, id: row.referral_id }))}
          columns={[
            { key: "organization_name", label: "Negocio" },
            { key: "created_at", label: "Alta", render: (row) => dayFormat(row.created_at) },
            {
              key: "estado",
              label: "Estado",
              render: (row) => <Badge tone={ESTADO_TONE[row.estado]}>{row.estado}</Badge>,
            },
          ]}
        />
      </Card>
    </div>
  );
}

export function Captacion() {
  const query = useCachedQuery<Program>(KEY);

  if (query.data) return <Programa data={query.data} reload={query.reload} />;
  if (query.error) {
    return (
      <div className="grid gap-4">
        <ErrorBlock>{query.error}</ErrorBlock>
        <div>
          <Button variant="secondary" onClick={query.reload}>
            Reintentar
          </Button>
        </div>
      </div>
    );
  }
  return <AsyncState status="loading" loadingLabel="Cargando captación..." />;
}
