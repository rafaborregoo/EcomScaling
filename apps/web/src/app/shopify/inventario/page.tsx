"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { forecastStockDemand } from "@e-nora/contracts";
import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
import { useActiveConnection } from "@/components/active-connection";
import { useCachedQuery } from "@/lib/use-cached-query";
import { AsyncState, EmptyState, ErrorBlock } from "@/components/ui";
import { cx } from "../../dashboard/client-pulse";
import { fmtNum } from "../../dashboard/client-pulse-model";
import pulse from "../../dashboard/client-pulse.module.css";
import type { CatalogProduct, CatalogProductsResponse } from "../catalog-types";
import c from "../productos/catalogo.module.css";
import s from "./inventario.module.css";
import { GroupArt } from "./group-art";
import { TaskButton } from "../task-button";
import { groupByFilter, groupCards, inventoryHref, type InventoryResponse } from "./inventory-groups";

const RESTOCK_LIMIT = 6;
const IDLE_LIMIT = 5;

type Restock = { product: CatalogProduct; stock: number; perMonth: number | null; days: number | null; out: boolean };

/** Qué reponer primero: agotados que se venden, y luego lo que se acaba en 14 días o menos. */
function restockList(products: CatalogProduct[]): Restock[] {
  return products
    .flatMap((product) => {
      const m = product.metrics;
      if (!m || m.tracked_variants === 0 || m.stock_available == null) return [];
      const forecast = forecastStockDemand(product.weekly_units ?? [], m.stock_available, true);
      const out = m.stock_available <= 0 || m.variants_out > 0;
      const soon = forecast.coverageDays != null && forecast.coverageDays <= 14;
      if (!out && !soon) return [];
      return [{ product, stock: m.stock_available, perMonth: forecast.forecast30d, days: forecast.coverageDays, out }];
    })
    .sort((a, b) => restockRank(a) - restockRank(b) || (a.days ?? 0) - (b.days ?? 0) || (b.perMonth ?? 0) - (a.perMonth ?? 0))
    .slice(0, RESTOCK_LIMIT);
}

/** Primero lo agotado que se vende, luego lo que se acaba pronto y al final lo agotado sin demanda. */
function restockRank(item: Restock) {
  if (item.out && (item.perMonth ?? 0) > 0) return 0;
  return item.out ? 2 : 1;
}

function restockReason(item: Restock) {
  const m = item.product.metrics!;
  if (item.stock <= 0) return "Agotado";
  if (m.variants_out > 0) return m.variants_out === 1 ? "1 variante agotada" : `${m.variants_out} variantes agotadas`;
  const days = Math.round(item.days ?? 0);
  return days <= 1 ? "Se agota en 1 día" : `Se agota en ${days} días`;
}

function productHref(productId: string, organizationId: string, connectionId: string) {
  const params = new URLSearchParams({ organizationId });
  if (connectionId) params.set("connectionId", connectionId);
  return `/shopify/productos/${productId}?${params.toString()}`;
}

