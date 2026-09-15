"use client";

// A que tienda pertenece cada cuenta de Meta y de Klaviyo.
//
// Una tienda es la que tiene conexion Shopify; Meta y Klaviyo son datos DE esa
// tienda. Con una sola tienda la asignacion la hizo sola la migracion y esta
// tarjeta no aparece: no hay nada que elegir. Con dos o mas hay que decirlo,
// porque de lo contrario el panel de rendimiento sumaria cuentas de tiendas
// distintas y presentaria el total como si fuera de la tienda seleccionada.
//
// Tres cosas que esta tarjeta tiene que hacer y antes no hacia:
//   - decir en que tienda esta el usuario ahora mismo (la del selector del
//     header), porque si no la lista es un monton de cuentas sin contexto;
//   - pegar cada error a la cuenta que lo produjo, en vez de volcar un mensaje
//     unico encima de todo el modulo;
//   - fallar dentro de su propia tarjeta, sin llevarse por delante el resto de
//     /integraciones.

import { useEffect, useId, useState } from "react";
import { useActiveConnection } from "@/components/active-connection";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import {
  Badge,
  Banner,
  Button,
  Card,
  EmptyState,
  LoadingBlock,
  Select,
} from "@/components/ui";
import {
  storeLabel,
  useStoreScope,
  type ScopeAccount,
} from "./shared";

type ScopedTable = "meta_ad_accounts" | "klaviyo_accounts";

type SaveFailure = { table: ScopedTable; id: string; message: string };

type AccountRow = {
  account: ScopeAccount;
  table: ScopedTable;
  provider: string;
  label: string;
};

const UNASSIGNED = "";

