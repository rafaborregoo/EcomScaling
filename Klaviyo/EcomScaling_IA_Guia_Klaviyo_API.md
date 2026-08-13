# EcomScaling IA

> **Alineación de producto (2026-08-02):** además de sincronizar reporting cuando
> exista OAuth, EcomScaling preparará generación de emails y plantillas con IA como
> borradores auditables. La IA no envía ni publica sin aprobación humana y conexión
> Klaviyo saludable. El contrato transversal está en
> [`../roadmap/roadmaps/04-integraciones/CONTRATO_PREPARACION_CONECTORES.md`](../roadmap/roadmaps/04-integraciones/CONTRATO_PREPARACION_CONECTORES.md).

## Aplicación en EcomScaling

Esta guía debe leerse junto con el [objetivo global del SaaS y sus criterios de terminado](../docs/OBJETIVO_SAAS_PILOTO_Y_CRITERIOS_DE_TERMINADO.md):
Klaviyo debe quedar preparado mediante contratos, adaptadores, feature flags y estados honestos para que la
conexión futura sea una activación del conector, no un rediseño. Sin credenciales reales, no se muestran
campañas, flows, perfiles ni métricas como si existieran.
Guía técnica de integración  
Klaviyo API

OAuth, arquitectura JSON:API, flows, campañas, formularios, reporting, métricas y ajustes de base de datos

**Auditoría de documentación oficial · Revisión estable 2026-04-15**

13 de julio de 2026 · Documento técnico para desarrollo · Confidencial

| Objetivo: validar qué datos puede obtener EcomScaling IA desde Klaviyo, cómo deben sincronizarse y qué cambios necesita el modelo de Supabase antes de cerrar la arquitectura. |
|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

# Contenido

- 1\. Conclusiones ejecutivas

- 2\. Qué es la API de Klaviyo y cómo funciona

- 3\. Versionado y revisión utilizada

- 4\. Autenticación OAuth para una aplicación multi-tenant

- 5\. Arquitectura de integración propuesta

- 6\. Cuenta de Klaviyo

- 7\. Perfiles, consentimiento y privacidad

- 8\. Listas y segmentos

- 9\. Flows, acciones y mensajes

- 10\. Campañas y mensajes

- 11\. Formularios

- 12\. Métricas y eventos

- 13\. Reporting API

- 14\. Webhooks y sincronización incremental

- 15\. Límites, paginación y gestión de errores

- 16\. Scopes mínimos

- 17\. Mapeo funcional con EcomScaling IA

- 18\. Consecuencias para la base de datos

- 19\. Catálogo de endpoints relevantes

- 20\. Decisiones pendientes

- 21\. Fuentes oficiales

# 1. Conclusiones ejecutivas

- Para EcomScaling IA debe utilizarse OAuth, no pedir a cada cliente que copie una Private API Key. OAuth permite que cada cuenta autorice la aplicación, entregue scopes concretos y pueda revocar el acceso.

- La API estable vigente en la fecha de esta auditoría utiliza la revisión 2026-04-15. La nueva Campaigns API multicanal está documentada como beta con el header 2026-04-15.pre y su disponibilidad general está prevista para el 15 de julio de 2026; no debe convertirse todavía en dependencia de producción.

- Klaviyo separa metadatos operativos de rendimiento: Campaigns API, Flows API y Forms API describen los objetos; Reporting API devuelve las estadísticas que coinciden con la interfaz de Klaviyo.

- Para comparar EcomScaling IA con el panel de Klaviyo debe usarse Reporting API. Query Metric Aggregates agrupa por la fecha del evento y puede producir cifras diferentes a las mostradas por Klaviyo, que calcula el rendimiento de campañas y flows por fecha de envío.

- Un flow no es una única fila simple: contiene acciones, y determinadas acciones contienen mensajes. Debemos guardar flows, acciones y mensajes para localizar exactamente qué email o SMS ha dejado de enviar.

- Una campaña también puede contener uno o varios mensajes. El esquema actual de una sola tabla de campañas es insuficiente si queremos conservar canal, asunto, remitente, plantilla y variaciones.

- No es necesario copiar todos los perfiles ni todos los eventos personales para el MVP. Las funcionalidades del briefing pueden construirse con listas, segmentos, metadatos y datos agregados, reduciendo PII y complejidad.

