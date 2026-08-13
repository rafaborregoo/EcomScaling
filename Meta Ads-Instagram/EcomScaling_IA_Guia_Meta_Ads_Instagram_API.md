# EcomScaling IA

> **Alineación con el producto (2026-08-02):** esta guía describe la API de referencia;
> el estado implementado y el criterio de activación de EcomScaling están en
> [`../roadmap/roadmaps/04-integraciones/CONTRATO_PREPARACION_CONECTORES.md`](../roadmap/roadmaps/04-integraciones/CONTRATO_PREPARACION_CONECTORES.md).
> Shopify sigue siendo la única integración operativa. Meta Ads e Instagram no deben
> fabricar activos o métricas mientras falten credenciales, permisos o App Review.

## Aplicación en EcomScaling

Esta guía debe leerse junto con el [objetivo global del SaaS y sus criterios de terminado](../docs/OBJETIVO_SAAS_PILOTO_Y_CRITERIOS_DE_TERMINADO.md):
Shopify es la integración operativa actual y Meta Ads/Instagram se preparan para activarse con credenciales
reales sin rehacer la UI, los contratos de dominio ni los agentes. Los ejemplos de esta guía son contratos
y casos de integración; no autorizan a inventar cuentas, métricas o resultados en producción.
Guía técnica de Meta Ads  
e Instagram Graph API

Arquitectura, endpoints, métricas, sincronización y ajustes de base de datos

*Documento técnico para desarrollo · Julio 2026*

> **Alcance de la auditoría Se han revisado las superficies de API necesarias para EcomScaling IA: lectura de cuentas publicitarias, campañas, conjuntos, anuncios, creatividades, Ads Insights, contenido orgánico de Instagram, Insights de cuenta y medios, webhooks, autenticación, límites y sincronización. No se auditan funcionalidades que el producto no necesita en su MVP, como creación automática de campañas, mensajes directos, comentarios, catálogos o publicación de contenido.**

# 1. Conclusiones ejecutivas

- Meta Ads e Instagram utilizan la infraestructura Graph API, pero son superficies distintas: Marketing API para publicidad e Instagram Platform para contenido orgánico e Insights.

- La jerarquía publicitaria correcta es cuenta publicitaria → campaña → conjunto de anuncios → anuncio → creatividad.

- La tabla actual de métricas de Meta es demasiado rígida: conversiones, valores y ROAS llegan como métricas tipadas por action_type y dependen de ventanas de atribución.

- Hook rate y hold rate deben almacenarse como métricas calculadas con fórmula versionada; no deben tratarse como columnas nativas garantizadas por Meta.

- Las creatividades dinámicas o Advantage+ pueden contener múltiples imágenes, vídeos, titulares y textos. Una sola fila con un único media_url no representa correctamente esos anuncios.

- Instagram solo permite análisis de cuentas profesionales autorizadas. La ruta con Facebook Login requiere una Página vinculada; la ruta con Instagram Login tiene capacidades distintas y no sirve para acceder a Ads.

- Instagram no ofrece atribución fiable de seguidores ganados a una publicación individual. El registro manual de “ganadores de seguidores” continúa siendo necesario.

- Los Insights deben sincronizarse periódicamente y reconsultar días recientes porque las conversiones atribuidas pueden llegar o revisarse con retraso.

> **Decisión recomendada Para EcomScaling IA se recomienda una única autorización Meta mediante Facebook Login for Business, desde la que el usuario seleccione cuentas publicitarias, Páginas y cuentas profesionales de Instagram. Las métricas pagadas y orgánicas deben mantenerse separadas para evitar duplicidades.**

# 2. Cómo encaja Meta en EcomScaling IA

Meta no expone una única API monolítica. La integración se compone de varias superficies conectadas por Graph API:

