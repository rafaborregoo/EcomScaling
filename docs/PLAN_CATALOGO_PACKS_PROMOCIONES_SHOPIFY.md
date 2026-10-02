# Plan: catálogo, packs y promociones de Shopify

## Estado de ejecución — 30-09-2026

> **Estado actualizado tras aplicar migraciones:** `npm run db:push:dry` y `npm run db:push:prod:dry` informan cero migraciones pendientes. Se aplicaron en la base no productiva configurada en `.env.local` y en producción mediante `.env.production.local`. No existe un `.env.test` separado: la base no productiva es la usada para desarrollo/pruebas. No se desplegó la aplicación. Las menciones posteriores a migraciones pendientes describen el estado histórico de cada revisión y no el estado actual.

- El alcance organización/tienda ya está aplicado en las entidades y cruces del catálogo tratados por las migraciones recientes; las comprobaciones locales anteriores devolvieron cero discrepancias en variantes, inventario y aplicaciones de descuento.
- El catálogo tiene imágenes, opciones de variante, bundles nativos y objetivos de promoción persistidos; existen directorio y fichas propias de producto/promoción conectados desde cliente y consultor, y las tools de IA declaran procedencia y cobertura.
- La exportación de variantes y sus imágenes usa `productVariants` para evitar el límite de 250 por producto. El ciclo `products/delete` marca producto, variantes, medios y relaciones de pack; la reconciliación segura de snapshot completo retira registros ausentes solo si la lectura y escritura del snapshot tuvieron éxito. Los incrementales nunca interpretan ausencia como borrado, y el sync de packs conserva relaciones anteriores cuando su paginación queda parcial o hay referencias sin resolver.
- Las migraciones de Shopify, Klaviyo y agentes están aplicadas tanto en la base no productiva como en producción. La comprobación de pendientes en ambas bases devuelve cero. No se ha desplegado código.
- Las importaciones OAuth/manuales y la reconciliación usan `ecomscaling-shopify-sync`: límite Redis global de una tienda activa y una nueva cada 5 segundos, deduplicación por conexión, reintentos y lectura paginada de conexiones. La activación depende de desplegar API y worker con Redis, Supabase y Shopify configurados; validar con una tienda de prueba antes de producción.
- El lector de colecciones mantiene como máximo 500 productos hijos por segmento; pedidos/carritos abortan con error explícito si una raíz supera 5.000 descendientes. Suite API (899), build de API, typechecks de API/web/worker/IA y 17 guardas pasan.
- Estado de conexiones leído sin datos sensibles: no hay Shopify conectado (producción: 1 conexión en error; no producción: 1 en error y 1 pendiente de eliminación). Klaviyo tiene 2 conexiones conectadas en no producción y ninguna en producción. Pendiente antes de declarar terminado: aceptación de snapshots incrementales/completos, validar JSONL y scopes con una tienda Shopify conectada, revisar vínculo Shopify–Klaviyo y hacer revisión requisito por requisito de promociones, packs, UI y tools de IA.

> Documento inicial. La auditoría y el orden de ejecución actualizados están en [AUDITORIA_SHOPIFY_DATOS_UI_AGENTES.md](./AUDITORIA_SHOPIFY_DATOS_UI_AGENTES.md), contrastados con [la API oficial](./AUDITORIA_SHOPIFY_API_OFICIAL.md). La auditoría incorpora imágenes, pantallas de cliente/consultor y problemas de integridad monetaria que este primer plan no recogía.

## Resultado que buscamos

Una tienda con cientos o miles de productos debe poder revisar su catálogo completo, abrir la ficha de un producto, entender sus variantes, stock y ventas, distinguir los packs confirmados de los posibles y ver las promociones configuradas y su efecto real. Las mismas definiciones y datos deben alimentar a los agentes de IA con límites de frescura, tienda y certeza.

## Auditoría de partida — 30-09-2026

| Capa | Existe | Límite actual |
| --- | --- | --- |
| Sincronización | Bulk de productos y variantes; precios, precio comparativo, SKU, coste, inventario, pedidos y descuentos | No persiste la composición explícita de packs ni todos los objetivos y condiciones de las promociones |
| Base de datos | `shopify_products`, `shopify_variants`, inventario, `shopify_discounts`, aplicaciones por pedido y colecciones | No hay relación pack → componentes; el descuento de un pedido puede compartirse entre varias reglas |
| Interfaz | Ranking de productos, stock agregado, uso de códigos, directorio paginado inicial y ficha básica propia | El overview solo enseña una muestra de 50 productos; faltan imágenes, datos comerciales por producto/variante, enlaces desde cliente/consultor y catálogo de promociones configuradas |
| IA | `get_shopify_product_catalog` y motores de producto/precios ya consultan el catálogo y métricas | La herramienta limita a 30 productos y 120 variantes en total; no expresa packs ni alcance completo de promociones; su descripción promete buscar por handle/proveedor, pero hoy filtra solo el título |