- Los system webhooks no están disponibles para cualquier cuenta: la documentación limita su gestión a clientes Advanced KDP y partners de aplicaciones. La arquitectura debe funcionar mediante sincronización programada aunque los webhooks no estén disponibles.

- Las métricas de reporting deben guardarse de forma flexible por statistic, entidad, canal, intervalo y conversion_metric_id. Columnas rígidas como opens, clicks y revenue no cubren cambios de API, SMS, push ni métricas personalizadas.

# 2. Qué es la API de Klaviyo y cómo funciona

Klaviyo expone una API HTTP organizada por recursos. La superficie moderna sigue el estándar JSON:API: cada respuesta contiene objetos data, attributes, relationships, links e included. Esto permite solicitar campos concretos, filtrar, ordenar, paginar e incluir relaciones sin descargar información innecesaria.

```http
GET https://a.klaviyo.com/api/flows
Authorization: Bearer {access_token}
revision: 2026-04-15
accept: application/vnd.api+json
```

Las operaciones principales que utiliza EcomScaling IA son de lectura. El backend consulta objetos de Klaviyo, los normaliza en Supabase y genera snapshots o estadísticas agregadas. El navegador del cliente no debe llamar directamente a endpoints privados de Klaviyo.

| **Concepto**      | **Aplicación en EcomScaling IA**                                                                |
|-------------------|-------------------------------------------------------------------------------------------------|
| Resource          | Cuenta, flow, campaña, formulario, lista, segmento, métrica o evento.                           |
| Attributes        | Nombre, estado, fechas, canal, trigger, opt-in y otros campos del recurso.                      |
| Relationships     | Conexiones entre flow y acciones, acción y mensajes, campaña y mensajes, lista y perfiles, etc. |
| Sparse fieldsets  | Solicitar solo los campos necesarios para reducir respuesta y coste.                            |
| Filter y sort     | Sincronización incremental por updated_at, status, channel o ID.                                |
| Cursor pagination | Recorrer colecciones sin depender de offsets inestables.                                        |
| Revision header   | Fijar el contrato de API utilizado por el backend.                                              |

# 3. Versionado y revisión utilizada

Klaviyo versiona su API mediante el header revision. En esta auditoría se toma como contrato estable la revisión 2026-04-15. Las migraciones y el código deben guardar qué revisión se utilizó en cada sincronización.

| No implementar en producción la API beta 2026-04-15.pre sin una reauditoría. La documentación indica que la nueva Campaigns API multicanal está prevista para GA el 15 de julio de 2026, dos días después de la fecha de este documento. |
|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

| **Elemento**       | **Decisión**                                                                 |
|--------------------|------------------------------------------------------------------------------|
| Revisión estable   | 2026-04-15.                                                                  |
| Beta disponible    | 2026-04-15.pre, especialmente nueva Campaigns API multicanal.                |
| Header obligatorio | revision: 2026-04-15.                                                        |
| Persistencia       | Guardar api_version/revision en integration_sync_runs y report runs.         |
| Actualización      | Revisar changelog antes de subir de revisión y ejecutar pruebas de contrato. |

# 4. Autenticación OAuth para una aplicación multi-tenant

EcomScaling IA es una aplicación que conectará cuentas pertenecientes a clientes diferentes. La opción correcta es crear una aplicación OAuth de Klaviyo. Cada cliente inicia la instalación, autoriza scopes concretos y Klaviyo devuelve un authorization code que el backend intercambia por access token y refresh token.

GET https://www.klaviyo.com/oauth/authorize  
?response_type=code  
&client_id={client_id}  
&redirect_uri={callback}  
&scope={scopes}  
&state={state}  
&code_challenge_method=S256  
&code_challenge={challenge}

POST https://a.klaviyo.com/oauth/token  
Content-Type: application/x-www-form-urlencoded  
Authorization: Basic base64(client_id:client_secret)

GET https://a.klaviyo.com/api/accounts  
Authorization: Bearer {access_token}  
revision: 2026-04-15

Klaviyo exige PKCE. Debe generarse un code_verifier y code_challenge nuevos para cada autorización. Los tokens se guardan cifrados en el esquema privado y nunca se envían al frontend.

