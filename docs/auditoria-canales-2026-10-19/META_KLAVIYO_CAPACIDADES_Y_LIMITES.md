# Meta y Klaviyo: capacidades, límites y encaje en E-NORA

Fecha de referencia: **19 de octubre de 2026, Europe/Madrid**. Investigación documental con fuentes oficiales y lectura estática de los adaptadores del repositorio. No se han inspeccionado credenciales, permisos concedidos en producción, facturación de las cuentas ni resultados de llamadas autenticadas. No se ha modificado la aplicación.

## 1. Decisión de producto

Es factible ofrecer pantallas propias para campañas, creativos, audiencias, automatizaciones, plantillas y formularios, con decisiones de IA conectadas a productos y stock. La API disponible, el permiso concedido por cada cliente y la implementación actual son tres cosas distintas. Que una herramienta del conector de ChatGPT exista no significa que E-NORA tenga implementada esa operación, ni que la cuenta conectada pueda ejecutarla.

Recomiendo mostrar en cada pantalla: cuenta/tienda seleccionada, recurso real y su identificador externo, última sincronización, operaciones disponibles, borrador local frente a estado remoto, errores accionables y acceso al recurso en la plataforma. Las operaciones que todavía no funcionen deben indicarlo antes de que el usuario prepare una publicación.

Una biblioteca de creativos propia es especialmente útil: reúne piezas creadas en E-NORA y anuncios importados de Meta, manteniendo su origen y relaciones. Una imagen generada, un creativo remoto, un anuncio y una publicación orgánica deben conservar identidades distintas.

## 2. Meta: superficie útil y factibilidad

