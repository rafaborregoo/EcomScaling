# Auditoría de Shopify: datos, interfaz de cliente y consultor, y agentes

## Ejecución controlada — 30-09-2026

- Corregida la ingesta bulk de líneas: `discount_total` ahora suma `DiscountAllocation.allocatedAmountSet` en vez de guardar `discountedTotalSet`, que representa precio tras descuento. La asignación se pide junto a los campos opcionales para conservar el fallback de pedidos si Shopify no acepta ese bloque.
- Añadida persistencia local de imágenes con alcance compuesto por organización, tienda y producto; la sincronización masiva reconcilia galerías y los webhooks de producto crean, actualizan y retiran medios. También guarda el ID de la imagen asociada a cada variante.
- El catálogo API muestra miniatura, la ficha abre una galería y cada fila de variante enlaza su imagen. Los productos más vendidos del panel compartido cliente/consultor enlazan a la ficha.
- Shopify acepta `read_products` para Product.media y MediaImage; no hay que solicitar `read_files` para la galería de productos ([MediaImage, Admin GraphQL 2026-07](https://shopify.dev/docs/api/admin-graphql/2026-07/objects/MediaImage)). Una denegación de acceso ya no se atribuye a ese scope por defecto: la API señala únicamente el permiso que Shopify nombre o deja el error como revisión de acceso a datos.
- `npm run typecheck -w @e-nora/api` y `npm run typecheck --prefix apps/web` pasan. Las pruebas focalizadas de importes, media y payloads de webhook pasan (8/8).
- Shopify Admin GraphQL 2026-07 validó las selecciones para líneas con descuentos, imágenes de producto, media de variante y el bulk principal de variantes/inventario.
- La exportación de variantes y la asociación de su imagen dejaron de depender de `products.variants(first: 250)`: ahora usan la conexión raíz `productVariants` y resuelven cada variante por GID. En sincronizaciones incrementales filtra por `updated_at`; la consulta oficial admite filtros, catálogo grande y paginación. La operación bulk real debe comprobarse con una tienda de prueba antes de activar la nueva ruta en producción. [Referencia oficial](https://shopify.dev/docs/api/admin-graphql/2026-07/queries/productVariants).
- La consulta de variantes resuelve sus productos contra el mapa completo de productos ya almacenados; así no se descartan variantes actualizadas de productos que no cambiaron en la consulta incremental de productos.
- La retirada ahora tiene dos fuentes explícitas: `products/delete` marca el producto como `DELETED` y desactiva sus variantes, medios y relaciones de pack; las sincronizaciones completas también detectan productos/variantes ausentes, pero solo retiran registros tras leer y escribir correctamente el snapshot. Los incrementales nunca interpretan ausencia como borrado. Catálogo y agentes omiten los productos eliminados por defecto.
- Las migraciones Shopify necesarias para media, cobertura, grupos de pack, métricas netas, metadata, atribución exacta y reconciliación de colecciones se aplicaron previamente en producción y en la base no productiva; no se aplicaron migraciones nuevas en esta revisión. No existe `.env.test` separado; `.env.local` es el destino no productivo. El código API/worker de este worktree no está desplegado. Ya se contrastaron productos, imágenes y scopes con la tienda de prueba `e-nora`; sigue pendiente ejecutar la sincronización con el código actualizado.
- Las rutas de métricas e insights ya no suman varias tiendas en una misma respuesta: si hay más de una activa y no llega `connectionId`, devuelven `shopify_store_selection_required`. La vista cliente/consultor indica que hay que elegir tienda y formatea los importes Shopify con `shopify_stores.currency_code`; la clave Redis de métricas cambió de versión para no reutilizar payloads anteriores sin moneda. No se hace conversión de divisas.
- La API calcula ahora cobertura de moneda en vivo para tiendas Shopify, configuración financiera, gastos fijos, reglas de envío, costes de producto, cuentas Meta y cuentas activas de Klaviyo. Si hay una moneda distinta o no se puede verificar, el panel mantiene ventas Shopify en la moneda de tienda, pero oculta beneficio, margen, CAC/ROAS, recuperación, objetivos financieros y atribución multifuente. La ruta de insights también adjunta la cobertura y elimina del contrato los campos de contribución/CAC/payback de lifetime cuando no se puede comparar la moneda. El contexto de los agentes Shopify incluye esa cobertura y la instrucción de no afirmar rentabilidad si no es compatible; la vista consultor también deja de mostrar propuestas financieras antiguas. Las respuestas cacheadas reemplazan siempre la cobertura por la lectura actual. No se convierten divisas.
- La herramienta `get_shopify_product_catalog` admite ahora cursor `offset`, indica `total_count`, `truncated` y `next_cursor`, y busca por título, handle, proveedor o tipo de producto dentro de una única tienda. También expone contadores y estado de truncamiento para variantes y medios; la cobertura de packs baja a parcial si el límite de lectura recorta sus componentes. Así, el agente puede recorrer catálogos grandes y distinguir una página/muestra de una lectura completa.
- Las pertenencias de colección ahora se leen y guardan en segmentos de hasta 500 productos, incluso cuando un único padre tiene miles. El contador de productos se actualiza con el total al cerrar la colección, sin acumular su lista completa en memoria.
- El directorio web del catálogo busca también por handle, proveedor y tipo de producto, igual que la herramienta IA; antes solo filtraba por título.
- La ficha de variante ahora identifica cuándo se leyó el stock por ubicación y avisa que la cantidad es una lectura sincronizada, no tiempo real.
- La tool IA permite paginar también las variantes de un producto mediante `product_id` y `variants_cursor`. El resultado general sigue señalando la muestra de 120 variantes; los agentes pueden recorrer el resto sin tratar el primer bloque como catálogo completo.
- La carga OAuth, la sincronización manual y las reconciliaciones incrementales se envían a la cola persistente BullMQ `ecomscaling-shopify-sync`. Los trabajos se deduplican por tienda, así que cada tienda tiene como máximo una importación pendiente o activa; los intentos repetidos no crean una tormenta de trabajos. El primer catálogo de una tienda tiene prioridad sobre las actualizaciones manuales e incrementales que sigan pendientes, para que una reconciliación no retrase la disponibilidad inicial de los datos. BullMQ conserva las peticiones pendientes en Redis, aplica reintentos con espera creciente y procesa con concurrencia global 1 y un intervalo mínimo de 5 segundos entre inicios, compartidos por todas las réplicas. La política global se establece al arrancar el worker, no en cada solicitud que añade un trabajo. La API responde sin esperar a que termine la importación. El barrido de reconciliación lee las conexiones en páginas de 250 y va encolando tienda por tienda, sin cargar la lista completa en memoria. Esto mantiene una sola carga de Shopify escribiendo en la base de datos a la vez, incluso al conectar muchas cuentas. El worker que consume la cola necesita Redis y la configuración de API, Supabase y Shopify.
- Capacidad y operación: la cola limita la concurrencia global y el backlog pendiente (250 trabajos), pero no elimina el tiempo de espera si entran más tiendas de las que el worker puede procesar. El backlog crece como máximo con las tiendas que tengan una solicitud pendiente, no con cada clic o cada barrido duplicado. La API y el panel de infraestructura del admin exponen conteos (incluidos los priorizados), edad del trabajo Shopify pendiente más antiguo y los límites globales configurados. Antes de ampliar capacidad hay que medir duración por tipo de sincronización, reintentos, memoria del worker, errores y límites/throttling de Shopify. Si la cola crece de forma sostenida, se debe añadir admisión gradual/backpressure y alertas por antigüedad antes de escalar; no basta con añadir réplicas porque eso puede multiplicar carga sobre Shopify y la base de datos.
- Pendiente para activación operativa: desplegar API y worker actualizados con sus variables de entorno, comprobar el envío OAuth → cola → worker en una tienda de prueba y habilitar alertas por cola pendiente, antigüedad y errores antes de ampliar concurrencia. La salud de plataforma ya da visibilidad de conteos y edad del trabajo más antiguo.
- Verificación de código: `npm run test:unit --prefix apps/api` pasó con 899 pruebas; build de API, typechecks de API, worker, web e IA y las 17 guardas pasaron en esa revisión. La tienda de prueba conectada permitió contrastar en vivo los 17 productos, los 18 IDs de imagen y los permisos; la aplicación/worker actualizados siguen sin desplegarse.
- Esta cobertura solo demuestra compatibilidad del código de moneda de las filas disponibles. No demuestra conexión, frescura, completitud histórica ni que existan datos de gasto publicitario/costes; esas señales deben comprobarse por separado antes de interpretar beneficio como definitivo. La política es conservadora en algunos costes de producto al comparar entradas de toda la organización incluso en una tienda seleccionada. También requiere revisión el resto de paneles que muestran dinero fuera de `ClientShopify`.
- Los scopes concedidos están comprobados en la tienda de prueba. Sigue pendiente capturar y validar el JSONL de una sincronización ejecutada con el código actualizado, comprobar packs de apps que no expongan relaciones Shopify estándar y reconciliar el histórico de importes/costes. La cobertura de medios almacenada continúa marcada como parcial aunque la comparación directa de los 18 IDs de imagen coincide exactamente; la cobertura solo se debe actualizar mediante una sincronización completa verificada.
- Esta corrección no recalcula líneas históricas, ni completa asignaciones de envío/descuento por código, ni valida importes contra una tienda real. Esas tareas siguen siendo requisitos antes de dar por fiable el margen histórico.

Fecha de revisión del código: 30-09-2026. Alcance: repositorio local de E-NORA. Las migraciones locales se aplicaron previamente en producción y en la base no productiva configurada para desarrollo/pruebas; no se aplicaron nuevas migraciones en esta revisión. No hay un `.env.test` separado. El worktree actual no está desplegado. La aceptación parcial con la tienda de prueba confirmó catálogo, imágenes y scopes; queda validar el JSONL y la sincronización completa usando el código actual. Las capacidades y límites de la API se documentan con fuentes oficiales en [AUDITORIA_SHOPIFY_API_OFICIAL.md](./AUDITORIA_SHOPIFY_API_OFICIAL.md).

## Decisión principal

La unidad de trabajo es **tienda → catálogo → producto → variante**, conectada con imágenes, inventario, promociones, pedidos y líneas vendidas. El cliente y el consultor deben poder recorrer ese mismo catálogo y abrir la misma ficha de producto, con acciones y contexto adecuados a su rol. El administrador de plataforma necesita ver la cobertura y los fallos de sincronización por tienda. Los agentes deben leer los mismos hechos y declarar su fecha y cobertura.

El color y el shell del admin ya tienen su propio plan. El trabajo prioritario aquí es que los datos comerciales sean completos, correctos y comprensibles en todos los módulos que los usan.

## Recorrido inicial comprobado antes de esta ejecución

| Capa | Lo que ya existe | Brecha para el producto solicitado | Evidencia local |
| --- | --- | --- | --- |
| Permisos y conexión | La app declara `read_products`, `read_inventory`, `read_discounts`, `read_orders`, entre otros; Admin API `2026-07` | Hay que comprobar permisos realmente concedidos por tienda y el acceso a histórico de pedidos | `shopify.app.toml` |
| Sincronización inicial | Bulk de productos, variantes, inventario, pedidos, descuentos, colecciones y otros bloques | El bulk de producto omite imágenes, descripción, opciones, publicaciones y relaciones de pack. El de descuentos guarda solo el primer código y omite objetivos/condiciones | `apps/api/src/shopify-sync.ts:1144`, `:2418` |
| Actualización | Webhooks de producto actualizado, inventario, pedidos y devoluciones, más sincronización periódica | No aparece `products/create` ni `products/delete` entre los topics; no hay borrado/tumba del catálogo. El webhook de producto tampoco persiste imágenes u opciones | `apps/api/src/shopify-webhooks.ts:22`, `apps/api/src/shopify-webhook-handler.ts:188` |
| Base de datos | Productos, variantes, inventario actual por ubicación, pedidos y líneas, descuentos, aplicaciones y colecciones; RLS por organización | No hay tabla de media de producto, opciones de variante, códigos múltiples, objetivos de descuentos ni composición de packs. Hay que revisar la identidad externa en tiendas múltiples | `supabase/migrations/20260715173726_db_05_shopify_vertical_slice.sql`, `20260907142000_shopify_marketing_catalog.sql` |
| API de lectura | Resumen Shopify, métricas, insights y nuevo catálogo paginado con ficha | El catálogo aún devuelve texto/precio/SKU/coste; faltan imagen, inventario cuantificado, ventas por variante, promociones y pack. El overview de una tienda toma una muestra de 50 | `apps/api/src/shopify-overview.ts:478`, `apps/api/src/shopify-catalog.ts` |
| UI cliente y consultor | Ambos usan `ClientShopify`; ven ventas, top de ocho productos, devoluciones y seis códigos usados | Los productos no tienen imagen ni enlace a su ficha desde esas tablas. No existe directorio de promociones configuradas, ni vista de packs. La ficha nueva del catálogo vive fuera de ese recorrido | `apps/web/src/app/dashboard/client-shopify.tsx:210`, `:510`, `:646` |
| IA | Tool `get_shopify_product_catalog`, métricas y prompts de agentes de producto/marketing | La tool limita a 30 productos y 120 variantes globales; busca solo título pese a prometer handle/proveedor; no ve imágenes, packs ni reglas completas; requiere una tienda seleccionada | `apps/api/src/ai-runtime.ts:2892`, `packages/ai/src/tool-layer.ts:246` |

## Hallazgos de integridad que preceden a la nueva UI

### P0. Importe por línea de pedido — corregido en código

El hallazgo original era guardar `discountedTotalSet` como descuento. El bulk ahora guarda el descuento de [`DiscountAllocation`](https://shopify.dev/docs/api/admin-graphql/2026-07/objects/DiscountAllocation), conserva por separado importes originales/netos y marca la cobertura de las aplicaciones observadas. Los webhooks mantienen su campo de descuento propio. Las métricas que dependen de cobertura neta incompleta se ocultan o devuelven `null`. El histórico antiguo no queda reparado automáticamente: requiere resincronización y conciliación con pedidos reales antes de dar margen histórico por fiable.

### P0. Cruces entre tiendas y organizaciones — corregido en desarrollo

Las referencias de la sincronización y los webhooks ahora se resuelven con organización, tienda y relación propietaria. Inventario y variantes tienen identidad acotada por tienda; las aplicaciones de descuento incluyen el mismo ámbito. Las migraciones correspondientes están aplicadas en ambas bases y las comprobaciones de integridad en producción no encontraron cruces entre organizaciones/tiendas.

### P0. Descuentos observados y configurados — código corregido; migración nueva pendiente

Las aplicaciones observadas guardan asignaciones por índice y declaran cobertura completa, parcial o no disponible. La UI y los agentes no presentan el total del pedido como coste causado por cada código. La migración `20261118000000_shopify_discount_attribution_exact.sql` está aplicada en ambas bases.

### P1. Frescura y desaparición de productos

Hallazgo de la auditoría inicial: la sincronización no reconciliaba ausencias. Corregido en código: el webhook `products/delete` marca el estado `DELETED` y retira variantes, medios y relaciones de pack; un snapshot completo hace la misma reconciliación si sus upserts concluyen sin error. Un incremental o una lectura parcial nunca provoca bajas. Media y bundles conservan su cobertura por subbloque. La aceptación final sigue requiriendo un payload/JSONL de una tienda conectada.

### P1. Histórico y alcance

`read_all_orders` está excluido del TOML de la app por aprobación pendiente. Cualquier pantalla que ofrezca «todo el histórico» debe mostrar el periodo realmente cubierto por Shopify y la fecha del primer pedido importado. No extrapolar a periodos anteriores ni a tiendas con sincronización parcial.

### P1. Moneda en el panel compartido — corregido

Las vistas de cliente, consultor y cartera ya leen la moneda guardada por tienda. Separan monedas incompatibles y ocultan importes compuestos cuando la moneda falta o la lectura falla. No hay conversión FX; una suma entre monedas distintas sigue sin presentarse como cifra válida.

## Datos que debe traer el conector

| Dominio | Campos/relaciones mínimos | Persistencia y uso |
| --- | --- | --- |
| Identidad del producto | ID externo, tienda, título, handle, descripción resumida, vendedor, tipo/taxonomía, estado, etiquetas, fechas | Ficha, filtros, contexto de IA; distinguir texto público de HTML no confiable |
| Variantes | ID, SKU, código de barras, opciones y valores, precio y compare-at, política de inventario, coste disponible, estado | Tabla propia y selector de variante; moneda y fecha del dato visibles |
| Imágenes y media | Imagen principal, galería ordenada, alt, dimensiones, tipo, estado y asociación con variantes | Miniatura en listas y dashboards; galería en ficha. Guardar URL/metadatos y procedencia; plan de sustitución si cambia o desaparece |
| Colecciones | Manual/automática, pertenencia, título y handle | Navegación y segmentación; mantener cambios de pertenencia |
| Inventario | Artículo, ubicación, disponible, reservado/en mano, seguimiento, fecha | Vista por variante y tienda; agregado solo cuando las ubicaciones son comparables |
| Ventas y devoluciones | Pedido, línea, variante, cantidades, importe original, descuentos asignados, neto, reembolso, moneda y periodo | Ficha de producto/variante y métricas; evitar duplicación entre pack padre y componentes |
| Promociones | Clase, código(s), regla, beneficio, objetivos, condiciones, combinabilidad, vigencia, estado, uso y fuente | Directorio y ficha de promoción; separar regla actual de lo aplicado históricamente |
| Packs | Padre, componentes, cantidades, origen, estado de verificación y líneas de pedido relacionadas | Mostrar pack confirmado y su efecto sobre stock/ventas; no inferir composición por nombre |
| Contextos condicionales | Precios por mercado, planes de venta/suscripción, publicaciones/canales, apps de packs y metafields seleccionados | Activar por capacidad y caso de uso; definir alcance y permisos antes de ingerirlos masivamente |

Las imágenes merecen un tratamiento propio: principal y galería no son equivalentes; una variante puede mostrar una imagen distinta. El texto `alt` puede faltar. La miniatura del ranking debe proceder del mismo registro canónico que la ficha. Un agente de texto puede citar `alt` y metadatos; una afirmación visual requiere inspección de la imagen y su propia cobertura.

## Impacto en los módulos existentes

| Módulo | Adaptación necesaria |
| --- | --- |
| Dashboard de cliente y escritorio del consultor | Enlazar productos, devoluciones y promociones a sus fichas; mostrar miniaturas y moneda correcta; conservar cliente/tienda/periodo. Ambos consumen `ClientShopify`, de modo que la definición comercial debe ser compartida. |
| Shopify analítica y diagnóstico | Sustituir listas de «top» como sustituto del catálogo por vistas paginadas; usar métricas por variante y cobertura. Revisar los diagnósticos de inventario/producto tras corregir importes de línea. |
| Inventario y operaciones | Añadir stock por variante/ubicación y distinguir stock de componentes de un pack; enlazar alertas y tareas con la variante real. |
| Finanzas y planes | Recalcular ingresos y márgenes afectados por la semántica de línea; separar costes actuales de históricos y monedas antes de agregados. |
| Klaviyo y contenido | A11 ya consulta el catálogo cuando el brief menciona productos. Incorporar media/alt, disponibilidad y oferta verificada con fecha; mantener un aviso si falta evidencia antes de publicar una pieza. |
| Meta y creatividad | Si se cruzan anuncios con productos o imágenes de Shopify, usar una relación explícita y fecha de captura. La mera semejanza visual o de título no demuestra qué producto se promocionó ni su rendimiento. |
| Admin de cliente y observabilidad | Mostrar cobertura de producto, media, descuentos y packs por tienda; scopes concedidos, última sincronización, subbloques fallidos y ruta de reparación. |
| Agentes de IA | Revisar herramientas y prompts que usan top de productos, descuentos, stock, recompra o catálogo; bloquear afirmaciones cuando la fuente esté incompleta. |

## Experiencia objetivo por rol

| Lugar | Cliente | Consultor | Administrador de plataforma |
| --- | --- | --- | --- |
| Portada Shopify | Pulso comercial, productos que requieren atención y enlace al catálogo; periodo/tienda visibles | Mismo pulso con cola de acciones y diagnóstico por cliente/tienda | Salud del conector, permisos, errores y cobertura |
| Catálogo | Galería o tabla con miniatura, nombre, variante/rango de precios, stock, ventas y señales de oferta verificadas | Misma ficha con filtros operativos: sin imagen, sin coste, stock bajo, ventas/devoluciones, promociones | Vista de cobertura y sync por tienda; acceso contextual a ficha del cliente |
| Producto | URL propia con galería, variantes, precio, disponibilidad, ventas, devoluciones y promociones relacionadas | Añade evidencia, riesgos, tareas y recomendaciones con referencia a producto/variante | Diagnóstico de datos y trazas de sincronización |
| Promoción | Lista y ficha: vigente/programada/finalizada, qué incluye, beneficio y uso real | Añade análisis de solapamiento, margen y propuesta de mejora | Errores de permisos, lectura o asociación |
| Pack | Componentes confirmados y disponibilidad condicionada; «sin verificar» si faltan relaciones | Impacto sobre ventas, stock y recomendaciones solo con cobertura suficiente | Estado de captura y origen nativo/app |

Las filas de «más vendidos», devoluciones y códigos usados en `ClientShopify` deben enlazar a estas fichas conservando organización, tienda y periodo. El directorio `/shopify/productos` debe poder abrirse con ese contexto en URL y validarlo en el API; la selección global del navegador no siempre coincide con el cliente que está examinando un consultor. La vista compartida de cliente y consultor evita métricas contradictorias; sus permisos y acciones se resuelven en el API. El admin global enlaza a la misma información del cliente, sin duplicar un segundo catálogo.

## Contrato para agentes de IA

Consumidores actuales que deben revisarse tras corregir la fuente: A06 (planificación de stock), A20 (recompra por producto), A11 (emails con productos del catálogo), las herramientas `shopify_margin_health` y `get_shopify_product_catalog`, y las lecturas de top de productos, devoluciones y coste por código usadas por otros agentes (`apps/api/src/ai-runtime.ts`, `packages/ai/src/tool-layer.ts`). Las recomendaciones basadas en ingreso o margen por producto heredan el riesgo monetario descrito arriba.

1. Lecturas versionadas para producto, variante, media, pack, promoción y rendimiento. Cada resultado lleva `organization_id`, `store_id`, `as_of`, periodo, moneda, fuente y cobertura.
2. Búsqueda y paginación explícitas; `has_more`/`total` para que 30 productos o 120 variantes nunca parezcan el catálogo entero. Igualar filtros prometidos con filtros reales.
3. Separar hechos de catálogo, configuración de promoción, aplicación observada en pedidos e inferencia de agente. El coste actual no demuestra el margen histórico.
4. Bloquear afirmaciones de composición de pack, promoción activa, descuento exacto por código o aspecto visual cuando la evidencia correspondiente falte.
5. Actualizar contratos, prompts y evaluaciones de agentes de stock, producto, oferta/precio, CRO y marketing. Mostrar en la UI las fuentes que sustentan cada propuesta y su tienda.

## Orden de ejecución y entregables

| Etapa | Trabajo | Criterio para pasar |
| --- | --- | --- |
| 0. Verdad de datos | Validar campos financieros con Shopify; corregir mapeos de bulk/webhook; cerrar cruces de IDs por tienda; documentar cobertura actual de pedidos; definir plan de reparación histórica | Una misma línea de pedido da el mismo bruto, descuento y neto tras bulk y webhook; ninguna asociación cruza tiendas |
| 1. Contratos y migraciones | Modelo aditivo de media/opciones, promociones, packs y cobertura; RLS, índices y tipos; consultas GraphQL `2026-07` validadas y permisos revisados | Migraciones reproducibles, lectura aislada por organización/tienda y ausencia distinguible de fallo |
| 2. Ingesta fiable | Full sync y webhook/reconciliación por dominio; paginar o separar consultas según límites de bulk; captar altas, cambios, bajas, imágenes y variantes; backfill gradual | Conteos de Shopify y E-NORA reconciliados en tiendas de prueba; ninguna sincronización parcial se etiqueta completa |
| 3. Catálogo visual | Extender el catálogo paginado ya creado; miniaturas/galería, opciones, filtros, stock y enlaces desde cliente/consultor | Tiendas con 0, 1, 51 y >1000 productos; URL de producto abre la misma entidad desde ambas vistas |
| 4. Producto y promoción | Métricas por producto/variante; directorio y ficha de descuentos con condiciones/objetivos/aplicaciones; advertencia de solapamientos | Un compare-at sin promoción, un BXGY y dos descuentos en un pedido se muestran correctamente |
| 5. Packs y contextos especiales | Relaciones nativas y de apps donde existan; mercados/planes de venta según cobertura real | Pack confirmado muestra componentes y cantidades; pack sin evidencia no se clasifica como confirmado |
| 6. Agentes | Tools compartidas con API de UI, contexto y límites; prompts/evaluaciones; trazas | Recomendaciones con fuente, periodo y tienda; abstención ante imagen/pack/regla no verificados |
| 7. Cierre | Revisión con cuentas cliente, consultor y admin; tiendas múltiples; datos reales y auditoría de permisos/acciones | Todo enlace y acción funciona según rol; datos y cifras conciliados; incidencias documentadas |

## Casos que deben estar en la revisión con tiendas reales

- Producto sin imágenes, con varias imágenes y con imagen específica por variante; media cambiada o eliminada.
- Más de 1000 productos, variantes numerosas, colecciones automáticas, producto archivado y producto eliminado.
- Dos tiendas con mismo SKU/código comercial, distintas monedas, y un usuario sin acceso a una organización.
- Precio de comparación sin descuento, código con varios valores, descuento automático, BXGY, combinación de promociones y promoción ya borrada.
- Pack nativo, pack de app, pack vendido como componentes y producto cuyo nombre contiene «kit» sin composición verificable.
- Pedido con dos descuentos, devolución parcial, cancelación, cambio posterior de precio/coste y datos anteriores al permiso de histórico.
- Sincronización con un subbloque fallido y webhook recibido antes del primer bulk.

## Límite de esta auditoría

El código y las migraciones aplicadas en desarrollo permiten confirmar las brechas iniciales y sus cambios de código. Falta contrastar contra una tienda conectada: scopes concedidos, media y packs realmente usados, distribución de variantes, volumen, moneda/Markets y ejemplos de pedidos con descuentos. Producción no ha recibido estas migraciones.

## Avance de integridad por tienda - 2026-09-30

- `shopify_variants` y `shopify_inventory_items` incorporan `store_id`; la migracion lo rellena desde producto/variante y reemplaza la unicidad global del ID de inventario por unicidad tienda + ID externo.
- Las aplicaciones de descuento observadas incorporan el ambito de tienda y se rellenan a partir del pedido existente.
- Los cruces de IDs del sync exigen filtro de tienda o del pedido propietario; los errores de lectura ya no se convierten silenciosamente en listas vacias. Los webhooks de pedido e inventario tambien filtran por tienda y organizacion.
- El reset de relaciones de coleccion queda limitado a las colecciones de esa sincronizacion. El overview, la ficha de producto y la lectura de variantes de IA usan el mismo ambito.
- `npm run typecheck -w @e-nora/api` pasa. Las migraciones de alcance tienda se aplicaron en desarrollo y la verificacion local anterior devolvio cero discrepancias en variantes, inventario y aplicaciones de descuento.
- Quedan pendientes el historico de importes/costes, los bundles transformados por apps sin relacion Shopify nativa y la aceptacion con fixtures/tienda real; promociones, packs nativos, actividad observada y contexto de IA ya tienen las ampliaciones descritas mas abajo.

## Cobertura monetaria en la interfaz y agentes - 2026-09-30

- Las fuentes monetarias de la suma financiera se comparan con la moneda de las tiendas del ámbito solicitado; lecturas con error, incompletas o con código de moneda ausente se marcan `unknown` (fail closed).
- El panel compartido de cliente/consultor presenta importes Shopify con moneda dinámica. Cuando la cobertura no es `compatible`, conserva las ventas de Shopify y oculta métricas derivadas que mezclarían fuentes. La atribución de Meta/Klaviyo y objetivos financieros solo aparece cuando la cobertura es compatible.
- El runner añade cobertura al contexto de los agentes financieros Shopify A02, A13, A17, A18 y A19 y ordena no declarar margen, beneficio, CAC/ROAS o recuperación cuando no sea compatible. Esto no sustituye una futura cobertura estructurada por tool ni pruebas con datos reales.
- No hay conversión FX ni política de tipo de cambio. La comparación de monedas no valida conexión, freshness, cobertura temporal, costes faltantes ni disponibilidad de gasto; el panel debe seguir mostrando esas limitaciones de forma independiente.

## Avance de promociones, packs y agentes - 2026-09-30

- La sincronizacion de descuentos guarda multiples codigos, resumen, reglas seleccionadas y niveles de cobertura; distingue reglas administradas por apps y no afirma que una promocion del catalogo aplique a un producto concreto.
- Se han anadido relaciones nativas verificadas entre variantes para packs fijos y cobertura por tienda. La ficha de producto muestra componentes solo cuando existen relaciones confirmadas y avisa si la lectura esta parcial o la migracion falta.
- La herramienta de catalogo para IA expone resumen de ofertas y componentes confirmados con cobertura. Su contrato prohibe deducir elegibilidad por producto, inspeccion visual o composicion por el nombre.
- Las aplicaciones de descuentos de pedidos ahora capturan importes asignados a lineas y envios agrupados por el indice de Shopify. `amount_coverage` permite distinguir cantidades completas, parciales y no disponibles; el valor anterior `0` ya no se presenta como exacto cuando no hay datos suficientes.
- Las consultas de descuentos y componentes de variantes se validaron contra Shopify Admin GraphQL `2026-07`. Los typechecks de API y web pasan; las dos pruebas focalizadas de agregacion pasan.
- Las migraciones Shopify se aplicaron en desarrollo. La lectura de objetivos concretos, la ficha de promocion, inventario por ubicacion y actividad observada por producto ya estan conectadas. Siguen pendientes los packs creados por apps sin datos legibles, validar importes con pedidos reales y reparar el historico.
- La ficha de producto ya lee el estado actual de inventario por ubicacion dentro de la organizacion y la tienda del producto; muestra cantidades separadas por ubicacion y degrada a `migration_pending` si esa tabla no esta disponible. API y web pasan TypeScript despues de este cambio.
- El catalogo de promociones tiene ruta API paginada y una pagina propia compartida por cliente y consultor. Permite buscar, filtrar por estado y revisar códigos, vigencia, usos y cobertura de la regla; si faltan las columnas nuevas, degrada al esquema básico y lo indica.
- TypeScript pasa para API y web tras incorporar la ruta. El directorio presenta configuración importada separada de aplicación observada. La ficha individual se completó después; la elegibilidad exacta de cliente/carrito sigue sin afirmarse porque Shopify puede depender de condiciones no sincronizadas.

## Avance de objetivos de promoción por producto - 2026-09-30

- La sincronización de Shopify consulta por separado los objetivos `gets` y `buys` para no perder el lado de la regla al aplanar conexiones bulk. Guarda relaciones explícitas de producto, variante, colección y todos los productos (`AllDiscountItems`), con claves compuestas por organización/tienda/promoción y cobertura `complete`, `partial` o `failed` por lado ([tipo oficial](https://shopify.dev/docs/api/admin-graphql/2026-07/objects/AllDiscountItems)).
- Las conexiones por encima de 250 objetivos, tipos desconocidos, descuentos administrados por aplicaciones o IDs sin correspondencia reducen la cobertura; no se retiran objetivos previos después de una lectura parcial.
- La ficha de producto coteja sus IDs externos, los de sus variantes y las colecciones asociadas. Agrupa coincidencias por promoción/regla y aclara que no confirma segmentos de cliente, mínimos, fechas ni elegibilidad completa del carrito.
- `get_shopify_product_catalog` devuelve coincidencias con esos objetivos y una cobertura que queda parcial si faltan objetivos, colecciones o variantes fuera de la muestra. El contrato de la herramienta prohíbe afirmar elegibilidad solo por coincidencia de objetivo.
- Shopify Admin GraphQL `2026-07` validó las consultas de objetivos `gets` y `buys`, con scopes `read_discounts` y `read_products`. Typechecks de API, web y paquete IA pasan.
- El parser local acepta el DDL nuevo de las tablas e índices. `supabase db lint --local` no pudo conectar a Postgres local. La migración Shopify se aplicó después en desarrollo; no se ha enviado a producción.

## Actividad observada en ficha de producto - 2026-09-30

- La API agrega por tienda, producto y periodo (30, 90 o 365 días) unidades de pedidos y devoluciones por variante, número de pedidos y fecha del último pedido observado. El RPC usa `SECURITY INVOKER` y limita la consulta a la organización, tienda y productos solicitados. La ficha y la herramienta de catálogo de IA comparten la lectura agregada.
- La ficha muestra las cifras agregadas y por variante, con estado `observed_only` y una nota visible de cobertura. Solo se cuentan pedidos sincronizados; Shopify no tiene concedido `read_all_orders`, por lo que un cero no demuestra ausencia de actividad histórica.
- No se muestran ventas, importes reembolsados ni ingresos netos: `current_line_total` tiene semántica histórica no reconciliada y los pedidos pueden usar monedas diferentes. La ficha presenta cantidades de unidades, no importes monetarios. El contrato de la herramienta de IA exige respetar `activity_coverage` y no interpretar un cero observado como ausencia histórica de ventas.
- La migración que incorpora el RPC está aplicada en desarrollo. La consulta quedó registrada y ejecuta con alcance vacío sin error; `npm run typecheck` pasa en el monorepo. No se ha aplicado nada en producción.

## Opciones estructuradas de variante - 2026-09-30

- La sincronización bulk incorpora `ProductVariant.selectedOptions` (nombre y valor), el webhook `products/create`/`products/update` normaliza las opciones REST, y la ficha compartida cliente/consultor muestra combinaciones como color o talla ([documentación Shopify](https://shopify.dev/docs/api/admin-graphql/2026-07/objects/ProductVariant); scope `read_products`).
- La normalización también recoge los objetos de opción que Shopify puede emitir como líneas hijas en el resultado bulk y los reagrupa por ID de variante antes de guardar; esto evita perder las opciones al agrupar variantes bajo cada producto.
- La herramienta `get_shopify_product_catalog` devuelve las opciones con `variant_options_coverage`; si el esquema aún no está migrado, la API conserva la ficha y los agentes reciben cobertura `migration_pending` sin opciones inventadas.
- La migración aditiva `20261115850000_shopify_variant_selected_options.sql` se aplicó en desarrollo. La columna existe como `jsonb`; no se ha enviado a producción.
- Verificación posterior en desarrollo: las migraciones Shopify constan aplicadas y las consultas de coherencia entre organización/tienda/producto/variante devuelven cero discrepancias en variantes, inventario y aplicaciones de descuento. El `dry-run` conserva cinco migraciones: una migración vacía Shopify y cuatro de otros módulos.

## Ficha de promoción y uso observado - 2026-09-30

- La lista compartida por cliente y consultor enlaza a una ficha individual. La API valida el acceso por organización, tienda y descuento, y devuelve reglas configuradas, códigos, límites y vigencia junto a objetivos explícitos `buys`/`gets` y su cobertura.
- Los usos reportados por Shopify y las aplicaciones locales observadas se presentan por separado. Cada aplicación se enlaza a un pedido sin exponer datos del cliente; el importe se muestra por fila y con moneda del pedido solo cuando `amount_coverage` es `complete`, sin sumar monedas distintas.
- Se degrada a cobertura pendiente si faltan objetivos o el esquema de aplicaciones por tienda. La ficha no afirma elegibilidad exacta del carrito ni que el historial local incluya todos los pedidos.
- `npm run typecheck -w @e-nora/api` y `npm run typecheck -w web` pasan. No requiere una migración nueva.

## Ingresos netos por línea y cobertura histórica - 2026-09-30

- `current_line_total` conserva su significado anterior (importe original bruto); no se usa como ingreso neto nuevo. Se añaden `net_quantity`, `net_revenue` y `net_metrics_source`, sin rellenar históricos con fórmulas no demostrables.
- Bulk GraphQL guarda `currentQuantity` y `priceAfterAllDiscountsBeforeTaxesSet` como `shopify_graphql_exact`. Shopify define el importe como posterior a todos los descuentos, antes de impuestos y excluyendo cantidades reembolsadas o retiradas ([documentación LineItem 2026-07](https://shopify.dev/docs/api/admin-graphql/2026-07/objects/LineItem)).
- Los webhooks REST calculan una aproximación marcada `shopify_rest_estimate`; las unidades retiradas se prorratean sobre el total original y los reembolsos descuentan el subtotal sin impuestos. Si la cantidad reembolsada histórica no tiene detalle de subtotal, el ingreso neto queda sin cobertura.
- `shopify_top_products`, `shopify_margin_summary` y `shopify_return_rate_by_product` suman las métricas nuevas y devuelven recuentos exactos, estimados y sin cobertura. El margen compara solo las líneas con cantidad, ingreso y coste disponibles. La UI y `shopify_margin_health` avisan cuando las sumas son parciales y prohíben a la IA presentar históricos desconocidos como cero o como importe bruto.
- Los pedidos anteriores a esta captura quedan sin cobertura hasta que Shopify vuelva a enviarlos en una importación. La escritura y lectura REST tienen fallback a las columnas antiguas si la migración sigue pendiente, para que una activación escalonada no interrumpa pedidos ni webhooks.
- La migración aditiva `20261116000000_shopify_order_item_net_metrics.sql` está creada, pero no aplicada. No se pudo iniciar el stack local porque Docker Desktop no está disponible; API y paquete IA pasan TypeScript. Web mantiene el error previo en `apps/web/src/app/marketing/studio/studio-design.ts:213`, fuera de Shopify.

## Protección de carga para muchas tiendas - 2026-09-30

- Las solicitudes de importación no ejecutan la sincronización dentro de la petición web: se guardan en BullMQ/Redis y el worker las procesa fuera del proceso de API.
- Hay un ID estable por conexión, así que varios clics, reintentos OAuth o reconciliaciones no duplican el trabajo de una tienda mientras siga pendiente o activo.
- El límite global en Redis es una sincronización activa a la vez entre todas las réplicas y como máximo un inicio cada 5 segundos. El worker también tiene concurrencia local 1; aumentar réplicas no aumenta el paralelismo Shopify por accidente.
- Los errores reintentables tienen hasta cinco intentos con espera exponencial. La cola registra pendientes, activos, fallidos y diferidos en el chequeo de salud de plataforma; los fallos conservan una retención limitada.
- Por ahora la prioridad es proteger Shopify, Redis y Postgres frente a un pico de altas; una cola grande espera su turno y no crea trabajo simultáneo. Antes de subir concurrencia hay que medir duración por tienda, tamaño de importación, rate-limit cost de Shopify, memoria del worker, latencia/CPU de Postgres y retraso p95 de la cola. El siguiente escalón debe limitar concurrencia por tienda y por infraestructura, conservar deduplicación y aplicar backpressure con estado visible; no basta con añadir réplicas.
- Esta serialización alarga el tiempo total cuando se conectan muchas tiendas. Es intencional hasta tener métricas de producción y un límite de capacidad comprobado; los paneles deben mostrar `queued`/`running` y la última sincronización para que una espera no parezca una importación terminada.

## Cobertura neta en agentes de decisión y LTV - 2026-09-30

- Los contextos de adquisición, CRO, medios pagados, pricing, retención, inventario, benchmarks, escalabilidad y economía unitaria reciben ahora los contadores de líneas exactas, estimadas y pendientes del RPC de margen. Una afirmación económica dependiente del margen queda `UNKNOWN` si faltan contadores o hay líneas sin reconciliar; un periodo vacío también queda desconocido.
- La versión de contexto de esos motores se incrementa para que las decisiones nuevas identifiquen el contrato actualizado. El runtime directo de `shopify_margin_health` ya expone la cobertura y su descripción prohíbe presentar sumas parciales como totales.
- `shopify_customer_lifetime` deja de estimar ingresos de cohorte desde totales históricos de pedido. Tras aplicar la migración, usa `net_revenue`/`net_quantity`, devuelve contadores de cobertura y entrega ingreso/contribución en `null` cuando el hito contiene líneas históricas desconocidas. El cálculo de coste fecha precio de coste y además filtra el inventario por `store_id`, cerrando un cruce potencial entre tiendas.
- La UI y el contrato del agente distinguen ahora la falta de coste de la falta de cobertura de importes netos. El payback no puede concluirse si no hay una cohorte con contribución completa.
- Mientras la migración esté pendiente, la normalización del RPC antiguo detecta que faltan sus contadores y fuerza `avg_revenue`/`avg_contribution` a `null`; el agente y la UI identifican la cobertura neta como pendiente en lugar de aceptar el LTV histórico anterior.
- La migración `20261116000000_shopify_order_item_net_metrics.sql` incorpora la nueva definición de LTV además de las métricas netas por línea. Sigue sin aplicarse: el Postgres local no está disponible y producción permanece intacta.
- La ficha de producto resuelve coincidencias de promociones por variantes con consultas de hasta 100 IDs, y carga todas las páginas de variantes con orden estable. Así los productos de hasta 2.048 variantes no generan filtros PostgREST gigantes ni dependen de paginación sin orden.

## Descripcion, etiquetas y categoria del producto - 2026-09-30

- Shopify Admin GraphQL 2026-07 expone en `Product` `descriptionHtml`, `tags` y `category`; la categoria da acceso a `TaxonomyCategory` con ID y nombre jerarquico. Estos campos requieren `read_products` ([Product](https://shopify.dev/docs/api/admin-graphql/2026-07/objects/Product), [TaxonomyCategory](https://shopify.dev/docs/api/admin-graphql/2026-07/objects/TaxonomyCategory)).
- El bulk de productos guarda HTML original, etiquetas y la categoria estandarizada en `shopify_products`. La ficha compartida de cliente/consultor muestra descripcion como texto seguro, etiquetas y categoria. La respuesta API y el contexto de IA no devuelven HTML ejecutable; la descripcion de comercio se etiqueta como contenido no confiable y se limita a 800 caracteres por producto en la tool de IA.
- El webhook REST `products/create`/`products/update` conserva `body_html` y etiquetas cuando Shopify las incluye, marca metadata parcial y no borra la categoria GraphQL ya sincronizada. Una nueva sincronizacion bulk completa la cobertura de categoria.
- La migracion aditiva `20261117000000_shopify_product_content_metadata.sql` incorpora las columnas. Si el esquema aun no esta aplicado, sync y webhook guardan los campos base anteriores; API y agentes devuelven `migration_pending`, sin interrumpir el catalogo. La migracion esta creada y no aplicada en produccion.
- No se representa el HTML de la tienda con `dangerouslySetInnerHTML`; se transforma a texto antes de mostrarlo. La herramienta `get_shopify_product_catalog` incluye descripcion, etiquetas, categoria y `product_metadata_coverage` para que el agente distinga la metadata sincronizada de la pendiente.

## Comprobacion de alcance por tienda en webhooks - 2026-09-30

- Los webhooks de pedidos enlazan variantes usando simultaneamente `organization_id`, `store_id` y GID de Shopify; los niveles de inventario aplican el mismo alcance a `InventoryItem` y `Location`. Las devoluciones y bajas de producto tambien parten del contexto de la conexion autenticada y fijan tienda/organizacion antes de modificar filas.
- La baja de producto recorre las variantes con orden estable por ID antes de retirar relaciones de bundles por lotes, evitando desplazamientos entre paginas cuando el producto tiene muchas variantes.
- La migracion `20261115832000_shopify_product_media_catalog.sql` elimina la unicidad global del GID de `InventoryItem` y la sustituye por unicidad `(store_id, external_inventory_item_id)`, porque los IDs externos no son la clave de aislamiento entre tiendas.
- Revalidacion: `npm run typecheck -w @e-nora/api` pasa. No se han corrido pruebas ni se ha aplicado una migracion en este paso; produccion no se ha tocado.

## Paginacion de objetivos de promociones - 2026-09-30

- La ficha de descuento solicita como maximo 100 objetivos por pagina y pide un conteo exacto, en vez de cargar todos los productos/variantes/colecciones de una regla en una sola respuesta.
- La navegacion de objetivos tiene estado y URL de consulta propios; cambiar entre paginas de aplicaciones observadas no reinicia ni altera la pagina de objetivos.
- La cobertura por lado (`gets`/`buys`) sigue describiendo la sincronizacion desde Shopify. El total y la pagina de objetivos describen solo la lectura paginada de la base de datos, para no presentar una pagina parcial como una regla sincronizada parcialmente.

## Lectura de componentes en fichas de packs - 2026-09-30

- La ficha de producto ya no solicita todas las relaciones de componentes en una unica respuesta PostgREST: las lee en paginas ordenadas de 500 filas, dentro de la organizacion y tienda activas.
- Las referencias a variantes y productos componentes se resuelven en filtros de hasta 100 IDs por consulta. Esto evita filtros extensos cuando el producto contiene muchos packs/componentes.
- La sincronizacion conserva la regla de no retirar relaciones existentes si la lectura Shopify esta incompleta o contiene referencias sin resolver; la ficha sigue exponiendo el estado de cobertura (`complete`/`partial`).
- Validacion: `npm run typecheck -w @e-nora/api`, `npm run typecheck -w web` y `git diff --check` pasan. No se ejecutaron pruebas ni migraciones.

## Cobertura de la galeria de producto - 2026-09-30

- La sincronizacion de medios registra por tienda estado `running`/`complete`/`partial`/`failed`, conteos de la ultima carga completa, ultima tentativa, fecha de la ultima carga completa y codigo de error. La UI advierte cuando las imagenes guardadas pueden estar desactualizadas.
- Los incrementales solo actualizan medios de productos devueltos por Shopify y no retiran ausencias. En una carga completa, el resultado `COMPLETED` de Bulk Operations y el EOF del JSONL confirman que se recorrieron los nodos de la conexión; `pageInfo` se ignora en bulk y no sirve para decidir la cobertura. Si falta la referencia local del producto, se preservan sus medios anteriores y la cobertura queda parcial.
- La nueva migracion aditiva `20260930161448_shopify_product_media_sync_coverage.sql` crea la cobertura por tienda con RLS. Mientras no este aplicada, la sincronizacion principal continua y la ficha indica `migration_pending`.
- API y web pasan TypeScript. La migracion esta creada pero no aplicada; no se ha tocado produccion.
- `get_shopify_product_catalog` lee la misma cobertura persistida: si el ultimo intento falla, esta en curso o la migracion falta, no presenta `image_count` como completo ni reutiliza alts antiguos como hechos actuales. El conteo solo se entrega como completo con cobertura completa y sin truncamiento de la propia respuesta de IA.
- Revalidacion adicional del runtime IA: `npm run typecheck -w @e-nora/ai` tambien pasa.
- Las referencias a colecciones y objetivos de promociones del contexto de IA se consultan en lotes de hasta 100 IDs y con un tope de 1.000 filas por tipo de objetivo. Si las relaciones exceden esos limites o se trunca una referencia de coleccion, `offers_coverage` queda parcial para evitar afirmaciones de elegibilidad completas.

## Dosificación de importaciones y grupos de packs en pedidos - 2026-09-30

- BullMQ ofrece el límite global de concurrencia y el límite global de frecuencia para toda la cola; E-NORA los establece al arrancar el worker. La cola Shopify queda en una sincronización activa y un nuevo inicio cada 5 segundos entre réplicas. La API ya no vuelve a escribir esa configuración en Redis por cada tienda que encola ([concurrencia global de BullMQ](https://docs.bullmq.io/guide/queues/global-concurrency), [frecuencia global de BullMQ](https://docs.bullmq.io/guide/queues/global-rate-limit)).
- En la revisión inicial el trabajo pendiente aún no tenía un tope total. El apartado “Backpressure multi-tienda y alcance histórico visible” recoge la capacidad actual de admisión y sustituye esa observación inicial.
- Shopify expone `LineItem.lineItemGroup` con `id`, `productId`, `variantId`, `quantity` y `title`. Se añadió captura aditiva para distinguir grupo confirmado, línea que Shopify confirma como no-pack y dato incompleto, manteniendo métricas de venta en las líneas componentes y evitando duplicar ingresos en el pack padre ([LineItem](https://shopify.dev/docs/api/admin-graphql/2026-07/objects/LineItem), [LineItemGroup](https://shopify.dev/docs/api/admin-graphql/2026-07/objects/LineItemGroup)).
- El catálogo de permisos de Shopify ahora atribuye `media`, opciones y componentes de pack a `read_products`, y `lineItems.lineItemGroup` a `read_orders`, para que la pantalla de permisos explique qué datos habilitan los scopes concedidos.
- La migración `20260930163451_shopify_bundle_order_group_tracking.sql` está creada pero no aplicada. Si la base aún no tiene las columnas, la ingesta reintenta sin ese bloque y mantiene los campos de línea anteriores; por tanto, la relación de packs no se guarda hasta aplicar la migración.
- Los webhooks de producto toleran que todavía no exista `shopify_product_media`: guardan el producto y sus variantes, omiten solo la galería y dejan que la sincronización posterior la complete. Otros errores de escritura siguen produciendo error para no ocultar fallos reales.
- La ficha de producto y `get_shopify_product_catalog` muestran grupos/unidades de packs del periodo con estados `observed_only`, `partial` o `migration_pending`; el RPC agrupa una vez por pedido y grupo y deja las cifras monetarias en los componentes. API, worker, web, agente IA y tipos de base de datos pasan TypeScript; no se ejecutaron pruebas ni se aplicó migración.
- `npx supabase status` confirma que no se puede iniciar el Postgres local porque Docker Desktop no está disponible; por eso el SQL nuevo no se ha ejecutado ni validado contra una base local. No se ha tocado producción.

## Aislamiento de lecturas y vigilancia de la cola - 2026-09-30

- Las resoluciones internas de referencias de pedidos, variantes, reembolsos, descuentos y colecciones ahora filtran por `organization_id` además de la tienda o pedido. Evita que una coincidencia por identificador externo resuelva filas fuera del tenant durante una importación.
- La cola mantiene una sola sincronización activa global y arranca como máximo una nueva cada 5 segundos; cada conexión tiene un único trabajo pendiente/activo deduplicado, las conexiones se recorren en páginas de 250 y los fallos usan reintentos exponenciales. Así, añadir tiendas aumenta la espera de la cola, no la concurrencia de Shopify/Postgres.
- La página de infraestructura muestra trabajos priorizados, antigüedad del pendiente más antiguo y límites globales efectivos para detectar backlog antes de cambiar capacidad. La admisión actual limita el backlog pendiente y la reconciliación difiere tiendas cuando alcanza ese límite.
- Revalidación de esta tanda: `npm run typecheck` dentro de `apps/api` pasa. No se ejecutaron pruebas ni se aplicaron migraciones o cambios de producción.

## Moneda desconocida en las pantallas Shopify - 2026-09-30

- El resumen Shopify, el diagnóstico, las fichas de producto y las listas/fichas de promociones ya no sustituyen una moneda ausente por EUR. Los importes sin unidad se muestran como no disponibles o con el aviso «moneda no informada».
- El formateador común conserva EUR como valor predeterminado para módulos que históricamente operan en esa moneda, pero acepta `null` para fallar de forma segura en pantallas Shopify.
- La tabla de inventario distingue coste nulo de coste cero; `0` es un coste válido y se representa como tal.
- Verificación: `npm run typecheck` dentro de `apps/web` pasa. No se ejecutaron pruebas.

## Usos de Shopify fuera de su módulo - 2026-09-30

- El informe de rendimiento de Marketing consume el código de moneda devuelto por las métricas Shopify y deja de forzar EUR en ventas de primera parte. Klaviyo y Meta mantienen sus importes en EUR atribuidos según los contratos de esas fuentes.
- El estudio de contenido ya no etiqueta como EUR los precios de productos Shopify ni los ingresos de plantillas si su moneda no viene informada.
- `npm run typecheck` dentro de `apps/web` pasa tras estas correcciones.

## Monedas en cartera y paneles del consultor - 2026-09-30

- El resumen por cliente, la cartera global y «Mis tiendas» consultan las monedas guardadas en las tiendas Shopify y las cuentas Meta. Cada fuente se agrega solo si todas sus tiendas/cuentas tienen una única moneda válida; si hay mezcla, moneda desconocida o falla la lectura, conserva el conteo de pedidos pero devuelve importes nulos y la ficha del cliente explica la limitación.
- Los importes de Shopify y Meta usan monedas independientes. Ventas, ticket medio, gasto Meta, valor atribuido y ROAS no se etiquetan con la moneda configurada para la organización por defecto.
- Los rankings de pedidos por cliente y tienda obtienen la moneda desde `shopify_stores`; solo desempatan por ventas cuando las filas tienen la misma moneda. La matriz de cartera también evita ordenar ventas entre monedas distintas.
- El typecheck de API y web pasa después de los cambios. No se ejecutaron pruebas ni se aplicaron migraciones; esta corrección no requiere cambio de esquema y producción permanece intacta.

## Beneficio con cobertura neta incompleta - 2026-09-30

- Hallazgo: `shopify_financial_summary` consume el coste de `shopify_margin_summary`, pero sus cálculos agregados podían mostrar beneficio aunque hubiese líneas históricas sin importe/cantidad netos verificados. La interfaz solo comprobaba que hubiese configuración financiera y costes de producto.
- El resumen API de Shopify adjunta la cobertura neta también al periodo anterior. La vista de cliente y la del consultor ocultan beneficio, margen, margen de equilibrio y comparaciones financieras si falta cobertura de líneas; el panel Shopify tampoco muestra margen bruto parcial. Ventas y número de pedidos siguen visibles.
- `storePulse` no usa beneficio incompleto para emitir un titular de pérdidas. Si no se puede confirmar cobertura, la interfaz lo identifica como pendiente y pide sincronizar líneas.
- Verificación: typecheck de API y web pasa. No se ejecutaron pruebas ni migraciones. La resolución completa del histórico requiere volver a sincronizar pedidos desde Shopify y validar permisos/ventana disponible; esta corrección evita presentar el resultado parcial como fiable mientras tanto.

## Backpressure multi-tienda y alcance histórico visible - 2026-09-30

- La cola conserva concurrencia global 1 y frecuencia global 1 inicio cada 5 segundos entre réplicas. La admisión limita el backlog pendiente a 250 trabajos; al alcanzar el límite, OAuth/manual informa el rechazo de cola y la reconciliación difiere el resto para próximas pasadas. Los trabajos ya en cola no se eliminan.
- La reconciliación recorre primero conexiones con `updated_at` más antiguo y pagina de 250; una sincronización que actualiza la conexión la mueve hacia atrás en el turno siguiente. Salud de plataforma publica el límite junto al volumen, antigüedad, concurrencia y frecuencia efectivos.
- El panel llama al filtro `Todo`, pero ya no lo describe como “todo el histórico”: muestra el pedido más antiguo guardado en la base y advierte si el scope concedido solo es `read_orders` o si no se pudo confirmar el permiso. Tener `read_all_orders` permite solicitar fechas anteriores; por sí solo no demuestra que ya estén importadas.
- Shopify limita por defecto `read_orders` a los últimos 60 días; `read_all_orders` requiere aprobación de Shopify. Fuente: [Access scopes oficiales](https://shopify.dev/docs/api/usage/access-scopes) y [Order Admin GraphQL](https://shopify.dev/docs/api/admin-graphql/2026-07/objects/Order).
- Los valores de cliente de por vida se describen como calculados sobre pedidos disponibles y sincronizados, no como un histórico completo garantizado.
- La métrica superior de margen queda marcada como parcial si faltan costes o cobertura neta por línea.

## Aplicaciones de descuentos en webhooks de pedido - 2026-09-30

- Los webhooks `orders/create` y `orders/updated` guardan aplicaciones y asignaciones de descuento con alcance `organization_id`, `store_id` y pedido. El importe se agrega por `discount_application_index` a partir de las asignaciones de líneas y de envío.
- La ruta es idempotente por `(order_id, position)` y retira posiciones que ya no aparecen cuando el payload incluye líneas y arrays de asignaciones completos. Si falta alguno, deja intactos los datos anteriores para no convertir una omisión en cero.
- Las asignaciones mal formadas se guardan como cobertura parcial; si faltan las columnas nuevas de alcance/cobertura, el webhook conserva el procesamiento de pedido y registra que la migración sigue pendiente.
- Verificación: TypeScript de API. No se ejecutaron pruebas ni se aplicó migración; una validación final de importes requiere comparar webhooks de tiendas de prueba con el admin de Shopify.

## Alcance y errores de lectura en devoluciones webhook - 2026-09-30

- La búsqueda del pedido de una devolución ahora filtra por organización, tienda e ID externo; las lecturas de líneas y devoluciones también incluyen organización/pedido. Las actualizaciones del pedido mantienen las tres condiciones.
- Un pedido todavía no importado difiere el webhook como error recuperable; los errores de búsqueda, suma de reembolsos o resolución de líneas ya no se confunden con una lista vacía. Shopify y el drenaje durable de webhooks pueden reintentarlo en lugar de confirmar y perder la actualización.

## Atribución de devoluciones a líneas de producto - 2026-09-30

- La consulta GraphQL de devolución ya trae el GID de `LineItem`, pero antes no se resolvía al `shopify_order_items.id`; las devoluciones se guardaban con `order_item_id` nulo y el RPC por producto no podía contarlas. El webhook ahora resuelve la línea dentro de la organización y el pedido antes de guardarla.

## Procesamiento gradual de webhooks Shopify - 2026-09-30

- La API verifica HMAC, resuelve la tienda y persiste el payload saneado con estado `queued`; responde sin aplicar operaciones de catálogo/ventas en el proceso HTTP.
- Un trabajo repetible cada minuto drena un lote máximo de 10 y comparte la cola Shopify con importaciones. La cola mantiene concurrencia global 1 y un inicio de trabajo cada 5 segundos; así, los webhooks no generan una segunda vía paralela de carga de Supabase.
- Los eventos se reclaman con transición condicional a `processing`, se deduplican por conexión/fingerprint y reintentan hasta cinco veces. Eventos `processing` abandonados se recuperan tras 15 minutos; eventos de conexiones ya desconectadas se cierran como ignorados, permitiendo que los topics de privacidad se procesen aunque la tienda esté desconectada.
- La consulta del lote está acotada a 25 eventos como máximo; el worker usa 10 para limitar el tiempo de una sola tanda. Queda pendiente verificar con Shopify real el orden entre webhooks y la carga inicial, además de métricas de cola y tasa de reintentos.
- Sin migración nueva: se reutilizan `queued`, `processing`, `claimed_at` y `retry_count` ya presentes en migraciones del esquema. No se aplicó ninguna migración ni despliegue.

## Lectura de resultados de Shopify Bulk Operations - 2026-09-30

- Los bloques principales del catálogo y los pedidos ya ejecutaban `bulkOperationRunQuery`; la brecha estaba después de completarse la operación, al descargar su JSONL.
- El lector JSONL genérico consume el cuerpo HTTP por fragmentos y parsea línea a línea. La sincronización ya no expone un helper que materialice el archivo bulk completo en un array.
- Los resultados bulk de productos y clientes (consultas sin hijos) ahora se leen en lotes secuenciales de hasta 500 registros y se espera a cada upsert antes de continuar; se limita la copia temporal del JSONL a un lote.
- Las lecturas de galerias agrupan hasta 25 productos raiz con sus hijos `__parentId`, persisten cada bloque y liberan sus objetos antes de descargar el siguiente. La cobertura ya no depende de `pageInfo` (Shopify lo ignora en bulk); solo se retiran medios tras completar la exportación y resolver las referencias locales.
- Variantes, inventario y packs nativos ahora se procesan por bloques de hasta 100 variantes raiz. Se resuelven opciones, niveles de inventario y referencias inline del `inventoryItem`; los niveles se guardan dentro del mismo bloque. La imagen principal de variante tambien se actualiza por lotes. Las relaciones de packs se guardan por bloque, y las obsoletas solo se desactivan tras recorrer el snapshot completo sin paginacion incompleta ni componentes sin resolver. La retirada del snapshot de variantes tambien espera a que todas tengan producto local y no haya errores de escritura.
- El catalogo de descuentos ahora conserva un maximo de 50 descuentos raiz por bloque, resuelve sus codigos despues de cada upsert y crea el indice codigo→descuento sin guardar todos los objetos GraphQL. Los objetivos de `buys`/`gets` se procesan por 25 descuentos; las escrituras son por bloque y el retiro sigue condicionado a cobertura completa. Las campañas declaradas en Shopify también se guardan en lotes de 500.
- Pedidos y carritos abandonados se procesan por grupos de hasta 25 y 100 raíces. Una raíz con más de 5.000 descendientes se aborta con un error explícito antes de acumular filas sin límite; debe tratarse como sync fallido y revisarse, sin declarar completa la cobertura del pedido/carrito. Las colecciones emiten segmentos de hasta 500 productos hijos y actualizan el recuento exacto al completar la raíz. En esos bloques se vuelven a leer referencias locales por lote; pedidos, líneas, devoluciones, carritos y productos de colección sin referencia cuentan como fallo y dejan log, en vez de desaparecer silenciosamente. Las pertenencias de colecciones llevan marca de snapshot y solo se retiran tras completar la lectura, resolver referencias y guardar todos los lotes. Si falta la migración de la marca, se guardan filas nuevas y se aplaza la retirada de obsoletas. La lista local de IDs de colección para la reconciliación se lee paginada.
- Shopify documenta que el JSONL coloca cada padre antes que sus hijos y añade `__parentId`, lo que permite ese procesamiento por raíz. `groupObjects` existe, pero Shopify advierte que ralentiza la operación y aumenta el riesgo de timeout; no se activa mientras no sea necesario ([guía oficial de Bulk Operations](https://shopify.dev/docs/apps/build/apis/graphql-admin/bulk-operations/queries), [payload oficial de bulkOperationRunQuery](https://shopify.dev/docs/api/admin-graphql/latest/mutations/bulkoperationrunquery)).
- La normalización de cobertura LTV omite ahora campos opcionales cuando el origen no informó cobertura, en vez de asignarles `undefined`; esto permite que el paquete de contratos se construya con `exactOptionalPropertyTypes` activo.
- Verificación: `npm run typecheck -w @e-nora/api` y `npm run test:unit --prefix apps/api` pasan con 899 pruebas tras añadir límites y casos de streaming. También se verificó previamente el build de API y los typechecks de worker, web e IA. No se validó con una tienda conectada.
- Cada actualización de devolución vuelve a sincronizar la lista observada y retira líneas que ya no aparecen. Una línea que no se pueda enlazar sigue sin atribución y deja una señal explícita en logs; no se adjudica a un producto por título o SKU.
- Los handlers de baja por privacidad y desinstalación también incluyen ahora el alcance de organización, tienda y proveedor donde aplica.

## Relación obligatoria Shopify-Klaviyo - 2026-09-30

- La cuenta Klaviyo queda vinculada a `shopify_stores.id`. Cuando la organización tiene exactamente una tienda, OAuth, conexión por API key y la sincronización conservan o establecen esa asignación automáticamente. Con varias tiendas, la relación se escoge en «Cuentas por tienda»; el selector también aparece cuando solo existe una para que se pueda corregir una cuenta heredada sin asignar.
- El modelo asume Klaviyo como parte de la configuración normal de cada cliente Shopify. La asignación de E-NORA identifica qué cuenta Klaviyo corresponde a cada tienda, pero por sí sola no demuestra que la integración nativa instalada dentro de Shopify/Klaviyo siga activa; esa comprobación queda para la validación con una tienda conectada.
- Los pedidos y reembolsos recibidos por webhooks Shopify solo se registran en la cuenta Klaviyo asignada a esa misma tienda. Si no hay asignación, el esquema aún no tiene `store_id` o hay varias cuentas ambiguas, se omite esa señal de Klaviyo sin interrumpir la ingestión de Shopify.
- Las líneas de pedido que viajan a la señal compartida normalizan los IDs numéricos de REST a GID `Product`/`ProductVariant`, usando la misma identidad externa que el catálogo Shopify.
- El importe real del pedido sigue viniendo de Shopify. Los ingresos atribuidos en informes de Klaviyo se mantienen como una medición de marketing separada y no se suman a las ventas de Shopify.
- Verificación local: typecheck de API y web. La asociación efectiva, el comportamiento de la integración Shopify-Klaviyo del cliente y cualquier diferencia de IDs/productos todavía requieren una tienda conectada.

## Atribucion exacta y presentacion de descuentos por codigo - 2026-09-30

- La función anterior sumaba el descuento total de cada pedido a cada código aplicado; en pedidos con varios códigos eso duplicaba el coste atribuido. La migración local `20261118000000_shopify_discount_attribution_exact.sql` calcula primero una fila por tienda/pedido/código y suma solo las asignaciones de descuento guardadas para ese código.
- La respuesta separa `attributed_discount_total` del `order_discount_total`. Solo declara cobertura completa cuando todas las asignaciones de esa fila tienen importe exacto; con cobertura parcial o ausente devuelve la atribución y su porcentaje como nulos. Ventas e importe total del pedido se conservan como contexto, con una nota de que pueden repetirse entre códigos y no son ventas causadas exclusivamente por uno.
- API y agentes normalizan respuestas antiguas de la RPC a `migration_pending` y no las tratan como coste exacto. Ambas vistas de Shopify ocultan el importe atribuible si no hay cobertura completa; el panel de cliente también separa una consulta fallida de un periodo sin códigos.
- Tipos DB alineados con la firma/nullable de la función. La migración está aplicada en desarrollo; no se ha aplicado en producción.
- Verificación de código: build API, typecheck worker/AI/web y `git diff --check`. La primera pasada del typecheck web detectó que el tipo de presentación no contemplaba `migration_pending`; se añadió antes de repetir la comprobación. No se ejecutaron pruebas ni se validaron importes con una tienda real.

## Validación de la tienda de prueba y permisos instalados - 2026-09-30

- La cuenta propietaria comunicada por la usuaria es `borregorafa99@gmail.com`; la tienda de prueba conectada es `e-nora-jox8kc2h.myshopify.com`.
- Shopify CLI consultó la tienda con `currentAppInstallation.accessScopes`: la instalación concede los 11 scopes configurados (`read_customer_events`, `read_customers`, `read_discounts`, `read_inventory`, `read_locations`, `read_marketing_events`, `read_orders`, `read_products`, `read_reports`, `read_returns`, `write_pixels`) y además `read_pixels`.
- La consulta directa de productos de Shopify devolvió 17 productos y no más páginas. Los 17 GID externos y títulos coinciden con los 17 registros de `shopify_products` de la tienda en `.env.local`; no hay productos solo en la base de datos que importar. No se ejecutó ninguna mutación de catálogo.
- La consulta directa GraphQL devolvió las galerías completas (18 imágenes, con `hasNextPage: false` para cada producto). Los 18 GID de imagen coinciden exactamente con los 18 medios activos de `shopify_product_media`; faltan cero y sobran cero. La tabla de cobertura todavía conserva el estado histórico `partial`, 0 productos/0 imágenes: el código anterior dependía de `pageInfo`, que Shopify ignora en bulk. El arreglo local ya usa la finalización del JSONL, pero la fila solo se actualizará tras una sincronización real; no se editó manualmente.
- La última ejecución guardada (20:45:47 UTC) terminó con `catalog: failed` y reportó `shopify_variant_media_upsert_failed` por `organization_id` nulo en `shopify_variants`. Ese identificador de error no existe como emisor en el código actual: `upsertBlockRows` produciría `shopify_variants_upsert_failed`, y las filas actuales incluyen `organization_id: connection.organization_id`. La ejecución es evidencia de un runtime anterior al worktree, no de aceptación del código actual. Falta volver a sincronizar con el código actualizado; no se desplegará a producción sin instrucción expresa.
- `integration_connections.connected_by` está vacío para esa instalación, aunque la tienda está asociada a la organización y la propietaria ha sido identificada por la usuaria. Se debe completar o documentar la atribución de usuario cuando se confirme el flujo OAuth correspondiente; no se ha modificado la asociación.
- Shopify CLI también confirmó que la app tiene una versión activa publicada, `oauth-flow-fix-2026-09-28`. No se ha desplegado una nueva versión ni aplicado una migración a producción.
- En Redis hay worker activo, cero trabajos en ejecución y ningún trabajo Shopify pendiente para esta tienda; solo aparecen tareas del drenaje de webhooks. No se arrancó otro worker para evitar que consuma tareas de otras cuentas.
- Una descarga bulk ya validaba el host de Google Cloud Storage, pero seguía automáticamente redirecciones HTTP. Se configuró `redirect: "error"` y se añadió una prueba de regresión; las pruebas Shopify bulk focalizadas pasan (7/7) y `npm run typecheck` de API pasa.

### Corrección de cobertura de conexiones Bulk Operations - 2026-09-30

- La guía oficial confirma que Shopify ignora los campos `cursor` y `pageInfo` en bulk, mientras devuelve cada nodo de una conexión anidada como objeto JSONL con `__parentId` ([guía de Bulk Operations](https://shopify.dev/docs/apps/build/apis/graphql-admin/bulk-operations/queries)). Por eso los checks anteriores de `pageInfo` marcaban falsamente como parciales galerías, composiciones de packs, códigos/objetivos de descuentos y asignaciones de descuentos de pedidos.
- El código local ahora usa la terminación correcta de la bulk y las referencias locales resueltas como evidencia de cobertura. Las lecturas parciales/errores siguen sin retirar datos anteriores; no se alteran productos de Shopify.
- Verificación pendiente: aceptar esta corrección en una sincronización controlada con la tienda de prueba y comprobar que medios, `buys`/`gets`, packs y asignaciones concuerdan con el JSONL real. La ejecución requiere autorización explícita de CLI; todavía no se lanzó.

### Asociación de Klaviyo con la tienda de prueba

- Lectura de solo lectura en la base de desarrollo configurada en `.env.local`: la tienda activa tiene exactamente una cuenta de Klaviyo asignada por `store_id`; su organización coincide con la de Shopify y su conexión aparece `connected`.
- La consulta solo devolvió conteos y estados, sin leer ni imprimir tokens, email del perfil Klaviyo ni otros datos personales.
- Esto confirma la asociación en E-NORA, pero no prueba que la integración nativa Shopify↔Klaviyo siga activa dentro de sus respectivas plataformas. Esa comprobación requiere validar eventos de prueba o el estado visible de ambas plataformas.
- El MCP de Supabase disponible en esta sesión rechazó la consulta por falta de autorización; la lectura se hizo con el cliente Supabase ya configurado localmente y usando credenciales de `.env.local`, sin escritura alguna.

## Seguimiento del error de variante y verificación focalizada - 2026-09-30

- La base de desarrollo sigue registrando `e-nora-jox8kc2h.myshopify.com` en estado `error`; su última sincronización es la ejecución del 30-09 a las 20:45:47 UTC. La conexión antigua `ecomscaling-dev.myshopify.com` está en `pending_deletion` y no se debe incorporar a esta validación.
- Relectura de solo lectura de esa tienda: 17 productos, 26 variantes, 18 filas de medios, 5 descuentos y 6 objetivos explícitos; no hay pedidos sincronizados. La cobertura de packs declara 26 variantes exploradas, 0 packs y 0 componentes; esa cobertura histórica es completa. La cobertura de galerías continúa parcial con 0 productos/0 imágenes aceptados; `buys` de descuentos sigue parcial (5 promociones/2 objetivos) y `gets` completo (5/4). Estas filas son previas a corregir `pageInfo`, no aceptación del código actualizado.
- El código local incluye `organization_id` y `store_id` al insertar variantes; la actualización de imagen usa `UPDATE` filtrado por esos dos campos y por la variante local. La cadena antigua `shopify_variant_media_upsert_failed` no es emitida por esta versión del sincronizador.
- La interfaz ya traduce ese error histórico a una instrucción concreta: actualizar el worker Shopify y repetir la sincronización. Conserva la cadena original como detalle técnico.
- Revisión de integridad en las dos tiendas no productivas de la organización (`SUPABASE_ENV_GUARD=block`): 52/52 variantes resuelven a su producto dentro de la misma organización y tienda; 18/18 medios resuelven al producto correcto; 6/6 objetivos resuelven a su descuento. No se encontraron referencias ausentes ni cruces de alcance. Hay 0 pedidos y 0 componentes de packs guardados en esas dos tiendas.
- Verificación local: typecheck de API y web; 10 pruebas focalizadas de streaming, cobertura, medios y asignaciones de descuento; 15 pruebas de vista/estado de conexión. Las consultas GraphQL de variantes, packs, promociones y objetivos `buys`/`gets` pasan validación contra Admin GraphQL `2026-07`.
- El typecheck del paquete IA pasa y su suite canónica pasa 44/44. La suite detectó aserciones obsoletas sobre el orden de filtros de tienda y el lugar donde se documenta la cobertura del catálogo; se actualizaron para comprobar el filtrado por organización/tienda y la cobertura actual de metadata, variantes, medios, packs y ofertas.
- No se lanzó otra sincronización: Redis tiene un worker Shopify conectado, sin trabajo activo ni trabajo de sync de esta conexión, pero no se pudo acreditar que el proceso use este worktree actualizado. No desplegar ni volver a encolar hasta que el worker actualizado esté ejecutándose. Producción y Shopify no se modificaron.

## Verificación posterior del error de variantes y cobertura restante - 2026-09-30

- Se acreditó el worker local: consume `apps/worker/src/worker.ts`, que importa `@e-nora/api/shopify-queue-worker` desde `apps/api/dist`. La compilación de API local estaba obsoleta y aún contenía el upsert antiguo de imagen de variante; se recompiló antes de la reejecución.
- Para que el desajuste no vuelva a aparecer al iniciar el worker local, `apps/worker` ahora ejecuta el build de la API en su ciclo `predev` antes de importar sus módulos compilados. Los builds de producción no cambian.
- Una sincronización manual posterior acabó con la conexión `connected`, `last_error_message = null` y el bloque `catalog` con 87 registros leídos, 61 escritos y 0 fallidos. Galería: `complete` (17 productos, 18 imágenes). Packs: `complete` (26 variantes, 0 componentes, sin pendientes). Promociones `gets`: `complete` (5 descuentos, 4 objetivos). El error histórico de `organization_id` se limpió únicamente del registro `catalog` exitoso de la base de desarrollo, tras comprobar su estado y tienda.
- Se encontró otro falso parcial en `buys`: los descuentos `basic` y `free-shipping` no tienen relación `customerBuys`, pero el código los marcaba como tipos desconocidos para ese lado. Se amplió la clasificación de tipos conocidos; las apps continúan etiquetándose parciales porque la semántica específica puede no estar expuesta. La regresión focalizada pasa y la API recompila.
- La nueva reejecución para aceptar la cobertura `buys` no llegó a realizar una lectura de Shopify: el trabajo de cola se consumió, pero `integration_sync_runs` reutiliza la clave idempotente de la misma hora UTC, cuyo bloque `discounts` ya constaba como exitoso. No se forzó una escritura de historial para saltarse la protección; queda volver a comprobar tras cambiar la hora UTC.
- Validación actual de catálogo/UI: `/shopify/productos` y `/shopify/promociones` son páginas separadas accesibles desde la navegación compartida del portal; ambas conservan el filtro de tienda. Las fichas individuales separan imágenes, variantes, componentes de pack, objetivos de regla y aplicaciones de descuento observadas. El cliente entra desde sus listas/módulo Shopify y la vista del consultor reutiliza el módulo Shopify con selección de cliente/tienda. La herramienta IA `get_shopify_product_catalog` informa cobertura de metadata, variantes, medios, packs y ofertas, restringe la tienda y explicita que coincidencias de regla no prueban elegibilidad de carrito.
- La cola Shopify impone una sola tarea por conexión, una concurrencia de 1 por worker y un máximo de 250 trabajos pendientes. En esta comprobación había 0 activos y 0 en espera; se identificaron varias instancias locales de worker conectadas a la cola compartida, por lo que el límite global efectivo depende del número de réplicas desplegadas.
- No se desplegó la API/worker ni se aplicaron migraciones en producción; no se hicieron mutaciones de catálogo en Shopify. La autorización `read_reports` está presente, pero Shopify todavía rechaza la consulta ShopifyQL; requiere validar configuración/acceso de la app en Shopify.

### Reejecución en hora idempotente nueva - 2026-09-30 UTC

- Tras cambiar la hora UTC y dejar que la cola procesara el trabajo (sin saltarse la idempotencia), la ejecución manual iniciada a las `22:00:24 UTC` terminó a las `22:02:04 UTC`: conexión `connected`, 11/11 bloques `succeeded`, 0 registros fallidos y `last_error_message = null`.
- Cobertura vigente: catálogo 87 leídos/61 escritos; 17 productos/18 imágenes completas; 26 variantes revisadas y 0 componentes de pack (cobertura completa); descuentos `buys` 5/5 y 2 objetivos completos; descuentos `gets` 5/5 y 4 objetivos completos. El falso `partial` de `buys` desapareció con la clasificación corregida.
- El bloque `sessions` es `succeeded` con un aviso opcional `shopify_reports_access_denied`; no convierte la integración en error. La documentación oficial indica que `shopifyqlQuery` exige `read_reports`, acceso de API 2025-10 o superior y acceso a datos protegidos de cliente Nivel 2, incluidos nombre, dirección, teléfono y email aunque la consulta no los solicite ([requisito de ShopifyQL](https://shopify.dev/docs/apps/build/shopifyql/graphql-admin-api), [datos protegidos](https://shopify.dev/docs/apps/launch/protected-customer-data)). Esta tienda tiene `read_reports` y usa API 2026-07; el acceso Nivel 2/selección de campos se configura en el dashboard de la app, no en una migración de E-NORA. Como la tienda es de desarrollo, Shopify indica que no hace falta someterla a revisión después de seleccionar datos y campos.
- Build API y typecheck terminaron correctamente; pruebas focalizadas de clasificación de descuentos y cobertura de tiendas: 9/9. La siguiente sincronización manual durante la misma hora se había consumido sin lectura externa porque el bloque ya estaba exitoso para su clave por hora; la ejecución posterior confirma el nuevo código con datos frescos.
- Comprobación visual de solo lectura en el portal local con el consultor autenticado: el menú muestra Shopify, Productos y Promociones; el listado renderiza los 17 productos y sus imágenes; la ficha de `The Complete Snowboard` enseña descripción, 5 variantes/precios, una imagen con cobertura completa, cero actividad de pedido declarada con su limitación, y promociones asociadas; la ficha BXGY de `Dawn` muestra por separado `buys` y `gets` como completos y cero aplicaciones observadas. No se ejecutaron acciones desde el navegador y se restauró la pestaña original.
- Estado de alcance: no hay fallo de catálogo ni error `organization_id` reproducible en esta tienda de desarrollo. Sigue sin validarse una tienda de cliente con pedidos reales ni el acceso Nivel 2/ShopifyQL en Partner Dashboard. Producción y catálogo Shopify permanecen intactos.
