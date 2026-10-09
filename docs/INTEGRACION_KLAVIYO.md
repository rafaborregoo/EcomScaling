# Integración con Klaviyo

Qué pide el módulo, por qué, y qué hacer cuando Klaviyo dice que no. Sigue el
patrón de [ADR-0006](decisions/ADR-0006-integration-module-pattern.md); para las
cifras de ingresos atribuidos manda
[ADR-0021](decisions/ADR-0021-ingresos-atribuidos-entre-integraciones.md).

## Dos formas de conectar

| | OAuth | Private API key (`pk_...`) |
|---|---|---|
| Permisos | Los scopes que pide el servidor (`KLAVIYO_SCOPES`) | Los que marques al crear la clave |
| Caducidad | Token con refresh automático | No caduca; se revoca a mano en Klaviyo |
| Cuándo | Opción recomendada | Si el OAuth del servidor no está configurado, o para pruebas |

El cliente HTTP distingue una de otra por el prefijo `pk_` y cambia la cabecera
`Authorization` (`Klaviyo-API-Key` vs `Bearer`), ver
[klaviyo-client.ts](../apps/api/src/klaviyo-client.ts).

## Permisos necesarios

Fuente única: `DEFAULT_KLAVIYO_SCOPES` en
[packages/config/src/index.ts](../packages/config/src/index.ts). Hoy:

```
accounts:read events:read flows:read campaigns:read forms:read lists:read segments:read
metrics:read templates:read templates:write campaigns:write
```

| Scope | Para qué | Si falta |
|---|---|---|
| `accounts:read` | Identificar la cuenta al conectar | La conexión falla en el propio callback |
| `campaigns:read`, `flows:read`, `forms:read`, `segments:read`, `metrics:read`, `lists:read` | Sync e informes de rendimiento | El sync marca la conexión en error |
| `templates:read` | Listar e importar plantillas existentes | "Importar de Klaviyo" en /marketing devuelve 403 |
| `templates:write` | Publicar en la cuenta las piezas aprobadas | "Enviar a Klaviyo" devuelve `klaviyo_template_write_denied` |
| `campaigns:write` | Programar, cancelar o devolver a borrador campañas desde Marketing → Campañas | "Programar" devuelve `klaviyo_campaign_write_denied`; todo lo demás sigue funcionando |
| `flows:write` | Crear en Klaviyo (en borrador) los flows diseñados en Marketing → Flows | Ya forma parte de `DEFAULT_KLAVIYO_SCOPES`. Decláralo también en la app OAuth de Klaviyo antes de desplegar; el callback rechaza autorizaciones que no devuelvan el permiso pedido. Con private API key basta marcar Flows en Full access; se sondea al conectar |

**En una private API key** el equivalente es, en `Settings → API keys`: lectura
(Read) para Campaigns, Flows, Metrics, Lists y Segments, y **Full access** en
Templates y Campaigns. Con la clave solo de lectura todo lo demás sigue
funcionando; lo único que se cae es publicar plantillas y programar campañas.

### Al pegar la clave se comprueban los permisos

No basta con que la clave exista: `/accounts` responde bien con una clave que no
puede leer nada más. Por eso, al conectar, el servidor sondea un recurso por
permiso ([klaviyo-permissions.ts](../apps/api/src/klaviyo-permissions.ts)):

- Si falta alguno de los **obligatorios** (Campaigns, Flows, Lists, Segments,
  Metrics), la conexión se rechaza con el nombre exacto de lo que hay que
  marcar: *"A la API key le faltan permisos en Klaviyo: Flows (Read), Metrics
  (Read). Edítala en Settings → API keys…"*. No se guarda nada a medias.
- Los **opcionales** (Forms, Templates) no bloquean. Lo que la clave sí puede
  hacer se guarda en `integration_connections.scopes`, y `/integraciones/klaviyo`
  avisa con un banner si la conexión no puede publicar plantillas — antes de que
  alguien lo descubra al pulsar "Enviar a Klaviyo".
- La escritura se comprueba **sin escribir**: un `PATCH` sobre un id de plantilla
  inexistente devuelve 404 si la credencial puede escribir y 403 si no.
- Un fallo que no sea 401/403 (red, 5xx) queda como *no concluyente* y nunca se
  presenta como "te falta un permiso".

## Ampliar los scopes es un cambio con cola

