"use client";

import { useCallback, useEffect, useState } from "react";
import { PortalShell } from "@/components/portal-shell";
import { useActiveConnection } from "@/components/active-connection";
import { apiFetch, type BootstrapResponse } from "@/lib/bootstrap";
import {
  AsyncState,
  Banner,
  Button,
  Card,
  Checkbox,
  EmptyState,
  ErrorBlock,
  LoadingBlock,
} from "@/components/ui";
import {
  BackToHub,
  ConnectionFacts,
  ConnectionPicker,
  InfoModalButton,
  LastErrorBanner,
  ProviderStatusCard,
  Steps,
  readErr,
  storeLabel,
  storesByConnection,
  useIntegrations,
  useProviderConnection,
  useStoreScope,
  type MetaAssetsResponse,
} from "../shared";

function useMetaAssets(
  organizationId: string | null,
  connectionId: string | null,
) {
  const [assets, setAssets] = useState<MetaAssetsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    if (!organizationId || !connectionId) {
      setAssets(null);
      setError(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/meta/assets`,
      );
      if (!response.ok) {
        setError(await readErr(response));
        setAssets(null);
        return;
      }
      setAssets((await response.json()) as MetaAssetsResponse);
    } catch {
      setError("No se pudieron cargar las cuentas de Meta. Reintenta.");
    } finally {
      setIsLoading(false);
    }
  }, [organizationId, connectionId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { assets, setAssets, error, isLoading, reload: load };
}

function MetaIntegrationPage({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const {
    organization,
    provider,
    isLoading,
    error,
    actions,
    pending,
    actionError,
  } = useIntegrations(bootstrap);
  const meta = provider("meta_ads");
  // En Meta la tienda NO la marca la conexion: una sola conexion OAuth sirve
  // legitimamente a varias tiendas (una cuenta publicitaria por tienda dentro
  // del mismo portfolio). Quien lleva la tienda es la cuenta publicitaria, asi
  // que aqui se etiqueta cuenta a cuenta.
  const { connectionId: activeConnectionId } = useActiveConnection();
  const { scope } = useStoreScope(organization?.id ?? null);
  const storeByConnection = storesByConnection(
    scope?.meta_ad_accounts ?? [],
    scope?.stores ?? [],
  );
  const activeStore =
    scope?.stores.find((store) => store.connection_id === activeConnectionId) ??
    null;
  const preferredConnectionId =
    [...storeByConnection.entries()].find(
      ([, store]) => store.id === activeStore?.id,
    )?.[0] ?? null;

  const { connection, connections, setChosenId } = useProviderConnection(
    meta,
    preferredConnectionId,
  );
  const connectionId = connection?.id ?? null;

  // meta_ad_accounts.id, la misma clave que trae la lista de activos.
  const storeByAccountId = new Map(
    (scope?.meta_ad_accounts ?? [])
      .filter((account) => account.store_id)
      .map((account) => [
        account.id,
        scope?.stores.find((store) => store.id === account.store_id) ?? null,
      ]),
  );
  const {
    assets,
    setAssets,
    error: assetsError,
    isLoading: assetsLoading,
  } = useMetaAssets(organization?.id ?? null, connectionId);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  if (isLoading) {
    return <AsyncState status="loading" loadingLabel="Cargando Meta Ads..." />;
  }
  if (error) {
    return (
      <div className="portal-page space-y-4">
        <BackToHub />
        <ErrorBlock>{error}</ErrorBlock>
      </div>
    );
  }
  if (!meta) {
    return (
      <div className="portal-page space-y-4">
        <BackToHub />
        <AsyncState
          status="empty"
          emptyTitle="Meta Ads no está disponible"
          emptyHint="Este conector no aparece en la configuración de esta organización."
        />
      </div>
    );
  }

  const configured = meta.configuration.status === "configured";

  async function saveSelection() {
    if (!organization || !assets) return;
    setSaving(true);
    setSaveError(null);
    setSaveMessage(null);
    const adAccountIds = assets.ad_accounts
      .filter((asset) => asset.is_selected)
      .map((asset) => asset.id);
    try {
      const selectionResponse = await apiFetch(
        `/v1/organizations/${organization.id}/meta/assets/selection`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ adAccountIds }),
        },
      );
      if (!selectionResponse.ok) {
        setSaveError(await readErr(selectionResponse));
        return;
      }
      const syncResponse = await apiFetch(
        `/v1/organizations/${organization.id}/meta/sync`,
        { method: "POST" },
      );
      if (!syncResponse.ok) {
        setSaveError(await readErr(syncResponse));
        return;
      }
      setSaveMessage(
        "Cuentas guardadas. La sincronización inicial se ha puesto en cola.",
      );
    } catch {
      setSaveError("No se pudieron guardar las cuentas de Meta. Reintenta.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="portal-page space-y-6">
      <BackToHub />

      <ProviderStatusCard provider={meta}>
        <p className="mt-3 text-sm leading-6 text-muted">
          Importa gasto, impresiones, clics y resultados por campaña de las
          cuentas publicitarias que elijas. Solo se sincronizan las cuentas
          marcadas.
        </p>
      </ProviderStatusCard>

      <ConnectionPicker
        connections={connections}
        connection={connection}
        onChange={setChosenId}
        storeByConnection={storeByConnection}
        activeStore={activeStore}
      />

      <Card
        className="border border-channel-meta"
        title={
          meta.connection
            ? "Renueva el acceso a Meta"
            : "Conecta tu cuenta de Meta"
        }
        description="Necesitamos permiso de solo lectura para traer el rendimiento de tus anuncios. No publicaremos ni modificaremos campañas."
      >
        {!configured ? (
          <Banner tone="warn">
            La app de Meta no está configurada en el servidor todavía (
            <span className="font-mono">META_APP_ID</span> /{" "}
            <span className="font-mono">META_APP_SECRET</span>).
          </Banner>
        ) : (
          <>
            <InfoModalButton
              title="Qué ocurre al conectar Meta Ads"
              label="Ver pasos y permisos"
            >
              <Steps
                items={[
                  <>
                    Pulsa{" "}
                    <span className="font-medium">
                      {meta.connection ? "Reautorizar" : "Conectar"} Meta Ads
                    </span>{" "}
                    e inicia sesión en Facebook con un usuario con acceso al
                    Business Manager.
                  </>,
                  <>
                    Concede los permisos de lectura de anuncios y vuelves aquí
                    automáticamente.
                  </>,
                  <>
                    Abajo elige las cuentas publicitarias a sincronizar y
                    guarda.
                  </>,
                ]}
              />
            </InfoModalButton>
            <Button
              className="mt-4"
              type="button"
              onClick={() => void actions.connectMeta()}
              disabled={pending === "meta"}
            >
              {pending === "meta"
                ? "Conectando..."
                : meta.connection
                  ? "Reautorizar Meta Ads"
                  : "Conectar Meta Ads"}
            </Button>
            {actionError ? (
              <Banner className="mt-3" tone="danger">
                {actionError}
              </Banner>
            ) : null}
          </>
        )}
      </Card>

      {meta.connection ? (
        <Card
          className="border border-channel-meta"
          title="Elige las cuentas que quieres analizar"
          description="Solo traeremos datos de las cuentas marcadas. Puedes cambiar esta selección cuando lo necesites."
        >
          {assetsLoading ? (
            <LoadingBlock label="Cargando cuentas publicitarias..." />
          ) : assetsError ? (
            <Banner tone="danger">{assetsError}</Banner>
          ) : !assets || assets.ad_accounts.length === 0 ? (
            <EmptyState
              title="Aún no hay cuentas descubiertas"
              hint="Meta no ha devuelto cuentas para esta conexión. Revisa permisos o vuelve a autorizar."
            />
          ) : (
            <>
              <fieldset
                className="space-y-2"
                aria-label="Cuentas publicitarias Meta"
              >
                <legend className="sr-only">Cuentas publicitarias Meta</legend>
                {assets.ad_accounts.map((asset) => (
                  <Checkbox
                    key={asset.id}
                    checked={asset.is_selected}
                    disabled={!asset.is_active || saving}
                    className="flex items-start gap-3 rounded-md border border-separator p-3"
                    onChange={(checked) => {
                      setAssets((current) =>
                        current
                          ? {
                              ...current,
                              ad_accounts: current.ad_accounts.map((item) =>
                                item.id === asset.id
                                  ? { ...item, is_selected: checked }
                                  : item,
                              ),
                            }
                          : current,
                      );
                    }}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-foreground">
                        {asset.name}
                      </span>
                      <span className="block font-mono text-xs text-muted">
                        {asset.external_id}
                      </span>
                      {asset.currency_code || asset.timezone_name ? (
                        <span className="block text-xs text-muted">
                          {[asset.currency_code, asset.timezone_name]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      ) : null}
                      {/* A que tienda se le imputa el gasto de esta cuenta. Sin
                          esto, con dos tiendas, marcar una casilla era decidir
                          a ciegas de quien es el gasto. */}
                      {scope && scope.store_count > 1 ? (
                        <span className="mt-1 block text-xs">
                          {storeByAccountId.get(asset.id) ? (
                            <span className="text-muted">
                              Tienda:{" "}
                              {storeLabel(storeByAccountId.get(asset.id)!)}
                            </span>
                          ) : (
                            <span className="text-warn">
                              Sin tienda asignada · su gasto no aparece al
                              filtrar por tienda
                            </span>
                          )}
                        </span>
                      ) : null}
                    </span>
                  </Checkbox>
                ))}
              </fieldset>
              {/* Antes era texto suelto: al guardar, con lector de pantalla no
                  se anunciaba nada y el foco seguia en el boton. */}
              <p
                role="status"
                aria-live="polite"
                className="mt-3 text-xs text-success"
              >
                {saveMessage}
              </p>
              {saveError ? (
                <Banner className="mt-3" tone="danger">
                  {saveError}
                </Banner>
              ) : null}
              <p className="mt-3 text-xs leading-5 text-muted">
                Al guardar, iniciaremos la sincronización. Los primeros datos
                pueden tardar unos minutos en aparecer en Meta Ads y en el
                panel.
              </p>
              <Button
                className="mt-3"
                type="button"
                onClick={() => void saveSelection()}
                disabled={saving}
              >
                {saving ? "Guardando..." : "Guardar y sincronizar"}
              </Button>
            </>
          )}
        </Card>
      ) : null}

      <LastErrorBanner provider={meta} />

      <InfoModalButton title="Detalles técnicos de Meta Ads" label="Detalles técnicos">
          <ConnectionFacts provider={meta} />
      </InfoModalButton>
    </div>
  );
}

export default function MetaPage() {
  return (
    <PortalShell title="Integración · Meta Ads">
      {(bootstrap) => <MetaIntegrationPage bootstrap={bootstrap} />}
    </PortalShell>
  );
}
