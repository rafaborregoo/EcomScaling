# Evidencias Shopify para el Reel — 27 de octubre de 2026

Capturas reales de https://ecom.noraapp.es, tomadas con la sesión disponible en el navegador. La tienda visible es EcomScaling Dev y su conexión está en error. El resumen indica última actualización 22/9/26, 2:00. Las cifras no demuestran actividad comercial actual ni sincronización operativa.

## Archivos

- 01-conexion.jpg: formulario real «Conectar Shopify» y aviso de sincronización fallida. No se ejecutó OAuth ni se concedieron permisos.
- 02-resumen.jpg: resumen real, con aviso «Shopify rechazó el permiso guardado. Reconecta la tienda.».
- 03-producto.jpg: ficha real de The Complete Snowboard.
- 04-inventario.jpg: listado real; diferencia entre «Sin lectura» y «Sin seguimiento».
- 05-nora.jpg: respuesta real del Consultor IA a «Preguntar qué haría» desde el producto.
- 06-promociones.jpg: listado real de promociones.
- Los archivos *-produccion.txt contienen el texto de las vistas observadas.

## Límites observados

- No se verificó una instalación nueva ni una sincronización con éxito.
- No se verificó entrega de alertas por correo o push.
- No se encontró una alerta comercial activa de caída de ventas o stock. Sí se capturó un aviso de conexión.
- El inventario en producción es un listado. El código local contiene otra portada con grupos y «Reponer primero».
- «Nuevo código» y el flujo de aplicación de descuentos existen en código local, pero no aparecieron en la producción revisada, tampoco seleccionando una tienda concreta.
- Los textos y diseños locales no deben sustituir a los de estas capturas sin comprobar el despliegue.
- NORA tardó 73,0 s y usó 5 herramientas. Advirtió del conector antiguo, pero también afirmó stock agotado donde otras vistas indican ausencia de lectura y enlazó a diagnóstico técnico. Esa respuesta no es una pieza publicitaria validada.
- La promoción de envío gratuito muestra «Envío 0 €» aunque la tienda está en USD.
- No se modificaron productos, inventario, precios, costes, promociones ni conexiones. Se realizó una consulta al Consultor IA, que quedó en su historial.

## Fuentes locales revisadas

- apps/web/src/app/shopify/page.tsx
- apps/web/src/app/dashboard/client-shopify.tsx
- apps/web/src/app/integraciones/shopify/page.tsx
- apps/web/src/app/shopify/productos/page.tsx
- apps/web/src/app/shopify/productos/[productId]/page.tsx
- apps/web/src/app/shopify/inventario/page.tsx
- apps/web/src/app/shopify/inventario/inventory-groups.ts
- apps/web/src/app/shopify/promociones/page.tsx
- apps/web/src/app/shopify/promociones/discount-proposal-workspace.tsx
- apps/web/src/app/shopify/productos/stock-forecast.tsx
- apps/web/src/app/shopify/trust-strip.tsx
- apps/api/src/shopify-sync.ts
- apps/api/src/shopify-sessions.ts
- apps/api/src/shopify-webhooks.ts
- apps/api/src/shopify-queue-worker.ts
- apps/api/src/shopify-metrics.ts
- apps/api/src/shopify-product-costs.ts
- apps/api/src/shopify-discount-proposals.ts
- apps/api/src/operations.ts
- apps/api/src/ai-runtime.ts
- apps/api/src/cross-channel-attribution.ts
- apps/worker/src/repeatable-jobs.ts
- shopify.app.toml
- supabase/migrations/20261116000000_shopify_order_item_net_metrics.sql
- supabase/migrations/20270113100000_alertas_copy_normalizado.sql

El repositorio tiene numerosos cambios locales sin confirmar. La revisión del código refleja el árbol de trabajo, no garantiza lo desplegado. Las fechas de nombres de migraciones no prueban su aplicación en producción.