1.  El usuario pulsa “Conectar Klaviyo”.

2.  El backend genera state, code_verifier y code_challenge y almacena temporalmente el verifier.

3.  El usuario autoriza los scopes en Klaviyo.

4.  Klaviyo redirige al callback con code y state.

5.  El backend valida state y canjea code + verifier por tokens.

6.  Se cifra el refresh token y se reutiliza el access token hasta su expiración.

7.  Se consulta /api/accounts para vincular el account_id con la organización.

8.  Comienza la sincronización inicial.

| El refresh token permanece válido hasta desinstalación o revocación, pero puede revocarse si no se usa durante 90 días. La aplicación debe refrescar con criterio y tratar invalid_grant como desconexión. |
|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

# 5. Arquitectura de integración propuesta

Organization  
└── integration_connections(provider = klaviyo)  
├── private.integration_credentials  
├── klaviyo_accounts  
├── klaviyo_lists / klaviyo_segments  
├── klaviyo_flows → actions → messages  
├── klaviyo_campaigns → messages  
├── klaviyo_forms  
├── klaviyo_metrics  
└── reporting runs → report values

La sincronización se divide en cuatro procesos:

| **Proceso**            | **Qué hace**                                                                            | **Frecuencia orientativa**                       |
|------------------------|-----------------------------------------------------------------------------------------|--------------------------------------------------|
| Descubrimiento inicial | Cuenta, listas, segmentos, flows, acciones, mensajes, campañas, formularios y métricas. | Al conectar.                                     |
| Incremental de objetos | Recursos modificados desde el último watermark updated_at.                              | Cada 1-6 horas según recurso.                    |
| Reporting              | Valores y series de rendimiento para campañas, flows, forms y segmentos.                | Diaria; más frecuente para alertas prioritarias. |
| Reconciliación         | Relee colecciones completas para recuperar cambios perdidos.                            | Diaria o semanal.                                |

# 6. Cuenta de Klaviyo

El endpoint Accounts devuelve la cuenta vinculada al token, incluyendo identificador, timezone, currency, información de contacto y Public API key/site ID. Para EcomScaling IA solo se almacenarán los datos técnicos necesarios.

| **Endpoint**                            | **Uso**                                                                      |
|-----------------------------------------|------------------------------------------------------------------------------|
| GET /api/accounts                       | Detectar la cuenta autorizada y verificar el token.                          |
| GET /api/accounts/{id}                  | Releer una cuenta concreta.                                                  |
| GET /api/tracking-settings/{account_id} | Opcional: conocer configuración UTM si se utiliza en análisis de atribución. |

| No guardar contacto personal de la cuenta salvo que exista una necesidad funcional. El account_id, timezone, currency, site_id y estado de sincronización son suficientes para el MVP. |
|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

# 7. Perfiles, consentimiento y privacidad

Un profile representa a una persona y puede contener email, teléfono, nombres, dirección, localización, propiedades, consentimientos y analítica predictiva. Son datos personales y no deben copiarse por defecto.

| **Necesidad**                | **Decisión**                                                                           |
|------------------------------|----------------------------------------------------------------------------------------|
| Métricas de campañas y flows | Usar Reporting API agregada; no requiere copiar perfiles.                              |
| Tamaño de listas/segmentos   | Guardar profile_count o series agregadas.                                              |
| Consentimiento individual    | Solo consultar bajo demanda si una funcionalidad futura lo necesita.                   |
| Segmentación avanzada        | Guardar la definición o metadatos del segmento, no los miembros.                       |
| Actividad individual         | Fuera del MVP; implicaría PII, retention y RLS más estrictos.                          |
| Borrado GDPR                 | Si se almacenan perfiles en el futuro, coordinar Data Privacy API y eliminación local. |

Endpoints disponibles pero no necesarios como sincronización masiva del MVP:

- GET /api/profiles

- GET /api/profiles/{id}

- GET /api/lists/{id}/profiles

- GET /api/segments/{id}/profiles

- POST /api/profile-import

- Endpoints de subscribe/unsubscribe y suppress/unsuppress

