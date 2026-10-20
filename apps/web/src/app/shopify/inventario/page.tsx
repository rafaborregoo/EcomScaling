"use client";

import { type FormEvent, useEffect, useState } from "react";
import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
import { useActiveConnection } from "@/components/active-connection";
import { useCachedQuery } from "@/lib/use-cached-query";
import { AsyncState, EmptyState, ErrorBlock } from "@/components/ui";
import { cx } from "../../dashboard/client-pulse";
import { fmtNum } from "../../dashboard/client-pulse-model";
import pulse from "../../dashboard/client-pulse.module.css";
import s from "./inventario.module.css";

type InventoryFilter = "" | "out" | "low" | "untracked";
type InventoryRow = {
  product_id: string;
  store_id: string;
  store_name: string;
  product_title: string;
  variant_id: string;
  variant_title: string | null;
  inventory_item_id: string | null;
  sku: string | null;
  tracked: boolean;
  location_id: string | null;
  location_name: string | null;
  available_quantity: number | null;
  on_hand_quantity: number | null;
  committed_quantity: number | null;
  incoming_quantity: number | null;
  updated_at: string | null;
  is_stale: boolean | null;
};
type InventoryResponse = {
  organization_id: string;
  page: number;
  page_size: number;
  total: number;
  coverage: "available" | "migration_pending";
  rows: InventoryRow[];
};

function productHref(productId: string, organizationId: string, connectionId: string) {
  const params = new URLSearchParams({ organizationId });
  if (connectionId) params.set("connectionId", connectionId);
  return `/shopify/productos/${productId}?${params.toString()}`;
}

function inventoryState(row: InventoryRow) {
  if (!row.tracked) return { label: "Sin seguimiento", tone: pulse.chipWarn };
  if (row.available_quantity == null) return { label: "Sin lectura", tone: pulse.chipWarn };
  if (row.available_quantity <= 0) return { label: "Agotado", tone: pulse.chipBad };
  if (row.available_quantity <= 5) return { label: "Stock bajo", tone: pulse.chipWarn };
  return { label: "Disponible", tone: pulse.chipGood };
}

