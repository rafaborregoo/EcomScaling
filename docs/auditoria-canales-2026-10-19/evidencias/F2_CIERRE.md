# Cierre de F2 · Catálogo e inventario coherentes

Fecha: 20-10-2026.

F2 cierra el recorrido de inventario entre las superficies principales:

- El Catálogo de Shopify y la ficha ya leen cantidades desde `shopify_inventory_current_state` y las presentan por variante y ubicación. Un nivel sin lectura permanece `null` y se muestra como desconocido.
- El agente A06 ya utilizaba `shopify_stock_risk_products_a06`, con producto, tienda, SKU, conteos de variantes y fecha de lectura más antigua incluida. Ahora incorpora el mismo desglose canónico por variante/ubicación que el móvil, con cobertura explícita si falla esa consulta. Sus puertas de calidad dejan cobertura y disponibilidad en desconocido si los datos no son completos o están obsoletos.
- El contexto del agente limita el detalle a 25 niveles por producto y registra el total y si la lista se truncó, para contener el tamaño del prompt sin ocultar que queda más detalle.
- La previsión móvil usaba la RPC anterior `shopify_stock_risk_products`, que no devolvía frescura ni el estado de sincronización requeridos por `enrichStockRiskEvidence`. Se cambió para usar la misma RPC A06 que el agente. La lectura privilegiada ocurre después de validar pertenencia, conexión/tienda activa y alcance de la membership; las consultas quedan restringidas a la organización y tienda resueltas.
- El móvil ahora muestra tienda, SKU, variante, ubicación, cantidad, fecha relativa de lectura y cobertura del producto. Las consultas de detalle están paginadas y conservan cantidades nulas.

No se añadió migración. Se verificó que `ai_05_a06_stock_risk_function`, `a06_oldest_inventory_freshness` y `shopify_inventory_variant_page` constan en TEST (`kopcblejsxpkxoykldyh`) y producción (`cthjwpeygpzwdmjkxeqa`).

## Verificación

- `npx tsx --test --test-force-exit apps/api/src/stock-forecast.test.ts`: 4 pruebas correctas; incluye filtro de datos obsoletos/desconocidos y mapeo estable de variante/ubicación sin convertir `null` a cero.
- `npm run typecheck --workspace=@e-nora/api`: correcto.
- `npm run typecheck --workspace=@e-nora/mobile`: correcto.

No se sincronizó ni modificó ninguna tienda Shopify real. No tienes que hacer nada en Shopify para F2. El código permanece local, sin despliegue, según la instrucción de desplegarlo al final.