| Decisión recomendada: no crear una tabla klaviyo_profiles en el MVP. Guardar perfiles “por si acaso” aumenta riesgos sin aportar valor a los KPIs definidos. |
|--------------------------------------------------------------------------------------------------------------------------------------------------------------|

# 8. Listas y segmentos

Las listas son colecciones explícitas de perfiles y registran opt-in. Los segmentos son audiencias dinámicas definidas por condiciones. Ambos pueden ser audiencias de campañas o triggers de flows y deben representarse como entidades distintas.

| **Recurso**   | **Campos útiles**                                                 | **Endpoint principal**                         |
|---------------|-------------------------------------------------------------------|------------------------------------------------|
| Lista         | id, name, opt_in_process, created, updated, profile_count.        | GET /api/lists                                 |
| Segmento      | id, name, is_active, is_starred, created, updated, profile_count. | GET /api/segments                              |
| Miembros      | Relación con profiles. No sincronizar en MVP.                     | /lists/{id}/profiles; /segments/{id}/profiles  |
| Flow triggers | Flows activados por una lista o segmento.                         | Relationships/include en Lists y Segments API. |

Debemos guardar snapshots de tamaño porque profile_count es una fotografía actual y las consultas que incluyen ese campo tienen límites más estrictos.

# 9. Flows, acciones y mensajes

Un flow representa una automatización. Su estado puede ser live, manual o draft y contiene un trigger. Dentro existen acciones, como enviar email, enviar SMS, esperar un periodo o evaluar una condición. Las acciones de envío contienen mensajes.

klaviyo_flows  
└── klaviyo_flow_actions  
└── klaviyo_flow_messages

| **Endpoint**                             | **Uso en EcomScaling IA**                                         |
|------------------------------------------|-------------------------------------------------------------------|
| GET /api/flows                           | Sincronizar flows, estado, trigger, fechas y tags.                |
| GET /api/flows/{id}                      | Reconciliar un flow concreto.                                     |
| GET /api/flows/{id}/flow-actions         | Obtener acciones del flow.                                        |
| GET /api/flow-actions/{id}               | Releer una acción.                                                |
| GET /api/flow-actions/{id}/flow-messages | Obtener mensajes de email/SMS asociados.                          |
| GET /api/flow-messages/{id}              | Obtener metadatos del mensaje.                                    |
| GET /api/flow-messages/{id}/template     | Opcional: identificar la plantilla.                               |
| PATCH /api/flows/{id}                    | No necesario para MVP; permitiría cambiar estado con flows:write. |

La alerta “flow sin envíos durante 7 días” debe evaluarse con Reporting API a nivel de flow y, cuando sea posible, mensaje. No basta con mirar updated_at o status: un flow puede estar live y no enviar porque no se activa el trigger.

# 10. Campañas y mensajes

Una campaña es un envío programado a listas o segmentos. La API estable devuelve metadatos de campaña y mensajes, pero no las métricas de rendimiento. Las métricas proceden de Reporting API.

klaviyo_campaigns  
├── klaviyo_campaign_messages  
└── klaviyo_campaign_audience_links → lists / segments

| **Endpoint estable**                      | **Uso**                                                                         |
|-------------------------------------------|---------------------------------------------------------------------------------|
| GET /api/campaigns                        | Campañas filtradas por channel, status, archived, created_at y scheduled_at.    |
| GET /api/campaigns/{id}                   | Campaña concreta.                                                               |
| GET /api/campaigns/{id}/campaign-messages | Mensajes relacionados.                                                          |
| GET /api/campaign-messages/{id}           | Canal, contenido y metadatos de un mensaje.                                     |
| GET template relationship                 | Vincular mensaje con plantilla cuando proceda.                                  |
| Recipient estimation/send jobs            | Fuera del MVP analítico; necesarios si EcomScaling envía campañas desde la app. |

| La nueva Campaigns API 2026-04-15.pre introduce campaign → audience → message → variation y varios canales dentro de una campaña. La base propuesta se deja preparada, pero el código productivo debe usar el contrato estable hasta revalidar la GA. |
|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

# 11. Formularios

Forms API permite listar formularios y conocer nombre, estado, fechas y si existe A/B test. El endpoint de objetos no entrega por sí solo impresiones, envíos o tasa de conversión; esos datos se solicitan mediante Reporting API.

