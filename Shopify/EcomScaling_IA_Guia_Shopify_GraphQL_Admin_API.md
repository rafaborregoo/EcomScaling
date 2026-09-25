# E-NORA IA

## Aplicación en E-NORA

Esta guía debe leerse junto con el [objetivo global del SaaS y sus criterios de terminado](../docs/OBJETIVO_SAAS_PILOTO_Y_CRITERIOS_DE_TERMINADO.md):
Shopify es la integración operativa del piloto y debe seguir siendo la referencia para validar conexión,
sincronización, métricas, webhooks, reconciliación, diagnósticos y uso semanal con una cuenta real.
Guía técnica de integración  
Shopify GraphQL Admin API

Qué es GraphQL, cómo funciona, cómo se autentica la aplicación, cómo se sincronizan los datos y cómo se conecta todo con Supabase.

> **Alcance del documento**
>
> La guía cubre todas las superficies de Shopify relevantes para E-NORA IA: tienda, productos, variantes, inventario, ubicaciones, pedidos, líneas, clientes pseudonimizados, reembolsos, fulfillment, analítica, operaciones masivas, webhooks, permisos, límites y versionado. No pretende enumerar módulos de Shopify ajenos al producto, como POS, B2B, themes o facturación de aplicaciones.

**Versión del análisis: Shopify Admin API 2026-07**

Documento preparado para validar la arquitectura de base de datos antes de generar migraciones reales en Supabase.

# Contenido

- 1\. Qué es GraphQL y por qué Shopify lo utiliza

- 2\. Diferencias prácticas entre GraphQL y REST

- 3\. Cómo se estructura una petición GraphQL

- 4\. Autenticación y conexión de una tienda

- 5\. Arquitectura de integración propuesta

- 6\. Sincronización inicial y actualizaciones incrementales

- 7\. Operaciones de Shopify necesarias por dominio

- 8\. Inventario real de Shopify

- 9\. Pedidos, clientes, privacidad y reembolsos

- 10\. Analítica, ShopifyQL y tráfico de producto

- 11\. Límites, paginación, errores y versionado

- 12\. Mapeo con Supabase y reglas de seguridad

- 13\. Ejemplos de consultas

- 14\. Decisiones pendientes antes del desarrollo

- 15\. Referencias oficiales

# 1. Qué es GraphQL y por qué Shopify lo utiliza

GraphQL es un lenguaje de consulta para APIs y, al mismo tiempo, un contrato tipado que describe qué objetos, campos y operaciones ofrece un servidor. La aplicación cliente indica exactamente qué datos necesita y Shopify devuelve únicamente esos campos.

> **Idea fundamental**
>
> En Shopify GraphQL no existe una URL distinta para productos, otra para pedidos y otra para inventario. La mayoría de las operaciones se envían mediante POST a un único endpoint versionado. Lo que cambia es la query o mutation incluida en el cuerpo de la petición.

```http
POST https://{tienda}.myshopify.com/admin/api/2026-07/graphql.json
```

Para E-NORA IA esto permite consultar en una sola operación un producto, sus variantes, el InventoryItem asociado y los niveles de inventario de cada ubicación, seleccionando solo los campos necesarios.

## Conceptos básicos

| **Concepto** | **Significado**                               | **Aplicación en E-NORA IA**                                                        |
|--------------|-----------------------------------------------|-----------------------------------------------------------------------------------------|
| Schema       | Contrato tipado de la API.                    | Permite conocer objetos, campos, relaciones, argumentos y tipos antes de programar.     |
| Query        | Operación de lectura.                         | Leer tienda, productos, pedidos, inventario, clientes o analítica.                      |
| Mutation     | Operación que cambia datos o inicia procesos. | Registrar webhooks o iniciar una bulk operation. El MVP será principalmente de lectura. |
| Object       | Entidad del dominio.                          | Product, ProductVariant, InventoryItem, InventoryLevel, Location, Order o Refund.       |
| Field        | Dato seleccionado dentro de un objeto.        | title, sku, unitCost, currentTotalPriceSet o updatedAt.                                 |
| Connection   | Lista paginada de objetos.                    | products, orders, inventoryLevels o lineItems.                                          |
| Edge / node  | Estructura habitual de las listas GraphQL.    | node contiene el objeto y edge puede contener el cursor de paginación.                  |
| GID          | Identificador global de Shopify.              | Ejemplo: gid://shopify/Product/123. Debe almacenarse como texto.                        |
| Variables    | Valores enviados separadamente de la query.   | IDs, cursores, fechas y filtros sin concatenar strings inseguros.                       |