Las colecciones citadas pertenecen al equipo oficial verificado de Meta; no son documentación de un proveedor intermediario. La página oficial identifica estos recursos como mantenidos por Meta. [Equipo oficial de Meta en Postman](https://www.postman.com/meta).

| Área / página propuesta | Lectura y acciones factibles | Condiciones y límite de la promesa | Evidencia oficial |
|---|---|---|---|
| Campañas | Listar campañas, conjuntos y anuncios; consultar y modificar nombre/estado y configuración admitida; crear la jerarquía publicitaria | Acceso al activo y permisos de escritura. Crear un anuncio no equivale a aprobación ni a entrega efectiva | [Marketing API, colección oficial](https://www.postman.com/meta/facebook-marketing-api/documentation/0zr4mes/facebook-marketing-api-mapi?entity=request-31691153-75199fc3-314d-40ef-895b-3edbcf37ef06) |
| Creativos | Importar creativos de la cuenta, texto, títulos, imágenes/vídeo y sus identificadores; crear creativos y vincularlos a anuncios | Respetar formatos y combinaciones admitidas. Nuestro editor debe validar cada destino | [Modelo de creativos en SDK de Meta](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/adcreative.py) |
| Biblioteca y previews | Miniaturas, imágenes, vídeos, variantes y previews donde el endpoint/formato lo permita | La maqueta de E-NORA debe distinguirse de un preview devuelto por Meta. No garantizar representación idéntica de cada ubicación | [AdAccount: creativos, imágenes y previews](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/adaccount.py) |
| Rendimiento | Gasto, impresiones, alcance, clics, CTR, CPC, CPM y métricas/conversiones devueltas; niveles cuenta/campaña/conjunto/anuncio | Conservar moneda, zona horaria, ventana y origen de atribución. Desgloses y campos dependen de la consulta | [Ejemplo oficial de Insights](https://www.postman.com/meta/facebook-marketing-api/request/zo3xvu7/get-campaign-insights-l3) |
| Audiencias | Gestionar audiencias personalizadas y sus relaciones mediante APIs admitidas | Tener endpoints no demuestra acceso a todos los datos personales ni que se puedan exportar miembros identificados. Audiencias basadas en clientes requieren datos autorizados y condiciones aplicables | [SDK oficial CustomAudience](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/customaudience.py) |
| Leads | Recibir notificaciones `leadgen`, recuperar el lead y conectarlo a un proceso comercial | Requiere configuración de webhook, suscripción de la página, permisos y acceso a leads del negocio. La notificación lleva identificadores; hay que recuperar el contenido | [Guía y comprobador oficiales](https://github.com/facebookincubator/catalogue-of-api-solutions/blob/main/solutions/leads/leads-retrieval-set-up-checker.md) |
| Catálogos | Mostrar catálogos y conjuntos de productos; gestionar recursos admitidos por la API | Mantener Shopify como fuente del producto y Meta como destino publicitario. Evitar sincronizadores que sobrescriban el mismo recurso entre sí | [Consulta oficial de catálogos](https://www.postman.com/meta/facebook-marketing-api/request/0w6p8rh/get-catalog-and-product-set), [SDK ProductCatalog](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/productcatalog.py) |
| Píxel y Conversions API | Enviar eventos del servidor y gestionar su trazabilidad; auditar configuración y cobertura de los datos que podamos leer | No activar un segundo emisor sin revisar el ya instalado. `event_id` permite correlación/deduplicación; enviar eventos no garantiza atribución perfecta | [SDK EventRequest](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/serverside/event_request.py), [SDK Event](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/serverside/event.py) |
| Instagram orgánico | Leer medios/insights y publicar formatos soportados; comentarios si se conceden permisos | API diferente a Marketing API. En Facebook Login exige cuenta profesional vinculada a una página; no admite cuentas personales. La colección indica Stories para cuentas Business | [Instagram API con Facebook Login, colección oficial](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api?entity=request-23987686-10bf8bf7-d9b7-4340-9c66-61d3ce683a87) |

### Requisitos y cuestiones pendientes de Meta

La colección oficial de inicio distingue acceso a cuentas propias de acceso avanzado para gestionar cuentas de otras personas. La combinación de app, acceso a activos y permiso se debe verificar en la aplicación real. `ads_read` sirve al caso de lectura; para escribir publicidad se debe habilitar el caso de `ads_management`. [Inicio oficial de Marketing API](https://www.postman.com/meta/facebook-marketing-api/collection/0zr4mes/facebook-marketing-api-mapi).

**No se ha comprobado que E-NORA tenga hoy App Review, Advanced Access o Business Verification aprobados.** Algunas páginas de developers.facebook.com devolvieron 429 o no fueron accesibles durante esta investigación. Los requisitos exactos por permiso, las cuotas vigentes y elegibilidad de comercio deben verificarse en el panel de la app y la documentación primaria antes de vender estas funciones. Referencias para esa comprobación: [permisos](https://developers.facebook.com/docs/permissions/), [niveles de acceso](https://developers.facebook.com/docs/graph-api/overview/access-levels/), [límites de Graph API](https://developers.facebook.com/docs/graph-api/overview/rate-limiting/). Estas tres páginas son destinos oficiales de verificación, no evidencia de que nuestra cuenta esté aprobada.

Lista de comprobación para la primera prueba técnica, con resultado guardado por cuenta:

- Lectura publicitaria: `ads_read`, cuenta y tareas disponibles.
- Escritura: `ads_management`, acceso avanzado/caso de uso aprobado cuando corresponda, cuenta autorizada, estado de pago y capacidad efectiva de crear en pausa.
- Descubrimiento empresarial: `business_management` y permisos de páginas solo cuando el flujo los necesite.
- Catálogos: comprobar `catalog_management`, titularidad/asignación del catálogo y posibilidad de gestionar el recurso concreto.
- Leads: permisos de recuperación de leads y acceso a la página/formulario.
- Publicación orgánica: producto de login, tipo de cuenta y scopes específicos; el permiso de anuncios no cubre automáticamente orgánico.
- Tokens: tipo, vencimiento, revocación y activos asociados. No modelarlos como credenciales permanentes.
- Límites: medir cabeceras y errores reales; colas por cuenta y backoff. No fijar una cuota universal para todas las llamadas.

**Fuera del compromiso inicial:** clonar íntegramente Ads Manager/Business Suite, gestionar cualquier configuración financiera, garantizar Shops/checkout en todos los países o conceder permisos desde nuestro producto. Son superficies distintas y dependen de elegibilidad/configuración que no está verificada aquí. Tampoco se puede prometer una lista completa de funciones futuras o betas porque aparezcan en un SDK.

## 3. Klaviyo: superficie útil y factibilidad

| Área / página propuesta | Capacidad de plataforma verificada | Condiciones relevantes | Fuente |
|---|---|---|---|
| Perfiles y consentimiento | Crear/actualizar perfiles y consultar propiedades, suscripciones y supresiones | Crear un perfil no concede consentimiento de marketing. Mostrar estado por canal | [Profiles API](https://developers.klaviyo.com/en/reference/profiles_api_overview) |
| Listas y segmentos | Listas y sus relaciones; crear, leer, actualizar y borrar definiciones de segmentos | Segmentos se calculan de forma asíncrona; no tratarlos como listas editables miembro por miembro. La guía señala máximo 5 procesándose a la vez y 100 creados/día | [Segments API](https://developers.klaviyo.com/en/reference/segments_api_overview) |
| Campañas | Crear, leer, editar, clonar y programar mensajes según la revisión usada | La revisión 2026-10-15 GA introduce jerarquía campaña → audiencias → mensajes → variación. Migración incompatible con estructuras anteriores | [Campaigns omnicanal](https://developers.klaviyo.com/en/reference/campaigns_omni_api_overview) |
| Flows | Consultar definición, acciones y mensajes; crear flows por definición; actualizar estado del flow | No confundir cambio de estado con edición arbitraria de toda la definición | [Flows API](https://developers.klaviyo.com/en/reference/flows_api_overview), [Update Flow Status](https://developers.klaviyo.com/en/reference/update_flow) |
| Acciones de flows | Actualizar acciones y añadir acciones en posiciones admitidas | La inserción nueva tiene exclusiones y no es idempotente; reconciliar antes de reintentar | [Update Flow Action](https://developers.klaviyo.com/en/reference/update_flow_action), [Create Flow Action](https://developers.klaviyo.com/en/reference/create_flow_action) |
| Plantillas | HTML, híbridas y definiciones nativas drag-and-drop; crear, editar, renderizar y clonar | Hay esquemas distintos por tipo; no asumir que HTML devuelto conserva un documento DnD editable | [Templates API](https://developers.klaviyo.com/en/reference/templates_api_overview) |
| Imágenes | Consultar, subir/importar y actualizar imágenes de la cuenta | Son assets de Klaviyo; vincular a nuestra biblioteca sin perder el origen | [Images API](https://developers.klaviyo.com/en/v2026-04-15/reference/images_api_overview) |
| Formularios y popups | Listar/leer definición y crear formularios draft; actualizar draft, publicar y despublicar | Las nuevas acciones de ciclo de vida necesitan revisión 2026-10-15 y `forms:write`; A/B tests requieren editor externo para publicar/despublicar | [Forms API](https://developers.klaviyo.com/en/reference/forms_api_overview), [Update](https://developers.klaviyo.com/en/reference/update_form), [Publish](https://developers.klaviyo.com/en/reference/publish_form), [Unpublish](https://developers.klaviyo.com/en/reference/unpublish_form) |
| Informes | Campañas, flows, formularios y segmentos; valores y series según recurso | Reporting API se diseña para reproducir cifras de su UI. Metric Aggregates agrupa por momento de evento y puede diferir de informes por envío | [Reporting API](https://developers.klaviyo.com/en/reference/reporting_api_overview) |
| Catálogo y back in stock | Items, variantes, categorías, trabajos bulk y suscripciones a reposición | Catálogo de mensajes; no es el registro maestro del inventario físico. No mezclar fuente API y feed personalizado sobre los mismos productos sin diseño explícito | [Catalogs API](https://developers.klaviyo.com/en/reference/catalogs_api_overview) |
| Cupones | Crear/gestionar contenedores y subir códigos para mensajes | La Coupons API no crea descuentos Shopify ni da acceso a los cupones Shopify creados desde la UI de Klaviyo. Canje real debe verificarse en el comercio | [Coupons API](https://developers.klaviyo.com/en/docs/use_klaviyos_coupons_api) |
| Webhooks | Notificaciones del sistema para temas admitidos y webhooks como acciones de flows | El acceso a la API de system webhooks está limitado a clientes Advanced KDP y partners; la guía conserva requisitos de allowlist para OAuth | [Webhooks API](https://developers.klaviyo.com/en/reference/webhooks_api_overview) |

### 3.1 Cambios críticos de 2026-10-15

El changelog oficial confirma la GA omnicanal, nuevas operaciones de formularios e inserción de acciones en flows. También aclara que cada mensaje tiene **una variación** y que la API v3 no admite A/B tests. No derivar soporte de experimentación de que exista el nombre «variación». [Changelog oficial](https://developers.klaviyo.com/en/docs/changelog_).

Para campañas nuevas, el adaptador debe modelar audiencias y mensajes explícitos, y la programación correspondiente. La guía indica UTM de mensajes en solo lectura; su configuración se realiza en Klaviyo. No trasladar automáticamente `tracking_options` del cuerpo antiguo al contrato nuevo. La sección sobre Smart Send Time de la guía conserva texto de revisiones anteriores: verificar el endpoint y cuenta antes de ofrecer ese botón. [Guía omnicanal](https://developers.klaviyo.com/en/reference/campaigns_omni_api_overview).

### 3.2 Formularios: qué podemos ofrecer sin prometer un clon del editor

Es factible una página de formularios con estado, métricas, vista previa, duplicación por lectura/transformación/creación, editor acotado y publicación. «Duplicar» sería nuestra composición de operaciones, no un endpoint clone de formularios verificado. La guía recomienda reutilizar una definición obtenida de un formulario válido; para crear se eliminan IDs y timestamps y se envía en draft. [Guía Forms](https://developers.klaviyo.com/en/reference/forms_api_overview).

Al actualizar, `definition` sustituye el documento almacenado; solo se edita draft. Hay que conservar versiones e IDs y no alterar versiones live; conflictos concurrentes devuelven 409. El editor inicial debe limitarse a propiedades compatibles que podamos validar. [Update Form](https://developers.klaviyo.com/en/reference/update_form), [Reglas detalladas](https://developers.klaviyo.com/en/reference/forms_api_overview).

Publish y Unpublish devuelven un recurso de job con 202 pero terminan síncronamente; ese job no se consulta después. Confirmar leyendo el formulario. A/B tests se gestionan en el editor Klaviyo. Necesitan `forms:write` y tienen límite publicado de 3/s, 60/min. [Publish Form](https://developers.klaviyo.com/en/reference/publish_form), [Unpublish Form](https://developers.klaviyo.com/en/reference/unpublish_form).

### 3.3 Flows: alcance de un editor propio

Crear un flow por definición y consultar su estructura está soportado. El cambio `PATCH /flows/{id}` modifica el estado del flow y sus acciones, no representa un reemplazo general de definición. La transición a live debe explicar que activa comunicaciones. [Create/read flow](https://developers.klaviyo.com/en/reference/flows_api_overview), [Update Flow Status](https://developers.klaviyo.com/en/reference/update_flow).

La inserción admite acciones lineales, WhatsApp estándar y divisiones multirrama, con exclusiones explícitas: conditional/trigger/action-output splits, A/B tests, experimentos de contenido y Automated Conversations. Las acciones de comunicación nuevas quedan en draft; lógica/tiempos en un flow live pueden afectar perfiles en tránsito y requieren opt-in específico. El endpoint no es idempotente y `temporary_id` no evita duplicados. **Un canvas completo necesita una matriz de operaciones por tipo de nodo; hoy no debemos prometer edición arbitraria de cualquier flow.** [Create Flow Action](https://developers.klaviyo.com/en/reference/create_flow_action).

### 3.4 Envíos, consentimiento y límites operativos

Importar perfiles, añadirlos a una lista y suscribirlos son acciones distintas. La API de suscripción debe conservar consentimiento por canal y las reglas de double opt-in de la lista; no inferir consentimiento de compras o de pertenencia a un segmento. [Guía oficial de formularios e integración](https://developers.klaviyo.com/en/docs/guide_to_integrating_a_forms_and_popups_platform).

SMS exige configuración del canal y consentimiento explícito; marketing y transaccional deben conservarse por separado. Disponibilidad territorial, remitentes y registros se deben comprobar antes de habilitar envíos para una cuenta. [Guía de consentimiento de canal](https://developers.klaviyo.com/en/docs/guide_to_integrating_a_wellness_platform). No usar la descripción de la API sobre consentimiento implícito como dictamen legal para todas las tiendas.

OAuth autoriza cuentas y devuelve scopes. Se requieren PKCE y conservación segura de tokens; usar `expires_in`, no una duración codificada. Aumentar los scopes de la app no actualiza por sí solo los tokens antiguos: el cliente deberá autorizar los permisos que falten. [OAuth oficial](https://developers.klaviyo.com/en/docs/set_up_oauth).

Las cuotas cambian por endpoint y parámetros. OAuth dispone de cuotas por instalación cuenta/app; claves privadas comparten la cuota de cuenta. Respetar `Retry-After`, planificar sincronizaciones y guardar resultados locales. [Rate limits](https://developers.klaviyo.com/en/docs/rate_limits_and_error_handling). Un caso especialmente restrictivo es Query Campaign Values: 1/s burst, 2/min steady y **225/día**; llamar en cada render del dashboard agotaría el presupuesto. [Endpoint Reporting](https://developers.klaviyo.com/en/reference/query_campaign_values).

### 3.5 Ampliaciones viables para Studio, marca y operaciones

Estas ampliaciones GA de octubre son candidatas al roadmap, con habilitación por capacidad. Su disponibilidad en la plataforma no significa que estén implementadas en E-NORA.

| Oportunidad en E-NORA | Qué permite ofrecer | Condición / límite | Fuente oficial |
|---|---|---|---|
| Marca sincronizada con Studio | Leer y gestionar logos, colores, botones y grupos de redes; leer/editar voz de marca y valores predeterminados de email | `brands:read` / `brands:write`. Definir fuente maestra y resolución de conflictos con nuestra configuración de marca | [Brands GA](https://developers.klaviyo.com/en/docs/changelog_), [Brand Voice](https://developers.klaviyo.com/en/reference/get_brand_voice), [Email Defaults](https://developers.klaviyo.com/en/reference/get_brand_email_defaults) |
| Email de prueba desde Studio | Enviar una plantilla de prueba a destinatarios elegidos antes de una campaña | `templates:write`; 1/s, 15/min y 100/día. El usuario debe ordenar ese envío; no se deduce de guardar una pieza | [Template Preview Send Job](https://developers.klaviyo.com/en/reference/create_template_preview_send_job) |
| HTML generado → plantilla editable | Convertir un HTML en una plantilla DnD nueva y registrar el resultado junto al original | Solo cuentas de pago; trabajo asíncrono; creación 1/min, `templates:write`. Verificar el resultado convertido y sus diferencias antes de usarlo | [Template Conversion Job](https://developers.klaviyo.com/en/reference/create_template_conversion_job) |
| Consumo de Klaviyo | Mostrar consumo medido del periodo frente a topes del plan y alertar antes de nuevas operaciones | Lectura, `usage:read`; no equivale a gestionar la suscripción, pagar facturas ni garantizar una factura final | [Billing Usage API](https://developers.klaviyo.com/en/reference/billing_usage_api_overview) |
| Campañas por idioma | Gestionar traducciones vinculadas a variaciones, mensajes de flows, plantillas y contenido universal | Requiere permisos y modelo de recursos compatible. Una traducción almacenada no demuestra que cada contacto tenga idioma correctamente resuelto | [Translations API](https://developers.klaviyo.com/en/reference/translations_api_overview) |
| Preparación de SMS | Mostrar configuración, remitentes y registro; guiar correcciones de un registro rechazado | Text Messaging API configura, no envía SMS. Actualmente admite remitente toll-free; `sender-config:read` / `sender-config:write`; aprobación del operador pendiente hasta verificarse | [Text Messaging API](https://developers.klaviyo.com/en/reference/text_messaging_api_overview) |

**Email, SMS, push y WhatsApp deben habilitarse por cuenta y canal.** El modelo omnicanal incluye estos canales, pero no concede una cuenta WhatsApp, un remitente autorizado, una app móvil ni consentimiento. SMS necesita configuración y registro aplicables; push exige configuración y dispositivos/token de una app; WhatsApp exige configuración y recursos válidos para ese canal. No mostrar «publicar» cuando solo podemos guardar un borrador local. [Campañas omnicanal](https://developers.klaviyo.com/en/reference/campaigns_omni_api_overview), [Campañas y requisitos push de la revisión anterior](https://developers.klaviyo.com/en/v2025-07-15/reference/campaigns_api_overview), [Configuración SMS](https://developers.klaviyo.com/en/reference/text_messaging_api_overview).

**Exploración, fuera del compromiso de producción:** el bloque `2026-10-15.pre` incluye K-SQL Ask, Managed DNS, Locations y Social Reporting; mantiene otras superficies en beta como Customer Agent y Sending Domains. Podrían servir para consultas de IA, operaciones de dominio y tiendas físicas, pero requieren evaluación de acceso, estabilidad y coste. K-SQL Ask depende de habilitación y consume créditos de IA. No contabilizar estas APIs beta como funciones entregables del alcance inicial. [Changelog, sección 2026-10-15.pre](https://developers.klaviyo.com/en/docs/changelog_).

## 4. Distancia frente a la integración actual

Evidencia estática del checkout; los números de línea pueden desplazarse con cambios en curso:

| Evidencia local | Estado observado | Consecuencia para el plan |
|---|---|---|
| `apps/api/src/klaviyo-oauth.ts:9` | `KLAVIYO_API_REVISION = "2026-07-15"` | La capacidad GA de octubre no aparece automáticamente |
| `apps/api/src/klaviyo-client.ts:145` | Default de revisión con posibilidad de override por petición | Posible adaptación gradual por recurso; requiere contratos explícitos |
| `packages/config/src/index.ts:12` | Default incluye lectura de forms y escritura de campañas/flows/plantillas | `forms:write` y otras escrituras de perfiles/listas/segmentos/catálogos/cupones no están en el default |
| `apps/api/src/klaviyo-permissions.ts` | Capacidades/probes separados por recurso, forms solo lectura | Extender la matriz al implementar cada pantalla; distinguir error de permiso de contrato o red |
| `apps/api/src/marketing-klaviyo.ts` | Cuerpo de campaña de julio y uso de `/campaign-send-jobs/` | Subir la constante global sin migrar requests/responses rompería el contrato |
| `apps/api/src/marketing-flows.ts` | Construcción de definición de flow desde diseño local | Ya existe base de creación; no demuestra cobertura del nuevo editor por acciones |
| `apps/api/src/meta-client.ts:7` | Versión configurable; fallback `v23.0` | Comprobar versión efectiva del despliegue y lifecycle; no asumir uso del último contrato |
| `apps/api/src/meta-oauth.ts` | Default `public_profile,ads_read`; requerido `ads_read`; configuración alternativa de Login for Business | La conexión de lectura no garantiza permisos para publicar anuncios, catálogos o Instagram |
| `apps/api/src/meta-ad-write-plan.ts` | Existe preparación de plan de creación de anuncios | Un plan preparado no prueba ejecución remota ni aprobación de permisos |

**Migración recomendada:** conservar estable julio para funciones existentes; introducir contratos de octubre detrás del adaptador de capacidad/revisión; migrar campañas, sincronización, filtros, almacenamiento y UI como conjunto. Hacer una prueba de lectura, draft, programación y cancelación en cuenta de ensayo autorizada antes de habilitar producción. No mezclar payload antiguo con revisión nueva. Las revisiones están diseñadas para fijar contratos; betas `.pre` no deben convertirse en requisito de funciones de producción. [Versionado oficial](https://developers.klaviyo.com/en/docs/api_versioning_and_deprecation_policy).

## 5. Diferenciación que E-NORA puede construir

Estas son propuestas de producto propias, no funciones concedidas automáticamente por una plataforma:

1. **Campaña conectada al stock:** antes de publicar, comprobar variantes promocionadas, margen, previsión, plazos de reposición y capacidad disponible; proponer un producto alternativo cuando la campaña agotaría una variante.
2. **Biblioteca transversal:** pieza, autor/agente, versión, aprobación, uso en Meta/Klaviyo/web y rendimiento con procedencia. Evitar duplicar archivos y conservar relación con IDs externos.
3. **Auditoría de experiencia:** capturas y revisión de landing móvil/escritorio, mensaje del anuncio frente al producto, claridad de promoción, errores y rendimiento; enlazar cada hallazgo a URL y evidencia fechada.
4. **Centro de acciones:** ver propuesta, evidencia, impacto estimado y destino antes de ejecutar; reconciliar el resultado remoto, permisos y cambios concurrentes.
5. **Analítica diferenciada:** ventas/pedidos reales del comercio, ingresos atribuidos por Meta e ingresos atribuidos por Klaviyo en medidas separadas. No sumarlos como ventas independientes; ventanas y modelos pueden solaparse.

## 6. Qué falta verificar antes de presupuestar una cobertura completa

- Pruebas autenticadas de cada operación que se quiera vender, por tipo de cuenta y conexión; esta investigación no las sustituye.
- Meta: estado de la app, acceso avanzado y revisión por permisos, negocio, activos, tokens y versión desplegada; catálogo y commerce elegibles por mercado.
- Klaviyo: scopes efectivos de conexiones antiguas, plan/canal habilitado, acceso a system webhooks y funciones que dependan de partnership/allowlist.
- Esquemas OpenAPI por revisión para el canvas de flows, formularios y campañas omnicanal; soporte preciso de cada tipo de nodo, plantilla y transición.
- Estado real de sincronización, retención, reintentos, errores parciales y aislamiento por tienda en el software: tratado en la auditoría interna, no demostrado por la disponibilidad de una API externa.
- Cualquier «todo lo que hace la plataforma» necesita una lista contractual de operaciones. Esta matriz cubre las superficies relevantes para el producto propuesto; no certifica paridad con todos los productos, planes, funciones regionales y betas de Meta o Klaviyo.