| **Endpoint**                  | **Uso**                               |
|-------------------------------|---------------------------------------|
| GET /api/forms                | Sincronizar todos los formularios.    |
| Filtros por updated_at/status | Sincronización incremental.           |
| POST /api/form-values-reports | Totales de rendimiento en un periodo. |
| POST /api/form-series-reports | Serie por hora, día, semana o mes.    |

La alerta del briefing “pop-up convirtiendo por debajo del 2 %” se calcula con las estadísticas oficiales del formulario. La base no debe asumir únicamente views y submissions: debe guardar statistic_name y valor para soportar los nombres y métricas que exponga cada revisión.

# 12. Métricas y eventos

En Klaviyo, una metric es una categoría de evento: Opened Email, Clicked Email, Placed Order, Received Email, etc. Un event es una ocurrencia concreta asociada a una métrica y, normalmente, a un profile.

| **API**                 | **Cuándo usarla**                                                             |
|-------------------------|-------------------------------------------------------------------------------|
| Metrics API             | Descubrir metric_id, nombre e integración de origen.                          |
| Events API              | Actividad granular. No necesaria para el dashboard agregado del MVP.          |
| Query Metric Aggregates | Crear análisis propios por fecha del evento, filtros y agrupaciones.          |
| Reporting API           | Reproducir cifras de campañas, flows, forms y segmentos mostradas en Klaviyo. |

| Para “% de facturación por email” y rendimiento de campañas/flows debemos usar Reporting API con un conversion_metric_id acordado. No sumar indiscriminadamente eventos Placed Order porque pueden existir varias métricas similares o una métrica personalizada de revenue. |
|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

La tabla klaviyo_metrics es necesaria para registrar los IDs de métricas disponibles por cuenta y seleccionar cuál representa la conversión/revenue oficial de esa organización.

# 13. Reporting API

Reporting API devuelve resultados equivalentes a la interfaz de Klaviyo para campañas, flows, formularios y segmentos. Existen informes de valores y de series.

| **Tipo**          | **Descripción**                                           | **Recursos**                        |
|-------------------|-----------------------------------------------------------|-------------------------------------|
| Values report     | Totales para un periodo.                                  | Campaign, flow, form, segment.      |
| Series report     | Datos divididos por hora, día, semana o mes.              | Flow, form, segment.                |
| Conversion metric | Métrica usada para conversiones e ingresos atribuidos.    | Obligatoria en informes relevantes. |
| Timeframe         | Predefinido o custom, con máximo de un año por solicitud. | Todos los reports.                  |

| **Endpoint**                      | **Finalidad**                       |
|-----------------------------------|-------------------------------------|
| POST /api/campaign-values-reports | Totales de rendimiento de campañas. |
| POST /api/flow-values-reports     | Totales de flows.                   |
| POST /api/flow-series-reports     | Evolución temporal de flows.        |
| POST /api/form-values-reports     | Totales de formularios.             |
| POST /api/form-series-reports     | Evolución de formularios.           |
| POST /api/segment-values-reports  | Totales de segmentos.               |
| POST /api/segment-series-reports  | Evolución de segmentos.             |

Las cuotas de Reporting API son bajas frente a endpoints de lectura ordinaria. Por ejemplo, Flow Values documenta 1 solicitud por segundo, 2 por minuto y 225 por día. Por eso hay que agrupar entidades, cachear resultados y no solicitar cada KPI individualmente desde el dashboard.

Job programado  
→ crea report request con múltiples statistics y entidades  
→ persiste klaviyo_report_runs  
→ normaliza cada resultado en klaviyo_report_values  
→ calcula resumen diario por cuenta  
→ evalúa alertas

# 14. Webhooks y sincronización incremental

Klaviyo distingue Flow webhooks y System webhooks. Los Flow webhooks son acciones configuradas manualmente dentro de un flow que envían un payload personalizado. Los System webhooks notifican eventos predefinidos, pero la documentación limita su gestión a clientes Advanced KDP y partners de aplicaciones.