function CatalogInventory() {
  const { organizationId } = useActiveOrganization();
  const { connectionId } = useActiveConnection();
  const [draftSearch, setDraftSearch] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<InventoryFilter>("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const requestedFilter = new URLSearchParams(window.location.search).get("filter");
    if (requestedFilter === "out" || requestedFilter === "low" || requestedFilter === "untracked") setFilter(requestedFilter);
  }, []);
  useEffect(() => setPage(1), [organizationId, connectionId, filter]);

  const params = new URLSearchParams({ page: String(page) });
  if (connectionId) params.set("connectionId", connectionId);
  if (search) params.set("q", search);
  if (filter) params.set("filter", filter);
  const key = organizationId ? `/v1/organizations/${organizationId}/shopify/inventory?${params.toString()}` : null;
  const query = useCachedQuery<InventoryResponse>(key);
  const data = query.data;
  const rows = data?.rows ?? [];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;
  const showLocation = new Set(rows.map((row) => row.location_name ?? "")).size > 1;
  const showIncoming = rows.some((row) => (row.incoming_quantity ?? 0) > 0);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearch(draftSearch.trim());
  }

  function setStockFilter(next: InventoryFilter) {
    const resolved = filter === next ? "" : next;
    setFilter(resolved);
    const nextParams = new URLSearchParams(window.location.search);
    if (resolved) nextParams.set("filter", resolved);
    else nextParams.delete("filter");
    window.history.replaceState(null, "", `/shopify/inventario${nextParams.size ? `?${nextParams.toString()}` : ""}`);
  }

  return (
    <div className={`${pulse.root} ${s.root}`}>
      <header className={s.header}>
        <div>
          <h1>Inventario</h1>
          <p>Cuántas unidades te quedan de cada producto.</p>
        </div>
      </header>

      {!organizationId ? (
        <EmptyState title="Selecciona una tienda" hint="El inventario se consulta dentro de una organización activa." />
      ) : (
        <>
          <div className={s.toolbar}>
            <form role="search" onSubmit={submitSearch}>
              <label className="sr-only" htmlFor="inventory-search">Buscar producto, variante o SKU</label>
              <input id="inventory-search" type="search" value={draftSearch} onChange={(event) => setDraftSearch(event.target.value)} maxLength={120} placeholder="Buscar producto, variante o SKU" />
              <button className={cx(pulse.btn, pulse.ghost, pulse.sm)} type="submit">Buscar</button>
            </form>
            <div className={pulse.seg} role="group" aria-label="Filtrar inventario">
              <button type="button" aria-pressed={!filter} onClick={() => setStockFilter("")}>Todos</button>
              <button type="button" aria-pressed={filter === "out"} onClick={() => setStockFilter("out")}>Agotados</button>
              <button type="button" aria-pressed={filter === "low"} onClick={() => setStockFilter("low")}>Stock bajo</button>
              <button type="button" aria-pressed={filter === "untracked"} onClick={() => setStockFilter("untracked")}>Sin seguimiento</button>
            </div>
          </div>

          {query.error && !data ? <ErrorBlock>{query.error}</ErrorBlock> : null}
          {!data && !query.error ? <AsyncState status="loading" loadingLabel="Cargando inventario…" /> : null}
          {data?.coverage === "migration_pending" ? (
            <div className={pulse.panel}><p className={pulse.empty}>La lista de inventario por variante estará disponible al aplicar la migración pendiente.</p></div>
          ) : null}
          {data?.coverage === "available" && rows.length === 0 ? (
            <div className={pulse.panel}><p className={pulse.empty}>{filter ? "No hay variantes que coincidan con este filtro." : "No hay variantes activas para esta tienda."}</p></div>
          ) : null}

          {data?.coverage === "available" && rows.length > 0 ? (
            <section className={pulse.panel} aria-label="Existencias por variante y ubicación">
              <div className={pulse.tblWrap} style={{ marginTop: 0 }}>
                <table className={pulse.tbl}>
                  <thead><tr>
                    <th>Producto</th>{showLocation ? <th>Almacén</th> : null}<th>Estado</th><th style={{ textAlign: "right" }}>Quedan</th>{showIncoming ? <th style={{ textAlign: "right" }}>En camino</th> : null}
                  </tr></thead>
                  <tbody>
                    {rows.map((row) => {
                      const state = inventoryState(row);
                      const href = productHref(row.product_id, organizationId, connectionId);
                      return (
                        <tr key={`${row.variant_id}:${row.location_id ?? "unknown"}`}>
                          <td><a className={s.product} href={href}>
                            <span><b>{row.product_title}</b>{[row.variant_title && row.variant_title !== "Default Title" ? row.variant_title : null, row.sku].filter(Boolean).length ? <small>{[row.variant_title && row.variant_title !== "Default Title" ? row.variant_title : null, row.sku].filter(Boolean).join(" · ")}</small> : null}{row.is_stale || !row.updated_at ? <small className={s.stale}>{row.updated_at ? "Dato de hace más de 24 h" : "Sin fecha de lectura"}</small> : null}</span>
                          </a></td>
                          {showLocation ? <td>{row.location_name || "Sin almacén"}</td> : null}
                          <td><span className={cx(pulse.chip, state.tone)}>{state.label}</span></td>
                          <td className={`${pulse.tdN} ${row.available_quantity == null ? "" : row.available_quantity <= 0 ? s.bad : row.available_quantity <= 5 ? s.warn : s.good}`}>{row.available_quantity == null ? "—" : `${fmtNum(row.available_quantity)} uds.`}</td>
                          {showIncoming ? <td className={pulse.tdN}>{row.incoming_quantity == null ? "—" : `${fmtNum(row.incoming_quantity)} uds.`}</td> : null}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <footer className={s.footer}>
                <span>“Sin lectura” significa que Shopify no ha enviado el dato, no que queden cero.</span>
                <div>
                  <span>{fmtNum(data.total)} productos · página {page} de {totalPages}</span>
                  <button className={cx(pulse.btn, pulse.ghost, pulse.sm)} type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Anterior</button>
                  <button className={cx(pulse.btn, pulse.ghost, pulse.sm)} type="button" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Siguiente</button>
                </div>
              </footer>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

export default function ShopifyInventoryPage() {
  return <PortalShell title="Inventario Shopify">{() => <CatalogInventory />}</PortalShell>;
}