| **Superficie**         | **Finalidad en EcomScaling IA**                                                   | **Se usa en MVP** |
|------------------------|-----------------------------------------------------------------------------------|-------------------|
| Graph API              | Modelo común de nodos, edges, campos, tokens, paginación y versionado.            | Sí                |
| Marketing API          | Leer cuentas publicitarias, campañas, conjuntos, anuncios y creatividades.        | Sí                |
| Ads Insights API       | Obtener inversión, alcance, clics, conversiones, ROAS y métricas de vídeo.        | Sí                |
| Instagram Platform     | Leer cuenta profesional, publicaciones, reels y métricas orgánicas.               | Fase 3            |
| Webhooks               | Notificar determinados cambios de cuentas publicitarias, comentarios o menciones. | Parcial           |
| Conversions API        | Enviar eventos del servidor a Meta para medición y optimización.                  | No inicialmente   |
| Content Publishing API | Publicar imágenes, reels, carruseles o stories.                                   | No                |

La Marketing API es una colección de endpoints Graph API para gestionar y consultar publicidad. Ads Insights es la superficie específica de reporting. Instagram Platform permite trabajar con cuentas profesionales y sus medios. [S1][S2][S10]

# 3. Modelo Graph API: nodos, edges y fields

Cada recurso tiene un identificador y se consulta mediante una URL versionada. Un nodo representa un objeto; un edge representa una colección conectada; fields limita los datos solicitados.

GET https://graph.facebook.com/{api-version}/{object-id}?fields=id,name,status

GET https://graph.facebook.com/{api-version}/act\_{ad-account-id}/campaigns?fields=id,name,status,effective_status

La versión de API debe ser configurable. Esta auditoría utiliza como referencia la documentación v25.0 disponible en julio de 2026, pero el código no debe fijar permanentemente ese valor.

# 4. Autenticación y selección de activos

El cliente no introduce manualmente IDs de campañas o publicaciones. Autoriza la aplicación mediante OAuth, y el backend enumera los activos a los que tiene acceso.

1.  El usuario inicia “Conectar Meta”.

2.  Meta muestra el consentimiento y los permisos solicitados.

3.  El backend intercambia el código por un token y lo almacena cifrado.

4.  La aplicación consulta cuentas publicitarias, Páginas y cuentas profesionales de Instagram disponibles.

5.  El usuario selecciona qué activos pertenecen a la organización de EcomScaling.

6.  Se ejecuta la importación inicial y después sincronizaciones incrementales.

| **Permiso**               | **Uso previsto**                                                                       |
|---------------------------|----------------------------------------------------------------------------------------|
| ads_read                  | Lectura de cuentas, estructura publicitaria e Insights.                                |
| business_management       | Enumeración y acceso a activos empresariales cuando el modelo de permisos lo requiera. |
| pages_show_list           | Listar las Páginas administradas por el usuario.                                       |
| pages_read_engagement     | Consultar metadatos de la Página vinculada.                                            |
| instagram_basic           | Leer perfil y medios de la cuenta profesional.                                         |
| instagram_manage_insights | Leer Insights de cuenta y medios de Instagram.                                         |

Meta exige permisos y, para operar con clientes externos, revisión y acceso adecuado de la aplicación. Los permisos de Insights de Instagram se conceden mediante instagram_manage_insights. [S12][S13]

> **Seguridad Los tokens no deben almacenarse en tablas públicas ni enviarse al navegador. Deben permanecer cifrados en el backend o en un esquema privado, con registro de scopes, expiración y motivo de reconexión.**

# 5. Jerarquía de objetos de Meta Ads

Meta Business / usuario autorizado  
└── Ad Account  
└── Campaign  
└── Ad Set  
└── Ad  
└── Ad Creative  
└── Creative Assets

## 5.1 Cuenta publicitaria

La cuenta agrupa campañas, moneda, zona horaria, estado, límites y configuración. EcomScaling puede gestionar varias cuentas por organización.

## 5.2 Campaña

Es el nivel estratégico superior. Define el objetivo, estado, tipo de compra y, cuando procede, presupuesto a nivel campaña. Meta describe la campaña como el nivel organizativo superior dentro de la cuenta. [S3]

## 5.3 Conjunto de anuncios

