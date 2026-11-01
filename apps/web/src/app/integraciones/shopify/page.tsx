"use client";

import { StoreIcon } from "lucide-react";
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
  ErrorBlock,
  Input,
  TrashIcon,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogConfirmPhrase,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  RadioCard,
  RadioGroup,
} from "@/components/ui";
import {
  BackToHub,
  ConnectionFacts,
  InfoModalButton,
  LastErrorBanner,
  ProviderStatusCard,
  Steps,
  StateBadge,
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
  const [showConnectForm, setShowConnectForm] = useState(false);

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
    <div className="portal-page space-y-6">
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
                Los permisos opcionales aparecen al autorizar solo si los
                solicita la versi&#xF3;n actual de la app. El hist&#xF3;rico de m&#xE1;s de 60 d&#xED;as
                adem&#xE1;s requiere aprobaci&#xF3;n de Shopify.
              </span>
            </Banner>
          </InfoModalButton>
        );
      })}

      <InfoModalButton
        title="Encuentra el dominio interno de Shopify"
        label="¿Dónde veo mi dominio?"
      >
        <Card>
          <CardHeader>
            <CardTitle>¿No recuerdas tu dominio .myshopify.com?</CardTitle>
            <CardDescription>No es el dominio público de tu web. Es el identificador interno que Shopify asignó a la tienda y no cambia.</CardDescription>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      </InfoModalButton>

      <Card className="border border-[#168446]">
        <CardHeader>
          <CardTitle>{shopifyConnections.length > 0 ? "Añade otra tienda" : "Conecta tu tienda"}</CardTitle>
          <CardDescription>Traeremos catálogo, inventario, pedidos y clientes para que los diagnósticos trabajen con datos reales.</CardDescription>
        </CardHeader>
        <CardContent>
          <Collapsible open={shopifyConnections.length === 0 || showConnectForm} onOpenChange={setShowConnectForm}>
          {shopifyConnections.length > 0 ? (
            <CollapsibleTrigger render={<Button variant="secondary" />}>
              {showConnectForm ? "Cerrar formulario" : "A\u00f1adir otra tienda"}
            </CollapsibleTrigger>
          ) : null}
          <CollapsibleContent>
          {!shopify.available ? (
            <Banner tone="warn">
              La conexión con Shopify está desactivada por ahora. En cuanto se
              active, podrás conectarla desde aquí.
            </Banner>
          ) : !configured ? (
            <Banner tone="warn">
              Conectar Shopify aún no está disponible: falta configurarlo en el
              servidor. Se activará solo en cuanto esté listo.
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
              <RadioGroup aria-label="App de Shopify" className="mt-2 gap-2 sm:grid-cols-2" value={appMode} onValueChange={setAppMode}>
                <RadioCard value="public" title="App pública" description="La recomendada para nuevas conexiones." />
                <RadioCard value="custom" title="App personalizada heredada" description="Solo si la tienda ya fue instalada con esa app." />
              </RadioGroup>
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
          </CollapsibleContent>
          </Collapsible>
        </CardContent>
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
        <Card>
          <CardHeader>
            <CardTitle>{`Tiendas conectadas (${shopifyConnections.length})`}</CardTitle>
            <CardDescription>Revisa rápidamente el dominio y estado de cada conexión.</CardDescription>
          </CardHeader>
          <CardContent>
              <div className="space-y-3">
                {shopifyConnections.map((connection) => (
                  <Card size="sm" key={connection.id}><CardContent>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm">
                        {connection.provider_account_id ?? "Dominio pendiente"}
                      </span>
                      {/* Salud, no el estado crudo: una tienda 'connected' que
                        lleva dos semanas sin sincronizar no esta bien, y aqui
                        salia en verde. */}
                      <StateBadge connection={connection} providerId="shopify" />
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
                      <p className="mt-2 text-xs text-danger">
                        Fall&#xF3; la &#xFA;ltima sincronizaci&#xF3;n. Abre &laquo;Detalles t&eacute;cnicos&raquo; para consultar el motivo.
                      </p>
                    ) : null}
                    {canManageConnections ? (
                      <div className="mt-3 flex justify-end">
                        <AlertDialog>
                          <AlertDialogTrigger
                            render={
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                disabled={pending === `remove-${connection.id}`}
                              >
                                <TrashIcon aria-hidden className="size-4" />
                                Eliminar tienda
                              </Button>
                            }
                          />
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogMedia className="bg-danger/10 text-danger">
                                <StoreIcon />
                              </AlertDialogMedia>
                              <AlertDialogTitle>
                                ¿Eliminar {connection.provider_account_id ?? "esta tienda"} de E-NORA?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                {connection.status === "error" && !connection.last_sync_at
                                  ? "Esta conexión falló antes de sincronizar datos. Se eliminará ahora de E-NORA de forma definitiva. Esto no desinstala la app de Shopify."
                                  : "La tienda dejará de sincronizar y desaparecerá de E-NORA ahora. Sus datos se conservarán 30 días para poder restaurarla; después se eliminarán definitivamente. Esto no desinstala la app de Shopify."}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            {connection.provider_account_id ? (
                              <AlertDialogConfirmPhrase phrase={connection.provider_account_id} />
                            ) : null}
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                variant="destructive"
                                busyLabel="Eliminando…"
                                onClick={() => removeStore(connection.id)}
                              >
                                Eliminar tienda
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    ) : null}
                  </CardContent></Card>
                ))}
              </div>
          </CardContent>
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
