# Shopify: capacidades, límites y propuesta para E-NORA

Fecha de corte: **19 de octubre de 2026**. Investigación de documentación oficial de Shopify y documentación primaria de navegador/Playwright. Este documento describe viabilidad y propuesta; no certifica que las capacidades estén implementadas ni concedidas a una tienda concreta.

## 1. Conclusión de producto

Es viable que E-NORA tenga páginas propias de **Catálogo**, **Inventario**, **Promociones**, **Códigos de descuento**, **Popups y formularios** y **Web y revisiones**. La interfaz puede presentar los datos de Shopify y ejecutar operaciones que su API, los permisos concedidos y el plan de la tienda permitan. La propuesta debe centrarse en tareas completas y verificables; «controlar todo Shopify» no constituye un alcance técnico garantizable.

La oportunidad diferencial de E-NORA es unir disponibilidad real de cada variante, previsión por periodos y campañas, márgenes y decisiones de marketing. La aplicación no debe confundir una propuesta de compra al proveedor con un ajuste de existencias en Shopify.

## 2. Evidencia local comprobada

| Evidencia | Estado encontrado | Implicación |
| --- | --- | --- |
| `shopify.app.toml`, `[access_scopes]` | `read_customer_events,read_customers,read_discounts,read_inventory,read_locations,read_marketing_events,read_orders,read_products,read_reports,read_returns,write_pixels` | La app declarada está orientada a lectura y medición. No declara escritura de productos, inventario, descuentos o contenido. |
| `shopify.app.toml`, comentario de scopes | `read_all_orders` retirado hasta aprobación de Shopify | El histórico anterior a 60 días no se debe dar por accesible. |
| `apps/api/src/shopify-client.ts`, `SHOPIFY_API_VERSION` | Variable de entorno opcional; valor por defecto `2026-07` | No asumir que funciones añadidas en `2026-10` funcionan con el cliente actual. |
| `shopify.app.toml`, `[webhooks]` | `api_version = "2026-07"` | La versión de eventos también requiere planificación al evolucionar el contrato. |
| `apps/web/src/components/portal-navigation.ts` | `/shopify`, `/shopify/productos` y `/shopify/promociones` dentro de «Analítica» | El menú mezcla fuentes analíticas con gestión de recursos. |
| `apps/api/src/shopify-overview.ts`, `shopifyDatasetCatalog` | Descuentos y marketing events como datasets activos; devoluciones detalladas como `planned` | Una tabla o scope declarado no prueba sincronización ni una pantalla operativa completa. |
| `packages/contracts/src/index.ts`, `SHOPIFY_SCOPES_USED` | Incluye `read_files` como permiso de galería; TOML comenta que `Product.media` usa `read_products` | Hay mensajes de capacidad que requieren reconciliación con operaciones reales. No pedir acceso global a ficheros por una galería básica. |

**Límite de esta evidencia:** la configuración del repositorio no demuestra scopes efectivamente concedidos, estado de una Access request, aprobación de datos protegidos, versión de la variable desplegada ni datos presentes en cada tienda. La aplicación debe consultar y enseñar su capacidad efectiva por conexión.

## 3. Páginas propias que sí tienen sentido

Las rutas siguientes son una **propuesta**, salvo las tres rutas existentes indicadas arriba.

