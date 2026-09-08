"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { formatMoney } from "@/lib/money";
import {
  Badge,
  Banner,
  Card,
  EmptyState,
  ErrorBlock,
  LoadingBlock,
  Metric,
  Table,
  type TableColumnDef,
  type Tone,
} from "@/components/ui";

export type MetaCreative = {
  ad_id: string;
  ad_name: string;
  ad_set_name: string;
  campaign_name: string;
  effective_status: string | null;
  spend: number;
  impressions: number;
  outbound_clicks: number | null;
  outbound_ctr: number | null;
  video_plays: number | null;
  hook_rate: number | null;
  hold_rate: number | null;
  thruplay_rate: number | null;
  quality_ranking: string | null;
  engagement_rate_ranking: string | null;
  conversion_rate_ranking: string | null;
  purchases: number;
  purchase_value: number;
  roas: number | null;
  cost_per_purchase: number | null;
  purchase_attribution_window: string | null;
  has_video: boolean;
  enough_volume: boolean;
  days_with_data: number;
};

export type MetaPixelRow = {
  pixel_id: string;
  pixel_name: string | null;
  external_pixel_id: string;
  is_unavailable: boolean | null;
  last_fired_at: string | null;
  hours_since_last_fire: number | null;
  event_name: string | null;
  events_total: number;
  days_with_events: number;
  days_in_period: number;
  days_missing: number;
  last_event_date: string | null;
  avg_daily_events: number | null;
};

export type MetaLearningRow = {
  ad_set_id: string;
  ad_set_name: string;
  campaign_name: string;
  effective_status: string | null;
  optimization_goal: string | null;
  learning_stage_status: string | null;
  learning_conversions: number | null;
  learning_conversions_needed: number | null;
  conversions_missing: number | null;
  daily_budget: number | null;
  spend_in_period: number;
  last_significant_change: string | null;
  days_since_change: number | null;
};

export type MetaAudienceRow = {
  audience_id: string;
  audience_name: string | null;
  subtype: string | null;
  approximate_count_lower: number | null;
  approximate_count_upper: number | null;
  retention_days: number | null;
  is_lookalike: boolean;
  lookalike_ratio: number | null;
  lookalike_country: string | null;
  origin_name: string | null;
  delivery_status_code: number | null;
  delivery_status_description: string | null;
  ad_sets_using: number;
  external_updated_at: string | null;
};

export type MetaChangeRow = {
  event_time: string;
  event_type: string;
  translated_event_type: string | null;
  actor_name: string | null;
  object_name: string | null;
  entity_level: string;
  spend_before: number;
  spend_after: number;
  purchases_before: number;
  purchases_after: number;
  purchase_value_before: number;
  purchase_value_after: number;
  roas_before: number | null;
  roas_after: number | null;
  cpa_before: number | null;
  cpa_after: number | null;
  roas_delta_pct: number | null;
  days_before: number;
  days_after: number;
  purchase_attribution_window: string | null;
};

export type MetaInsights = {
  period: { days: number | "all"; start: string | null; end: string };
  currency: string | null;
  min_impressions_for_rates: number;
  change_window_days: number;
  creatives: MetaCreative[];
  ranking_distribution: Array<{
    dimension: string;
    ranking_value: string;
    ads: number;
    spend: number;
    spend_share: number | null;
  }>;
  learning: MetaLearningRow[];
  pixels: MetaPixelRow[];
  audiences: MetaAudienceRow[];
  changes: MetaChangeRow[];
  unavailable: string[];
};

// Un pixel que lleva mas de un dia sin disparar deja a Meta optimizando sobre
// conversiones que no llegan.
const PIXEL_SILENT_HOURS = 24;

// Las creatividades que se pueden mirar de una sentada. El resto sigue en la
// funcion SQL para quien la llame por otra via.
const CREATIVE_LIMIT = 25;

// A partir de aqui la variacion de ROAS tras un cambio deja de ser ruido.
const ROAS_SHIFT_PCT = 15;

