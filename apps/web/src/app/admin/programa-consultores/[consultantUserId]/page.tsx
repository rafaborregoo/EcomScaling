"use client";

import { type FormEvent, useState } from "react";
import { useParams } from "next/navigation";
import { PlatformAdminShell } from "@/components/platform-admin-shell";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { invalidateCachedQueries, useCachedQuery } from "@/lib/use-cached-query";
import { AsyncState, Badge, Button, ButtonLink, Checkbox, ErrorBlock, Field, Input, Metric, DataTable, toast, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";

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
const ESTADO_TONE = { activo: "success", registrado: "neutral", cancelado: "danger" } as const;

function ReferralControl({ row, onSaved }: { row: ConsultantRow; onSaved: () => void }) {
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
      body: JSON.stringify({ code, discount_percent: Number(percent), discount_months: Number(months), is_active: active }),
    });
    setBusy(false);
    if (!response.ok) { setError(await readApiError(response)); return; }
    toast.success("Código guardado");
    onSaved();
  }

  return <Card>
    <CardHeader>
      <CardTitle>Configuración del código</CardTitle>
      <CardDescription>{"El cupón referido-{descuento}-{meses}m debe existir en Stripe. Los cambios afectan a las altas nuevas."}</CardDescription>
    </CardHeader>
    <CardContent>
      <form className="grid gap-4" onSubmit={submit}>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Código"><Input value={code} onChange={(event) => setCode(event.target.value.toLowerCase().trim())} required /></Field>
          <Field label="Descuento (%)"><Input type="number" min={0} max={100} value={percent} onChange={(event) => setPercent(event.target.value)} required /></Field>
          <Field label="Duración (meses)"><Input type="number" min={1} max={36} value={months} onChange={(event) => setMonths(event.target.value)} required /></Field>
        </div>
        <Checkbox checked={active} onCheckedChange={setActive}>Código activo</Checkbox>
        {row.code && code !== row.code ? <p className="text-sm text-muted">Cambiar el código invalida los enlaces anteriores.</p> : null}
        {error ? <ErrorBlock>{error}</ErrorBlock> : null}
        <div><Button type="submit" disabled={busy}>{busy ? "Guardando…" : row.code ? "Guardar cambios" : "Crear código"}</Button></div>
      </form>
    </CardContent>
  </Card>;
}

function ReferralList({ consultantUserId }: { consultantUserId: string }) {
  const query = useCachedQuery<{ referrals: Referral[] }>(`${KEY}/${consultantUserId}`);
  if (query.error) return <ErrorBlock>{query.error}</ErrorBlock>;
  if (!query.data) return <AsyncState status="loading" loadingLabel="Cargando referidos…" />;
  return <Card>
    <CardHeader>
      <CardTitle>Referidos</CardTitle>
      <CardDescription>Altas atribuidas al código y estado de su suscripción.</CardDescription>
    </CardHeader>
    <CardContent>
      <DataTable ariaLabel="Referidos del consultor" emptyLabel="Todavía no hay registros con este código."
        rows={query.data.referrals.map((row) => ({ ...row, id: row.referral_id }))}
        columns={[
          { key: "organization_name", label: "Negocio" },
          { key: "created_at", label: "Fecha de alta", render: (row) => new Date(row.created_at).toLocaleDateString("es-ES") },
          { key: "estado", label: "Estado", render: (row) => <Badge tone={ESTADO_TONE[row.estado]}>{row.estado}</Badge> },
          { key: "contact_email", label: "Contacto consentido", render: (row) => row.contact_email ? `${row.contact_name ?? ""} ${row.contact_email}`.trim() : "—" },
        ]} />
    </CardContent>
  </Card>;
}

function ReferralDetail({ consultantUserId }: { consultantUserId: string }) {
  const query = useCachedQuery<{ consultants: ConsultantRow[] }>(KEY);
  if (query.error && !query.data) return <ErrorBlock>{query.error}</ErrorBlock>;
  if (!query.data) return <AsyncState status="loading" loadingLabel="Cargando programa…" />;
  const row = query.data.consultants.find((item) => item.consultant_user_id === consultantUserId);
  if (!row) return <Card>
    <CardHeader>
      <CardTitle>No encontramos este consultor</CardTitle>
    </CardHeader>
    <CardContent><ButtonLink href="/admin/programa-consultores" variant="secondary">Volver al programa</ButtonLink></CardContent>
  </Card>;
  const reload = () => { invalidateCachedQueries(KEY); query.reload(); };
  return <div className="admin-client-detail">
    <header className="admin-client-detail-header">
      <ButtonLink href="/admin/programa-consultores" variant="ghost" size="sm">Programa de consultores</ButtonLink>
      <div className="admin-client-detail-title-row"><div>
        <div className="flex flex-wrap items-center gap-2"><h1>{row.consultant_name ?? "Consultor sin nombre"}</h1><Badge tone={row.is_active ? "success" : "neutral"}>{row.code ? (row.is_active ? "Código activo" : "Código inactivo") : "Sin código"}</Badge></div>
        <p>Control del código, descuentos y resultados de referidos</p>
      </div></div>
    </header>
    <div className="admin-data-summary">
      <Metric card label="Registros" value={String(row.registrados)} />
      <Metric card label="Con plan activo" value={String(row.activos)} />
      <Metric card label="Cancelados" value={String(row.cancelados)} />
      <Metric card label="Leads" value={String(row.leads)} />
    </div>
    <ReferralControl key={row.consultant_user_id} row={row} onSaved={reload} />
    {row.code ? <ReferralList consultantUserId={row.consultant_user_id} /> : null}
  </div>;
}

export default function ConsultantReferralPage() {
  const params = useParams<{ consultantUserId: string }>();
  return <PlatformAdminShell title="Programa de consultores">{() => <div className="portal-page mx-auto max-w-5xl"><ReferralDetail consultantUserId={params.consultantUserId} /></div>}</PlatformAdminShell>;
}
