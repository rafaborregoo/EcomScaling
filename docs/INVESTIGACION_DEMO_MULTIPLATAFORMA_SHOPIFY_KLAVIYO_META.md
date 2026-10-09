# Investigación: demo de E-NORA con Shopify, Klaviyo y Meta

**Revisado:** 2 de octubre de 2026.  
**Fuentes:** documentación oficial de Shopify, Klaviyo, Meta y Model Context Protocol (MCP).

## Respuesta corta

Se puede preparar una demo realista con datos alojados en las plataformas y sincronizarlos a E-NORA. No hay un botón que cree automáticamente una tienda, una cuenta de Klaviyo y un entorno de Meta ya enlazados entre sí y con los mismos datos. Hay que crear los espacios de prueba por separado, conectarlos y verificar la integración.

La base de E-NORA debe ser una réplica normalizada para mostrar y cruzar información, no la fuente de verdad de los objetos externos:

- Shopify: productos, inventario y pedidos.
- Klaviyo: perfiles, campañas y eventos email/SMS.
- Meta: campañas y métricas de anuncios.
- E-NORA: conexiones, IDs externos, estado de sincronización, normalización, analítica derivada y auditoría.

MCP puede permitir que un agente de IA invoque herramientas para consultar o actuar sobre esos servicios. No sustituye las APIs, OAuth, webhooks, jobs de sincronización ni la base de datos que mantienen la aplicación.

## Opciones reales de prueba

