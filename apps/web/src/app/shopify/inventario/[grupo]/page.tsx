"use client";

import { type FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
import { useActiveConnection } from "@/components/active-connection";
import { useCachedQuery } from "@/lib/use-cached-query";
import { AsyncState, Pagination, EmptyState, ErrorBlock } from "@/components/ui";
import { cx } from "../../../dashboard/client-pulse";
import { fmtNum } from "../../../dashboard/client-pulse-model";
import pulse from "../../../dashboard/client-pulse.module.css";
import c from "../../productos/catalogo.module.css";
import s from "../inventario.module.css";
import { groupBySlug, groupCards, inventoryHref, type InventoryResponse, type InventoryRow } from "../inventory-groups";
import { TaskButton } from "../../task-button";

type ProductGroup = {
  productId: string;
  title: string;
  category: string | null;
  rows: InventoryRow[];
  units: number | null;
  incoming: number;
};

function productHref(productId: string, organizationId: string, connectionId: string) {
  const params = new URLSearchParams({ organizationId });
  if (connectionId) params.set("connectionId", connectionId);
  return `/shopify/productos/${productId}?${params.toString()}`;
}

function tone(row: InventoryRow) {
  if (!row.tracked || row.available_quantity == null) return c.dim;
  if (row.available_quantity <= 0) return c.bad;
  if (row.available_quantity <= 5) return c.warn;
  return undefined;
}

function variantName(row: InventoryRow, showLocation: boolean) {
  const name = row.variant_title && row.variant_title !== "Default Title" ? row.variant_title : null;
  return [name, showLocation ? row.location_name : null].filter(Boolean).join(" · ") || null;
}

function quantity(row: InventoryRow) {
  if (!row.tracked) return "sin seguimiento";
  if (row.available_quantity == null) return "sin lectura";
  return `${fmtNum(row.available_quantity)} uds.`;
}

/** Una fila por producto, con sus variantes dentro; mantiene el orden de urgencia de la API.
    ponytail: agrupa dentro de la página (50 variantes); un producto puede partirse entre dos páginas. */
function byProduct(rows: InventoryRow[]): ProductGroup[] {
  const groups = new Map<string, ProductGroup>();
  for (const row of rows) {
    const group = groups.get(row.product_id) ?? { productId: row.product_id, title: row.product_title, category: row.category, rows: [], units: null, incoming: 0 };
    group.rows.push(row);
    if (row.available_quantity != null) group.units = (group.units ?? 0) + row.available_quantity;
    group.incoming += row.incoming_quantity ?? 0;
    groups.set(row.product_id, group);
  }
  return [...groups.values()];
}

function taskFor(group: ProductGroup, label: string) {
  const lines = group.rows.map((row) => `${variantName(row, true) ?? "Única"}: ${quantity(row)}`).join("; ");
  return {
    title: `${label === "Con stock" ? "Revisar stock" : "Reponer"} ${group.title}`,
    description: `${label}. ${lines}.${group.incoming ? ` En camino: ${fmtNum(group.incoming)} uds.` : ""}`,
  };
}

function InventoryGroupList({ canCreateTasks }: { canCreateTasks: boolean }) {
  const { organizationId } = useActiveOrganization();
  const { connectionId } = useActiveConnection();
  const { grupo } = useParams<{ grupo: string }>();
  const searchParams = useSearchParams();
  const urlSearch = searchParams.toString();
  const group = groupBySlug(grupo);
  const filter = group?.filter ?? "";
  const [draftSearch, setDraftSearch] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => setPage(1), [organizationId, connectionId, grupo]);
  // La búsqueda se aplica al dejar de teclear; Enter la aplica al instante.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setSearch(draftSearch.trim());
    }, 350);
    return () => window.clearTimeout(timer);
  }, [draftSearch]);

  const params = new URLSearchParams({ page: String(page) });
  if (connectionId) params.set("connectionId", connectionId);
  if (search) params.set("q", search);
  if (filter) params.set("filter", filter);
  const key = organizationId && group ? `/v1/organizations/${organizationId}/shopify/inventory?${params.toString()}` : null;
  const query = useCachedQuery<InventoryResponse>(key);
  const data = query.data;
  const rows = data?.rows ?? [];
  const products = byProduct(rows);
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;
  const showLocation = new Set(rows.map((row) => row.location_name ?? "")).size > 1;
  const tabs = data?.summary ? groupCards(data.summary) : [];

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearch(draftSearch.trim());
  }

  return (
    <div className={cx(pulse.root, c.cat)}>
      {/* div, no header: la primera <header> de .root se pinta como cabecera del canal. */}
      <div className={s.groupHead}>
        <Link className={s.back} href={inventoryHref(null, urlSearch)} aria-label="Volver al inventario" title="Volver al inventario">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
        </Link>
        <h1>{group?.label ?? "Grupo desconocido"}</h1>
      </div>

      {!organizationId ? (
        <EmptyState title="Selecciona una tienda" hint="El inventario se consulta dentro de una organización activa." />
      ) : !group ? (
        <p className={cx(c.dim, c.none)}>Este grupo no existe. Vuelve al inventario y elige uno.</p>
      ) : (
        <>
          {/* Cambiar de grupo sin volver a la portada. */}
          {tabs.length ? (
            <nav className={s.tabs} aria-label="Grupos de inventario">
              {tabs.map((tab) => (
                <Link key={tab.slug} href={inventoryHref(tab.slug, urlSearch)} aria-current={tab.slug === grupo ? "page" : undefined}>
                  {tab.label} <b className={tab.tone ? c[tab.tone] : undefined}>{fmtNum(tab.value)}</b>
                </Link>
              ))}
              <Link href={inventoryHref("todo", urlSearch)} aria-current={grupo === "todo" ? "page" : undefined}>
                Todo <b>{fmtNum(data?.summary?.total_count ?? 0)}</b>
              </Link>
            </nav>
          ) : null}

          <div className={c.toolbar}>
            <form className={c.find} role="search" onSubmit={submitSearch}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input type="search" value={draftSearch} onChange={(event) => setDraftSearch(event.target.value)} maxLength={120} placeholder="Buscar producto, variante o SKU" aria-label="Buscar producto, variante o SKU" />
            </form>
          </div>

          {query.error && !data ? <ErrorBlock onRetry={() => query.reload()}>No se han podido cargar los datos. Inténtalo de nuevo en unos segundos.</ErrorBlock> : null}
          {!data && !query.error ? <AsyncState status="loading" loadingLabel="Cargando inventario…" /> : null}
          {data?.coverage === "migration_pending" ? (
            <p className={cx(c.dim, c.none)}>El inventario por variante todavía no está disponible para esta tienda.</p>
          ) : null}
          {data?.coverage === "available" && rows.length === 0 ? (
            <p className={cx(c.dim, c.none)}>{search ? "Ninguna variante de este grupo coincide con la búsqueda." : "Nada en este grupo. Buena señal."}</p>
          ) : null}

          {data?.coverage === "available" && products.length > 0 ? (
            <table className={c.list}>
              <thead>
                <tr>
                  <th scope="col">Producto</th>
                  <th scope="col" className={c.opt}>Variantes</th>
                  <th scope="col" className={c.num}>Quedan</th>
                  {canCreateTasks ? <th scope="col"><span className="sr-only">Acción</span></th> : null}
                </tr>
              </thead>
              <tbody>
                {products.map((product) => {
                  const task = taskFor(product, group.label);
                  const worst = product.rows.find((row) => tone(row) === c.bad) ?? product.rows.find((row) => tone(row) === c.warn);
                  const stale = product.rows.some((row) => row.tracked && (row.is_stale || !row.updated_at));
                  return (
                    <tr key={product.productId} className="task-lift">
                      <td>
                        <a className={c.prodLink} href={productHref(product.productId, organizationId, connectionId)}>
                          <span className={c.prodText}>
                            <span className={c.prodName}>{product.title}</span>
                            <span className={c.dim}>
                              {[product.category, product.rows.length > 1 ? `${product.rows.length} variantes` : null].filter(Boolean).join(" · ") || "Sin categoría"}
                            </span>
                            {stale ? <span className={c.warn}>Algún dato tiene más de 24 h</span> : null}
                          </span>
                        </a>
                      </td>
                      <td className={c.opt}>
                        <span className={s.variants}>
                          {product.rows.length === 1 && !variantName(product.rows[0], showLocation) ? <span className={c.dim}>Única</span> : product.rows.map((row) => {
                            const name = variantName(row, showLocation);
                            return (
                              <span key={`${row.variant_id}:${row.location_id ?? "unknown"}`}>
                                {name ? <span className={c.dim}>{name}</span> : null}
                                <b className={tone(row)}>{quantity(row)}</b>
                              </span>
                            );
                          })}
                        </span>
                      </td>
                      <td className={cx(c.num, worst ? tone(worst) : undefined)}>
                        {product.units == null ? <span className={c.dim}>—</span> : `${fmtNum(product.units)} uds.`}
                        {product.incoming ? <small className={c.dim}>+{fmtNum(product.incoming)} en camino</small> : null}
                      </td>
                      {canCreateTasks ? (
                        <td className={s.actionCell}>
                          <TaskButton organizationId={organizationId} title={task.title} description={task.description} />
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : null}

          {data?.coverage === "available" && totalPages > 1 ? (
            <div className={c.pages}>
              <Pagination page={page} pageCount={totalPages} onChange={setPage} />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

export default function ShopifyInventoryGroupPage() {
  return (
    <PortalShell title="Inventario Shopify">
      {(bootstrap) => <InventoryGroupList canCreateTasks={["consultant", "platform_admin"].includes(bootstrap.profile.platform_role)} />}
    </PortalShell>
  );
}