# 2. Diferencias prácticas entre GraphQL y REST

| **Aspecto** | **REST tradicional**                      | **GraphQL Admin API**                        |
|-------------|-------------------------------------------|----------------------------------------------|
| Endpoints   | Múltiples URLs por recurso.               | Un endpoint principal versionado.            |
| Campos      | El servidor decide la respuesta completa. | La aplicación selecciona los campos.         |
| Relaciones  | Suelen requerir varias peticiones.        | Se pueden anidar relaciones controladamente. |
| Paginación  | Página o cursor según endpoint.           | Conexiones con first/after y pageInfo.       |
| Límites     | Frecuentemente por número de llamadas.    | Shopify calcula el coste de la query.        |
| Evolución   | Cambios por endpoint/versiones.           | Schema tipado y versiones trimestrales.      |

La REST Admin API de Shopify es una tecnología heredada para aplicaciones nuevas. La arquitectura de E-NORA IA debe construirse sobre GraphQL Admin API, utilizando librerías oficiales cuando sea posible.

# 3. Cómo se estructura una petición GraphQL

## 3.1 Petición HTTP

POST /admin/api/2026-07/graphql.json  
Content-Type: application/json  
X-Shopify-Access-Token: {offline_access_token}  
  
{  
"query": "query GetShop { shop { id name currencyCode ianaTimezone } }"  
}

La respuesta tiene normalmente un objeto data. Los errores de validación o ejecución pueden aparecer en errors. Las mutations también devuelven userErrors específicos del negocio, por lo que no basta con comprobar el código HTTP.

## 3.2 Query, variables y respuesta

query GetProduct(\$id: ID!) {  
product(id: \$id) {  
id  
title  
status  
variants(first: 50) {  
nodes {  
id  
title  
price  
inventoryItem { id sku tracked unitCost { amount currencyCode } }  
}  
}  
}  
}  
  
Variables: { "id": "gid://shopify/Product/123" }

> **Regla de implementación**
>
> Las queries deben tener nombre, utilizar variables y seleccionar únicamente los campos que se vayan a persistir o utilizar. No conviene crear una query gigantesca que intente descargar todo Shopify en cada ejecución.

## 3.3 Paginación con cursores

```graphql
query Products(\$after: String) {  
products(first: 100, after: \$after, sortKey: UPDATED_AT) {  
nodes { id title updatedAt }  
pageInfo { hasNextPage endCursor }  
}  
}

Mientras pageInfo.hasNextPage sea true, el backend repite la consulta enviando endCursor como variable after. Para importaciones muy grandes se utilizarán operaciones masivas en lugar de paginar manualmente todo el catálogo o el histórico de pedidos.
```
# 4. Autenticación y conexión de una tienda

Cada tienda debe autorizar expresamente a E-NORA IA. El token nunca debe enviarse al navegador ni guardarse en texto plano en una tabla pública.

## 4.1 Flujo de conexión

1.  El cliente pulsa “Conectar Shopify” dentro de E-NORA IA.

2.  El backend inicia la instalación/autorización de la aplicación de Shopify.

3.  Shopify muestra al comerciante los permisos solicitados.

4.  El comerciante autoriza la aplicación.

5.  El backend valida la petición y obtiene un access token.

6.  El token se cifra y se guarda en private.integration_credentials.

7.  Se consulta shop para identificar la tienda.

8.  Se registran webhooks y comienza la sincronización inicial.

## 4.2 Offline access token

E-NORA IA necesita ejecutar sincronizaciones y alertas aunque el usuario no tenga una sesión abierta. Por eso la integración debe utilizar acceso offline. Shopify admite tokens offline no expirables y, en arquitecturas recientes, tokens offline expirables con mecanismo de renovación. La base de datos debe contemplar access token, refresh token, fecha de expiración y versión de cifrado.

## 4.3 Scopes mínimos previstos