| Plataforma | Qué ofrece | Restricciones importantes |
|---|---|---|
| Shopify | Dev store de desarrollo y pruebas; se puede poblar con demo data mediante Shopify CLI. Los pedidos pueden probarse con Bogus test gateway o el modo de prueba del proveedor de pagos. | No sirve para producción ni transacciones reales; no se convierte ni transfiere a producción/cliente. Límite documentado de 250 dev stores por organización. [Dev stores](https://shopify.dev/docs/apps/build/stores/development-stores) |
| Klaviyo | Cuenta separada gratuita de prueba vinculada al mismo login. Su herramienta de muestra puede crear perfiles, eventos ecommerce y catálogo dentro de Klaviyo. | La herramienta solo puede generar cada tipo de muestra una vez por cuenta. La facturación sigue activa incluso en una cuenta test: vigilar uso de perfiles, SMS y email. Las muestras de Klaviyo no son automáticamente el catálogo o pedidos de la dev store. [Test account](https://developers.klaviyo.com/en/docs/create_a_test_account) · [Sample data](https://developers.klaviyo.com/en/v1-2/docs/generate-sample-data) |
| Meta Ads | Marketing API sandbox ad accounts permiten probar llamadas sin entregar anuncios. Meta enlaza el tutorial desde su canal oficial. [Meta Developers](https://www.linkedin.com/posts/meta-for-developers_see-how-to-create-and-use-marketing-api-sandbox-activity-7082387686371553280-BOfu) · [Postman oficial](https://www.postman.com/meta/facebook-marketing-api/overview) | Como no se entregan anuncios, no es un entorno para validar impresiones, alcance, gasto o conversiones reales. No asumir que generará insights ficticios. La app, permisos, token y acceso a Marketing API deben configurarse aparte; para clientes externos pueden aplicar revisión y requisitos de acceso. En 2026 Meta renombró el nivel avanzado como Marketing API Access Tier. [Anuncio Meta](https://developers.meta.com/blog/updates-to-ads-management-standard-access-feature/) |

### Qué significa «todo simulado pero reflejado en las aplicaciones»

Hay dos objetivos distintos que conviene no mezclar:

1. **Demo guiada de E-NORA:** fixture sintética reproducible en un tenant de demo. Permite ver dashboards completos y métricas coherentes, pero esos datos no existen en Shopify, Klaviyo ni Meta.
2. **Prueba de conectores:** datos creados en las cuentas test nativas y luego importados por E-NORA. Son verificables en cada aplicación, pero los datos disponibles varían: Meta sandbox no entrega anuncios ni debe esperarse que produzca métricas reales.

Recomiendo implementar ambos modos, con una marca visible de **Datos de demostración** o **Cuenta de prueba**. Si se quieren cifras completas para una presentación, usar datos sintéticos aislados en el tenant demo; nunca etiquetarlos como si fueran insights leídos de Meta.

Para una prueba multicanal, la dev store Shopify, la cuenta de Klaviyo y la sandbox de Meta tienen que configurarse individualmente. Luego se verifica qué eventos Shopify envía a Klaviyo mediante la integración configurada. No asumir que la herramienta de datos de muestra de Klaviyo está enlazada a los productos/pedidos de Shopify.

Meta Ads tampoco conoce por sí solo cada pedido de Shopify. La unión de gasto y campañas con pedidos es una capa de análisis de E-NORA basada en UTMs, eventos, IDs y/o atribución. Las cifras de atribución de Shopify, Klaviyo y Meta pueden variar legítimamente; la demo debe enseñar método y ventana de atribución.

## Arquitectura recomendada

### 1. APIs y OAuth para conectar las fuentes

Cada conector de E-NORA autentica con OAuth o el método oficial del proveedor, usa scopes mínimos y consume sus APIs. Shopify recomienda Admin GraphQL API para leer y escribir productos, pedidos, clientes e inventario. [Shopify APIs para apps](https://shopify.dev/docs/apps/build/apis) · [Autenticación Shopify](https://shopify.dev/docs/apps/build/authentication-authorization)

### 2. Webhooks más reconciliación periódica

Webhooks para enterarse pronto de cambios y jobs de API para backfill y reconciliación. Shopify advierte que una entrega webhook puede perderse y recomienda reconciliar periódicamente para corregir huecos. [Webhooks Shopify](https://shopify.dev/docs/apps/build/webhooks)

Klaviyo dispone de webhooks para algunos eventos de email, SMS, push, reviews y consentimiento, pero la gestión por API está limitada a clientes Advanced KDP y partners de apps. No diseñar el conector suponiendo que toda cuenta podrá configurar esos webhooks. [Klaviyo Webhooks API](https://developers.klaviyo.com/en/v2026-01-15/reference/webhooks_api_overview) · [Klaviyo Events API](https://developers.klaviyo.com/en/reference/events_api_overview)

### 3. DB propia como espejo, lectura y analítica

Guardar los IDs externos y plataforma de origen, timestamp del proveedor, fecha de sincronización, datos normalizados necesarios, cursores, errores y registros de auditoría. Usar upserts idempotentes, paginación, rate limiting, reintentos y soporte para actualizaciones/borrados. Distinguir entre:

- dato de origen importado;
- dato normalizado por E-NORA;
- cálculo derivado, por ejemplo ROAS o atribución;
- fixture sintética de demo.

Cuando E-NORA modifique algo, escribir en la plataforma propietaria (p. ej., producto en Shopify, campaña en Meta, email en Klaviyo) y actualizar el espejo solo tras confirmar la respuesta del proveedor. No declarar éxito solo porque la DB local cambió.

### 4. MCP como capa para agentes

MCP define herramientas invocables por modelos y recursos de contexto; sirve para que un agente acceda a datos o invoque acciones. No define replicación permanente ni reemplaza la integración backend. [Introducción MCP](https://modelcontextprotocol.io/docs/2026-07-28/getting-started/intro) · [Tools](https://modelcontextprotocol.io/specification/2025-11-25/server/tools) · [Resources](https://modelcontextprotocol.io/specification/2025-11-25/server/resources)

Klaviyo ya tiene MCP oficial para que clientes de IA consulten y modifiquen Klaviyo con permisos del usuario. Es útil para operaciones desde un asistente, pero no mantiene por sí mismo la UI de E-NORA sincronizada. [Klaviyo MCP](https://developers.klaviyo.com/en/docs/klaviyo_mcp_server) · [Conexión](https://developers.klaviyo.com/en/docs/connect_to_the_klaviyo_mcp_server)

Shopify tiene MCP y herramientas agentic para casos como desarrollo, storefront/commerce u órdenes concretas; la ingestión SaaS del catálogo y pedidos debe continuar sobre Admin API y webhooks. [Shopify APIs](https://shopify.dev/docs/apps/build/apis) · [Order MCP](https://shopify.dev/docs/agents/orders/order-mcp)

Meta anunció Meta Ads AI Connectors en beta abierta para conectar una cuenta de anuncios con un agente de IA. Puede servir para operar o consultar Meta desde un agente, sujeto a disponibilidad y permisos de la cuenta. No sustituye los conectores backend de E-NORA ni sincroniza Shopify y Klaviyo. [Anuncio de Meta](https://s21.q4cdn.com/399680738/files/doc_financials/2026/q1/META-Q1-2026-Earnings-Call-Transcript.pdf)

Meta también ofrece un programa diferente, Meta AI Connectors, para que un desarrollador exponga su propia API a Meta AI; ese programa está en developer preview y requiere solicitar acceso. No confundirlo con el conector de Meta Ads. [Meta AI Connectors para desarrolladores](https://dev.meta.ai/products/connectors)

**Diseño sugerido:** conectores backend propios para Shopify, Klaviyo y Meta; DB de E-NORA como proyección normalizada; y, si hay un caso de uso, un servidor MCP de E-NORA encima de los mismos servicios autenticados. Herramientas de solo lectura por defecto. Para acciones con efectos (enviar email, crear campaña, cambiar presupuesto, publicar producto), scopes mínimos, confirmación humana, límites por tenant y auditoría.

## Plan de ejecución

1. Definir el alcance: tenant demo propio, cuentas test externas o ambos; pantallas y eventos que se van a enseñar; sin gasto real por defecto.
2. Crear tenant/credenciales separados de producción. Mostrar persistentemente la etiqueta de prueba; almacenar tokens en gestor de secretos, nunca en fixtures o logs.
3. Crear Shopify dev store con demo data, instalar E-NORA, importar catálogo/inventario y crear pedidos de prueba con gateway de test.
4. Crear cuenta test de Klaviyo. Decidir antes si se generarán muestras nativas, porque cada categoría se puede generar una vez. Configurar la integración con Shopify test y comprobar productos/eventos concretos.
5. Configurar app y Marketing API sandbox de Meta. Comprobar OAuth, activos encontrados, campañas consultables e insights vacíos como estado válido. Mantener métricas ficticias fuera de Meta.
6. Implementar backfill paginado, sincronización incremental, webhooks disponibles, reconciliación programada, idempotencia y estado por plataforma/entidad.
7. Validar el recorrido: producto Shopify → pedido/evento Shopify → evento Klaviyo → campaña/gasto Meta cuando haya objetos → panel E-NORA con origen, marca temporal y atribución explicada.
8. Añadir MCP cuando haya un caso claro para el agente. Empezar con lectura y acciones estrechas; nunca exponer credenciales del proveedor al modelo.

## Estado de ejecución

**Actualizado:** 2 de octubre de 2026.

- Shopify: hay dos tiendas de prueba. La preview temporal `790r9d-2z.myshopify.com` contiene los ocho productos iniciales; caduca y no es la tienda principal del demo. La tienda persistente de desarrollo **E-NORA Demo** (`e-nora-demo.myshopify.com`) contiene el dataset oficial de Shopify (17 productos y 3 clientes de muestra), ocho productos adicionales de moda con etiqueta `demo`/`e-nora-demo` y ocho clientes sintéticos con direcciones `example.invalid`. Tiene un pedido **#1001** por 58 €, marcado pagado manualmente en la tienda de desarrollo: no hubo transacción ni cobro. Shopify registró una notificación de confirmación dirigida al cliente de muestra `ayumu.hirano@example.com`; no se ha verificado si llegó a entregarse. La notificación de confirmación está activa, por lo que no se crearán más pedidos asociados a clientes. El pedido usa un cliente de muestra de Shopify, no uno de los clientes sintéticos. La tienda existente `e-nora-jox8kc2h` quedó intacta.
- E-NORA: la interfaz local autenticada sigue mostrando únicamente la tienda `e-nora-jox8kc2h`, una credencial Shopify expirada, una conexión Klaviyo suelta de producción y una conexión Meta suelta sin asignar a tienda. No se conectó `e-nora-demo.myshopify.com` a esa organización para evitar mezclar datos demo con conexiones existentes. La revisión de solo lectura del proyecto Supabase disponible en el conector mostró un proyecto CRM distinto (`INMONORA CRM`) y sin tenant de demo ni conexiones de Shopify/Klaviyo/Meta; no se ejecutaron escrituras SQL. Esa base no coincide con lo que sirve el panel local, así que no se usó para provisionar el tenant.
- Klaviyo: el conector MCP apunta a la cuenta de producción de E-NORA (`test_account: false`) y no se usó para escribir. La sesión del navegador está identificada en la UI como **Cuenta de prueba**. Se añadieron allí los conjuntos nativos de muestra (marketing, ecommerce y catálogo); la interfaz confirma 10 perfiles y 15 productos de catálogo. No se envió ninguna campaña. La cuenta test ya muestra una integración Shopify activada, pero su URL es la tienda existente `e-nora-jox8kc2h.myshopify.com`, no la nueva `e-nora-demo.myshopify.com`; la UI muestra el seguimiento del sitio desactivado y cero eventos de pedido recientes. No se cambió esa conexión. Los eventos ecommerce de muestra son de integración personalizada y el catálogo no se enlaza automáticamente a los productos de Shopify; aún no comparten IDs ni representan pedidos importados desde la tienda demo.
- Meta: no hay sesión iniciada en el navegador. El formulario visible crea un porfolio empresarial real y solicita correo verificable; no es una sandbox de Marketing API. No se creó ni modificó ningún activo de Meta.

El demo tiene datos de prueba en las interfaces de Shopify y Klaviyo, pero todavía **no es end-to-end**: falta un tenant aislado de E-NORA y una conexión a la tienda demo y a una cuenta Klaviyo test enlazada a esa tienda; falta iniciar sesión en Meta y crear/configurar la sandbox de Marketing API. El proyecto Supabase visible en el conector no coincide con el `SUPABASE_URL` configurado para el servicio local y no contiene este tenant ni sus integraciones. No se ejecutaron escrituras SQL ni se escribieron filas de demostración en la base de E-NORA.

## Criterios de terminado

- Conexiones y datos de prueba están separados de producción y etiquetados como test.
- UI distingue conectado, sincronizando, actualizado, conectado sin datos y error.
- Cada registro muestra origen y fecha de actualización.
- Sincronizar varias veces no duplica datos y la reconciliación repara huecos.
- Una tienda vacía o Meta sandbox sin métricas se muestra como «conectada, sin datos de este tipo».
- Fixtures sintéticas no se mezclan con resultados leídos de las APIs.
- La demo se puede repetir sin tocar cuentas reales.

## Fuentes oficiales

- Shopify: [Dev stores](https://shopify.dev/docs/apps/build/stores/development-stores), [APIs for apps](https://shopify.dev/docs/apps/build/apis), [webhooks](https://shopify.dev/docs/apps/build/webhooks), [autenticación](https://shopify.dev/docs/apps/build/authentication-authorization).
- Klaviyo: [test account](https://developers.klaviyo.com/en/docs/create_a_test_account), [sample data](https://developers.klaviyo.com/en/v1-2/docs/generate-sample-data), [MCP](https://developers.klaviyo.com/en/docs/klaviyo_mcp_server), [webhooks](https://developers.klaviyo.com/en/v2026-01-15/reference/webhooks_api_overview).
- Meta: [Sandbox Ad Accounts](https://www.linkedin.com/posts/meta-for-developers_see-how-to-create-and-use-marketing-api-sandbox-activity-7082387686371553280-BOfu), [Marketing API Postman](https://www.postman.com/meta/facebook-marketing-api/overview), [Access Tier](https://developers.meta.com/blog/updates-to-ads-management-standard-access-feature/), [Meta Ads AI Connectors announcement](https://s21.q4cdn.com/399680738/files/doc_financials/2026/q1/META-Q1-2026-Earnings-Call-Transcript.pdf), [Meta AI Connectors for developers](https://dev.meta.ai/products/connectors).
- MCP: [introducción](https://modelcontextprotocol.io/docs/2026-07-28/getting-started/intro), [tools](https://modelcontextprotocol.io/specification/2025-11-25/server/tools), [resources](https://modelcontextprotocol.io/specification/2025-11-25/server/resources).