| **Mecanismo**        | **Uso recomendado**                                                                     |
|----------------------|-----------------------------------------------------------------------------------------|
| System webhooks      | Complemento si EcomScaling obtiene acceso como app partner; no dependencia obligatoria. |
| Flow webhooks        | Solo para casos diseñados explícitamente; no sustituyen la sincronización general.      |
| Polling incremental  | Mecanismo base para flows, campañas, forms, listas y segmentos.                         |
| Reporting programado | Mecanismo base para rendimiento y alertas.                                              |
| Reconciliación       | Lectura completa periódica para corregir eventos perdidos.                              |

Si se habilitan System webhooks, los payloads deben entrar en private.webhook_events, validarse, deduplicarse y procesarse de forma idempotente. Los temas disponibles incluyen eventos de email, SMS, push, reviews y consentimiento.

# 15. Límites, paginación y gestión de errores

Los límites son por cuenta y endpoint. Klaviyo utiliza dos ventanas: burst de un segundo y steady de un minuto. OAuth recibe una cuota independiente por instalación, lo que beneficia a una plataforma multi-tenant frente a compartir una Private API Key.

| **Clase habitual** | **Burst** | **Steady**                        |
|--------------------|-----------|-----------------------------------|
| XS                 | 1/s       | 15/min                            |
| S                  | 3/s       | 60/min                            |
| M                  | 10/s      | 150/min                           |
| L                  | 75/s      | aprox. 700-750/min según endpoint |
| XL                 | 350/s     | 3500/min                          |

- Leer RateLimit-Limit, RateLimit-Remaining y RateLimit-Reset en respuestas normales.

- Cuando llegue HTTP 429, respetar Retry-After y aplicar backoff con jitter.

- Usar cursor pagination hasta que no exista next link.

- Evitar include y additional-fields masivos: algunos reducen drásticamente el rate limit.

- Guardar cursor y watermark updated_at en integration_sync_runs.

- Reintentar 5xx e interrupciones de red de forma idempotente; no reintentar errores de validación sin corregir payload.

- Limitar concurrencia por connection_id para no saturar una cuenta concreta.

# 16. Scopes mínimos

Para un MVP de lectura y análisis deben solicitarse scopes mínimos. Pedir permisos de escritura sin usarlos dificulta la revisión de la aplicación y aumenta el riesgo.

| **Scope**           | **Necesidad**                                                                    |
|---------------------|----------------------------------------------------------------------------------|
| accounts:read       | Identificar cuenta, timezone, moneda y site ID.                                  |
| flows:read          | Flows, acciones, mensajes y reporting de flows.                                  |
| campaigns:read      | Campañas, mensajes y reporting de campañas.                                      |
| forms:read          | Formularios y reporting.                                                         |
| lists:read          | Listas y tamaños.                                                                |
| segments:read       | Segmentos, tamaños y reporting.                                                  |
| metrics:read        | Descubrir conversion metric y métricas disponibles.                              |
| events:read         | Opcional; solo si se implementan análisis granulares no cubiertos por reporting. |
| templates:read      | Opcional; si se analiza contenido de emails.                                     |
| webhooks:read/write | Solo si la cuenta/app tiene acceso a System webhooks.                            |
| profiles:read       | No solicitar en MVP salvo necesidad funcional aprobada.                          |

# 17. Mapeo funcional con EcomScaling IA

| **Funcionalidad del briefing** | **Fuente Klaviyo**                          | **Cálculo/observación**                                                    |
|--------------------------------|---------------------------------------------|----------------------------------------------------------------------------|
| % facturación por email        | Campaign + Flow Reporting API.              | Revenue atribuido / revenue Shopify; definir conversion_metric_id oficial. |
| Flow sin envíos 7 días         | Flow Series/Values.                         | Recipients, delivered u otra statistic de envío igual a 0 durante 7 días.  |
| Campañas históricas            | Campaigns API + Campaign Values.            | Metadatos y rendimiento se sincronizan por separado.                       |
| Última campaña enviada         | Campaign status/scheduled_at + reporting.   | No confundir campaña planificada interna con campaña real.                 |
| Pop-up por debajo del 2 %      | Forms API + Form Series.                    | Usar views/submissions o statistic oficial equivalente.                    |
| Ingresos por flow              | Flow Reporting API.                         | Conversion value según métrica de conversión elegida.                      |
| Apertura y clics               | Reporting API.                              | Los nombres exactos se guardan como statistics flexibles.                  |
| Tamaño de audiencia            | List/segment profile_count y report series. | Snapshot diario; no copiar miembros.                                       |
| Consultor IA                   | Datos agregados y metadatos.                | No exponer PII ni contenido personal sin autorización y necesidad.         |