| **Scope**                           | **Motivo**                                                             |
|-------------------------------------|------------------------------------------------------------------------|
| read_products                       | Productos, variantes y parte de InventoryItem.                         |
| read_inventory                      | InventoryItem, InventoryLevel y cantidades por ubicación.              |
| read_locations                      | Ubicaciones de inventario y fulfillment.                               |
| read_orders                         | Pedidos recientes, líneas, descuentos, pagos y reembolsos.             |
| read_all_orders                     | Histórico superior al periodo estándar. Requiere aprobación adicional. |
| read_customers                      | Clientes mínimos necesarios para recurrencia. Debe minimizarse la PII. |
| read_reports                        | ShopifyQL y analítica avanzada. Requiere requisitos adicionales.       |
| write_pixels / read_customer_events | Solo si se instala Web Pixel para tráfico de producto.                 |

# 5. Arquitectura de integración propuesta

Cliente conecta Shopify  
↓  
OAuth / token exchange  
↓  
Token cifrado en schema private  
↓  
Query shop + registro de la conexión  
↓  
Bulk import inicial  
↓  
Upserts en Supabase  
↓  
Webhooks incrementales  
↓  
Reconciliación periódica  
↓  
Métricas diarias  
↓  
Reglas → alertas → tareas

## Responsabilidades por componente

| **Componente**      | **Responsabilidad**                                                              |
|---------------------|----------------------------------------------------------------------------------|
| Frontend Next.js    | Iniciar conexión, mostrar estado y datos. Nunca maneja tokens de Shopify.        |
| Backend seguro      | OAuth, GraphQL, webhooks, cifrado, sincronización, métricas y alertas.           |
| Cola de trabajos    | Importaciones, reintentos, sincronizaciones y cálculos fuera de la petición web. |
| Supabase PostgreSQL | Datos normalizados, métricas agregadas, RLS y auditoría.                         |
| Schema private      | Credenciales y payloads sensibles no expuestos por la API pública.               |

# 6. Sincronización inicial y actualizaciones incrementales

## 6.1 Importación inicial con Bulk Operations

Para tiendas con miles de productos o pedidos no conviene descargar todo mediante cientos de consultas paginadas. bulkOperationRunQuery ejecuta la consulta en la infraestructura de Shopify y entrega un archivo JSONL descargable. Desde la versión 2026-01 se permiten hasta cinco bulk queries concurrentes por tienda.

