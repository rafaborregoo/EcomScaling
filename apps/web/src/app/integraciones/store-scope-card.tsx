"use client";

// A que tienda pertenece cada cuenta de Meta y de Klaviyo.
//
// Una tienda es la que tiene conexion Shopify; Meta y Klaviyo son datos DE esa
// tienda. Con una sola tienda la asignacion la hizo sola la migracion y esta
// tarjeta no aparece: no hay nada que elegir. Con dos o mas hay que decirlo,
// porque de lo contrario el panel de rendimiento sumaria cuentas de tiendas
// distintas y presentaria el total como si fuera de la tienda seleccionada.

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { Badge, Button, Card, ErrorBlock, LoadingBlock, Select } from "@/components/ui";

type Store = { id: string; myshopify_domain: string; shop_name: string };

type ProviderAccount = {
  id: string;
  store_id: string | null;
  account_name?: string | null;
  external_ad_account_id?: string;
  external_account_id?: string;
};

type StoreScope = {
  stores: Store[];
  meta_ad_accounts: ProviderAccount[];
  klaviyo_accounts: ProviderAccount[];
  store_count: number;
  unassigned_count: number;
};

const UNASSIGNED = "";

export function StoreScopeCard({ organizationId }: { organizationId: string }) {
  const [scope, setScope] = useState<StoreScope | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    if (!organizationId) return;
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/store-scope`,
      );
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      const payload = (await response.json()) as StoreScope;
      setScope(payload);
      setDraft(
        Object.fromEntries(
          [...payload.meta_ad_accounts, ...payload.klaviyo_accounts].map(
            (account) => [account.id, account.store_id ?? UNASSIGNED],
          ),
        ),
      );
      setError(null);
    } catch {
      setError("No se pudo cargar la asignación de tiendas. Reintenta.");
    }
  }, [organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!scope) return;
    setIsSaving(true);
    try {
      const toRows = (accounts: ProviderAccount[]) =>
        accounts
          .filter((account) => draft[account.id] !== (account.store_id ?? UNASSIGNED))
          .map((account) => ({
            id: account.id,
            store_id: draft[account.id] || null,
          }));

      const response = await apiFetch(
        `/v1/organizations/${organizationId}/store-scope`,
        {
          method: "PUT",
          body: JSON.stringify({
            meta_ad_accounts: toRows(scope.meta_ad_accounts),
            klaviyo_accounts: toRows(scope.klaviyo_accounts),
          }),
        },
      );
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      await load();
    } catch {
      setError("No se pudo guardar la asignación. Reintenta.");
    } finally {
      setIsSaving(false);
    }
  }

  if (!scope) {
    return error ? <ErrorBlock>{error}</ErrorBlock> : <LoadingBlock />;
  }

  // Con una tienda no hay decision que tomar: todo pertenece a esa.
  if (scope.store_count < 2) return null;

  const accounts = [
    ...scope.meta_ad_accounts.map((account) => ({
      account,
      provider: "Meta Ads",
      label:
        account.account_name || account.external_ad_account_id || account.id,
    })),
    ...scope.klaviyo_accounts.map((account) => ({
      account,
      provider: "Klaviyo",
      label: account.account_name || account.external_account_id || account.id,
    })),
  ];

  if (accounts.length === 0) return null;

  const isDirty = accounts.some(
    ({ account }) => draft[account.id] !== (account.store_id ?? UNASSIGNED),
  );

  const storeOptions = [
    { value: UNASSIGNED, label: "Sin asignar" },
    ...scope.stores.map((store) => ({
      value: store.id,
      label: store.shop_name || store.myshopify_domain,
    })),
  ];

  return (
    <Card
      title="Cuentas por tienda"
      description="Cada cuenta de Meta y Klaviyo pertenece a una tienda. Sin asignar, sus cifras no se filtran al cambiar de tienda."
    >
      {scope.unassigned_count > 0 ? (
        <Badge tone="warn">
          {scope.unassigned_count}{" "}
          {scope.unassigned_count === 1 ? "cuenta" : "cuentas"} sin asignar
        </Badge>
      ) : null}

      <div className="mt-4 space-y-3">
        {accounts.map(({ account, provider, label }) => (
          <div
            key={account.id}
            className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="truncate">{label}</p>
              <p className="text-muted">{provider}</p>
            </div>
            <Select
              className="sm:max-w-[16rem]"
              aria-label={`Tienda de ${label}`}
              value={draft[account.id] ?? UNASSIGNED}
              onChange={(value) =>
                setDraft((current) => ({ ...current, [account.id]: value }))
              }
              options={storeOptions}
            />
          </div>
        ))}
      </div>

      {error ? (
        <div className="mt-3">
          <ErrorBlock>{error}</ErrorBlock>
        </div>
      ) : null}

      <div className="mt-4">
        <Button onClick={() => void save()} disabled={!isDirty || isSaving}>
          {isSaving ? "Guardando..." : "Guardar asignación"}
        </Button>
      </div>
    </Card>
  );
}
