# Laboratorio local E-NORA

Este laboratorio ejecuta escenarios con datos ficticios y conectores simulados. No usa Shopify, Klaviyo, Meta, Supabase ni claves locales; no manda mensajes ni procesa pagos.

## Repetir una ejecución

```sh
npm run lab:reset
npm run lab:run
```

`lab:reset` restaura el estado base versionado. `lab:run` parte de ese mismo estado para cada escenario y escribe el resultado en `.e-nora-test-lab/runs/latest.json`. El resultado conserva el ID y fecha del dataset, el modo de integración, el número de ejecuciones externas (cero) y el resultado de cada escenario.

## Cobertura

- Búsqueda de producto publicado, variante, SKU y precio.
- Variante agotada y carrito sin cambios.
- Compra aprobada y rechazada con pagos simulados.
- Devolución/reembolso simulado.
- Baja de email respetada.
- Webhook duplicado con efecto único.
- Eventos de Klaviyo y Meta registrados solo en memoria como entregas hipotéticas.

El catálogo de `dataset.v1.json` es completamente sintético. No representa ni sustituye el inventario real de E-NORA. La prueba de eventos de Meta y la sincronización real de Klaviyo requieren activos de prueba autorizados. La cuenta Klaviyo actualmente conectada no está marcada como cuenta de prueba, por lo que este laboratorio no escribe en ella.

La tienda Shopify de desarrollo todavía requiere que exista una tienda de desarrollo y que se autorice el acceso correspondiente. El script existente `npm run seed:shopify-store` crea productos, clientes y pedidos en Shopify y exige una confirmación explícita por entorno; no forma parte del laboratorio local.