Agrupa anuncios que comparten presupuesto o configuración, calendario, optimización, puja, audiencia, ubicaciones y objeto promocionado. [S4]

## 5.4 Anuncio

Es la unidad de entrega asociada a un conjunto y una creatividad. El anuncio tiene estado configurado y estado efectivo, que puede diferir por revisión, incidencias o estado de niveles superiores.

## 5.5 Creatividad y activos

La creatividad contiene los elementos necesarios para representar el anuncio. Una creatividad clásica puede tener una imagen o vídeo, texto y titular; una creatividad dinámica puede contener varias alternativas de cada activo. [S5]

# 6. Endpoints relevantes de Marketing API

Las siguientes rutas cubren la lectura necesaria para EcomScaling IA. No se incluyen endpoints de creación o modificación porque el producto se plantea inicialmente como sistema de análisis y recomendaciones.

| **Ruta**                              | **Qué devuelve**                                                       | **Uso**             |
|---------------------------------------|------------------------------------------------------------------------|---------------------|
| GET /me/adaccounts                    | Lista las cuentas publicitarias accesibles por el usuario autorizado.  | Onboarding          |
| GET /{business-id}/owned_ad_accounts  | Cuentas propiedad del Business.                                        | Onboarding opcional |
| GET /{business-id}/client_ad_accounts | Cuentas de clientes compartidas con el Business.                       | Onboarding opcional |
| GET /act\_{account-id}                | Metadatos de una cuenta publicitaria concreta.                         | Cuenta              |
| GET /act\_{account-id}/campaigns      | Importa campañas de la cuenta.                                         | Estructura          |
| GET /act\_{account-id}/adsets         | Importa conjuntos de anuncios.                                         | Estructura          |
| GET /act\_{account-id}/ads            | Importa anuncios.                                                      | Estructura          |
| GET /act\_{account-id}/adcreatives    | Importa creatividades.                                                 | Estructura          |
| GET /{campaign-id}                    | Refresca una campaña concreta.                                         | Incremental         |
| GET /{adset-id}                       | Refresca un conjunto concreto.                                         | Incremental         |
| GET /{ad-id}                          | Refresca un anuncio y su referencia creativa.                          | Incremental         |
| GET /{creative-id}                    | Lee especificaciones y activos de una creatividad.                     | Creativos           |
| GET /{ad-id}/previews                 | Obtiene una previsualización renderizada del anuncio, cuando sea útil. | Opcional            |
| GET /act\_{account-id}/activities     | Historial de determinados cambios de la cuenta.                        | Auditoría opcional  |

Los edges de campañas, conjuntos y anuncios se encuentran en la referencia oficial de Marketing API. [S6][S7]

# 7. Ads Insights API

Ads Insights devuelve estadísticas de rendimiento y permite personalizar nivel, periodo, campos, filtros y breakdowns. [S2]

| **Ruta**                                       | **Finalidad**                                         |
|------------------------------------------------|-------------------------------------------------------|
| GET /act\_{account-id}/insights?level=account  | Totales de la cuenta.                                 |
| GET /act\_{account-id}/insights?level=campaign | Una fila por campaña.                                 |
| GET /act\_{account-id}/insights?level=adset    | Una fila por conjunto.                                |
| GET /act\_{account-id}/insights?level=ad       | Una fila por anuncio; base del ranking de creativos.  |
| GET /{campaign-id}/insights                    | Rendimiento de una campaña concreta.                  |
| GET /{adset-id}/insights                       | Rendimiento de un conjunto concreto.                  |
| GET /{ad-id}/insights                          | Rendimiento de un anuncio concreto.                   |
| GET /act\_{account-id}/insights?async=true     | Crea un informe asíncrono para consultas voluminosas. |
| GET /{report-run-id}                           | Consulta estado y porcentaje de finalización.         |
| GET /{report-run-id}/insights                  | Descarga el resultado del informe terminado.          |

## 7.1 Métricas base

