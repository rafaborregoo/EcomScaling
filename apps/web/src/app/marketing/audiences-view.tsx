"use client";

import { ButtonLink, EmptyState, Sparkline, DataTable, type DataTableColumn, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";
import { StatusStrip } from "@/components/trabajo-ui";
import { int, pct, type KSeriesPoint, type KWorkspace } from "./klaviyo-workspace";
import s from "./marketing-views.module.css";

type AudienceRow = { id: string; name: string; size: number | null; series: KSeriesPoint[]; used_in: number; synced_at: string | null };

function change(series: KSeriesPoint[]) {
  if (series.length < 2) return null;
  return series[series.length - 1]!.count - series[0]!.count;
}

/** Marketing -> Audiencias: listas, segmentos y formularios de Klaviyo. */
export function AudiencesView({ workspace }: { workspace: KWorkspace | undefined }) {
  if (!workspace?.connected) {
    return (
      <div className={s.root}>
        <Header />
        <EmptyState
          title="Tus listas y segmentos viven en Klaviyo"
          hint="Al conectar la cuenta, NORA trae cada lista y segmento con su tamaño y su evolución, y los formularios que las alimentan."
          action={
            <ButtonLink href="/integraciones" variant="default">
              Conectar Klaviyo
            </ButtonLink>
          }
        />
      </div>
    );
  }
  const audiences = workspace.audiences ?? { lists: [], segments: [], forms: [] };
  const main = [...audiences.lists].sort((a, b) => (b.size ?? 0) - (a.size ?? 0))[0];
  const mainChange = main ? change(main.series) : null;
  const forms = audiences.forms;
  const viewed = forms.reduce((sum, form) => sum + (form.stats?.viewed_form_uniques ?? 0), 0);
  const submits = forms.reduce((sum, form) => sum + (form.stats?.submits ?? 0), 0);

  const columns: Array<DataTableColumn<AudienceRow>> = [
    {
      key: "name",
      label: "Nombre",
      render: (row) => (
        <span className="grid">
          <b>{row.name}</b>
          <span className={s.muted}>{row.used_in ? `En ${row.used_in} campaña${row.used_in === 1 ? "" : "s"}` : "Sin usar en campañas"}</span>
        </span>
      ),
    },
    {
      key: "size",
      label: "Perfiles",
      render: (row) => {
        const delta = change(row.series);
        return (
          <span className="grid text-right">
            <b className={s.num}>{row.size == null ? "Pendiente" : int(row.size)}</b>
            {delta != null ? (
              <span className={s.muted} style={{ color: delta >= 0 ? "var(--mk-good)" : "var(--mk-bad)" }}>
                {delta >= 0 ? "+" : "−"}
                {int(Math.abs(delta))} en {row.series.length} d
              </span>
            ) : null}
          </span>
        );
      },
    },
    {
      key: "trend",
      label: "Tendencia",
      render: (row) =>
        row.series.length > 1 ? (
          <div style={{ width: 110 }} aria-label={`Evolución de ${row.name}`}>
            <Sparkline data={row.series.map((point) => point.count)} height={30} />
          </div>
        ) : (
          <span className={s.muted}>Se completa día a día</span>
        ),
    },
  ];

  return (
    <div className={s.root}>
      <Header />
      <StatusStrip
        items={[
          { value: main?.size == null ? "—" : int(main.size), label: main ? `Suscriptores · ${main.name}` : "Suscriptores" },
          {
            value: mainChange == null ? "—" : `${mainChange >= 0 ? "+" : "−"}${int(Math.abs(mainChange))}`,
            label: "Cambio en la lista principal",
            tone: mainChange != null && mainChange < 0 ? "warn" : mainChange ? "good" : undefined,
          },
          { value: viewed ? pct(submits / viewed) : "—", label: "Conversión de formularios · 30 d" },
          { value: int(submits), label: "Altas por formulario · 30 d" },
        ]}
      />
      <Card>
        <CardHeader>
          <CardTitle>Listas</CardTitle>
          <CardDescription>Perfiles y evolución de los últimos días.</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable ariaLabel="Listas" columns={columns} rows={audiences.lists} emptyLabel="No hay listas." />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Segmentos</CardTitle>
          <CardDescription>Klaviyo guarda su histórico de los últimos 60 días: se trae completo.</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable ariaLabel="Segmentos" columns={columns} rows={audiences.segments} emptyLabel="No hay segmentos." />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Formularios de captación</CardTitle>
          <CardDescription>Últimos 30 días.</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            ariaLabel="Formularios"
            rows={forms}
            emptyLabel="No hay formularios."
            columns={[
              { key: "name", label: "Formulario", render: (row) => <b>{row.name}</b> },
              { key: "status", label: "Estado", render: (row) => (String(row.status).toLowerCase() === "live" ? "Activo" : row.status ?? "—") },
              { key: "viewed", label: "Vistas", render: (row) => <span className={s.num}>{int(row.stats?.viewed_form_uniques ?? null)}</span> },
              { key: "submits", label: "Altas", render: (row) => <span className={s.num}>{int(row.stats?.submits ?? null)}</span> },
              {
                key: "rate",
                label: "Conversión",
                render: (row) => <span className={s.num}>{row.stats?.submit_rate != null ? pct(row.stats.submit_rate) : "—"}</span>,
              },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function Header() {
  return (
    <div className={`${s.head} client-sr-title`}>
      <div>
        <h1>Audiencias</h1>
        <p>A quién llegas, cuánto crece cada lista y qué formularios la alimentan.</p>
      </div>
    </div>
  );
}
