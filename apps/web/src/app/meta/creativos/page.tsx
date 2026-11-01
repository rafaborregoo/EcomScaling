"use client";

import { type FormEvent, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useActiveOrganization } from "@/components/active-organization";
import { useActiveConnection } from "@/components/active-connection";
import { PortalShell } from "@/components/portal-shell";
import { AsyncState, Pagination, EmptyState, ErrorBlock } from "@/components/ui";
import type { BootstrapResponse } from "@/lib/bootstrap";
import { useCachedQuery } from "@/lib/use-cached-query";
import { cx } from "../../dashboard/client-pulse";
import pulse from "../../dashboard/client-pulse.module.css";
import r from "../../shopify/legible.module.css";
import styles from "./creativos.module.css";

type Budget = { amount: number; kind: "daily" | "lifetime" } | null;
type CreativeAsset = {
  id: string;
  asset_type: string;
  position: number;
  text_value: string | null;
  media_url: string | null;
  thumbnail_url: string | null;
  link_url: string | null;
  asset_label: string | null;
  is_primary: boolean;
  metadata: Record<string, unknown> | null;
};
type CreativeAd = {
  id: string;
  external_id: string;
  name: string;
  configured_status: string | null;
  effective_status: string | null;
  review_feedback: string | null;
  last_synced_at: string | null;
  ad_set: {
    id: string;
    name: string;
    effective_status: string | null;
    budget: Budget;
    budget_remaining: number | null;
  } | null;
  campaign: {
    id: string;
    name: string;
    objective: string | null;
    effective_status: string | null;
    budget: Budget;
    budget_remaining: number | null;
  } | null;
};
type Creative = {
  id: string;
  external_id: string;
  name: string | null;
  object_type: string | null;
  primary_text: string | null;
  headline: string | null;
  description: string | null;
  link_url: string | null;
  thumbnail_url: string | null;
  image_hash: string | null;
  external_video_id: string | null;
  last_synced_at: string | null;
  account: {
    id: string;
    name: string | null;
    currency_code: string | null;
  } | null;
  assets: CreativeAsset[];
  ads: CreativeAd[];
  ad_count: number;
};
type LibraryResponse = {
  creatives: Creative[];
  total: number;
  page: number;
  page_size: number;
  scope: "store" | "organization";
};

function statusText(status: string | null | undefined) {
  const normalized = status?.toUpperCase() ?? "";
  const labels: Record<string, string> = {
    ACTIVE: "Activa",
    PAUSED: "En pausa",
    ARCHIVED: "Archivada",
    DELETED: "Eliminada",
    IN_REVIEW: "En revisión",
    PENDING_REVIEW: "Pendiente de revisión",
    DISAPPROVED: "Rechazada",
    WITH_ISSUES: "Con incidencias",
    WITH_ERRORS: "Con errores",
  };
  return (
    labels[normalized] ??
    (normalized ? normalized.replaceAll("_", " ") : "Sin estado remoto")
  );
}

function statusClass(status: string | null | undefined) {
  const normalized = status?.toUpperCase() ?? "";
  if (["ACTIVE", "DELIVERING"].includes(normalized)) return styles.statusGood;
  if (
    ["DISAPPROVED", "WITH_ERRORS", "WITH_ISSUES", "ERROR"].includes(normalized)
  )
    return styles.statusBad;
  if (["PAUSED", "ARCHIVED", "DELETED"].includes(normalized))
    return styles.statusMuted;
  return styles.statusWarn;
}