export function StoreScopeCard({ organizationId }: { organizationId: string }) {
  const { connectionId } = useActiveConnection();
  // La carga vive en shared.tsx: la comparten Meta y Klaviyo, que necesitan
  // saber sobre que tienda estan escribiendo.
  const { scope, error: loadError, reload: load } = useStoreScope(organizationId);
  const [draft, setDraft] = useState<Record<string, string>>({});
  // Error de la operacion entera (red, permiso, cuerpo invalido). Lo que falla
  // en una cuenta concreta vive en `rowErrors`, junto a su fila.
  const [saveError, setSaveError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const domId = useId();

  // El borrador arranca de lo guardado en cuanto llega (y se rehace tras cada
  // recarga), pero no pisa lo que el usuario ya haya tocado sin guardar.
  useEffect(() => {
    if (!scope) return;
    setDraft(
      Object.fromEntries(
        [...scope.meta_ad_accounts, ...scope.klaviyo_accounts].map(
          (account) => [account.id, account.store_id ?? UNASSIGNED],
        ),
      ),
    );
  }, [scope]);

  async function save(rows: AccountRow[]) {
    if (!scope) return;
    setIsSaving(true);
    setSaveError(null);
    setRowErrors({});
    setStatus("Guardando asignación...");
    try {
      const changed = (table: ScopedTable) =>
        rows
          .filter(
            (row) =>
              row.table === table &&
              draft[row.account.id] !== (row.account.store_id ?? UNASSIGNED),
          )
          .map((row) => ({
            id: row.account.id,
            store_id: draft[row.account.id] || null,
          }));

      const response = await apiFetch(
        `/v1/organizations/${organizationId}/store-scope`,
        {
          method: "PUT",
          body: JSON.stringify({
            meta_ad_accounts: changed("meta_ad_accounts"),
            klaviyo_accounts: changed("klaviyo_accounts"),
          }),
        },
      );
      if (!response.ok) {
        const message = await readApiError(response);
        setSaveError(message);
        setStatus(`No se pudo guardar la asignación. ${message}`);
        return;
      }
      const result = (await response.json()) as {
        updated: number;
        failed?: SaveFailure[];
      };
      const failed = result.failed ?? [];
      setRowErrors(
        Object.fromEntries(failed.map((item) => [item.id, item.message])),
      );
      setStatus(
        failed.length === 0
          ? `Asignación guardada: ${result.updated} ${
              result.updated === 1 ? "cuenta actualizada" : "cuentas actualizadas"
            }.`
          : `${result.updated} guardadas y ${failed.length} sin guardar. Revisa las cuentas marcadas.`,
      );
      await load();
    } catch {
      const message = "No se pudo guardar la asignación. Reintenta.";
      setSaveError(message);
      setStatus(message);
    } finally {
      setIsSaving(false);
    }
  }

  if (!scope) {
    // Contenido dentro de su propia tarjeta: que esta llamada falle no puede
    // dejar el resto de /integraciones sin pintar.
    return (
      <Card title="Cuentas por tienda">
        {loadError ? (
          <>
            <Banner tone="danger">{loadError}</Banner>
            <Button
              className="mt-3"
              variant="secondary"
              size="sm"
              onClick={() => void load()}
            >
              Reintentar
            </Button>
          </>
        ) : (
          <LoadingBlock label="Cargando asignación de tiendas..." />
        )}
      </Card>
    );
  }

  // Con una tienda no hay decision que tomar: todo pertenece a esa. Antes esto
  // devolvia null porque la tarjeta vivia en medio del hub; ahora tiene pagina
  // propia y desaparecer sin decir nada dejaria una pantalla en blanco.
  if (scope.store_count < 2) {
    return (
      <Card title="Cuentas por tienda">
        <EmptyState
          title="No hay nada que repartir"
          hint="Con una sola tienda, todas las cuentas de Meta y Klaviyo son suyas. Esta pantalla se vuelve útil al conectar la segunda."
        />
      </Card>
    );
  }

  const accounts: AccountRow[] = [
    ...scope.meta_ad_accounts.map((account) => ({
      account,
      table: "meta_ad_accounts" as ScopedTable,
      provider: "Meta Ads",
      label:
        account.account_name || account.external_ad_account_id || account.id,
    })),
    ...scope.klaviyo_accounts.map((account) => ({
      account,
      table: "klaviyo_accounts" as ScopedTable,
      provider: "Klaviyo",
      label: account.account_name || account.external_account_id || account.id,
    })),
  ];

  if (accounts.length === 0) {
    return (
      <Card title="Cuentas por tienda">
        <EmptyState
          title="Todavía no hay cuentas que repartir"
          hint="Conecta Meta Ads o Klaviyo y aquí podrás decir a qué tienda pertenece cada cuenta."
        />
      </Card>
    );
  }

  const isDirty = accounts.some(
    ({ account }) => draft[account.id] !== (account.store_id ?? UNASSIGNED),
  );

  const storeOptions = [
    { value: UNASSIGNED, label: "Sin asignar" },
    ...scope.stores.map((store) => ({
      value: store.id,
      label: storeLabel(store),
    })),
  ];

  // El selector de tienda del header trabaja con integration_connections.id;
  // la tienda trae su connection_id justo para poder cruzarlos aqui.
  const activeStore =
    scope.stores.find((store) => store.connection_id === connectionId) ?? null;

  // Se agrupa por la tienda YA guardada, no por el borrador: si las filas
  // saltaran de grupo al tocar el selector, elegir seria imposible.
  const groups = [
    ...scope.stores.map((store) => ({
      key: store.id,
      title: storeLabel(store),
      subtitle: store.myshopify_domain,
      isActive: store.id === activeStore?.id,
      rows: accounts.filter(({ account }) => account.store_id === store.id),
    })),
    {
      key: "unassigned",
      title: "Sin asignar",
      subtitle: "Sus cifras no se filtran al cambiar de tienda",
      isActive: false,
      rows: accounts.filter(({ account }) => account.store_id === null),
    },
  ].filter((group) => group.rows.length > 0);

  return (
    <Card
      title="Cuentas por tienda"
      description="Cada cuenta de Meta y Klaviyo pertenece a una tienda. Sin asignar, sus cifras no se filtran al cambiar de tienda."
      actions={
        scope.unassigned_count > 0 ? (
          <Badge tone="warn">
            {scope.unassigned_count}{" "}
            {scope.unassigned_count === 1 ? "cuenta" : "cuentas"} sin asignar
          </Badge>
        ) : null
      }
    >
      <p className="text-sm text-muted">
        Viendo ahora:{" "}
        <span className="font-medium text-foreground">
          {activeStore ? storeLabel(activeStore) : "Todas las tiendas"}
        </span>
        {activeStore
          ? null
          : " · elige una en el selector del encabezado para verla por separado."}
      </p>

      <div className="mt-4 space-y-5">
        {groups.map((group) => (
          <section key={group.key} aria-labelledby={`${domId}-${group.key}`}>
            <div className="flex flex-wrap items-baseline gap-2 border-b border-separator pb-1">
              <h3
                id={`${domId}-${group.key}`}
                className="text-sm font-medium text-foreground"
              >
                {group.title}
              </h3>
              {group.isActive ? <Badge tone="brand">Tienda activa</Badge> : null}
              <span className="text-xs text-muted">{group.subtitle}</span>
            </div>

            <ul className="mt-2 space-y-3">
              {group.rows.map(({ account, provider, label }) => {
                const rowError = rowErrors[account.id];
                const rowErrorId = `${domId}-err-${account.id}`;
                return (
                  <li
                    key={account.id}
                    className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate">{label}</p>
                      <p className="text-muted">{provider}</p>
                    </div>
                    <div className="sm:w-64 sm:shrink-0">
                      <Select
                        aria-label={`Tienda de ${label} (${provider})`}
                        aria-describedby={rowError ? rowErrorId : undefined}
                        invalid={Boolean(rowError)}
                        disabled={isSaving}
                        value={draft[account.id] ?? UNASSIGNED}
                        onChange={(value) =>
                          setDraft((current) => ({
                            ...current,
                            [account.id]: value,
                          }))
                        }
                        options={storeOptions}
                      />
                      {rowError ? (
                        <p
                          id={rowErrorId}
                          className="mt-1 text-xs text-danger"
                        >
                          {rowError}
                        </p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {saveError ? (
        <Banner className="mt-3" tone="danger">
          {saveError}
        </Banner>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          onClick={() => void save(accounts)}
          disabled={!isDirty || isSaving}
        >
          {isSaving ? "Guardando..." : "Guardar asignación"}
        </Button>
        {/* El resultado de guardar solo existia como cambio de la lista: con
            lector de pantalla, pulsar el boton no anunciaba nada. */}
        <p role="status" aria-live="polite" className="text-sm text-muted">
          {status}
        </p>
      </div>
    </Card>
  );
}