| **Categoría** | **Campos típicos**                                            | **Uso**                              |
|---------------|---------------------------------------------------------------|--------------------------------------|
| Entrega       | impressions, reach, frequency                                 | Cobertura, saturación y fatiga.      |
| Tráfico       | clicks, inline_link_clicks, outbound_clicks                   | Respuesta y tráfico generado.        |
| Coste         | spend, cpm, cpc, cpp                                          | Eficiencia del presupuesto.          |
| Ratios        | ctr, inline_link_click_ctr                                    | Eficiencia de clic.                  |
| Conversiones  | actions, action_values, cost_per_action_type                  | Compras, leads y otros eventos.      |
| ROAS          | purchase_roas u otros arrays de retorno                       | Retorno atribuido según action type. |
| Vídeo         | video\_\*\_watched_actions, thruplay y tiempo de reproducción | Análisis de hooks y retención.       |

> **Punto crítico Meta no devuelve una única “cantidad de compras” universal. El array actions puede contener varios action_type, por ejemplo compras del píxel, compras omnicanal u otros eventos. La base de datos debe conservar el action_type y no colapsarlo prematuramente.**

## 7.2 Parámetros que cambian el significado de una métrica

| **Parámetro**              | **Efecto**                                                                           |
|----------------------------|--------------------------------------------------------------------------------------|
| level                      | Determina si la fila representa cuenta, campaña, conjunto o anuncio.                 |
| time_range / date_preset   | Define el intervalo analizado.                                                       |
| time_increment             | Devuelve totales o series diarias/semanales/mensuales.                               |
| breakdowns                 | Segmenta por plataforma, ubicación, dispositivo, país u otras dimensiones admitidas. |
| action_breakdowns          | Segmenta arrays de acciones, normalmente por action_type.                            |
| action_attribution_windows | Define ventanas de atribución incluidas.                                             |
| action_report_time         | Controla si la acción se informa por impresión, conversión o combinación admitida.   |
| filtering                  | Restringe entidades o resultados.                                                    |

Los breakdowns pueden devolver valores estimados, y no todas las combinaciones son compatibles. [S8]

## 7.3 Atribución y revisiones retroactivas

Una compra puede atribuirse días después del clic o impresión. Por ello, la fila del 1 de julio puede cambiar al volver a consultarse el 5 de julio. El sistema debe:

- Guardar la configuración de atribución usada para cada informe.

- Reconsultar una ventana móvil de días recientes en cada sincronización.

- Hacer upsert por cuenta, nivel, entidad, fecha, breakdown y configuración de atribución.

- Diferenciar métricas observadas de métricas calculadas por EcomScaling.

## 7.4 Informes asíncronos, paginación y límites

Para consultas pequeñas se usa el modo síncrono. Para cuentas grandes, muchos campos, breakdowns o periodos amplios, Meta recomienda informes asíncronos y consultas más pequeñas para evitar timeouts. [S9]

1. Solicitar Insights con async=true  
2. Guardar report_run_id  
3. Consultar async_status y async_percent_completion  
4. Descargar /{report_run_id}/insights  
5. Paginar y hacer upsert  
6. Registrar el job en integration_sync_runs/meta_insight_report_runs

Los límites se controlan mediante cabeceras de uso como X-Business-Use-Case-Usage. La integración debe aplicar colas, backoff y prioridad por cuenta. [S11]

# 8. Creatividades, anuncios dinámicos y análisis de contenido pagado

El esquema original suponía una creatividad con un único vídeo o imagen, un texto y un titular. Ese modelo falla con creatividades dinámicas, personalización por placement y productos Advantage+, donde una creatividad puede agrupar múltiples activos.

Ad  
└── AdCreative  
├── image asset A  
├── image asset B  
├── video asset A  
├── primary text A/B  
├── headline A/B  
└── description / CTA / URL

- meta_creatives conserva la cabecera y la especificación original.

- meta_creative_assets conserva cada imagen, vídeo, texto, titular o descripción.

- meta_ads relaciona el anuncio con la creatividad activa.

- Insights a nivel ad determina qué anuncio rinde; el rendimiento de cada asset individual solo está disponible en determinados informes y formatos, por lo que no debe prometerse siempre.