```graphql
mutation RunBulk {  
bulkOperationRunQuery(  
query: """  
{  
products {  
edges {  
node {  
id title status updatedAt  
variants { edges { node { id title price inventoryItem { id sku tracked } } } }  
}
```  
}  
}  
}  
"""  
) {  
bulkOperation { id status }  
userErrors { field message }  
}  
}

## 6.2 Webhooks incrementales

Después de la importación inicial, los webhooks informan de cambios. El webhook debe validarse mediante HMAC, guardarse de forma idempotente y procesarse en una cola. El payload es una señal; cuando sea crítico, el backend debe consultar el recurso actual mediante GraphQL antes de actualizar Supabase.

| **Dominio** | **Temas principales**                                                                                                          |
|-------------|--------------------------------------------------------------------------------------------------------------------------------|
| Aplicación  | app/uninstalled, app/scopes_update, shop/update                                                                                |
| Productos   | products/create, products/update, products/delete                                                                              |
| Inventario  | inventory_items/update, inventory_items/delete, inventory_levels/connect, inventory_levels/disconnect, inventory_levels/update |
| Pedidos     | orders/create, orders/updated, orders/paid, orders/cancelled, orders/fulfilled, orders/edited, orders/delete                   |
| Reembolsos  | refunds/create                                                                                                                 |
| Bulk        | bulk_operations/finish                                                                                                         |
| Privacidad  | customers/data_request, customers/redact, shop/redact                                                                          |

## 6.3 Reconciliación periódica

Los webhooks no deben ser la única garantía de consistencia. Una tarea periódica debe consultar recursos actualizados desde el último cursor o fecha conocida para reparar eventos perdidos, cambios fuera de orden o errores temporales.

# 7. Operaciones de Shopify necesarias por dominio

| **Dominio**         | **Query / mutation**                   | **Uso**                                                          |
|---------------------|----------------------------------------|------------------------------------------------------------------|
| Tienda              | shop                                   | Identidad, dominio, moneda, zona horaria, configuración general. |
| Instalación         | currentAppInstallation                 | Scopes concedidos y estado de la instalación.                    |
| Productos           | products / product                     | Catálogo y detalle de producto.                                  |
| Variantes           | productVariants / productVariant       | SKU, precio, opciones e InventoryItem.                           |
| Colecciones         | collections / collection               | Agrupaciones comerciales. Opcional en MVP.                       |
| Inventario          | inventoryItems / inventoryItem         | SKU, tracked, unitCost y datos logísticos.                       |
| Ubicaciones         | locations / location                   | Almacenes, tiendas y operadores logísticos.                      |
| Nivel de inventario | inventoryLevel(s)                      | Cantidades por InventoryItem y Location.                         |
| Pedidos             | orders / order / ordersCount           | Ventas, líneas, estado, descuentos y cliente.                    |
| Clientes            | customers / customer / customersCount  | Recurrencia y total histórico con minimización de datos.         |
| Reembolsos          | refund / order.refunds                 | Devolución económica y líneas reembolsadas.                      |
| Devoluciones        | return                                 | Proceso logístico/comercial de devolución.                       |
| Fulfillment         | fulfillment / fulfillmentOrders        | Preparación, envío, ubicación y tracking.                        |
| Checkout abandonado | abandonedCheckouts                     | Análisis futuro de recuperación.                                 |
| Analítica           | shopifyqlQuery                         | Series temporales y métricas agregadas, sujeto a permisos.       |
| Bulk                | bulkOperationRunQuery / bulkOperations | Importación masiva y seguimiento.                                |
| Webhooks            | webhookSubscriptionCreate              | Suscripciones específicas cuando no se configuran por archivo.   |

# 8. Inventario real de Shopify

> **Corrección obligatoria de la base de datos**
>
> Una variante no tiene un único stock global. Shopify conecta ProductVariant con InventoryItem y este con uno o varios InventoryLevel, cada uno perteneciente a una Location.

Product  
└── ProductVariant  
└── InventoryItem  
├── InventoryLevel → Location Málaga  
├── InventoryLevel → Location Madrid  
└── InventoryLevel → Operador logístico

InventoryLevel expone varias cantidades, por ejemplo available, on_hand, incoming y committed. Para no quedar atados a una lista cerrada, la tabla de snapshots debe almacenar las cantidades comunes en columnas y conservar además el conjunto completo en JSONB.

## Coste unitario

InventoryItem.unitCost puede proporcionar el coste unitario, pero puede estar vacío y requiere que el usuario de Shopify tenga permiso para ver costes. E-NORA IA debe importarlo cuando exista y permitir un coste manual con histórico y prioridad explícita.

# 9. Pedidos, clientes, privacidad y reembolsos

## 9.1 Pedidos

La tabla local debe conservar importes actuales y suficientes datos para reconstruir ventas, descuentos, impuestos, envíos y reembolsos. Los pedidos pueden modificarse después de su creación, por lo que deben guardarse updatedAt y processedAt y procesar webhooks de edición y reembolso.

## 9.2 Histórico y read_all_orders

El acceso normal a pedidos históricos está limitado. Para comparativas anuales, previsiones estacionales y recurrencia de largo plazo será necesario solicitar read_all_orders y superar la revisión correspondiente de Shopify.

## 9.3 Clientes y pseudonimización

La aplicación no necesita almacenar nombre, dirección, email ni teléfono para la mayoría de KPIs. Se debe generar una referencia pseudonimizada estable a partir del identificador de Shopify y conservar únicamente datos agregados. Los pedidos de invitado pueden no tener customer asociado, lo que limita la exactitud de recurrencia si no se utiliza información personal adicional.

## 9.4 Reembolsos

Guardar solo un total de reembolsos en el pedido no es suficiente para analítica por producto. Se necesitan tablas de refunds y refund items para saber qué variante se devolvió, cuántas unidades y qué importe debe descontarse del margen y las ventas netas.

# 10. Analítica, ShopifyQL y tráfico de producto

## 10.1 Métricas derivadas de pedidos

Facturación, pedidos, unidades, ticket medio, descuentos y reembolsos pueden calcularse a partir de los datos sincronizados. El beneficio neto estimado combina Shopify con costes manuales, gastos fijos y Meta Ads.

## 10.2 ShopifyQL

shopifyqlQuery permite ejecutar consultas analíticas sobre fuentes como sales, orders o customers. Es útil para validar métricas y obtener series temporales, pero requiere read_reports y acceso adicional a datos protegidos. El MVP no debe depender exclusivamente de esta capacidad.

```sql
FROM sales
SHOW total_sales, net_sales, orders
TIMESERIES day
SINCE -30d
```

## 10.3 Visitas a páginas de producto

La query products no devuelve visitas. Para la alerta “stock cero con visitas activas” hay dos caminos: ShopifyQL con los permisos correspondientes o instalar un Web Pixel que capture product_viewed. Un píxel solo genera histórico desde su instalación. La base de datos debe registrar el origen de la métrica.

# 11. Límites, paginación, errores y versionado

## 11.1 Coste de query

Shopify limita GraphQL por coste calculado, no solo por número de llamadas. Las conexiones cuestan según el tamaño solicitado, las mutations tienen coste base y una query individual no puede superar 1.000 puntos. La respuesta incluye información de throttle que debe alimentar el planificador de trabajos.

## 11.2 Estrategia ante límites

- Seleccionar únicamente campos necesarios.

- Paginar con cursores y tamaños razonables.

- Usar Bulk Operations para grandes volúmenes.

- Leer throttleStatus y esperar cuando el bucket esté bajo.

- Aplicar reintentos exponenciales con jitter.

- Separar la carga por tienda: el límite se calcula por combinación aplicación-tienda.

## 11.3 Versionado

Shopify publica versiones trimestrales. La versión debe fijarse en configuración, no escribirse en decenas de archivos. Antes de cada actualización se deben revisar el changelog, campos deprecados y pruebas de integración. La guía utiliza 2026-07 como versión vigente del análisis.

## 11.4 Errores e idempotencia

| **Tipo**              | **Tratamiento**                                                          |
|-----------------------|--------------------------------------------------------------------------|
| HTTP / red            | Reintento controlado y registro del fallo.                               |
| GraphQL errors        | La petición puede responder 200 y contener errors. Deben inspeccionarse. |
| userErrors            | Errores de validación específicos de mutations.                          |
| Throttle              | Esperar según currentlyAvailable y restoreRate.                          |
| Webhook duplicado     | Clave única por proveedor + event ID o fingerprint.                      |
| Evento fuera de orden | Comparar updatedAt y reconciliar contra Shopify.                         |

# 12. Mapeo con Supabase y reglas de seguridad

| **Shopify**    | **Tabla Supabase**                | **Observación**                                 |
|----------------|-----------------------------------|-------------------------------------------------|
| Shop           | shopify_stores                    | Una tienda conectada por organización.          |
| Product        | shopify_products                  | Upsert por store_id + external_product_id.      |
| ProductVariant | shopify_variants                  | Upsert por product_id + external_variant_id.    |
| InventoryItem  | shopify_inventory_items           | Relación 1:1 con variante en el modelo normal.  |
| Location       | shopify_locations                 | Una tienda puede tener varias ubicaciones.      |
| InventoryLevel | shopify_inventory_level_snapshots | Histórico por InventoryItem + Location + fecha. |
| Order          | shopify_order_facts               | Sin PII directa.                                |
| LineItem       | shopify_order_items               | Datos económicos por línea.                     |
| Refund         | shopify_refunds                   | Cabecera del reembolso.                         |
| RefundLineItem | shopify_refund_items              | Producto, cantidad e importe reembolsado.       |
| BulkOperation  | integration_sync_runs             | external_operation_id, estado y contadores.     |

## RLS

Todas las tablas públicas de negocio incluyen organization_id. Un cliente solo puede leer datos de organizaciones a las que pertenece. Un consultor solo puede acceder a organizaciones asignadas. Las credenciales de Shopify permanecen en private y solo el backend con service role puede utilizarlas.

> **No exponer tokens**
>
> RLS no es una excusa para colocar tokens en public. Las credenciales deben permanecer fuera de las tablas expuestas por la API de Supabase y cifrarse antes de persistirlas.

# 13. Ejemplos de consultas

## 13.1 Tienda

```graphql
query ShopIdentity {  
shop {  
id  
name  
myshopifyDomain  
currencyCode  
ianaTimezone  
plan { displayName }  
}  
}
```
## 13.2 Productos, variantes e inventario

```graphql
query Products(\$after: String) {  
products(first: 100, after: \$after) {  
nodes {  
id title handle status vendor productType updatedAt  
variants(first: 100) {  
nodes {  
id title sku price updatedAt  
inventoryItem {  
id sku tracked unitCost { amount currencyCode }  
inventoryLevels(first: 50) {  
nodes {  
id  
location { id name isActive }  
quantities(names: ["available", "on_hand", "committed", "incoming"]) { name quantity }  
}  
}  
}  
}  
}  
}  
pageInfo { hasNextPage endCursor }  
}  
}
```
## 13.3 Pedidos incrementales

```graphql
query UpdatedOrders(\$after: String, \$query: String!) {  
orders(first: 100, after: \$after, query: \$query, sortKey: UPDATED_AT) {  
nodes {  
id name createdAt processedAt updatedAt cancelledAt test sourceName  
currencyCode presentmentCurrencyCode  
currentSubtotalPriceSet { shopMoney { amount currencyCode } }  
currentTotalDiscountsSet { shopMoney { amount currencyCode } }  
currentTotalTaxSet { shopMoney { amount currencyCode } }  
currentTotalPriceSet { shopMoney { amount currencyCode } }  
customer { id numberOfOrders }  
lineItems(first: 100) {  
nodes { id title sku quantity currentQuantity variant { id } }  
}  
refunds { id createdAt totalRefundedSet { shopMoney { amount currencyCode } } }  
}  
pageInfo { hasNextPage endCursor }  
}  
}
```
# 14. Decisiones pendientes antes del desarrollo

- Definir si la aplicación será pública/distribuida o una custom app por cliente; esto afecta instalación, revisión y mantenimiento.

- Solicitar y justificar read_all_orders para históricos superiores al periodo estándar.

- Decidir el nivel de acceso a datos protegidos necesario para recurrencia y ShopifyQL.

- Elegir si las visitas por producto vendrán de ShopifyQL o de Web Pixel.

- Definir el criterio de prioridad entre unitCost de Shopify y coste manual.

- Definir frecuencia de sincronización por dominio y SLA de actualización del dashboard.

- Crear fixtures con tiendas que tengan varias ubicaciones, pedidos editados, devoluciones parciales y clientes invitados.

- No ejecutar el esquema en Supabase hasta completar policies RLS y tests de aislamiento.

# 15. Referencias oficiales

> • [<u>GraphQL Admin API reference</u>](https://shopify.dev/docs/api/admin-graphql/latest)
>
> • [<u>Authentication and authorization</u>](https://shopify.dev/docs/apps/build/authentication-authorization)
>
> • [<u>Offline access tokens</u>](https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/offline-access-tokens)
>
> • [<u>Authorization code grant</u>](https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/authorization-code-grant)
>
> • [<u>API limits</u>](https://shopify.dev/docs/api/usage/limits)
>
> • [<u>Bulk query operations</u>](https://shopify.dev/docs/api/usage/bulk-operations/queries)
>
> • [<u>Webhook topics</u>](https://shopify.dev/docs/api/webhooks/latest)
>
> • [<u>Products query</u>](https://shopify.dev/docs/api/admin-graphql/latest/queries/products)
>
> • [<u>Product variants query</u>](https://shopify.dev/docs/api/admin-graphql/latest/queries/productVariants)
>
> • [<u>InventoryItem</u>](https://shopify.dev/docs/api/admin-graphql/latest/objects/InventoryItem)
>
> • [<u>InventoryLevel</u>](https://shopify.dev/docs/api/admin-graphql/latest/objects/InventoryLevel)
>
> • [<u>Orders query</u>](https://shopify.dev/docs/api/admin-graphql/latest/queries/orders)
>
> • [<u>ShopifyQL query</u>](https://shopify.dev/docs/api/admin-graphql/latest/queries/shopifyqlQuery)
>
> • [<u>Protected customer data</u>](https://shopify.dev/docs/apps/launch/protected-customer-data)

> **Conclusión técnica**
>
> GraphQL no es solo la forma de llamar a Shopify: determina el modelo de sincronización, el control de permisos, la estructura de inventario, la paginación, los límites y la forma en que la base de datos debe conservar el histórico. El bloque Shopify debe cerrarse después de incorporar InventoryItem, Location, InventoryLevel y Refund como entidades explícitas.
