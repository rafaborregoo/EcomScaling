"use client";

import { FormEvent, useState } from "react";
import { SHOPIFY_SCOPES_USED } from "@ecomscaling/contracts";
import { PortalShell } from "@/components/portal-shell";
import { useActiveConnection } from "@/components/active-connection";
import { type BootstrapResponse } from "@/lib/bootstrap";
import {
  AsyncState,
  Badge,
  Banner,
  Button,
  Card,
  ErrorBlock,
  Input,
  Label,
  Radio,
  RadioGroup,
} from "@/components/ui";
import {
  BackToHub,
  ConnectionFacts,
  LastErrorBanner,
  ProviderStatusCard,
  Steps,
  healthLabel,
  healthTone,
  useIntegrations,
} from "../shared";

function ShopifyIntegrationPage({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const { payload, provider, isLoading, error, actions, pending, actionError } =
    useIntegrations(bootstrap);
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
  const shopifyConnections = shopify.connections ?? [];

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
        const tienda = connection.provider_account_name ?? connection.provider_account_id ?? "esta tienda";
        return (
          <Banner key={connection.id} tone="warn">
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
        );
      })}

      <Card
        title="Encontrar tu dominio .myshopify.com"
        description="No es el dominio público de tu web, sino el interno que Shopify asignó al crear la tienda y que nunca cambia."
      >
        <Steps
          items={[
            <>
              Abre el admin de tu tienda. En la URL verás{" "}
              <span className="font-mono">admin.shopify.com/store/TU-HANDLE</span>
              : tu dominio es{" "}
              <span className="font-mono">TU-HANDLE.myshopify.com</span>.
            </>,
            <>
              O entra en{" "}
              <span className="font-medium">Configuración → Dominios</span>: ahí
              aparece el dominio <span className="font-mono">
                xxxx.myshopify.com
              </span>{" "}
              exacto.
            </>,
            <>
              Si al conectar ves una página de Shopify tipo{" "}
              <span className="italic">&laquo;This store will be right
              back&raquo;</span>
              , el dominio no corresponde a tu tienda activa: revisa el handle.
            </>,
          ]}
        />
      </Card>

      <Card title="Conectar la tienda">
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

        <Steps
          items={[
            <>
              Escribe el dominio{" "}
              <span className="font-mono">TU-HANDLE.myshopify.com</span> abajo y
              pulsa <span className="font-medium">Conectar Shopify</span>.
            </>,
            <>
              En la pantalla de Shopify revisa los permisos y pulsa{" "}
              <span className="font-medium">Instalar</span> (necesitas ser owner
              o staff con permiso de apps, con la sesión de Shopify iniciada).
              Hay que aceptarlos todos: cada uno alimenta una parte del panel
              {" "}({SHOPIFY_SCOPES_USED.map((item) => item.label).join(", ")}).
            </>,
            <>
              Vuelves aquí solo y la sincronización inicial arranca sola. Los
              datos aparecen en la sección Shopify en unos minutos.
            </>,
          ]}
        />

        {payload?.shopify_custom_app_available ? (
          <div className="mt-4">
            <RadioGroup
              value={appMode}
              onChange={(value) => setAppMode(value as "custom" | "public")}
            >
              <Label className="text-sm font-medium">App de Shopify a usar</Label>
              <div className="mt-1 flex flex-wrap gap-2">
                <Radio value="custom">
                  <Radio.Content>
                    <Radio.Control>
                      <Radio.Indicator />
                    </Radio.Control>
                    App personalizada heredada
                  </Radio.Content>
                </Radio>
                <Radio value="public">
                  <Radio.Content>
                    <Radio.Control>
                      <Radio.Indicator />
                    </Radio.Control>
                    App pública (recomendada)
                  </Radio.Content>
                </Radio>
              </div>
            </RadioGroup>
            <p className="mt-1 text-xs text-muted">
              Usa la app pública para nuevas conexiones. Elige la personalizada
              solo si esa tienda ya fue instalada con esa app heredada.
            </p>
          </div>
        ) : null}

        <form className="mt-4 flex flex-col gap-3 md:flex-row" onSubmit={submit}>
          <Input
            className="min-w-0 flex-1"
            aria-label="Dominio .myshopify.com de la tienda"
            value={shopDomain}
            onChange={(event) => setShopDomain(event.target.value)}
            placeholder="tu-tienda.myshopify.com"
            autoComplete="off"
            required
          />
          <Button
            type="submit"
            disabled={pending === "shopify" || !canConnect}
          >
            {pending === "shopify"
              ? "Conectando..."
              : shopify.connection
                ? "Reconectar Shopify"
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
          title={`Tiendas vinculadas (${shopifyConnections.length})`}
          description="Esta lista identifica exactamente qué dominio corresponde a cada estado y error."
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
                      App {connection.app_mode === "custom" ? "personalizada" : "pública"}
                    </span>
                  ) : null}
                </div>
                {connection.last_error_message ? (
                  <p className="mt-2 break-words text-xs text-danger">
                    {connection.last_error_message}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <Card title="Estado de la conexión">
        <ConnectionFacts provider={shopify} />
      </Card>
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