| Página | Lectura y valor para el usuario | Escritura razonable | Dependencia y límite |
| --- | --- | --- | --- |
| `/shopify/productos` — Catálogo | Productos, variantes, SKU, precios, estado, colecciones y galería; búsqueda y ficha de producto | Editar título, descripción, precios, variantes y estado, con alcance explícito | `read_products` / `write_products`; capacidades exactas por operación. No equivale a reproducir todos los editores del Admin. [Productos](https://shopify.dev/docs/api/admin-graphql/2026-07/mutations/productCreate) |
| `/shopify/inventario` — Inventario | Disponible por variante y ubicación, no rastreado, agotados, cobertura, próximas entradas | Ajustes y transferencias cuando estén autorizados; propuesta de compra separada | Inventario multinivel, fuente de verdad, concurrencia y ubicaciones. [InventoryItem](https://shopify.dev/docs/api/admin-graphql/2026-07/objects/InventoryItem) · [Transferencias](https://shopify.dev/docs/api/admin-graphql/2026-07/mutations/inventoryTransferCreate) |
| `/shopify/promociones` — Promociones | Ofertas automáticas, calendario comercial, productos afectados y objetivos | Crear/editar descuentos automáticos nativos; programar acciones propias de E-NORA | `write_discounts`; una campaña comercial de E-NORA puede coordinar varios recursos, no es un único objeto universal Shopify. [Descuentos](https://shopify.dev/docs/apps/build/discounts) |
| `/shopify/descuentos` — Códigos | Código, vigencia, condiciones, estado y usos disponibles | Crear/editar/activar/desactivar códigos soportados | Mismo dominio de descuentos que las promociones automáticas; interfaces distintas para una tarea más clara. [Código básico](https://shopify.dev/docs/api/admin-graphql/2026-07/mutations/discountCodeBasicCreate) |
| `/shopify/popups` — Popups y formularios | Inventario unificado de formularios propios y de proveedores conectados; procedencia visible | Crear/configurar los de E-NORA; editar externos solo con API oficial adecuada | Una Theme App Extension propia permite desplegar el componente. El comerciante activa el app embed. No existe garantía de acceso a todos los popups ajenos. [Extensiones](https://shopify.dev/docs/apps/build/online-store/theme-app-extensions) |
| `/shopify/web` — Web y revisiones | URL, capturas móvil/escritorio, lista de páginas y auditorías con evidencia | Propuestas de contenido y cambios admitidos; publicación diferenciada | Vista real y auditoría son viables; iframe y editor universal tienen límites. Ver sección 7. |
| `/shopify/analitica` — Analítica | Ventas, devoluciones, productos, clientes y embudo con cobertura explícita | Informes guardados propios | No confundir métricas calculadas sobre pedidos con sesiones/conversión o atribución. [ShopifyQL](https://shopify.dev/docs/apps/build/shopifyql/graphql-admin-api) |

La ficha de producto debe reunir variantes, stock por ubicación, evolución de ventas, promociones, activos creativos y recomendaciones. Los módulos Meta y Klaviyo enlazan a esta identidad comercial compartida; no deben crear catálogos maestros divergentes.

## 4. Inventario: lo que permite Shopify y lo que debe construir E-NORA

Shopify relaciona artículo de inventario, variante y niveles por ubicación. Sus cantidades tienen estados distintos. E-NORA debe preservar esa distinción y evitar sumar unidades comprometidas o entrantes como si estuvieran disponibles hoy. El coste unitario también puede depender de permisos granulares. [Modelo de inventario](https://shopify.dev/docs/api/admin-graphql/2026-07/objects/InventoryItem)

El cliente actual permite diseñar lectura de stock; para ajustarlo se necesita escritura y reglas de concurrencia. `inventorySetQuantities` está pensado para el sistema que actúa como fuente de verdad, con comparación de cantidades. Para otros ajustes debe evaluarse `inventoryAdjustQuantities`. Una recomendación de reposición no autoriza a aumentar artificialmente la cantidad vendible. [Establecer cantidades](https://shopify.dev/docs/api/admin-graphql/2026-07/mutations/inventorySetQuantities)

**Cambio relevante disponible en la fecha de corte:** Shopify anunció el 17-09-2026 lectura pública de órdenes de compra en Admin API `2026-10`: `inventoryPurchaseOrder` e `inventoryPurchaseOrders`, con `read_inventory_purchase_orders`. Las transferencias enlazadas requieren `read_inventory_transfers`. El lanzamiento es de **solo lectura**, sin mutaciones de órdenes de compra. E-NORA usa por defecto `2026-07`; se necesita una actualización deliberada y nuevos permisos antes de aprovecharlo. No basar el roadmap en mutaciones de previews inestables. [Anuncio oficial](https://shopify.dev/changelog/posts/purchase-order-read-api)

Shopify ya admite transferencias en la API estable consultada. Esto permite considerar gestión de movimientos entre ubicaciones, con su contrato de permisos y estados. No resuelve por sí solo compras a proveedores, fabricación, mínimos de compra o confirmación de fechas. [Crear transferencia](https://shopify.dev/docs/api/admin-graphql/2026-07/mutations/inventoryTransferCreate)

### Contrato de salida del agente de stock propuesto

La siguiente estructura es una recomendación de diseño E-NORA, no una capacidad predictiva que Shopify entregue calculada:

1. **Producto y variante identificados**: nombre, SKU/ID, talla/color y ubicación.
2. **Qué queda**: unidades disponibles y hora exacta de lectura; separar comprometido y entrante.
3. **Qué se espera vender**: demanda antes, durante y después del evento, escenario central y rango.
4. **Cuándo puede agotarse**: fecha estimada y riesgo; no mostrar certeza si la previsión es incierta.
5. **Qué hacer**: cantidad de reposición, fecha máxima de pedido y recepción necesaria.
6. **Por qué**: histórico comparable, ventas recientes, campaña confirmada, plazo del proveedor y stock de seguridad.
7. **Acción concreta**: abrir el producto/inventario, crear tarea de compra o borrador para proveedor; nunca fingir que la compra ya se ejecutó.

Ejemplo **hipotético** de presentación, sin usar datos de una tienda real:

> «Sudadera Arena · talla M: quedan 30 unidades disponibles, sincronizadas hace 8 minutos. El escenario central prevé vender 20 antes y durante Black Friday y 18 en los 14 días siguientes; faltarían 8 para terminar ese periodo. Con 7 unidades de seguridad, la propuesta es pedir 15 y recibirlas antes del evento. El proveedor tarda 10 días y no hay entradas confirmadas.»

Si el stock está desactualizado, la primera acción es sincronizar. Si faltan comparables, el agente puede mostrar escenarios con supuestos editables. Si falta plazo del proveedor, puede proponer cantidad provisional y pedir ese dato; no inventar una fecha de compra «última». La cifra de cobertura y la recomendación deben proceder de cálculos reproducibles, mientras el modelo explica el resultado.

Datos que E-NORA debe obtener de Shopify, proveedor, ERP o usuario: variantes/ubicaciones, ventas por día, cancelaciones/devoluciones, periodos sin stock, entradas con ETA confirmada, plazo y variabilidad del proveedor, mínimos/múltiplos, calendario de campañas confirmado, elasticidad solo cuando exista evidencia. La demanda censurada por agotados y el canibalismo entre variantes requieren tratamiento propio.

## 5. Descuentos, promociones, Functions y checkout

Los descuentos nativos pueden ser automáticos o por código. E-NORA puede disponer de formularios distintos que escriban a un modelo común, con vigencia, productos elegibles, mínimos y límites que cada tipo soporte. Condiciones complejas requieren estudiar Shopify Functions, no prometer que cualquier regla de negocio puede convertirse en un descuento básico. [Guía de descuentos](https://shopify.dev/docs/apps/build/discounts)

La disponibilidad de Functions depende de la distribución de la app y del API concreto: las apps públicas distribuidas mediante Shopify App Store pueden ofrecer Functions en planes admitidos; las **apps custom con Functions requieren Shopify Plus**. Algunas capacidades tienen restricciones adicionales. Confirmar qué distribución utiliza realmente E-NORA antes de prometerlas. [Disponibilidad de Functions](https://shopify.dev/docs/apps/build/functions)

Las extensiones visuales de checkout para los pasos de información, envío y pago requieren **Shopify Plus**. Las de agradecimiento/estado del pedido tienen una disponibilidad distinta; la documentación excluye Starter. No ofrecer «editar cualquier parte del checkout» en todos los planes. [Tecnologías de checkout](https://shopify.dev/docs/apps/build/checkout/technologies)

La sección Promociones de E-NORA puede añadir valor propio: calendario común, conflicto entre descuentos, margen esperado, coherencia entre banner/código/email/anuncio y seguimiento posterior. Son funciones de nuestro producto; su ejecución debe resolverse recurso por recurso y registrar éxitos parciales.

## 6. Popups y formularios: propiedad y proveedor

Una implementación propia puede usar app embed para ventanas flotantes, reglas de visualización, captura de leads, pruebas y métricas. Debe indicar dónde está instalado, estado de activación y tema soportado. Los app blocks y app embeds tienen flujos de activación/configuración en el editor; el SaaS debe acompañar ese paso del comerciante. [Configuración de extensiones](https://shopify.dev/docs/apps/build/online-store/theme-app-extensions/configuration) · [UX oficial](https://shopify.dev/docs/apps/build/online-store/theme-app-extensions/ux)

**Shopify Forms** es una app concreta con su propio editor; existen formularios popup e inline. Esta revisión no ha encontrado documentación oficial de un CRUD público para crear/editar todos sus formularios desde Admin GraphQL. Esto es una **limitación de capacidad verificada en la documentación consultada**, no una prueba universal de inexistencia futura. Mantener enlace al editor y evaluar métricas expuestas separadamente; no construir sobre endpoints internos. [Shopify Forms](https://help.shopify.com/en/manual/promoting-marketing/create-marketing/forms-app/create)

Lo mismo aplica a popups de Klaviyo u otros proveedores: no se administran por el hecho de estar insertados en Shopify. La fila debe mostrar `provider`, identificador remoto, capacidades de lectura/escritura y destino correcto. El popup canónico debe tener un único dueño para evitar dos editores y dobles publicaciones.

## 7. Ver la tienda y permitir que un agente la revise

**Factible y recomendable:** una pantalla con URL, modo móvil/escritorio, capturas recientes, navegación capturada y hallazgos anclados a una página. Un navegador automatizado puede generar capturas y extraer evidencia durante una sesión aislada. Esto es una arquitectura propuesta; requiere un servicio propio de navegación/captura, no viene incluido en el token Admin Shopify. [Capturas](https://playwright.dev/docs/screenshots) · [Contextos aislados](https://playwright.dev/docs/api/class-browsercontext)

**Iframe interactivo: condicionado.** La tienda o un recurso pueden impedir ser embebidos mediante `X-Frame-Options` o CSP. Aunque el iframe se vea, la política de mismo origen restringe el acceso al DOM desde E-NORA. No usar el simple iframe como supuesto motor de auditoría. [Política de mismo origen](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Same-origin_policy) · [X-Frame-Options](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Frame-Options)

La vista debe ofrecer tres modos según compatibilidad: captura navegable con evidencias; vista embebida cuando funcione; abrir la web en otra pestaña. Una sesión remota con interacción y retransmisión visual también es factible, con mayor coste y complejidad. No garantizar que reproduzca todas las personalizaciones, cookies, mercados, consentimiento o aplicaciones de un visitante real.

Para temas no publicados, Shopify permite compartir una vista previa; las sesiones protegidas necesitan acceso autorizado y caducan según su mecanismo. El agente debe diferenciar web pública, vista previa y sesión autenticada. No capturar credenciales o datos de clientes en los informes. [Vistas previas de temas](https://help.shopify.com/en/manual/online-store/themes/adding-themes) · [Autenticación del navegador](https://playwright.dev/docs/auth)

**Auditar no equivale a editar.** Leer contenido y proponer cambios es viable; publicar páginas puede usar las operaciones de contenido correspondientes. Modificar archivos de tema mediante `themeFilesUpsert` exige `write_themes` y una exención de Shopify. No diseñar un editor universal del tema dependiente de conseguir esa exención. Priorizar contenidos admitidos, extensiones propias y enlaces al editor nativo. [Crear página](https://shopify.dev/docs/api/admin-graphql/latest/mutations/pageCreate) · [Archivos del tema](https://shopify.dev/docs/api/admin-graphql/latest/mutations/themeFilesUpsert)

Las capturas y el contenido web deben tratarse como datos no confiables para el agente. Una recomendación debe enlazar evidencia y proponer un cambio concreto; la publicación debe mantener alcance, trazabilidad y autorización aplicables a la acción.

## 8. Analítica y permisos que afectan al producto

El acceso ordinario a pedidos cubre los últimos 60 días. Para periodos anteriores se requiere `read_all_orders` junto al acceso de pedidos y la aprobación correspondiente. Un análisis de Black Friday del año anterior debe declarar si dispone de esos datos o de un histórico persistido lícitamente, en vez de asumir acceso. [Permisos de pedidos](https://shopify.dev/docs/api/usage/access-scopes)

Los datos de pedidos/clientes también están sujetos al régimen de datos protegidos. El nivel 1 excluye nombre, dirección, teléfono y email; el nivel 2 incluye esos campos y requiere medidas adicionales. No basta añadir un scope a la configuración. [Datos de clientes protegidos](https://shopify.dev/docs/apps/launch/protected-customer-data)

La API de ShopifyQL requiere `read_reports`, **acceso de nivel 2 a datos protegidos** y Admin API `2025-10` o posterior. Por tanto, la app debe diagnosticar algo más que la presencia de `read_reports` cuando falten sesiones o conversión. La posibilidad de consultar una métrica y su cobertura deben verificarse por tienda y consulta. [ShopifyQL vía GraphQL](https://shopify.dev/docs/apps/build/shopifyql/graphql-admin-api)

El límite GraphQL se calcula por coste y por pareja aplicación/tienda, con capacidad según plan. La expansión a más pantallas debe apoyarse en sincronización, paginación, caché, colas y actualización selectiva, sin pedir todos los recursos en cada carga del dashboard. [Límites GraphQL](https://shopify.dev/docs/apps/build/apis/graphql-admin/rate-limits)

## 9. Áreas adicionales: alcance de descubrimiento, no promesas de paridad

El índice oficial incluye pedidos, fulfillment, devoluciones, clientes, colecciones, mercados, B2B, medios, traducciones, metadatos y pagos. La existencia de un dominio en el índice no implica acceso a todas las operaciones del Admin ni disponibilidad en todos los planes. [Índice Admin GraphQL](https://shopify.dev/docs/api/admin-graphql/2026-07)

| Área | Qué merece E-NORA | Qué cerrar antes de comprometer entrega |
| --- | --- | --- |
| Pedidos y devoluciones | Lista de incidencias, impacto en rentabilidad y vínculo a producto/cliente | Sincronización real de devoluciones, scopes y permisos; reembolsar/cancelar es una operación distinta de leer. |
| Clientes y segmentos | Cohortes y cruce de valor/retención con Klaviyo | Identidad, consentimiento, campos protegidos y correspondencia entre fuentes. |
| Colecciones y merchandising | Coherencia de catálogo, visibilidad y clasificación | Operaciones exactas, publicación en canales y planes relevantes. |
| Medios de producto | Auditoría de imágenes y mejora de fichas | Para carga/gestión del sistema de ficheros se requieren permisos y tratamiento de procesamiento asíncrono. [Medios](https://shopify.dev/docs/apps/build/product-merchandising/products-and-collections/manage-media) |
| Web, contenido y SEO | Páginas, auditoría visual y propuestas de mejora | CRUD de contenido admitido frente a edición de tema o de aplicaciones externas. |
| Markets, idiomas y B2B | Diagnóstico de consistencia comercial por mercado | Disponibilidad del plan y APIs específicas; no convertirlos en MVP por aparecer en Shopify. |
| Suscripciones, fidelización y reseñas | Ver señales relevantes cuando exista integración | Distinguir APIs nativas, contratos accesibles y datos de apps proveedoras. Una app no obtiene control de las demás. |
| Pagos, cuentas bancarias y configuración administrativa | Enlaces y lectura mínima cuando sea útil y esté permitida | Son superficies con autorizaciones y restricciones propias; fuera del alcance inicial de catálogo/stock/marketing. |

## 10. Orden recomendado y criterios de aceptación

1. **Resolver navegación y capacidades**: distinguir gestión Shopify de analítica; enlaces de alertas a un recurso concreto y filtro conservado. Una pantalla debe explicar ausencia de conexión, permiso, sincronización o datos.
2. **Separar Catálogo e Inventario** conservando la ficha compartida. Inventario muestra variantes, ubicaciones y frescura. Una alerta de agotado abre exactamente los agotados de su tienda; el total debe cuadrar.
3. **Agente de stock útil**: cálculo reproducible por SKU, horizontes de campaña, proveedores/entradas, escenarios y propuesta accionable. Bloquear consejo concluyente con stock obsoleto y mostrar el siguiente paso.
4. **Promociones y Códigos**: primero lectura depurada; después escritura mediante `write_discounts`, vista previa de condiciones y registro del resultado remoto.
5. **Web y revisiones**: piloto de capturas móvil/escritorio y evidencia por URL antes de un navegador remoto completo. Validar temas públicos, previews y bloqueos de iframe con fallbacks.
6. **Popups**: decidir proveedor y propiedad antes de crear el editor. Si son propios, extensión instalable, activación verificada, borrador/publicación, consentimiento y medición.
7. **Ampliaciones**: adopción evaluada de `2026-10` para órdenes de compra en lectura; otras áreas solo tras validar APIs, permisos, planes y demanda de usuarios.

Para cada módulo registrar por tienda: `read`, `write`, `preview`, `publish`, fuente, versión, scopes concedidos, requisitos del plan, última sincronización, cobertura histórica y enlace nativo de respaldo. Estos campos forman un contrato de capacidades propuesto para E-NORA; deben derivarse de comprobaciones reales.

## 11. Incertidumbres que deben cerrarse durante implementación

- Distribución efectiva de la app Shopify, estado de revisión y accesos aprobados en Partner/Dev Dashboard.
- Versión Admin y scopes efectivamente utilizados por cada entorno/instalación, que pueden diferir del TOML.
- Cobertura por tienda de ShopifyQL, atribución y datos protegidos.
- CRUD público disponible en el proveedor elegido para formularios; no confundir analítica de Forms con edición de Forms.
- Compatibilidad de la tienda real con embedding y de sus previews con sesiones autorizadas.
- Integración del ERP/proveedor para compras: la API pública de órdenes de compra de `2026-10` es de lectura; proveedor, MOQ y lead time no se deben inventar.

No se han cambiado funcionalidades de la app ni se ha ejecutado ninguna escritura en una tienda. El trabajo de este anexo es investigación documental y lectura de configuración/código local.