# 9. Hook rate y hold rate

El briefing usa hook rate y hold rate como KPIs de creatividad. Meta ofrece conteos de reproducción y visualización, pero la fórmula comercial debe definirse en EcomScaling.

| **Métrica EcomScaling** | **Ejemplo de fórmula**                                                | **Observación**                           |
|-------------------------|-----------------------------------------------------------------------|-------------------------------------------|
| Hook rate               | reproducciones de 3 segundos / impresiones o reproducciones iniciadas | La elección del denominador debe fijarse. |
| Hold rate               | ThruPlay o reproducciones de 15 s / reproducciones de 3 s             | Debe adaptarse a la duración del vídeo.   |

> **Requisito de trazabilidad Cada valor calculado debe guardar formula_code y formula_version. Cambiar la fórmula sin versionado haría incomparables los históricos.**

# 10. Webhooks y estrategia de sincronización de Meta Ads

Meta dispone de webhooks para determinadas modificaciones de cuentas publicitarias. No sustituyen la extracción periódica de Insights. [S14][S15]

```text
Autorización Meta
↓
Importación inicial de estructura
↓
Informe histórico asíncrono
↓
Sincronización periódica de Insights
↓
Webhooks para cambios estructurales o incidencias admitidas
↓
Reconciliación diaria de campañas, anuncios y permisos
```

- Cada webhook se valida y se guarda de forma idempotente.

- El webhook actúa como señal; el backend consulta el objeto actualizado.

- El dashboard muestra last_successful_sync_at y no afirma ser tiempo real.

# 11. Instagram Platform

Instagram Platform permite acceder a datos de cuentas profesionales —Business y Creator— y a sus medios e Insights. [S10][S12]

## 11.1 Dos modelos de autenticación

| **Modelo**                        | **Ventajas**                                                                                       | **Limitaciones para EcomScaling**                                    |
|-----------------------------------|----------------------------------------------------------------------------------------------------|----------------------------------------------------------------------|
| Instagram API con Facebook Login  | Permite descubrir la Página vinculada, la cuenta profesional y convivir con activos publicitarios. | Requiere Página vinculada y permisos de Facebook.                    |
| Instagram API con Instagram Login | Inicio directo con Instagram y no siempre requiere Página.                                         | No permite acceder a Ads ni tagging en la configuración documentada. |

Para un SaaS que analiza Meta Ads e Instagram conjuntamente, Facebook Login es la opción más coherente. La colección oficial de Meta confirma que la configuración con Instagram Login no accede a Ads. [S16]

## 11.2 Endpoints relevantes de Instagram

| **Ruta**                                                                   | **Finalidad**                                                     |
|----------------------------------------------------------------------------|-------------------------------------------------------------------|
| GET /me/accounts?fields=name,access_token,tasks,instagram_business_account | Lista Páginas y cuenta de Instagram vinculada.                    |
| GET /{page-id}?fields=instagram_business_account                           | Obtiene el IG User ID de una Página conocida.                     |
| GET /{ig-user-id}?fields=...                                               | Lee perfil profesional, username, seguidores, medios y metadatos. |
| GET /{ig-user-id}/media?fields=...                                         | Lista posts, reels, stories disponibles y carruseles.             |
| GET /{ig-media-id}?fields=...                                              | Refresca un medio concreto.                                       |
| GET /{ig-media-id}/children                                                | Obtiene elementos hijos de un carrusel.                           |
| GET /{ig-media-id}/insights?metric=...                                     | Obtiene métricas del medio compatibles con su tipo.               |
| GET /{ig-user-id}/insights?metric=...&period=...                           | Obtiene métricas de la cuenta profesional.                        |

La colección oficial de Meta muestra el flujo para obtener Page Access Tokens e instagram_business_account. Todos los endpoints utilizan paginación por cursor; User Insights añade paginación temporal. [S16]

## 11.3 Datos de perfil y medios