function money(value: number | null, currency: string | null | undefined) {
  if (value == null || !currency)
    return value == null
      ? "Presupuesto no informado"
      : `${value.toLocaleString("es-ES")} · moneda sin verificar`;
  try {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${value.toLocaleString("es-ES")} ${currency}`;
  }
}

function budgetText(
  budget: Budget,
  currency: string | null | undefined,
  label: string,
) {
  if (!budget) return null;
  return `${label}: ${money(budget.amount, currency)}${budget.kind === "daily" ? " / día" : " · total"}`;
}

function campaignHref(
  campaignId: string,
  organizationId: string,
  connectionId: string,
) {
  const params = new URLSearchParams({ organizationId });
  if (connectionId) params.set("connectionId", connectionId);
  return `/meta/campanas/${encodeURIComponent(campaignId)}?${params.toString()}`;
}

function safeHttpUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function CreativeCard({
  creative,
  organizationId,
  connectionId,
}: {
  creative: Creative;
  organizationId: string;
  connectionId: string;
}) {
  const visual =
    creative.assets.find(
      (asset) =>
        asset.is_primary &&
        ["image", "video", "thumbnail"].includes(asset.asset_type) &&
        (asset.media_url || asset.thumbnail_url),
    ) ??
    creative.assets.find(
      (asset) =>
        ["image", "video", "thumbnail"].includes(asset.asset_type) &&
        (asset.media_url || asset.thumbnail_url),
    );
  const imageUrl = safeHttpUrl(
    visual?.asset_type === "image"
      ? (visual.media_url ?? visual.thumbnail_url)
      : (visual?.thumbnail_url ?? creative.thumbnail_url),
  );
  const previewLabel =
    visual?.asset_type === "video" || creative.external_video_id
      ? "Miniatura de vídeo"
      : "Vista previa de Meta";
  const typeLabels = [
    ...new Set(
      creative.assets.map((asset) => asset.asset_type.replaceAll("_", " ")),
    ),
  ];

  return (
    <article className={styles.card}>
      <div className={styles.visual}>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={`Vista previa de ${creative.name ?? creative.headline ?? "la creatividad"}`}
            loading="lazy"
          />
        ) : (
          <div className={styles.noVisual}>
            Meta no devolvió una vista previa disponible
          </div>
        )}
        <span className={styles.visualLabel}>{previewLabel}</span>
      </div>
      <div className={styles.body}>
        <div className={styles.heading}>
          <div className={styles.headingText}>
            <p className={styles.eyebrow}>
              {creative.object_type ?? "Creatividad importada de Meta"}
              {typeLabels.length ? ` · ${typeLabels.join(", ")}` : ""}
            </p>
            <h2>
              {creative.name ||
                creative.headline ||
                `Creatividad ${creative.external_id}`}
            </h2>
          </div>
          <span className={styles.count}>
            {creative.ad_count} anuncio{creative.ad_count === 1 ? "" : "s"}
          </span>
        </div>

        {creative.headline ? (
          <p className={styles.headline}>{creative.headline}</p>
        ) : null}
        {creative.primary_text ? (
          <p className={styles.copy}>{creative.primary_text}</p>
        ) : null}
        {creative.description ? (
          <p className={styles.copy}>{creative.description}</p>
        ) : null}
        {safeHttpUrl(creative.link_url) ? (
          <a
            className={styles.landing}
            href={safeHttpUrl(creative.link_url)!}
            target="_blank"
            rel="noreferrer"
          >
            Abrir destino · {creative.link_url}
          </a>
        ) : null}

        {creative.ads.length ? (
          <div className={styles.uses}>
            <h3>Usos y estado remoto</h3>
            {creative.ads.map((ad) => {
              const budgets = [
                budgetText(
                  ad.campaign?.budget ?? null,
                  creative.account?.currency_code,
                  "Presupuesto de campaña",
                ),
                ad.campaign?.budget_remaining != null
                  ? `Restante en campaña: ${money(ad.campaign.budget_remaining, creative.account?.currency_code)}`
                  : null,
                budgetText(
                  ad.ad_set?.budget ?? null,
                  creative.account?.currency_code,
                  "Presupuesto del conjunto",
                ),
                ad.ad_set?.budget_remaining != null
                  ? `Restante en conjunto: ${money(ad.ad_set.budget_remaining, creative.account?.currency_code)}`
                  : null,
              ].filter(Boolean);
              return (
                <div key={ad.id} className={styles.use}>
                  <div className={styles.useTitle}>
                    <div className={styles.useNames}>
                      {ad.campaign ? (
                        <a
                          href={campaignHref(
                            ad.campaign.id,
                            organizationId,
                            connectionId,
                          )}
                        >
                          {ad.campaign.name}
                        </a>
                      ) : (
                        <span>Campaña no disponible</span>
                      )}
                      <span>
                        {ad.ad_set?.name ?? "Conjunto no disponible"} →{" "}
                        {ad.name}
                      </span>
                    </div>
                    <span
                      className={cx(
                        styles.status,
                        statusClass(ad.effective_status),
                      )}
                    >
                      {statusText(ad.effective_status)}
                    </span>
                  </div>
                  <div className={styles.metaLine}>
                    {budgets.length ? (
                      budgets.map((item) => <span key={item}>{item}</span>)
                    ) : (
                      <span>Presupuesto no informado en la sincronización</span>
                    )}
                    <span>Configurado: {statusText(ad.configured_status)}</span>
                    {ad.campaign?.effective_status ? (
                      <span>
                        Campaña: {statusText(ad.campaign.effective_status)}
                      </span>
                    ) : null}
                    {ad.ad_set?.effective_status ? (
                      <span>
                        Conjunto: {statusText(ad.ad_set.effective_status)}
                      </span>
                    ) : null}
                    {ad.campaign?.objective ? (
                      <span>
                        Objetivo: {ad.campaign.objective.replaceAll("_", " ")}
                      </span>
                    ) : null}
                  </div>
                  {ad.review_feedback ? (
                    <p className={styles.feedback}>
                      Revisión de Meta: {ad.review_feedback}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <p className={styles.unused}>
            Sin anuncios vinculados en la última sincronización. La creatividad
            no se ha publicado desde E-NORA.
          </p>
        )}

        <footer className={styles.footer}>
          <span>
            {creative.account?.name ?? "Cuenta Meta"}
            {creative.account?.currency_code
              ? ` · ${creative.account.currency_code}`
              : " · moneda no verificada"}
          </span>
          <span>
            {creative.last_synced_at
              ? `Sincronizada ${new Date(creative.last_synced_at).toLocaleString("es-ES")}`
              : "Sin fecha de sincronización"}
          </span>
        </footer>
      </div>
    </article>
  );
}

function CreativesContent({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const searchParams = useSearchParams();
  const activeOrganization = useActiveOrganization();
  const activeConnection = useActiveConnection();
  const requestedOrganizationId = searchParams.get("organizationId");
  const organizationId =
    requestedOrganizationId &&
    bootstrap.memberships.some(
      (item) => item.organization_id === requestedOrganizationId,
    )
      ? requestedOrganizationId
      : activeOrganization.organizationId;
  const connectionId = requestedOrganizationId
    ? (searchParams.get("connectionId") ?? "")
    : activeConnection.connectionId;
  const [draftSearch, setDraftSearch] = useState(searchParams.get("q") ?? "");
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [organizationId, connectionId, search]);
  // La búsqueda se aplica al dejar de teclear; Enter la aplica al instante.
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(draftSearch.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [draftSearch]);
  const params = new URLSearchParams({ page: String(page) });
  if (connectionId) params.set("connectionId", connectionId);
  if (search) params.set("q", search);
  const key = organizationId
    ? `/v1/organizations/${organizationId}/meta/creatives?${params.toString()}`
    : null;
  const query = useCachedQuery<LibraryResponse>(key);
  const data = query.data;
  const creatives = data?.creatives ?? [];
  const pages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(draftSearch.trim());
  }

  return (
    <div className={`${pulse.root} ${r.pg} ${r.min} nora-min`}>
      <header className={`${styles.top} client-sr-title`}>
        <div>
          <h1>Creatividades</h1>
          <p>
            Consulta las piezas importadas, sus anuncios, campañas, presupuestos
            y estado de revisión de Meta.
          </p>
        </div>
      </header>

      {!organizationId ? (
        <EmptyState
          title="Selecciona un cliente"
          hint="Elige una organización para consultar sus creatividades de Meta."
        />
      ) : (
        <>
          <div className={styles.toolbar}>
            <form
              className={styles.search}
              role="search"
              onSubmit={submitSearch}
            >
              <label htmlFor="meta-creative-search">
                Buscar por nombre, texto o titular
              </label>
              <div>
                <input
                  id="meta-creative-search"
                  type="search"
                  value={draftSearch}
                  onChange={(event) => setDraftSearch(event.target.value)}
                  maxLength={120}
                  placeholder="Ej. Black Friday, sudadera…"
                />
              </div>
            </form>
            {data ? (
              <span className={styles.total}>
                {data.total.toLocaleString("es-ES")} creatividades ·{" "}
                {data.scope === "store"
                  ? "tienda seleccionada"
                  : "cuentas seleccionadas"}
              </span>
            ) : null}
          </div>

          {query.error && !data ? <ErrorBlock onRetry={() => query.reload()}>No se han podido cargar los datos. Inténtalo de nuevo en unos segundos.</ErrorBlock> : null}
          {!data && !query.error ? (
            <AsyncState
              status="loading"
              loadingLabel="Cargando biblioteca de Meta…"
            />
          ) : null}
          {data && creatives.length === 0 ? (
            <div className={pulse.panel}>
              <p className={pulse.empty}>
                {search
                  ? `No hay creatividades para «${search}».`
                  : "Todavía no hay creatividades sincronizadas en las cuentas seleccionadas."}
              </p>
            </div>
          ) : null}

          {creatives.length ? (
            <div className={styles.grid}>
              {creatives.map((creative) => (
                <CreativeCard
                  key={creative.id}
                  creative={creative}
                  organizationId={organizationId}
                  connectionId={connectionId}
                />
              ))}
            </div>
          ) : null}
          {data && pages > 1 ? (
            <div className={styles.pager}>
              <span>
                {data.total.toLocaleString("es-ES")} resultados
              </span>
              <Pagination page={page} pageCount={pages} onChange={setPage} />
            </div>
          ) : null}
          <p className={styles.footnote}>
            El estado y el presupuesto se leen de la última sincronización
            disponible en Meta. Esta vista no crea, edita ni activa campañas o
            anuncios.
          </p>
        </>
      )}
    </div>
  );
}

export default function MetaCreativeLibraryPage() {
  return (
    <PortalShell title="Creatividades Meta Ads">
      {(bootstrap) => (
        <Suspense
          fallback={
            <AsyncState status="loading" loadingLabel="Cargando biblioteca…" />
          }
        >
          <CreativesContent bootstrap={bootstrap} />
        </Suspense>
      )}
    </PortalShell>
  );
}
