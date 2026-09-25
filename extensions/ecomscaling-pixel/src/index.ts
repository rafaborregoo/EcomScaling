import { register } from "@shopify/web-pixels-extension";

// Una vista de producto = un POST. text/plain para que el navegador no haga
// preflight (la API no devuelve nada que haya que leer) y keepalive para que
// el envio sobreviva si el comprador cambia de pagina.
register(({ analytics, settings }) => {
  const endpoint = `${settings.endpoint}?s=${encodeURIComponent(settings.accountID)}`;

  analytics.subscribe("product_viewed", (event) => {
    const variant = event.data?.productVariant;
    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      keepalive: true,
      body: JSON.stringify({
        name: event.name,
        id: event.id,
        timestamp: event.timestamp,
        client_id: event.clientId,
        product_id: variant?.product?.id ?? null,
        variant_id: variant?.id ?? null,
      }),
    }).catch(() => undefined);
  });
});