- Cuenta: id, username, name, biography, website, profile_picture_url, followers_count, follows_count y media_count, según disponibilidad.

- Medio: id, caption, media_type, media_product_type, permalink, timestamp, thumbnail_url, media_url, username, like_count, comments_count y children, según tipo y permisos.

- Los elementos de carrusel deben representarse como hijos, no como publicaciones independientes sin contexto.

- Las URLs de medios no deben tratarse como almacenamiento permanente; se guarda la referencia y se refresca cuando sea necesario.

## 11.4 Insights de medios

Meta documenta métricas de interacción como comentarios, likes, views y total_interactions; la disponibilidad exacta depende del tipo de medio y de la versión. [S17]

| **Familia**         | **Ejemplos**                                               | **Precaución**                                            |
|---------------------|------------------------------------------------------------|-----------------------------------------------------------|
| Visibilidad         | views, reach y métricas equivalentes disponibles           | No todos los tipos devuelven las mismas métricas.         |
| Interacción         | likes, comments, shares, saved, total_interactions         | Algunas son acumuladas de vida del contenido.             |
| Vídeo/Reels         | views, tiempo de reproducción y retención cuando se admita | No confundir con métricas pagadas de Ads Insights.        |
| Actividad de perfil | profile activity/follows cuando la métrica esté disponible | No equivale necesariamente a seguidores ganados por post. |

> **Diseño recomendado No crear una columna permanente por cada métrica de Instagram. Guardar metric_name, period, value, breakdown y captured_at permite sobrevivir a altas, bajas o cambios de métricas sin migrar la base de datos cada vez.**

## 11.5 Insights de cuenta

Los Insights de cuenta representan métricas de la cuenta profesional. Meta documenta, entre otras, follows_and_unfollows, y la disponibilidad depende del periodo y requisitos de la cuenta. [S18]

- Se guardan como series o snapshots diarios.

- followers_count del perfil se conserva además como fotografía diaria para calcular crecimiento neto.

- El crecimiento diario de seguidores no demuestra qué publicación concreta los generó.

## 11.6 Limitación: seguidores ganados por publicación

La API no proporciona una atribución general y fiable de seguidores ganados a cada post o reel. Por tanto:

- instagram_follower_winners se mantiene como entrada manual mensual.

- La aplicación puede sugerir correlaciones entre publicaciones y crecimiento de cuenta, pero debe etiquetarlas como inferencias, no como atribución oficial.

- No debe prometerse una métrica automática que la API no entrega.

# 12. Separación entre Instagram orgánico e Instagram pagado

| **Origen**                   | **Qué mide**                                                                      | **Tabla**     |
|------------------------------|-----------------------------------------------------------------------------------|---------------|
| Instagram Platform           | Rendimiento orgánico y métricas del medio/cuenta profesional.                     | instagram\_\* |
| Marketing API / Ads Insights | Rendimiento pagado del anuncio servido en Instagram, Facebook u otros placements. | meta\_\*      |

Una publicación promocionada puede aparecer en ambos contextos. No se deben sumar automáticamente sus métricas sin conocer la definición y el alcance, porque podría producirse doble conteo.

# 13. Impacto en la base de datos

| **Tabla actual**           | **Problema**                                                  | **Ajuste**                                       |
|----------------------------|---------------------------------------------------------------|--------------------------------------------------|
| meta_ad_accounts           | Faltan estado, Business y datos de sincronización relevantes. | Ampliar.                                         |
| meta_campaigns             | Modelo insuficiente para objetivos, estados y categorías.     | Ampliar.                                         |
| meta_ad_sets               | Faltan puja, targeting, promoted_object y atribución.         | Ampliar.                                         |
| meta_creatives             | Supone un único activo.                                       | Mantener cabecera y añadir meta_creative_assets. |
| meta_ads                   | Faltan estados y trazabilidad de nomenclatura.                | Ampliar.                                         |
| meta_ad_daily_metrics      | Colapsa acciones, atribución y breakdowns.                    | Sustituir por tablas de Insights normalizadas.   |
| instagram_accounts         | No conserva Página vinculada ni snapshots de cuenta.          | Ampliar y añadir account insights.               |
| instagram_media            | No representa carruseles ni ciclo de URLs.                    | Ampliar y añadir children.                       |
| instagram_media_metrics    | Columnas rígidas y métricas variables.                        | Sustituir por snapshots genéricos.               |
| instagram_follower_winners | Correcta como entrada manual.                                 | Mantener con pequeños metadatos.                 |