# 18. Consecuencias para la base de datos

El esquema previo debe cambiar en los siguientes puntos:

- Sustituir klaviyo_accounts por una versión que refleje account_id, timezone, currency, site_id, revision y sincronización.

- Añadir klaviyo_lists y klaviyo_segments; no mezclar ambas audiencias.

- Añadir snapshots de profile_count en vez de almacenar miembros.

- Sustituir klaviyo_flows por una versión con trigger_type, archived, status y raw_data.

- Añadir klaviyo_flow_actions y klaviyo_flow_messages.

- Sustituir klaviyo_campaigns y añadir klaviyo_campaign_messages y audience links.

- Mantener klaviyo_forms, pero permitir A/B test y raw_data.

- Añadir klaviyo_metrics para seleccionar la métrica de conversión oficial.

- Eliminar tablas rígidas flow_daily_metrics, campaign_daily_metrics y form_daily_metrics.

- Añadir klaviyo_report_runs y klaviyo_report_values con statistic_name flexible.

- Redefinir klaviyo_daily_account_metrics como tabla derivada calculada por EcomScaling, no como respuesta cruda de Klaviyo.

- No añadir klaviyo_profiles ni klaviyo_events en el MVP.

| El modelo propuesto mantiene datos externos normalizados y datos calculados separados. Esto permite reconstruir el dashboard, cambiar fórmulas y auditar la procedencia de cada KPI. |
|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

# 19. Catálogo de endpoints relevantes

| **Dominio** | **Método** | **Endpoint**                            | **Finalidad**                                        |
|-------------|------------|-----------------------------------------|------------------------------------------------------|
| OAuth       | GET        | https://www.klaviyo.com/oauth/authorize | Solicitar autorización y scopes.                     |
| OAuth       | POST       | https://a.klaviyo.com/oauth/token       | Canjear code o refrescar access token.               |
| OAuth       | POST       | https://a.klaviyo.com/oauth/revoke      | Revocar tokens al desconectar.                       |
| Accounts    | GET        | /api/accounts                           | Obtener la cuenta del token.                         |
| Accounts    | GET        | /api/accounts/{id}                      | Cuenta concreta.                                     |
| Lists       | GET        | /api/lists                              | Listar audiencias estáticas.                         |
| Lists       | GET        | /api/lists/{id}                         | Lista y profile_count opcional.                      |
| Lists       | GET        | /api/lists/{id}/profiles                | Miembros; no sincronizar en MVP.                     |
| Segments    | GET        | /api/segments                           | Listar segmentos dinámicos.                          |
| Segments    | GET        | /api/segments/{id}                      | Segmento y profile_count opcional.                   |
| Segments    | GET        | /api/segments/{id}/profiles             | Miembros; no sincronizar en MVP.                     |
| Flows       | GET        | /api/flows                              | Listar flows.                                        |
| Flows       | GET        | /api/flows/{id}                         | Flow concreto.                                       |
| Flows       | GET        | /api/flows/{id}/flow-actions            | Acciones del flow.                                   |
| Flows       | GET        | /api/flow-actions/{id}                  | Acción concreta.                                     |
| Flows       | GET        | /api/flow-actions/{id}/flow-messages    | Mensajes de la acción.                               |
| Flows       | GET        | /api/flow-messages/{id}                 | Mensaje concreto.                                    |
| Flows       | GET        | /api/flow-messages/{id}/template        | Plantilla vinculada.                                 |
| Campaigns   | GET        | /api/campaigns                          | Listar campañas.                                     |
| Campaigns   | GET        | /api/campaigns/{id}                     | Campaña concreta.                                    |
| Campaigns   | GET        | /api/campaigns/{id}/campaign-messages   | Mensajes de campaña.                                 |
| Campaigns   | GET        | /api/campaign-messages/{id}             | Mensaje concreto.                                    |
| Forms       | GET        | /api/forms                              | Listar formularios.                                  |
| Metrics     | GET        | /api/metrics                            | Descubrir métricas y metric_id.                      |
| Events      | GET        | /api/events                             | Eventos granulares; opcional.                        |
| Aggregates  | POST       | /api/metric-aggregates                  | Agregación por fecha de evento; análisis propios.    |
| Reporting   | POST       | /api/campaign-values-reports            | Rendimiento de campañas.                             |
| Reporting   | POST       | /api/flow-values-reports                | Totales de flows.                                    |
| Reporting   | POST       | /api/flow-series-reports                | Serie temporal de flows.                             |
| Reporting   | POST       | /api/form-values-reports                | Totales de forms.                                    |
| Reporting   | POST       | /api/form-series-reports                | Serie temporal de forms.                             |
| Reporting   | POST       | /api/segment-values-reports             | Totales de segmentos.                                |
| Reporting   | POST       | /api/segment-series-reports             | Serie temporal de segmentos.                         |
| Webhooks    | GET        | /api/webhooks                           | Webhooks configurados; acceso restringido.           |
| Webhooks    | POST       | /api/webhooks                           | Crear system webhook; acceso restringido.            |
| Webhooks    | GET        | /api/webhook-topics                     | Temas disponibles.                                   |
| Privacy     | POST       | Data Privacy API deletion endpoint      | Borrado si se almacenan perfiles en una fase futura. |