El conector usa Admin GraphQL `2026-07`. Según [Shopify Bundles](https://shopify.dev/docs/apps/build/product-merchandising/bundles/start-building), los pedidos de packs nativos pueden almacenar componentes con referencia al padre y los informes pueden contabilizar componentes. Las relaciones de variantes de packs fijos se exponen mediante [componentes de ProductVariant](https://shopify.dev/docs/apps/build/product-merchandising/bundles/add-variant-fixed-bundle). Las reglas BXGY distinguen productos/colecciones que se compran y los que reciben el beneficio en [Admin GraphQL](https://shopify.dev/docs/api/admin-graphql/2026-07/mutations/discountCodeBxgyCreate).

## Reglas de interpretación

1. Siempre separar organización, tienda, producto y variante. Un mismo SKU en dos tiendas no es la misma fila operativa.
2. Tratar `compare_at_price` como referencia de precio; las promociones se modelan por su regla y por su aplicación real en pedidos.
3. Clasificar un pack como **confirmado** solo con una relación explícita de Shopify o de la aplicación. Un nombre sugerente genera como mucho un candidato pendiente de revisión.
4. No sumar ventas del pack padre y de sus componentes como si fueran ventas independientes. Los importes del pedido son la fuente contable; cualquier atribución a componentes debe explicitar su método.
5. Distinguir coste actual del coste histórico de la venta; un margen con coste actual es estimado. Mantener moneda de tienda y fechas de sincronización visibles.
6. Conservar identidad y texto histórico de descuentos aplicados aunque la promoción se borre o cambie.

## Modelo de datos propuesto

**Ya existentes:** `shopify_products`, `shopify_variants`, `shopify_inventory_items`, `shopify_inventory_level_snapshots`, `shopify_order_items`, `shopify_discounts`, `shopify_order_discount_applications`, `shopify_collections` y `shopify_product_collections`.

**Ampliaciones versionadas:**

- `shopify_bundle_components`: organización, tienda, variante padre, variante componente, cantidad, origen (`shopify_native` o integración identificada), fecha de observación y estado. Un índice único por padre/componente/origen y RLS por organización.
- `shopify_discount_targets`: promoción, tipo de objetivo (producto, variante, colección o todos), ID externo e ID local cuando exista, lado de la regla (`buys`/`gets`/`applies_to`) y cobertura de la lectura. No inferir objetivos ausentes.
- Campos de cobertura en la sincronización para saber si las relaciones de pack y reglas se leyeron, no existen o fallaron. El vacío no significará «no hay packs».
- Relación padre/componente en líneas de pedido cuando la API la proporcione, conservando la línea original y la procedencia de los importes.

Antes de la migración hay que validar las consultas GraphQL para `2026-07`, los permisos reales y el comportamiento de tiendas que usen aplicaciones de terceros. La migración debe ser aditiva, con RLS, índices por organización/tienda y regeneración de los tipos de base de datos. Las tiendas existentes se completarán con una resincronización, sin fabricar relaciones a partir del nombre.

## Fases de implementación

### 1. Catálogo visible y navegable — empezada

- Nuevo endpoint paginado, filtrado por organización y tienda, con búsqueda por nombre y estado; respuestas pequeñas y recuento total.
- Página `/shopify/productos` con búsqueda, filtros, paginación, estado de sincronización y enlace a una ficha propia.
- Ficha `/shopify/productos/[productId]` con variantes, precio, SKU, coste actual, indicador de seguimiento de inventario y procedencia de datos. Si no hay tienda seleccionada, mostrar el nombre de tienda en cada fila. Las cantidades disponibles por ubicación requieren consolidar el último snapshot de cada artículo/ubicación y quedan para la fase 2.
- Enlaces desde Shopify y desde la navegación de Analítica. Una selección de tienda ajena a la organización debe fallar cerrada.
- Criterio de salida: se puede recorrer más de 50 productos sin perder ninguno, abrir uno por URL y cambiar de tienda sin mezclar datos.

### 2. Métricas y promociones

- Resumen por producto y variante: unidades, venta neta, reembolsos, stock disponible por ubicación y margen con cobertura de coste; periodos y monedas explícitos.
- Directorio de promociones configuradas: código/automática, tipo, estado, vigencia, uso, objetivos conocidos y ficha propia.
- Separar efecto observado en pedidos de la configuración actual; señalar pedidos con varias promociones y evitar sumas duplicadas.
- Criterio de salida: una promoción BXGY y un descuento automático se entienden sin confundirlos con `compare_at_price`.

### 3. Packs confirmados

- Validar y ampliar el bulk GraphQL para relaciones de variantes y líneas de pedidos; incorporar cobertura por bloque.
- Guardar composición confirmada con cantidades; distinguir packs fijos, packs transformados por app y casos no identificables.
- Mostrar componentes y stock dependiente en la ficha del pack; presentar ventas del padre y de componentes sin duplicarlas.
- Criterio de salida: un pack de dos unidades de A y una de B muestra exactamente esa composición; una tienda sin datos de composición muestra «sin verificar».

### 4. Agentes de IA y operación

- Hacer que la herramienta de catálogo comparta la misma lógica de alcance y paginación que la interfaz. Corregir la búsqueda prometida y evitar truncar variantes silenciosamente.
- Crear lecturas específicas de promociones y packs con `as_of`, tienda, cobertura y procedencia. Los agentes no deben afirmar composición ni rentabilidad que no esté confirmada.
- Actualizar contratos, prompts y evaluaciones de agentes de producto, precios, inventario y CRO para escenarios con varias tiendas, packs, variantes y descuentos acumulados.
- Añadir alertas de sincronización parcial y trazas de qué hechos sustentan una recomendación.
- Criterio de salida: un agente distingue producto normal, variante, pack confirmado y promoción, y explica cuándo la información es insuficiente.

## Casos de aceptación transversales

- Tienda con 0, 1, 51 y más de 1000 productos; producto con muchas variantes; productos archivados.
- Dos tiendas de la misma organización con el mismo SKU y otra organización sin acceso.
- Pack padre vendido como componentes; pack creado por una app sin relaciones legibles; producto llamado «kit» que no es pack.
- Precio comparativo sin descuento; código y descuento automático en un mismo pedido; BXGY con objetivos distintos; promoción retirada que dejó pedidos históricos.
- Coste ausente, coste actualizado después de la venta, inventario sin seguimiento, sincronización parcial y moneda distinta entre tiendas.

## Secuencia de entrega

La secuencia en curso ya modificó sincronización, modelo de datos, API, UI y tools de IA para completar el recorrido prioritario. Cada cambio de schema se aplica primero en desarrollo y se valida con tipos/consultas locales; cada fase debe exponer su cobertura real antes de usarla para recomendaciones automáticas. La siguiente puerta es ejercitar fixtures de catálogo y JSONL de Shopify, corregir discrepancias y validar con una tienda de prueba antes de cualquier despliegue.

### Integridad del ingreso neto por línea

- La nueva migración agrega cantidad e ingreso neto junto con su procedencia (`shopify_graphql_exact`, `shopify_rest_estimate` o sin cobertura). `current_line_total` sigue siendo bruto y no se reutiliza como neto.
- Las métricas de productos, devoluciones y margen exponen cuántas líneas son exactas, estimadas o todavía desconocidas. Cliente, consultor y agentes deben tratar los agregados como parciales si hay líneas sin cobertura.
- No se estima retroactivamente el histórico con `importe bruto - descuentos - reembolsos con impuestos`: las cantidades y asignaciones de descuentos no permiten demostrar ese resultado. La resincronización Shopify completa las líneas que la API permita volver a leer.
- La migración `20261116000000_shopify_order_item_net_metrics.sql` está aplicada en ambas bases. Sigue pendiente aceptar los resultados con datos de una tienda real (incluidos reembolso parcial, descuento combinado y cantidad retirada) y completar la revisión de los motores/agentes que consumen `shopify_margin_summary` antes de desplegar.

### Control de moneda ausente en interfaz

Las vistas Shopify no deben completar una moneda desconocida con EUR. Las métricas, el catálogo de productos y las fichas de promociones deben mostrar el importe solo con su moneda de tienda/pedido disponible; si no hay moneda, deben indicarlo. Un coste cero es dato válido y no equivale a coste ausente.