# 14. Arquitectura de sincronización recomendada

```text
Meta OAuth
↓
Descubrir Business / Pages / Ad Accounts / Instagram Accounts
↓
Usuario selecciona activos de la organización
↓
Importar estructura publicitaria e Instagram media
↓
Crear informe histórico asíncrono de Ads Insights
↓
Guardar métricas normalizadas
↓
Sincronización periódica + relectura de días recientes
↓
Webhooks y reconciliación
↓
Cálculo de KPIs EcomScaling
↓
Alertas y tareas
```

| **Proceso**                | **Frecuencia orientativa**                    | **Motivo**                               |
|----------------------------|-----------------------------------------------|------------------------------------------|
| Estructura publicitaria    | Cada pocas horas + webhook/reconciliación     | Estados, nombres y nuevas entidades.     |
| Ads Insights diarios       | Varias veces al día                           | Dashboard y alertas.                     |
| Backfill de conversiones   | Releer últimos días                           | Atribución tardía y revisiones.          |
| Instagram media            | Cada pocas horas o diario                     | Nuevas publicaciones.                    |
| Instagram media insights   | Diario; más frecuente para contenido reciente | Ranking y evolución.                     |
| Instagram account insights | Diario                                        | Crecimiento y salud de cuenta.           |
| Permisos/tokens            | Diario y ante errores                         | Evitar conexiones silenciosamente rotas. |

# 15. Métricas calculadas por EcomScaling

| **KPI**                  | **Fuente**                                 | **Cálculo**                            |
|--------------------------|--------------------------------------------|----------------------------------------|
| ROAS Meta                | spend + action_values/purchase_roas        | Debe fijar action_type y atribución.   |
| CAC                      | spend + compras/clientes atribuidos        | spend / conversiones válidas.          |
| Hook rate                | impresiones/reproducciones y video 3s      | Fórmula versionada.                    |
| Hold rate                | video 3s, 15s, ThruPlay o porcentaje visto | Fórmula adaptada al vídeo.             |
| Creative fatigue         | frequency + evolución CTR/CPA/ROAS         | Regla EcomScaling, no campo universal. |
| Engagement rate orgánico | interacciones + reach/views                | Definir denominador por tipo de medio. |

# 16. Riesgos y límites que deben explicarse al cliente

- App Review y permisos: una integración que funciona con cuentas de prueba puede no estar lista para clientes reales.

- Los tokens pueden expirar o revocarse; la aplicación debe mostrar estado de conexión y permitir reconectar.

- Las métricas de Meta pueden ser estimadas, estar en desarrollo o cambiar con versiones.

- Las conversiones y ROAS dependen de atribución, configuración de eventos y calidad de medición del cliente.

- Las combinaciones de breakdowns están restringidas y las consultas complejas pueden fallar o requerir async.

- Instagram no garantiza las mismas métricas para imágenes, carruseles, stories y reels.

- No se debe llamar “tiempo real” a una integración basada en sincronizaciones periódicas.

# 17. Implementación recomendada por fases

## Fase 1 · Meta Ads para MVP

- OAuth, tokens cifrados y selección de cuenta.

- Cuentas, campañas, conjuntos, anuncios y creatividades.

- Insights diarios a nivel cuenta y anuncio.

- Spend, impressions, reach, frequency, clicks, CTR, CPC, CPM.

- Acciones y valores normalizados por action_type.

- ROAS, CAC, hook rate y hold rate calculados y versionados.

- Informes asíncronos, backfill, rate limiting y observabilidad.

## Fase 3 · Instagram orgánico