# 20. Decisiones pendientes

- Definir qué metric_id representa la conversión/revenue oficial de cada cliente: Placed Order de Shopify u otra métrica personalizada.

- Decidir si el MVP necesita análisis de contenido de emails; si no, no solicitar templates:read.

- Definir frecuencia de actualización: campañas/flows, reporting y formularios.

- Decidir si EcomScaling IA será solo lectura o permitirá pausar flows y crear/enviar campañas en fases futuras.

- Reauditar Campaigns API después del 15 de julio de 2026 antes de implementar el conector.

- Confirmar elegibilidad para System webhooks como app partner; el sistema no dependerá de ellos.

- Definir retención de raw_data y report results.

- Validar estadísticas exactas devueltas por Reporting API con una cuenta real de Klaviyo antes de cerrar alertas y nombres de KPIs.

- Definir si el porcentaje de facturación por email se comparará con revenue Shopify bruto, neto, con o sin devoluciones y en qué timezone.

# 21. Fuentes oficiales

| **Fuente**                    | **URL**                                                                 |
|-------------------------------|-------------------------------------------------------------------------|
| API overview                  | https://developers.klaviyo.com/en/reference/api_overview                |
| OAuth                         | https://developers.klaviyo.com/en/docs/set_up_oauth                     |
| Rate limits and errors        | https://developers.klaviyo.com/en/docs/rate_limits_and_error_handling   |
| Accounts API                  | https://developers.klaviyo.com/en/reference/get_accounts                |
| Profiles API overview         | https://developers.klaviyo.com/en/reference/profiles_api_overview       |
| Lists API overview            | https://developers.klaviyo.com/en/reference/lists_api_overview          |
| Segments API overview         | https://developers.klaviyo.com/en/reference/segments_api_overview       |
| Flows API overview            | https://developers.klaviyo.com/en/reference/flows_api_overview          |
| Campaigns API overview        | https://developers.klaviyo.com/en/reference/campaigns_api_overview      |
| Campaigns beta 2026-04-15.pre | https://developers.klaviyo.com/en/reference/campaigns_omni_api_overview |
| Forms API overview            | https://developers.klaviyo.com/en/reference/forms_api_overview          |
| Metrics API overview          | https://developers.klaviyo.com/en/reference/metrics_api_overview        |
| Events API overview           | https://developers.klaviyo.com/en/reference/events_api_overview         |
| Reporting API overview        | https://developers.klaviyo.com/en/reference/reporting_api_overview      |
| Webhooks API overview         | https://developers.klaviyo.com/en/reference/webhooks_api_overview       |
| Changelog                     | https://developers.klaviyo.com/en/docs/changelog\_                      |

Nota de control: esta guía refleja la documentación consultada el 13 de julio de 2026. Klaviyo utiliza revisiones fechadas; cualquier implementación debe fijar el header revision y revalidar el contrato antes de actualizarlo.
