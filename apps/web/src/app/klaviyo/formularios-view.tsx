"use client";

import { Badge, DataTable, EmptyState, Heading, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";
import type { KWorkspace } from "@/app/marketing/klaviyo-workspace";

function number(value: number | null | undefined) {
  return value == null ? "—" : Math.round(value).toLocaleString("es-ES");
}

function statusLabel(status: string | null) {
  const value = (status ?? "").toLowerCase();
  if (value === "live" || value === "published") return "Activo";
  if (value === "draft") return "Borrador";
  return status || "Estado sin sincronizar";
}

export function KlaviyoFormsView({ workspace }: { workspace: KWorkspace | undefined }) {
  const forms = workspace?.audiences?.forms ?? [];
  const views = forms.reduce((total, form) => total + (form.stats?.viewed_form_uniques ?? 0), 0);
  const submits = forms.reduce((total, form) => total + (form.stats?.submits ?? 0), 0);

  return (
    <div className="grid gap-5">
      <header className="grid gap-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Klaviyo · Captación</p>
        <Heading size="lg">Formularios</Heading>
        <p className="max-w-3xl text-sm text-muted">
          Estado y resultados sincronizados de los formularios de Klaviyo. La edición y publicación remotas aún no están habilitadas en esta pantalla.
        </p>
      </header>

      {!workspace?.connected ? (
        <Card>
          <CardContent>
            <EmptyState title="Conecta Klaviyo para ver sus formularios." />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>{String(forms.length)}</CardTitle>
                <CardDescription>Formularios sincronizados</CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>{number(views)}</CardTitle>
                <CardDescription>Vistas únicas · últimos 30 días</CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>{number(submits)}</CardTitle>
                <CardDescription>Altas · últimos 30 días</CardDescription>
              </CardHeader>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Formularios de Klaviyo</CardTitle>
              <CardDescription>Rendimiento de los últimos 30 días; no incluye formularios creados fuera de Klaviyo.</CardDescription>
            </CardHeader>
            <CardContent>
              {forms.length ? (
                <DataTable
                  ariaLabel="Formularios de Klaviyo"
                  rows={forms}
                  searchPlaceholder="Buscar formulario…"
                  columns={[
                    { key: "name", label: "Formulario", render: (form) => <span className="font-medium">{form.name}</span> },
                    { key: "status", label: "Estado", value: (form) => statusLabel(form.status), render: (form) => <Badge tone={statusLabel(form.status) === "Activo" ? "success" : "neutral"}>{statusLabel(form.status)}</Badge> },
                    { key: "views", label: "Vistas", align: "end", value: (form) => form.stats?.viewed_form_uniques, render: (form) => number(form.stats?.viewed_form_uniques) },
                    { key: "submits", label: "Altas", align: "end", value: (form) => form.stats?.submits, render: (form) => number(form.stats?.submits) },
                    { key: "submit_rate", label: "Conversión", align: "end", value: (form) => form.stats?.submit_rate, render: (form) => (form.stats?.submit_rate == null ? "—" : `${(form.stats.submit_rate * 100).toLocaleString("es-ES", { maximumFractionDigits: 1 })} %`) },
                    { key: "synced_at", label: "Sincronizado", render: (form) => <span className="text-muted">{form.synced_at ? new Date(form.synced_at).toLocaleString("es-ES") : "Sin fecha"}</span> },
                  ]}
                />
              ) : (
                <EmptyState title="Aún no hay formularios sincronizados." hint="Revisa la conexión y la última sincronización de Klaviyo." />
              )}
            </CardContent>
          </Card>
          <p className="text-xs text-muted">La métrica de conversión usa las vistas y altas reportadas por Klaviyo. NORA conserva el estado remoto y no presenta un borrador local como si estuviera publicado.</p>
        </>
      )}
    </div>
  );
}