- Cuenta profesional y Página vinculada.

- Media, reels, carruseles y children.

- Snapshots genéricos de Insights de medios y cuenta.

- Ranking por views/reach/interacciones según disponibilidad.

- Ganadores de seguidores introducidos manualmente.

- Patrones de contenido generados por IA sobre métricas reales.

# 18. Checklist antes de cerrar el esquema

- Confirmar si una organización puede conectar varias cuentas publicitarias.

- Definir action_type oficial para “purchase” y ROAS del producto.

- Definir ventana de atribución que mostrará el dashboard.

- Definir fórmulas exactas de hook rate y hold rate.

- Decidir qué breakdowns se almacenan en MVP.

- Confirmar si se requiere análisis de assets individuales de creatividades dinámicas.

- Definir frecuencia de sincronización y ventana de backfill.

- Confirmar Facebook Login como flujo común para Ads + Instagram.

- Aceptar que seguidores por post seguirá siendo manual.

- Crear pruebas con cuenta real antes de prometer cada métrica en la interfaz.

# 19. Fuentes consultadas

| **Ref.** | **Documento**                                                | **URL**                                                                                                 |
|----------|--------------------------------------------------------------|---------------------------------------------------------------------------------------------------------|
| [S1]   | Marketing API - Meta for Developers                          | https://developers.facebook.com/documentation/ads-commerce/marketing-api                                |
| [S2]   | Ads Insights API - Meta for Developers                       | https://developers.facebook.com/documentation/ads-commerce/marketing-api/insights                       |
| [S3]   | Ad Campaign Group / Campaign reference - Meta for Developers | https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/ad-campaign-group    |
| [S4]   | Ad Set reference - Meta for Developers                       | https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/ad-campaign          |
| [S5]   | Ad Creative - Meta for Developers                            | https://developers.facebook.com/documentation/ads-commerce/marketing-api/creative                       |
| [S6]   | Marketing API Reference - Meta for Developers                | https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference                      |
| [S7]   | Ad Account Campaigns edge - Meta for Developers              | https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/ad-account/campaigns |
| [S8]   | Insights API Breakdowns - Meta for Developers                | https://developers.facebook.com/documentation/ads-commerce/marketing-api/insights/breakdowns            |
| [S9]   | Limits and Best Practices - Meta for Developers              | https://developers.facebook.com/documentation/ads-commerce/marketing-api/insights/best-practices        |
| [S10]  | Instagram Platform Overview - Meta for Developers            | https://developers.facebook.com/documentation/instagram-platform/overview                               |
| [S11]  | Graph API Rate Limits - Meta for Developers                  | https://developers.facebook.com/docs/graph-api/overview/rate-limiting/                                  |
| [S12]  | Instagram Account Insights - Meta for Developers             | https://developers.facebook.com/documentation/instagram-platform/api-reference/instagram-user/insights  |
| [S13]  | Meta Permissions Reference                                   | https://developers.facebook.com/docs/permissions/                                                       |
| [S14]  | Ad Account Webhooks Reference - Meta for Developers          | https://developers.facebook.com/docs/graph-api/webhooks/reference/ad-account/                           |
| [S15]  | Webhooks for Ad Accounts - Meta for Developers               | https://developers.facebook.com/docs/graph-api/webhooks/getting-started/webhooks-for-ad-accounts/       |
| [S16]  | Official Meta Instagram API Postman Collection               | https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api                              |
| [S17]  | Instagram Media Insights - Meta for Developers               | https://developers.facebook.com/documentation/instagram-platform/reference/instagram-media/insights/    |
| [S18]  | Instagram Insights Guide - Meta for Developers               | https://developers.facebook.com/documentation/instagram-platform/insights                               |

> **Estado del documento Este documento define la arquitectura técnica recomendada a partir de la documentación disponible en julio de 2026. Antes de implementar, se debe probar cada campo solicitado con una cuenta real autorizada, porque Meta aplica permisos, compatibilidades de métricas y cambios de versión que no pueden validarse únicamente con el diagrama.**