/**
 * Los veredictos de subasta de Meta.
 *
 * `UNKNOWN` no es un suspenso: es "no tengo bastante volumen para juzgarlo".
 * Pintarlo del mismo color que un BELOW_AVERAGE haria que alguien pausara un
 * anuncio recien lanzado por un juicio que Meta no ha emitido.
 */
const RANKING_PRESENTATION: Record<string, { label: string; tone: Tone }> = {
  ABOVE_AVERAGE: { label: "por encima de la media", tone: "success" },
  AVERAGE: { label: "en la media", tone: "neutral" },
  BELOW_AVERAGE_35: { label: "en el 35% peor", tone: "warn" },
  BELOW_AVERAGE_20: { label: "en el 20% peor", tone: "warn" },
  BELOW_AVERAGE_10: { label: "en el 10% peor", tone: "danger" },
  UNKNOWN: { label: "sin volumen para juzgar", tone: "neutral" },
  SIN_VEREDICTO: { label: "Meta no se ha pronunciado", tone: "neutral" },
};

const DIMENSION_LABEL: Record<string, string> = {
  calidad: "Calidad",
  interaccion: "Interacción",
  conversion: "Conversión",
};

const ENTITY_LABEL: Record<string, string> = {
  campaign: "campaña",
  adset: "conjunto",
  ad: "anuncio",
};

function percent(value: number | null | undefined, digits = 1) {
  if (value == null) return "—";
  return `${(Number(value) * 100).toFixed(digits)}%`;
}

function count(value: number | null | undefined) {
  if (value == null) return "—";
  return Number(value).toLocaleString("es-ES");
}

function money(value: number | null | undefined, currency: string | null) {
  if (value == null) return "—";
  // Sin moneda unica no se pinta simbolo: sumar dos monedas y ponerle un €
  // seria un importe que no existe en ninguna parte.
  return currency
    ? formatMoney(Number(value), currency)
    : Number(value).toLocaleString("es-ES", { maximumFractionDigits: 0 });
}

function multiple(value: number | null | undefined) {
  if (value == null) return "—";
  return `${Number(value).toFixed(2)}×`;
}

function dateTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function RankingBadge({ value }: { value: string | null }) {
  if (!value) return <span className="text-muted">—</span>;
  const presentation = RANKING_PRESENTATION[value] ?? {
    label: value.toLowerCase(),
    tone: "neutral" as Tone,
  };
  return <Badge tone={presentation.tone}>{presentation.label}</Badge>;
}

/**
 * Lo que aparece cuando un bloque no tiene datos. Separa "todavia no lo hemos
 * traido" de "lo trajimos y no hay nada": confundirlos hace que alguien celebre
 * cero anuncios rechazados cuando en realidad nunca se han sincronizado.
 */
function PendingSync({ what }: { what: string }) {
  return (
    <EmptyState
      title={`Todavía no hemos traído ${what}`}
      hint="Llega con el próximo sincronizado de Meta."
    />
  );
}

// --- 1. Lo que rompe la medicion --------------------------------------------

type PixelEventRow = MetaPixelRow & { id: string };

