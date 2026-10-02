"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/money";
import { Badge, Button, Card, Table, type TableColumnDef } from "@/components/ui";
import { audienceSize, STATE_LABEL, UPCOMING, type CampaignRow } from "./campaign-rows";
import { int, pct, ratio, type KWorkspace } from "./klaviyo-workspace";
import { fmtSchedule } from "./format";
import s from "./marketing-views.module.css";

const FILTERS: Array<{ key: string; label: string; match: (row: CampaignRow) => boolean }> = [
  { key: "upcoming", label: "Próximas", match: (row) => UPCOMING.includes(row.state) },
  { key: "sent", label: "Enviadas", match: (row) => row.state === "sent" },
  { key: "draft", label: "Borradores en Klaviyo", match: (row) => row.state === "draft" },
  { key: "all", label: "Todas", match: () => true },
];

/** Marketing -> Campañas: lo planificado en NORA y lo que hay en Klaviyo, juntos. */
export function CampaignsView({
  rows,
  workspace,
  onOpenRow,
  onPropose,
  onCreate,
}: {
  rows: CampaignRow[];
  workspace: KWorkspace | undefined;
  onOpenRow: (row: CampaignRow) => void;
  onPropose: () => void;
  onCreate: () => void;
}) {
  const [filter, setFilter] = useState("upcoming");
  const currency = workspace?.account?.currency ?? "EUR";
  const active = FILTERS.find((entry) => entry.key === filter) ?? FILTERS[0]!;
  const shown = rows.filter(active.match).map((row) => ({ ...row, id: row.key }));
  const maxRevenue = Math.max(1, ...rows.map((row) => row.stats?.revenue ?? 0));

  const columns: Array<TableColumnDef<CampaignRow & { id: string }>> = [
    {
      key: "name",
      label: "Campaña",
      render: (row) => (
        <button type="button" className={s.linkBtn} onClick={() => onOpenRow(row)}>
          <b>{row.name}</b>
          <span className={s.muted}>{row.subject || (row.state === "nopiece" ? "Falta escribir la pieza" : "—")}</span>
        </button>
      ),
    },
    {
      key: "state",
      label: "Estado",
      render: (row) => (
        <span className={s.row}>
          <Badge tone={STATE_LABEL[row.state].tone}>{STATE_LABEL[row.state].label}</Badge>
          <span className={s.src} data-src={row.source === "klaviyo" ? "klaviyo" : "nora"}>
            {row.source === "klaviyo" ? "KLAVIYO" : "NORA"}
          </span>
        </span>
      ),
    },
    {
      key: "audience",
      label: "Audiencia",
      render: (row) => {
        const size = audienceSize(row.audiences.included);
        return row.audiences.included.length ? (
          <span>
            {row.audiences.included.map((audience) => audience.name).join(", ")}
            {size != null ? <span className={s.muted}> · {int(size)}</span> : null}
          </span>
        ) : (
          <span className={s.muted}>—</span>
        );
      },
    },
    { key: "date", label: "Fecha", render: (row) => (row.date ? fmtSchedule(row.date) : "Sin fecha") },
    {
      key: "opens",
      label: "Aperturas",
      render: (row) => <span className={s.num}>{row.stats?.delivered ? pct(ratio(row.stats.opens_unique, row.stats.delivered)) : "—"}</span>,
    },
    {
      key: "clicks",
      label: "Clics",
      render: (row) => <span className={s.num}>{row.stats?.delivered ? pct(ratio(row.stats.clicks_unique, row.stats.delivered)) : "—"}</span>,
    },
    {
      key: "revenue",
      label: "EUR atrib. Klaviyo",
      render: (row) =>
        row.stats?.revenue ? (
          <span className={s.num} title={`${Math.round((100 * row.stats.revenue) / maxRevenue)} % de la mejor campaña`}>
            {formatMoney(row.stats.revenue, currency)}
          </span>
        ) : (
          <span className={s.muted}>—</span>
        ),
    },
  ];

  return (
    <div className={s.root}>
      <div className={s.head}>
        <div>
          <h1>Campañas</h1>
          <p>Lo que planificas en NORA y lo que ya está en Klaviyo, en una sola lista.</p>
        </div>
        <div className={s.acts}>
          <Button variant="secondary" onClick={onPropose}>
            Proponer con IA
          </Button>
          <Button onClick={onCreate}>Nueva campaña</Button>
        </div>
      </div>
      <div className={s.chips} role="group" aria-label="Filtrar campañas">
        {FILTERS.map((entry) => (
          <button
            key={entry.key}
            type="button"
            className={s.chip}
            aria-pressed={filter === entry.key}
            onClick={() => setFilter(entry.key)}
          >
            {entry.label}
            <span className={s.chipCount}>{rows.filter(entry.match).length}</span>
          </button>
        ))}
      </div>
      <Card>
        <Table
          ariaLabel="Campañas"
          columns={columns}
          rows={shown}
          emptyLabel={filter === "upcoming" ? "No hay nada próximo. Propón campañas con la IA o crea una." : "Nada en este filtro."}
        />
      </Card>
      <p className={s.caveat}>
        Cifras en EUR atribuidos por Klaviyo, de toda la vida de cada campaña. No se suman a Meta ni a las ventas de Shopify.
      </p>
    </div>
  );
}