/** Portada del inventario: cards de grupo arriba y, debajo, qué hacer ahora. */
function InventoryOverview({ canCreateTasks }: { canCreateTasks: boolean }) {
  const { organizationId } = useActiveOrganization();
  const { connectionId } = useActiveConnection();
  const router = useRouter();
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  // Los enlaces antiguos (/shopify/inventario?filter=out) van directos a su grupo.
  const legacyGroup = groupByFilter(searchParams.get("filter") ?? "");
  useEffect(() => {
    if (legacyGroup) router.replace(inventoryHref(legacyGroup.slug, search));
  }, [legacyGroup, router, search]);

  const ready = organizationId && !legacyGroup;
  const scope = connectionId ? `&connectionId=${connectionId}` : "";
  const base = `/v1/organizations/${organizationId}/shopify`;
  const query = useCachedQuery<InventoryResponse>(ready ? `${base}/inventory?page=1${scope}` : null);
  // Menos stock primero: ahí están los que hay que reponer.
  const lowest = useCachedQuery<CatalogProductsResponse>(ready ? `${base}/catalog/products?page=1&status=ACTIVE&sort=stock&periodDays=90${scope}` : null);
  const idle = useCachedQuery<CatalogProductsResponse>(ready ? `${base}/catalog/products?page=1&status=ACTIVE&filter=no_sales&sort=name&periodDays=90${scope}` : null);

  const data = query.data;
  const cards = data?.summary ? groupCards(data.summary) : [];
  const restock = restockList(lowest.data?.products ?? []);
  const inRestock = new Set(restock.map((item) => item.product.id));
  const idleStock = (idle.data?.products ?? [])
    .filter((product) => (product.metrics?.stock_available ?? 0) > 0 && !inRestock.has(product.id))
    .sort((a, b) => (b.metrics?.stock_available ?? 0) - (a.metrics?.stock_available ?? 0))
    .slice(0, IDLE_LIMIT);
  const href = (id: string) => productHref(id, organizationId ?? "", connectionId);

  return (
    <div className={cx(pulse.root, c.cat)}>
      <header className={`${c.top} client-sr-title`}>
        <h1>Inventario</h1>
      </header>

      {!organizationId ? (
        <EmptyState title="Selecciona una tienda" hint="El inventario se consulta dentro de una organización activa." />
      ) : (
        <>
          {query.error && !data ? <ErrorBlock onRetry={() => query.reload()}>No se han podido cargar los datos. Inténtalo de nuevo en unos segundos.</ErrorBlock> : null}
          {!data && !query.error ? <AsyncState status="loading" loadingLabel="Cargando inventario…" /> : null}
          {data?.coverage === "migration_pending" || (data && !data.summary) ? (
            <p className={cx(c.dim, c.none)}>El resumen del inventario todavía no está disponible para esta tienda.</p>
          ) : null}

          {cards.length ? (
            <nav className={s.overview} aria-label="Grupos de inventario">
              {cards.map((card) => (
                <Link key={card.slug} href={inventoryHref(card.slug, search)} className={cx(s.groupCard, "task-lift", card.tone && s[card.tone])}>
                  <span className={s.cardArt}><GroupArt filter={card.filter} /></span>
                  <span className={s.cardLabel}>{card.label}</span>
                  <strong>{fmtNum(card.value)}</strong>
                  <small>{card.hint}</small>
                </Link>
              ))}
            </nav>
          ) : null}

          {data?.summary ? (
            <section className={s.block} aria-labelledby="restock-title">
              <div className={s.blockHead}>
                <h2 id="restock-title">Reponer primero</h2>
                <Link href={inventoryHref("agotados", search)}>Ver agotados</Link>
              </div>
              {!lowest.data ? (
                <p className={c.dim}>Calculando qué se acaba antes…</p>
              ) : restock.length ? (
                <table className={c.list}>
                  <thead>
                    <tr>
                      <th scope="col">Producto</th>
                      <th scope="col" className={c.num}>Quedan</th>
                      <th scope="col" className={cx(c.num, c.opt)}>Vende</th>
                      <th scope="col"><span className="sr-only">Acción</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {restock.map((item) => {
                      const reason = restockReason(item);
                      return (
                        <tr key={item.product.id} className="task-lift">
                          <td>
                            <a className={c.prodLink} href={href(item.product.id)}>
                              <span className={c.prodText}>
                                <span className={c.prodName}>{item.product.title}</span>
                                <span className={item.out || (item.days ?? 99) <= 7 ? c.bad : c.warn}>{reason}</span>
                              </span>
                            </a>
                          </td>
                          <td className={cx(c.num, item.stock <= 0 ? c.bad : undefined)}>{fmtNum(item.stock)} uds.</td>
                          <td className={cx(c.num, c.opt)}>{item.perMonth == null ? <span className={c.dim}>—</span> : `≈ ${fmtNum(item.perMonth)}/mes`}</td>
                          <td className={s.actionCell}>
                            {canCreateTasks ? <TaskButton
                              organizationId={organizationId}
                              title={`Reponer ${item.product.title}`}
                              description={`${reason}. Quedan ${fmtNum(item.stock)} uds.${item.perMonth != null ? ` Vende ≈ ${fmtNum(item.perMonth)} al mes.` : ""} Pedir reposición al proveedor.`}
                            /> : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <p className={c.dim}>Nada urgente: ningún producto con ventas se agota en las próximas dos semanas.</p>
              )}
            </section>
          ) : null}

          {data?.summary && idle.data && idleStock.length ? (
            <section className={s.block} aria-labelledby="idle-title">
              <div className={s.blockHead}>
                <h2 id="idle-title">Stock parado</h2>
                <span className={c.dim}>con unidades y sin ventas en 90 días</span>
              </div>
              <table className={c.list}>
                <tbody>
                  {idleStock.map((product) => (
                    <tr key={product.id} className="task-lift">
                      <td>
                        <a className={c.prodLink} href={href(product.id)}>
                          <span className={c.prodText}>
                            <span className={c.prodName}>{product.title}</span>
                            <span className={c.dim}>{product.shopify_category_name || product.product_type || "Sin categoría"}</span>
                          </span>
                        </a>
                      </td>
                      <td className={c.num}>{fmtNum(product.metrics?.stock_available ?? 0)} uds.</td>
                      <td className={s.actionCell}>
                        {canCreateTasks ? <TaskButton
                          organizationId={organizationId}
                          title={`Mover stock parado: ${product.title}`}
                          description={`${fmtNum(product.metrics?.stock_available ?? 0)} uds. sin ventas en 90 días. Valorar promoción, pack o destacarlo en tienda y email.`}
                        /> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : null}

          {data?.summary ? (
            <p className={s.allLink}>
              <Link href={inventoryHref("todo", search)}>Ver todo el inventario ({fmtNum(data.summary.total_count)})</Link>
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

export default function ShopifyInventoryPage() {
  return (
    <PortalShell title="Inventario Shopify">
      {(bootstrap) => <InventoryOverview canCreateTasks={["consultant", "platform_admin"].includes(bootstrap.profile.platform_role)} />}
    </PortalShell>
  );
}
