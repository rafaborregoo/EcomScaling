"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import {
  Banner,
  Button,
  Dialog,
  EmptyState,
  LoadingBlock,
  ProviderIcon,
  Select,
} from "@/components/ui";
import { storeLabel, type ScopeAccount, type StoreScope } from "./store-scope-model";

type ScopedTable = "meta_ad_accounts" | "klaviyo_accounts";
type AccountRow = {
  account: ScopeAccount;
  table: ScopedTable;
  provider: "Meta Ads" | "Klaviyo";
  label: string;
};
type SaveFailure = { id: string; message: string };

const UNASSIGNED = "";

export function ShopifyAccountAssignmentModal({
  organizationId,
  shopDomain,
  scope,
  loadError,
  reload,
  onClose,
}: {
  organizationId: string;
  shopDomain: string;
  scope: StoreScope | null;
  loadError: string | null;
  reload: () => void;
  onClose: () => void;
}) {
  const normalizedDomain = shopDomain.trim().toLowerCase();
  const store = scope?.stores.find(
    (item) => item.myshopify_domain.trim().toLowerCase() === normalizedDomain,
  );
  const rows = useMemo<AccountRow[]>(
    () => [
      ...(scope?.meta_ad_accounts ?? []).map((account) => ({
        account,
        table: "meta_ad_accounts" as const,
        provider: "Meta Ads" as const,
        label: account.account_name || account.external_ad_account_id || account.id,
      })),
      ...(scope?.klaviyo_accounts ?? []).map((account) => ({
        account,
        table: "klaviyo_accounts" as const,
        provider: "Klaviyo" as const,
        label: account.account_name || account.external_account_id || account.id,
      })),
    ],
    [scope],
  );
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [initializedStoreId, setInitializedStoreId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  // Las cuentas sin asignar quedan preparadas para esta tienda. La persona
  // revisa los nombres y confirma antes de que E-NORA guarde la relación.
  useEffect(() => {
    if (!store || initializedStoreId === store.id) return;
    setDraft(
      Object.fromEntries(
        rows.map(({ account }) => [account.id, account.store_id ?? store.id]),
      ),
    );
    setInitializedStoreId(store.id);
  }, [initializedStoreId, rows, store]);

  const isDirty = rows.some(
    ({ account }) => draft[account.id] !== (account.store_id ?? UNASSIGNED),
  );
  const options = [
    { value: UNASSIGNED, label: "Sin asignar" },
    ...(scope?.stores ?? []).map((item) => ({
      value: item.id,
      label: storeLabel(item),
    })),
  ];

  async function save() {
    if (!scope || !store) return;
    setIsSaving(true);
    setSaveError(null);
    setRowErrors({});
    try {
      const changed = (table: ScopedTable) =>
        rows
          .filter(
            ({ account, table: rowTable }) =>
              rowTable === table &&
              draft[account.id] !== (account.store_id ?? UNASSIGNED),
          )
          .map(({ account }) => ({
            id: account.id,
            store_id: draft[account.id] || null,
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
        setSaveError(await readApiError(response));
        return;
      }
      const result = (await response.json()) as {
        updated: number;
        failed?: SaveFailure[];
      };
      const failures = result.failed ?? [];
      if (failures.length > 0) {
        setRowErrors(Object.fromEntries(failures.map((item) => [item.id, item.message])));
        setSaveError(
          `${result.updated} cuenta${result.updated === 1 ? " guardada" : "s guardadas"}; ${failures.length} ${failures.length === 1 ? "no se pudo guardar" : "no se pudieron guardar"}. Revisa las marcadas.`,
        );
        reload();
        return;
      }
      reload();
      onClose();
    } catch {
      setSaveError("No se pudo guardar la asignación. Reintenta.");
    } finally {
      setIsSaving(false);
    }
  }

  const noAccounts = rows.length === 0;
  const waitingForStore = Boolean(scope && !store);

  return (
    <Dialog
      isOpen
      onOpenChange={(open) => !open && onClose()}
      size="lg"
      title="Asigna las cuentas a esta tienda"
      isBusy={isSaving}
      cancelLabel={noAccounts ? "Cerrar" : "Ahora no"}
      primary={
        scope && store && rows.length > 0
          ? {
              label: "Guardar asignación",
              busyLabel: "Guardando…",
              disabled: !isDirty,
              onClick: () => void save(),
            }
          : undefined
      }
    >
              <div className="space-y-4">
                <p className="text-sm leading-6 text-muted">
                  Shopify ya está conectado. Elige qué cuentas de Meta Ads y Klaviyo
                  pertenecen a <span className="font-medium text-ink">{shopDomain}</span>.
                  Así E-NORA podrá atribuir sus datos a la tienda correcta.
                </p>

                {loadError ? (
                  <div className="space-y-3">
                    <Banner tone="danger">No se pudieron cargar las cuentas conectadas: {loadError}</Banner>
                    <Button type="button" variant="secondary" onClick={reload}>Reintentar</Button>
                  </div>
                ) : !scope ? (
                  <LoadingBlock label="Buscando cuentas conectadas de Meta Ads y Klaviyo…" />
                ) : waitingForStore ? (
                  <div className="space-y-3">
                    <LoadingBlock label="Shopify está terminando de registrar la tienda. Esta ventana se actualizará automáticamente…" />
                    {noAccounts ? (
                      <p className="text-sm text-muted">Todavía no hay cuentas de Meta Ads o Klaviyo conectadas en E-NORA.</p>
                    ) : null}
                  </div>
                ) : noAccounts ? (
                  <EmptyState
                    title="No hay cuentas conectadas para asignar"
                    hint="Cuando conectes Meta Ads o Klaviyo, podrás asignarlas a esta tienda desde Integraciones → Cuentas por tienda."
                  />
                ) : (
                  <div className="space-y-5">
                    {(["Meta Ads", "Klaviyo"] as const).map((provider) => {
                      const providerRows = rows.filter((row) => row.provider === provider);
                      if (providerRows.length === 0) return null;
                      return (
                        <section key={provider} aria-label={provider}>
                          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
                            <ProviderIcon provider={provider === "Meta Ads" ? "meta_ads" : "klaviyo"} size={16} />
                            {provider}
                          </h3>
                          <ul className="divide-y divide-line rounded-md border border-line">
                            {providerRows.map(({ account, label }) => (
                              <li key={account.id} className="grid gap-2 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,0.8fr)] sm:items-center">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium text-ink">{label}</p>
                                  {account.store_id ? (
                                    <p className="mt-1 text-xs text-muted">
                                      Actualmente: {(() => {
                                        const assignedStore = scope.stores.find((item) => item.id === account.store_id);
                                        return assignedStore ? storeLabel(assignedStore) : "Tienda no disponible";
                                      })()}
                                    </p>
                                  ) : (
                                    <p className="mt-1 text-xs text-muted">Cuenta detectada y sin asignar</p>
                                  )}
                                  {rowErrors[account.id] ? <p className="mt-1 text-xs text-danger">{rowErrors[account.id]}</p> : null}
                                </div>
                                <Select
                                  value={draft[account.id] ?? account.store_id ?? UNASSIGNED}
                                  onChange={(value) => setDraft((current) => ({ ...current, [account.id]: value }))}
                                  options={options}
                                  aria-label={`Tienda de ${label}`}
                                  disabled={isSaving}
                                />
                              </li>
                            ))}
                          </ul>
                        </section>
                      );
                    })}
                  </div>
                )}

                {saveError ? <Banner tone="danger">{saveError}</Banner> : null}
              </div>
    </Dialog>
  );
}