function MeasurementSection({ insights }: { insights: MetaInsights }) {
  if (!insights.pixels.length) {
    return (
      <Card
        title="Medición"
        description="Si el píxel no dispara, todo lo demás de esta página vale menos."
      >
        <PendingSync what="ningún píxel" />
      </Card>
    );
  }

  // La función SQL devuelve una fila por (píxel, evento); los campos de
  // cabecera se repiten en todas las de un mismo píxel.
  const pixels = new Map<
    string,
    {
      name: string;
      lastFired: string | null;
      hoursSince: number | null;
      unavailable: boolean;
      events: PixelEventRow[];
    }
  >();

  for (const row of insights.pixels) {
    const current = pixels.get(row.pixel_id) ?? {
      name: row.pixel_name ?? row.external_pixel_id,
      lastFired: row.last_fired_at,
      hoursSince: row.hours_since_last_fire,
      unavailable: Boolean(row.is_unavailable),
      events: [],
    };
    if (row.event_name) {
      current.events.push({ ...row, id: `${row.pixel_id}:${row.event_name}` });
    }
    pixels.set(row.pixel_id, current);
  }

  const columns: TableColumnDef<PixelEventRow>[] = [
    { key: "event_name", label: "Evento" },
    {
      key: "events_total",
      label: "Total",
      render: (row) => count(row.events_total),
    },
    {
      key: "avg_daily_events",
      label: "Media diaria",
      render: (row) => count(row.avg_daily_events),
    },
    {
      key: "days_missing",
      label: "Días sin él",
      render: (row) =>
        row.days_missing > 0 ? (
          <Badge tone="warn">
            {row.days_missing} de {row.days_in_period}
          </Badge>
        ) : (
          <span className="text-muted">0</span>
        ),
    },
    {
      key: "last_event_date",
      label: "Último",
      render: (row) => row.last_event_date ?? "—",
    },
  ];

  return (
    <Card
      title="Medición"
      description="Si el píxel no dispara, todo lo demás de esta página vale menos."
    >
      <div className="grid gap-6">
        {[...pixels.entries()].map(([pixelId, pixel]) => {
          const silent =
            pixel.unavailable ||
            pixel.hoursSince == null ||
            pixel.hoursSince > PIXEL_SILENT_HOURS;

          // Un evento que se cae a mitad de periodo es el caso que hay que
          // ver: el píxel sigue "vivo" y la optimización ya está ciega.
          const dropped = pixel.events.filter((event) => event.days_missing > 0);

          return (
            <div key={pixelId} className="grid gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={silent ? "danger" : "success"}>
                  {silent ? "sin disparar" : "activo"}
                </Badge>
                <span className="font-medium">{pixel.name}</span>
                <span className="text-xs text-muted">
                  último disparo {dateTime(pixel.lastFired)}
                </span>
              </div>

              {silent ? (
                <Banner tone="danger" className="text-sm">
                  <p className="font-medium">
                    Meta está optimizando sobre conversiones que no le llegan.
                  </p>
                  <p>
                    Mientras el píxel no dispare, las compras y el ROAS de esta
                    página no describen lo que pasa en la tienda.
                  </p>
                </Banner>
              ) : null}

              {pixel.events.length ? (
                <Table
                  ariaLabel={`Eventos del píxel ${pixel.name}`}
                  columns={columns}
                  rows={pixel.events}
                />
              ) : (
                <PendingSync what="los eventos de este píxel" />
              )}

              {dropped.length && !silent ? (
                <Banner tone="warn" className="text-sm">
                  El píxel dispara, pero{" "}
                  {dropped.map((event) => event.event_name).join(", ")} falta
                  algún día del periodo. Un píxel que manda visitas y no manda
                  compras se ve sano desde Meta.
                </Banner>
              ) : null}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// --- 2. Creatividades --------------------------------------------------------

type CreativeTableRow = MetaCreative & { id: string };

function CreativesSection({ insights }: { insights: MetaInsights }) {
  const currency = insights.currency;

  if (!insights.creatives.length) {
    return (
      <Card
        title="Creatividades"
        description="Qué pieza para el scroll y cuál se queda sin ver."
      >
        <PendingSync what="el rendimiento por anuncio" />
      </Card>
    );
  }

  const rows: CreativeTableRow[] = insights.creatives
    .slice(0, CREATIVE_LIMIT)
    .map((row) => ({ ...row, id: row.ad_id }));

  const withVideo = rows.filter((row) => row.has_video);
  const withoutVolume = rows.filter((row) => !row.enough_volume);
  const attributionWindow = rows.find(
    (row) => row.purchase_attribution_window,
  )?.purchase_attribution_window;

  const columns: TableColumnDef<CreativeTableRow>[] = [
    {
      key: "ad_name",
      label: "Anuncio",
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{row.ad_name}</p>
          <p className="truncate text-xs text-muted">
            {row.campaign_name} · {row.ad_set_name}
          </p>
        </div>
      ),
    },
    {
      key: "spend",
      label: "Gasto",
      render: (row) => (
        <span className="tabular-nums">{money(row.spend, currency)}</span>
      ),
    },
    {
      key: "hook_rate",
      label: "Enganche",
      // Tres situaciones distintas, tres textos distintos: no es un vídeo,
      // no hay volumen para medirlo, o el número.
      render: (row) =>
        !row.has_video ? (
          <span className="text-muted">sin vídeo</span>
        ) : !row.enough_volume ? (
          <span className="text-muted">sin volumen</span>
        ) : (
          <span className="tabular-nums">{percent(row.hook_rate)}</span>
        ),
    },
    {
      key: "hold_rate",
      label: "Retención",
      render: (row) =>
        !row.has_video || !row.enough_volume ? (
          <span className="text-muted">—</span>
        ) : (
          <span className="tabular-nums">{percent(row.hold_rate)}</span>
        ),
    },
    {
      key: "outbound_ctr",
      label: "CTR salida",
      render: (row) =>
        row.enough_volume ? (
          <span className="tabular-nums">{percent(row.outbound_ctr, 2)}</span>
        ) : (
          <span className="text-muted">sin volumen</span>
        ),
    },
    {
      key: "quality_ranking",
      label: "Calidad",
      render: (row) => <RankingBadge value={row.quality_ranking} />,
    },
    {
      key: "roas",
      label: "ROAS",
      render: (row) => (
        <span className="tabular-nums">{multiple(row.roas)}</span>
      ),
    },
    {
      key: "cost_per_purchase",
      label: "Coste por compra",
      render: (row) => (
        <span className="tabular-nums">
          {money(row.cost_per_purchase, currency)}
        </span>
      ),
    },
  ];

  return (
    <Card
      title="Creatividades"
      description="Qué pieza para el scroll y cuál se queda sin ver."
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric card label="Anuncios con gasto" value={count(rows.length)} />
        <Metric
          card
          label="De vídeo"
          value={count(withVideo.length)}
          hint={
            withVideo.length === 0 ? "las tasas de vídeo no aplican" : undefined
          }
        />
        <Metric
          card
          label="Sin volumen para juzgar"
          value={count(withoutVolume.length)}
          tone={withoutVolume.length > 0 ? "warn" : "default"}
          hint={`menos de ${count(insights.min_impressions_for_rates)} impresiones`}
        />
        <Metric
          card
          label="Gasto del periodo"
          value={money(
            rows.reduce((sum, row) => sum + Number(row.spend), 0),
            currency,
          )}
        />
      </div>

      <div className="mt-4">
        <Table
          ariaLabel="Rendimiento por creatividad"
          columns={columns}
          rows={rows}
        />
      </div>

      <p className="mt-3 text-xs text-muted">
        Enganche = reproducciones entre impresiones. Retención = de quien empezó
        el vídeo, cuánto llegó al final.
        {attributionWindow
          ? ` Compras y ROAS con la ventana de atribución ${attributionWindow} de Meta.`
          : null}
      </p>
    </Card>
  );
}

// --- 3. Donde va el dinero ---------------------------------------------------

function RankingSection({ insights }: { insights: MetaInsights }) {
  const currency = insights.currency;

  if (!insights.ranking_distribution.length) {
    return (
      <Card
        title="Dónde va el dinero"
        description="Cuánto presupuesto hay detrás de cada veredicto de Meta."
      >
        <PendingSync what="los veredictos de subasta" />
      </Card>
    );
  }

  const byDimension = new Map<
    string,
    MetaInsights["ranking_distribution"]
  >();
  for (const row of insights.ranking_distribution) {
    const current = byDimension.get(row.dimension) ?? [];
    current.push(row);
    byDimension.set(row.dimension, current);
  }

  return (
    <Card
      title="Dónde va el dinero"
      description="Cuánto presupuesto hay detrás de cada veredicto de Meta."
    >
      <div className="grid gap-6 lg:grid-cols-3">
        {[...byDimension.entries()].map(([dimension, values]) => (
          <div key={dimension} className="grid gap-2">
            <p className="text-sm font-medium">
              {DIMENSION_LABEL[dimension] ?? dimension}
            </p>
            {values.map((row) => (
              <div
                key={`${dimension}:${row.ranking_value}`}
                className="flex items-center justify-between gap-3"
              >
                <RankingBadge value={row.ranking_value} />
                <span className="shrink-0 text-sm tabular-nums">
                  {money(row.spend, currency)}
                  <span className="ml-2 text-muted">
                    {percent(row.spend_share, 0)}
                  </span>
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Diez anuncios flojos con 20 EUR son ruido; uno con el 60% del
          presupuesto es la conversacion del lunes. */}
      <p className="mt-3 text-xs text-muted">
        El reparto es por gasto, no por número de anuncios.
      </p>
    </Card>
  );
}

// --- 4. Fase de aprendizaje --------------------------------------------------

type LearningTableRow = MetaLearningRow & { id: string };

function LearningSection({ insights }: { insights: MetaInsights }) {
  const currency = insights.currency;

  if (!insights.learning.length) {
    return (
      <Card
        title="Aprendizaje"
        description="Un conjunto que aún aprende entrega peor, y es normal."
      >
        <PendingSync what="el estado de los conjuntos" />
      </Card>
    );
  }

  const rows: LearningTableRow[] = insights.learning
    .filter((row) => row.learning_stage_status === "LEARNING")
    .map((row) => ({ ...row, id: row.ad_set_id }));

  if (!rows.length) {
    return (
      <Card
        title="Aprendizaje"
        description="Un conjunto que aún aprende entrega peor, y es normal."
      >
        <EmptyState title="Ningún conjunto está en fase de aprendizaje." />
      </Card>
    );
  }

  const columns: TableColumnDef<LearningTableRow>[] = [
    {
      key: "ad_set_name",
      label: "Conjunto",
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{row.ad_set_name}</p>
          <p className="truncate text-xs text-muted">{row.campaign_name}</p>
        </div>
      ),
    },
    {
      key: "conversions",
      label: "Conversiones",
      render: (row) =>
        row.learning_conversions_needed == null ? (
          "—"
        ) : (
          <span className="tabular-nums">
            {count(row.learning_conversions)} de{" "}
            {count(row.learning_conversions_needed)}
          </span>
        ),
    },
    {
      key: "conversions_missing",
      label: "Faltan",
      render: (row) =>
        row.conversions_missing == null ? (
          "—"
        ) : (
          <Badge tone={row.conversions_missing > 25 ? "warn" : "neutral"}>
            {count(row.conversions_missing)}
          </Badge>
        ),
    },
    {
      key: "spend_in_period",
      label: "Gasto",
      render: (row) => (
        <span className="tabular-nums">
          {money(row.spend_in_period, currency)}
        </span>
      ),
    },
    {
      key: "last_significant_change",
      label: "Último cambio",
      render: (row) =>
        row.days_since_change == null ? (
          <span className="text-muted">sin cambios registrados</span>
        ) : (
          <span className="tabular-nums">
            hace {Math.round(row.days_since_change)} d
          </span>
        ),
    },
  ];

  return (
    <Card
      title="Aprendizaje"
      description="Un conjunto que aún aprende entrega peor, y es normal."
    >
      <Table
        ariaLabel="Conjuntos en fase de aprendizaje"
        columns={columns}
        rows={rows}
      />

      {/* El bucle que hay que romper: se toca porque entrega mal, y tocarlo
          reinicia el aprendizaje, con lo que vuelve a entregar mal. */}
      <p className="mt-3 text-xs text-muted">
        Meta reinicia el aprendizaje ante cambios de presupuesto, puja o
        segmentación. La columna de cambios está para ver si un conjunto lleva
        semanas sin salir de aquí porque se toca cada pocos días.
      </p>
    </Card>
  );
}

// --- 5. Que se toco y que paso -----------------------------------------------

type ChangeTableRow = MetaChangeRow & { id: string };

function ChangesSection({
  insights,
  showActor,
}: {
  insights: MetaInsights;
  showActor: boolean;
}) {
  const currency = insights.currency;

  if (!insights.changes.length) {
    return (
      <Card
        title="Qué se tocó y qué pasó"
        description={`Los ${insights.change_window_days} días anteriores y posteriores a cada cambio.`}
      >
        <PendingSync what="el registro de cambios de la cuenta" />
      </Card>
    );
  }

  const rows: ChangeTableRow[] = insights.changes.map((row, index) => ({
    ...row,
    id: `${row.event_time}:${row.entity_level}:${index}`,
  }));

  const columns: TableColumnDef<ChangeTableRow>[] = [
    {
      key: "event_time",
      label: "Cambio",
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium">
            {row.translated_event_type ?? row.event_type}
          </p>
          <p className="truncate text-xs text-muted">
            {dateTime(row.event_time)} ·{" "}
            {ENTITY_LABEL[row.entity_level] ?? row.entity_level}{" "}
            {row.object_name ?? ""}
            {/* Quien tocó qué es información del consultor: al cliente le
                sirve saber que se cambió, no señalar a nadie. */}
            {showActor && row.actor_name ? ` · ${row.actor_name}` : ""}
          </p>
        </div>
      ),
    },
    {
      key: "spend",
      label: "Gasto antes → después",
      render: (row) => (
        <span className="tabular-nums">
          {money(row.spend_before, currency)} →{" "}
          {money(row.spend_after, currency)}
        </span>
      ),
    },
    {
      key: "roas",
      label: "ROAS antes → después",
      render: (row) => (
        <span className="tabular-nums">
          {multiple(row.roas_before)} → {multiple(row.roas_after)}
        </span>
      ),
    },
    {
      key: "roas_delta_pct",
      label: "Variación",
      render: (row) =>
        row.roas_delta_pct == null ? (
          <span className="text-muted">—</span>
        ) : (
          <Badge
            tone={
              row.roas_delta_pct <= -ROAS_SHIFT_PCT
                ? "danger"
                : row.roas_delta_pct >= ROAS_SHIFT_PCT
                  ? "success"
                  : "neutral"
            }
          >
            {row.roas_delta_pct > 0 ? "+" : ""}
            {Number(row.roas_delta_pct).toFixed(0)}%
          </Badge>
        ),
    },
  ];

  return (
    <Card
      title="Qué se tocó y qué pasó"
      description={`Los ${insights.change_window_days} días anteriores y posteriores a cada cambio.`}
    >
      <Table
        ariaLabel="Impacto de los cambios de la cuenta"
        columns={columns}
        rows={rows}
      />

      {/* Sin esta frase, una flecha roja invita a leerse como causa probada. */}
      <p className="mt-3 text-xs text-muted">
        Esto es coincidencia en el tiempo, no causa demostrada: sirve para saber
        dónde mirar. El día del cambio queda fuera de las dos ventanas porque es
        mitad viejo y mitad nuevo.
      </p>
    </Card>
  );
}

// --- 6. Publicos -------------------------------------------------------------

type AudienceTableRow = MetaAudienceRow & { id: string };

function AudiencesSection({ insights }: { insights: MetaInsights }) {
  if (!insights.audiences.length) {
    return (
      <Card title="Públicos" description="Cuáles se usan y cuáles sobran.">
        <PendingSync what="los públicos de la cuenta" />
      </Card>
    );
  }

  const rows: AudienceTableRow[] = insights.audiences.map((row) => ({
    ...row,
    id: row.audience_id,
  }));
  const unused = rows.filter((row) => row.ad_sets_using === 0);

  const columns: TableColumnDef<AudienceTableRow>[] = [
    {
      key: "audience_name",
      label: "Público",
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium">
            {row.audience_name ?? "Sin nombre"}
          </p>
          <p className="truncate text-xs text-muted">
            {row.is_lookalike
              ? [
                  "similar",
                  row.lookalike_ratio
                    ? `${(Number(row.lookalike_ratio) * 100).toFixed(0)}%`
                    : null,
                  row.origin_name ? `de ${row.origin_name}` : null,
                ]
                  .filter(Boolean)
                  .join(" ")
              : (row.subtype?.toLowerCase() ?? "personalizado")}
          </p>
        </div>
      ),
    },
    {
      key: "size",
      label: "Tamaño",
      // Meta nunca da un numero exacto, da una horquilla. Se ensena como
      // horquilla en vez de aparentar una precision que no existe.
      render: (row) =>
        row.approximate_count_lower == null ? (
          <span className="text-muted">—</span>
        ) : (
          <span className="tabular-nums">
            {count(row.approximate_count_lower)}–
            {count(row.approximate_count_upper)}
          </span>
        ),
    },
    {
      key: "ad_sets_using",
      label: "En uso",
      render: (row) =>
        row.ad_sets_using > 0 ? (
          <Badge tone="success">{row.ad_sets_using} conjuntos</Badge>
        ) : (
          <Badge tone="neutral">sin usar</Badge>
        ),
    },
    {
      key: "delivery",
      label: "Estado",
      render: (row) => row.delivery_status_description ?? "—",
    },
  ];

  return (
    <Card title="Públicos" description="Cuáles se usan y cuáles sobran.">
      {unused.length ? (
        <p className="mb-4 text-sm text-muted">
          {unused.length} de {rows.length} públicos no aparecen en la
          segmentación de ningún conjunto.
        </p>
      ) : null}

      <Table
        ariaLabel="Públicos de la cuenta"
        columns={columns}
        rows={rows}
      />

      {/* La contrapartida de buscar el id con comodin recursivo. Decirlo evita
          que alguien borre un publico que solo se usa como exclusion. */}
      <p className="mt-3 text-xs text-muted">
        &quot;En uso&quot; cuenta que el público aparezca en la segmentación,
        sin distinguir si es para incluir o para excluir.
      </p>
    </Card>
  );
}

// --- Contenedor --------------------------------------------------------------

export function MetaInsightsSections({
  organizationId,
  connectionId,
  periodDays,
  showInternals,
}: {
  organizationId: string;
  connectionId: string | null;
  periodDays: number | "all";
  // El consultor ve quién tocó cada cosa y la higiene de la cuenta. El cliente
  // ve su dinero y lo que está roto, sin la parte forense.
  showInternals: boolean;
}) {
  const [insights, setInsights] = useState<MetaInsights | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (isCurrent: () => boolean) => {
      const params = new URLSearchParams({ days: String(periodDays) });
      if (connectionId) {
        params.set("connectionId", connectionId);
      }

      try {
        const response = await apiFetch(
          `/v1/organizations/${organizationId}/meta/insights?${params.toString()}`,
        );

        // El selector de periodo dispara una carga por pulsación. Sin este
        // corte, una respuesta lenta de "90 días" puede aterrizar después de
        // la de "7 días" y dejar en pantalla cifras de otro periodo.
        if (!isCurrent()) return;

        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as {
            error?: string;
            message?: string;
          } | null;
          setError(
            [body?.error ?? `HTTP ${response.status}`, body?.message]
              .filter(Boolean)
              .join(" - "),
          );
          return;
        }

        setInsights((await response.json()) as MetaInsights);
        setError(null);
      } catch {
        if (!isCurrent()) return;
        setError(
          "No se pudieron cargar estas métricas. Revisa la conexión e inténtalo de nuevo.",
        );
      }
    },
    [connectionId, organizationId, periodDays],
  );

  useEffect(() => {
    let current = true;
    void load(() => current);
    return () => {
      current = false;
    };
  }, [load]);

  if (error) {
    return (
      <Card>
        <ErrorBlock>{error}</ErrorBlock>
      </Card>
    );
  }

  if (!insights) {
    return (
      <Card>
        <LoadingBlock label="Cargando creatividades, píxel y cambios..." />
      </Card>
    );
  }

  return (
    <>
      {insights.unavailable.length ? (
        <Banner tone="danger" className="text-sm">
          No se pudieron calcular: {insights.unavailable.join(", ")}.
        </Banner>
      ) : null}

      {insights.currency === null && insights.creatives.length ? (
        <Banner tone="warn" className="text-sm">
          Las cuentas de este ámbito no usan la misma moneda: las cifras van sin
          símbolo porque sumarlas no daría un importe real.
        </Banner>
      ) : null}

      {/* La medición va primero: si el píxel está apagado, las cifras de abajo
          describen otra cosa. */}
      <MeasurementSection insights={insights} />
      <CreativesSection insights={insights} />
      <RankingSection insights={insights} />
      <LearningSection insights={insights} />
      <ChangesSection insights={insights} showActor={showInternals} />
      {showInternals ? <AudiencesSection insights={insights} /> : null}
    </>
  );
}
