"use client";

import { FormEvent, useState } from "react";
import { SHOPIFY_SCOPES_USED } from "@e-nora/contracts";
import { PortalShell } from "@/components/portal-shell";
import { useActiveConnection } from "@/components/active-connection";
import { type BootstrapResponse } from "@/lib/bootstrap";
import {
  AsyncState,
  Badge,
  Banner,
  Button,
  Card,
  ConfirmDialog,
  ErrorBlock,
  Input,
  TrashIcon,
} from "@/components/ui";
import {
  BackToHub,
  ConnectionFacts,
  InfoModalButton,
  LastErrorBanner,
  ProviderStatusCard,
  Steps,
  healthLabel,
  healthTone,
  useIntegrations,
} from "../shared";

function ShopifyIntegrationPage({
  bootstrap,
}: {
  bootstrap: BootstrapResponse;
}) {
  const {
    organization,
    payload,
    provider,
    isLoading,
    error,
    actions,
    pending,
    actionError,
  } = useIntegrations(bootstrap);
  // En Shopify una conexion ES una tienda, asi que la tienda del selector del
  // encabezado se identifica aqui directamente por id.
  const { connectionId: activeConnectionId } = useActiveConnection();
  const [shopDomain, setShopDomain] = useState("");
  const [appMode, setAppMode] = useState<"public" | "custom">("public");

  if (isLoading) {
    return <AsyncState status="loading" loadingLabel="Cargando Shopify..." />;
  }
  if (error) {
    return (
      <div className="portal-page space-y-4">
        <BackToHub />
        <ErrorBlock>{error}</ErrorBlock>
      </div>
    );
  }

  const shopify = provider("shopify");
  if (!shopify) {
    return (
      <div className="portal-page space-y-4">
        <BackToHub />
        <AsyncState
          status="empty"
          emptyTitle="Shopify no está disponible"
          emptyHint="Este conector no aparece en la configuración de esta organización."
        />
      </div>
    );
  }

  const configured = shopify.configuration.status === "configured";
  const canConnect = shopify.available && configured;
  // La tienda puede seguir en la respuesta de API durante los 30 días de
  // restauración; en esta lista de conexiones activas ya debe desaparecer.
  const shopifyConnections = (shopify.connections ?? []).filter(
    (connection) => connection.status !== "pending_deletion",
  );
  const canManageConnections = bootstrap.memberships.some(
    (membership) =>
      membership.organization_id === organization?.id &&
      membership.accessSource === "membership" &&
      ["owner", "manager"].includes(membership.role),
  );

  async function removeStore(connectionId: string) {
    await actions.scheduleStoreRemoval(connectionId);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!shopDomain.trim()) return;
    await actions.connectShopify(shopDomain.trim(), appMode);
  }

  return (
    <div className="portal-page space-y-5 sm:space-y-6">
      <BackToHub />

      <ProviderStatusCard provider={shopify}>
        <p className="mt-3 text-sm leading-6 text-muted">
          Al autorizar una tienda se importan catálogo, inventario, pedidos y
          clientes, y se mantienen al día con webhooks y una reconciliación
          periódica.
        </p>
      </ProviderStatusCard>

      {/* Solo los permisos OPCIONALES que la tienda no concedio. Los
          imprescindibles ya dejan la conexion en error, y ese texto lo pintan
          "Ultimo error" y la ficha de la tienda: repetirlo aqui seria decir lo
          mismo tres veces en la misma pantalla. */}
      {shopifyConnections.map((connection) => {
        const faltan = SHOPIFY_SCOPES_USED.filter(
          (item) =>
            !item.required &&
            connection.scopes.length > 0 &&
            !connection.scopes.includes(item.scope),
        );
        if (faltan.length === 0) return null;
        const tienda =
          connection.provider_account_name ??
          connection.provider_account_id ??
          "esta tienda";
        return (
          <InfoModalButton
            key={connection.id}
            title={`Permisos opcionales pendientes en ${tienda}`}
            label={`Permisos de ${tienda}`}
          >
            <Banner tone="warn">
              <span className="font-medium">{tienda}</span> funciona, pero se
              instaló sin estos permisos opcionales:
              <ul className="mt-1 list-disc pl-5">
                {faltan.map((item) => (
                  <li key={item.scope}>
                    <span className="font-medium">{item.label}</span>
                    {item.note ? ` — ${item.note}` : null}
                  </li>
                ))}
              </ul>
              <span className="mt-1 block">
                Para recuperarlos, vuelve a instalar la app en esa tienda
                aceptando todos los permisos.
              </span>
            </Banner>
          </InfoModalButton>
        );
      })}

      <InfoModalButton
        title="Encuentra el dominio interno de Shopify"
        label="¿Dónde veo mi dominio?"
      >
        <Card
          title="¿No recuerdas tu dominio .myshopify.com?"
          description="No es el dominio público de tu web. Es el identificador interno que Shopify asignó a la tienda y no cambia."
        >
          <Steps
            items={[
              <>
                Abre el admin de tu tienda. En la URL verás{" "}
                <span className="font-mono">
                  admin.shopify.com/store/TU-HANDLE
                </span>
                : tu dominio es{" "}
                <span className="font-mono">TU-HANDLE.myshopify.com</span>.
              </>,
              <>
                O entra en{" "}
                <span className="font-medium">Configuración → Dominios</span>:
                ahí aparece el dominio{" "}
                <span className="font-mono">xxxx.myshopify.com</span> exacto.
              </>,
              <>
                Si al conectar ves una página de Shopify tipo{" "}
                <span className="italic">
                  &laquo;This store will be right back&raquo;
                </span>
                , el dominio no corresponde a tu tienda activa: revisa el
                handle.
              </>,
            ]}
          />
        </Card>
      </InfoModalButton>

      <Card
        className="border border-[#168446]"
        title={shopifyConnections.length > 0 ? "Añade otra tienda" : "Conecta tu tienda"}
        description="Traeremos catálogo, inventario, pedidos y clientes para que los diagnósticos trabajen con datos reales."
      >
        {!shopify.available ? (
          <Banner tone="warn">
            Shopify está desactivado por configuración. El administrador puede
            habilitarlo con{" "}
            <span className="font-mono">INTEGRATION_FEATURE_FLAGS</span>.
          </Banner>
        ) : !configured ? (
          <Banner tone="warn">
            Shopify está habilitado en la interfaz, pero faltan las credenciales
            de la app en el servidor. La conexión se activará automáticamente
            cuando estén completas.
          </Banner>
        ) : null}

        <div className="mt-4">
          <InfoModalButton
            title="Qué ocurre al conectar Shopify"
            label="Ver pasos y permisos"
          >
          <Steps
            items={[
              <>
                Escribe el dominio{" "}
                <span className="font-mono">TU-HANDLE.myshopify.com</span> abajo
                y pulsa <span className="font-medium">Conectar Shopify</span>.
              </>,
              <>
                En la pantalla de Shopify revisa los permisos y pulsa{" "}
                <span className="font-medium">Instalar</span> (necesitas ser
                owner o staff con permiso de apps, con la sesión de Shopify
                iniciada). Hay que aceptarlos todos: cada uno alimenta una parte
                del panel (
                {SHOPIFY_SCOPES_USED.map((item) => item.label).join(", ")}).
              </>,
              <>
                Vuelves aquí solo y la sincronización inicial arranca sola. Los
                datos aparecen en la sección Shopify en unos minutos.
              </>,
            ]}
          />
          </InfoModalButton>
        </div>

        {payload?.shopify_custom_app_available ? (
          <div className="mt-4">
            <p className="text-sm font-medium text-foreground">App de Shopify a usar</p>
            <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="App de Shopify">
              <Button
                type="button"
                size="sm"
                variant={appMode === "public" ? "primary" : "secondary"}
                aria-pressed={appMode === "public"}
                onClick={() => setAppMode("public")}
              >
                App pública (recomendada)
              </Button>
              <Button
                type="button"
                size="sm"
                variant={appMode === "custom" ? "primary" : "secondary"}
                aria-pressed={appMode === "custom"}
                onClick={() => setAppMode("custom")}
              >
                App personalizada heredada
              </Button>
            </div>
            <p className="mt-1 text-xs text-muted">
              Usa la app pública para nuevas conexiones. Elige la personalizada
              solo si esa tienda ya fue instalada con esa app heredada.
            </p>
          </div>
        ) : null}

        <p className="mt-5 text-sm font-medium text-foreground">
          Dominio interno de Shopify
        </p>
        <p className="mt-1 text-xs text-muted">
          Usa el dominio terminado en{" "}
          <span className="font-mono">.myshopify.com</span>.
        </p>
        <form
          className="mt-3 flex flex-col gap-3 md:flex-row"
          onSubmit={submit}
        >
          <Input
            className="min-w-0 flex-1"
            aria-label="Dominio .myshopify.com de la tienda"
            value={shopDomain}
            onChange={(event) => setShopDomain(event.target.value)}
            placeholder="tu-tienda.myshopify.com"
            autoComplete="off"
            required
          />
          <Button type="submit" disabled={pending === "shopify" || !canConnect}>
            {pending === "shopify"
              ? "Conectando..."
            : "Conectar Shopify"}
          </Button>
        </form>
        {actionError ? (
          <Banner className="mt-3" tone="danger">
            {actionError}
          </Banner>
        ) : null}
      </Card>

      <LastErrorBanner
        provider={shopify}
        retrying={pending === "retry-shopify"}
        onRetry={
          shopify.connection
            ? () => void actions.retrySync("shopify", shopify.connection!.id)
            : undefined
        }
      />

      {shopifyConnections.length > 0 ? (
        <Card
          title={`Tiendas conectadas (${shopifyConnections.length})`}
          description="Revisa rápidamente el dominio y estado de cada conexión."
        >
            <div className="space-y-3">
              {shopifyConnections.map((connection) => (
                <div
                  key={connection.id}
                  className="rounded-lg border border-separator p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm">
                      {connection.provider_account_id ?? "Dominio pendiente"}
                    </span>
                    {/* Salud, no el estado crudo: una tienda 'connected' que
                      lleva dos semanas sin sincronizar no esta bien, y aqui
                      salia en verde. */}
                    <Badge tone={healthTone(connection.health.status)}>
                      {healthLabel(connection.health.status)}
                    </Badge>
                    {connection.id === activeConnectionId ? (
                      <Badge tone="brand">Tienda activa</Badge>
                    ) : null}
                    {connection.app_mode ? (
                      <span className="text-xs text-muted">
                        App{" "}
                        {connection.app_mode === "custom"
                          ? "personalizada"
                          : "pública"}
                      </span>
                    ) : null}
                  </div>
                  {connection.last_error_message ? (
                    <p className="mt-2 break-words text-xs text-danger">
                      {connection.last_error_message}
                    </p>
                  ) : null}
                  {canManageConnections ? (
                    <div className="mt-3 flex justify-end">
                      <ConfirmDialog
                        trigger={
                          <Button
                            type="button"
                            variant="danger"
                            size="sm"
                            disabled={pending === `remove-${connection.id}`}
                          >
                            <TrashIcon aria-hidden className="size-4" />
                            Eliminar tienda
                          </Button>
                        }
                        title={`Eliminar ${connection.provider_account_id ?? "esta tienda"} de E-NORA`}
                        description={
                          connection.status === "error" &&
                          !connection.last_sync_at
                            ? "Esta conexión falló antes de sincronizar datos. Se eliminará ahora de E-NORA de forma definitiva. Esto no desinstala la app de Shopify."
                            : "La tienda dejará de sincronizar y desaparecerá de E-NORA ahora. Sus datos se conservarán 30 días para poder restaurarla; después se eliminarán definitivamente. Esto no desinstala la app de Shopify."
                        }
                        confirmLabel={
                          pending === `remove-${connection.id}`
                            ? "Eliminando…"
                            : "Eliminar tienda"
                        }
                        onConfirm={() => void removeStore(connection.id)}
                      />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
        </Card>
      ) : null}

      <InfoModalButton title="Detalles técnicos de Shopify" label="Detalles técnicos">
          <ConnectionFacts provider={shopify} />
      </InfoModalButton>
    </div>
  );
}

export default function ShopifyPage() {
  return (
    <PortalShell title="Integración · Shopify">
      {(bootstrap) => <ShopifyIntegrationPage bootstrap={bootstrap} />}
    </PortalShell>
  );
}