`KLAVIYO_SCOPES` solo decide lo que se **pide** en el consentimiento. Los tokens
ya emitidos conservan los permisos de aquel día: una cuenta conectada antes de
que existiera `templates:write` seguirá leyendo bien y fallará al publicar, sin
ningún aviso previo. **La cuenta tiene que volver a autorizar** ("Reautorizar
Klaviyo (OAuth)" en `/integraciones/klaviyo`).

El callback sí valida el consentimiento nuevo: si Klaviyo devuelve menos scopes
de los pedidos, la conexión se guarda en `error` con
`klaviyo_permissions_missing:<scopes>` y no se usa
([klaviyo.ts](../apps/api/src/klaviyo.ts)).

## Qué escribe el módulo en la cuenta del cliente

Solo una cosa: plantillas de email, desde `/marketing`.

- Endpoint: `POST /v1/organizations/:organizationId/klaviyo/templates/push` con
  `{ draftId }`.
- Exige rol `owner`/`manager` (o platform admin) **y** borrador en `approved`.
  Un análisis de IA no publica nada por su cuenta.
- La primera vez hace `POST /templates/` y guarda el id en
  `request.klaviyo_template_id` del borrador; a partir de ahí hace
  `PATCH /templates/{id}/` sobre la misma plantilla. Si esa plantilla se borró
  en Klaviyo (404), se recrea.
- `editor_type: "CODE"`, que es el único que respeta HTML propio. El HTML pasa
  por `sanitizeGeneratedEmailHtml` antes de salir.
- Queda registrado en el audit log como `klaviyo.template_created` /
  `klaviyo.template_updated`.

Lo que **no** hace: crear campañas, elegir audiencia ni enviar. Eso se decide en
Klaviyo, con la plantilla ya puesta.

## Errores que vas a ver

| Error | Qué pasó | Arreglo |
|---|---|---|
| `klaviyo_template_write_denied` | 401/403 de Klaviyo al escribir | Reautorizar OAuth, o dar Full access en Templates a la clave |
| `klaviyo_permissions_missing:<scopes>` | El consentimiento devolvió menos scopes de los pedidos | Repetir la autorización aceptando todos los permisos |
| `marketing_draft_not_approved` | La pieza no está aprobada | Aprobarla antes de enviar |
| `marketing_draft_sin_html` | El borrador no tiene HTML (pieza social, por ejemplo) | Solo las piezas de email se publican como plantilla |
| `klaviyo_not_connected` | No hay conexión activa para esa organización | Conectar en `/integraciones/klaviyo` |
| `klaviyo_api_error:RATE_LIMIT:429` | Tope de la API | El cliente reintenta con backoff y respeta `Retry-After`; si persiste, esperar |
| `klaviyo_api_key_missing_permissions` | La clave no puede leer algo obligatorio (detectado al conectar) | El propio mensaje lista los permisos que faltan |
| "Faltan permisos en Klaviyo: …" en un sync | Un recurso se quedó fuera por 401/403 | Actualizar la clave (o reautorizar) y volver a sincronizar |

### La métrica de conversión sin valor económico

`Passed in conversion metric does not support querying for values data` (400,
apuntando a `/data/attributes/conversion_metric_id`).

No es un permiso ni una métrica mal elegida. Comprobado contra la cuenta real el
2026-09-10 con `Placed Order` de la integración de Shopify: pidiendo las 19
estadísticas la API devuelve 400; quitando `conversion_rate`,
`conversion_uniques`, `conversion_value` y `revenue_per_recipient`, la **misma**
petición devuelve 200. Klaviyo no ignora las estadísticas que no puede calcular
— rechaza el informe entero, así que cuatro campos dejaban sin aperturas, clics
ni entregas a todo el módulo (`klaviyo_report_values` llevaba vacía desde el
primer día y A12 opinaba de email sin una sola cifra de envío).

`runKlaviyoReport` reintenta una vez sin esas cuatro y marca el run como
`partial`, con la nota `conversion_metric_sin_valor:<id>`. Hay rendimiento, no
hay ingresos atribuidos — y eso es lo que hay que enseñar, nunca un 0 €
(ADR-0021).

Cuando un recurso no llega **por permisos**, el run del sync ya no se limita al
código `klaviyo_recursos_no_traidos:<recursos>`: antepone los permisos que
faltan con el nombre que tienen en Klaviyo. El código se conserva detrás para
soporte.

## Revisión de la API

La revisión va fijada en `KLAVIYO_API_REVISION`
([klaviyo-oauth.ts](../apps/api/src/klaviyo-oauth.ts)) y viaja en cada petición,
para no seguir a ciegas la última revisión de Klaviyo. Al subirla, revisar los
cambios de contrato de `templates` y `*-values-reports`.
