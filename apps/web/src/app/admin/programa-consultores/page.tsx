"use client";

import { PlatformAdminShell } from "@/components/platform-admin-shell";
import { useCachedQuery } from "@/lib/use-cached-query";
import { AsyncState, Badge, ButtonLink, ErrorBlock, DataTable, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";

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

const KEY = "/v1/admin/referidos";

function ProgramaPanel() {
  const query = useCachedQuery<{ consultants: ConsultantRow[] }>(KEY);

  if (query.error) return <ErrorBlock>{query.error}</ErrorBlock>;
  if (!query.data) {
    return <AsyncState status="loading" loadingLabel="Cargando programa..." />;
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Consultores</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
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
                  <ButtonLink
                    size="sm"
                    variant="secondary"
                    href={`/admin/programa-consultores/${row.consultant_user_id}`}
                  >
                    {row.code ? "Gestionar" : "Crear código"}
                  </ButtonLink>
                ),
              },
            ]}
          />
        </CardContent>
      </Card>
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
