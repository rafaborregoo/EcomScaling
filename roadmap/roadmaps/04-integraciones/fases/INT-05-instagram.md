# INT-05 - Instagram

> **Matriz oficial de estrategias 2026-08-24:** el contrato compartido distingue `facebook_login` (host `graph.facebook.com`, Página de Facebook vinculada y scopes `instagram_basic`/`instagram_manage_*`) de `instagram_login` (host `graph.instagram.com`, scopes `instagram_business_*` y limitación de Ads/tagging). Ambos exigen cuenta profesional; ningún flujo se activa hasta credenciales y App Review.

> Correccion UX 2026-08-21: la tarjeta de Integraciones muestra explicitamente `No disponible
todavía`, explica la dependencia de Meta/Instagram Login y no ofrece OAuth ni datos simulados
> mientras el adapter contractual permanezca unavailable.
>
> El adapter ya expone `discoverAssets` aunque responde `CREDENTIALS_MISSING` hasta activar el
> conector real, manteniendo alineadas las capacidades y la interfaz futura.

> **Correccion vigente 2026-08-20:** DB-10 ya tiene su foundation aplicada y el
> adapter contractual no disponible sigue bloqueando OAuth/sync de forma honesta.
> La UI y el dominio pueden consumir estados vacios sin que Instagram se anuncie
> como conectado; la activacion futura reutilizara la estrategia OAuth autorizada
> por Meta.

## Estado

- **Estado real:** `implemented_partial` (contrato, adapter no disponible, UI y schema de preparacion).
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-08-20
- **Dependencias:** INT-00, INT-02 (Meta)
- **Bloqueador:** ninguno propio; depende de que INT-02 amplie `META_SCOPES` con
  `instagram_basic`/`instagram_manage_insights` primero (hoy no los pide, ver INT-02) y de que la app de
  Meta este aprobada (mismo bloqueador que INT-02/BE-04).
- **Codigo/evidencia:** adapter contractual no disponible en `apps/api/src/integration-adapters.ts`,
  catálogo/capacidades en `packages/integrations/src/index.ts` y foundation de tablas en
  `20260820110000_db_10_instagram_foundation.sql`. No existe todavía runner OAuth/sync real, por lo
  que el conector devuelve estado no disponible y no crea datos.

## Decision de conexion

Instagram se descubre desde la conexion Meta existente, **no** un segundo flujo OAuth independiente para
Facebook Login; Instagram Login queda como estrategia alternativa explícita. La decisión de dominio está
preparada, pero el OAuth/sync real sigue pendiente de credenciales y scopes. Consecuencias:

- Solo cuentas profesionales Business o Creator; sin soporte para cuentas personales.
- La API de Insights de Instagram solo devuelve datos para media de cuentas profesionales, asi que una
  cuenta personal simplemente no tendria datos, no un error explicito que haya que manejar aparte.
- Los datos organicos (Instagram) se mantienen separados de Ads Insights (Meta) en el modelo de datos,
  aunque compartan la misma conexion OAuth.

## Correccion de autorizacion 2026-08-02

La preparacion de Instagram debe soportar las dos rutas oficiales de Meta sin
duplicar la UI ni el dominio:

- [Instagram API with Instagram Login](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login)
- [Instagram API with Facebook Login](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-facebook-login)

La conexion futura persistira `auth_strategy` (`instagram_login` o
`facebook_login`), scopes concedidos e identidad externa. Facebook Login puede
reutilizar una conexion Meta cuando proceda; Instagram Login no debe depender
artificialmente de ella. La estrategia se resolvera por cuenta y permisos,
porque no se debe asumir que ambas rutas estan disponibles para todas las
cuentas profesionales. Mientras INT-05 siga `not_available`, ninguna ruta OAuth
se expone ni ejecuta. Esta correccion supersede la decision historica que
forzaba siempre el descubrimiento desde Meta.

## Datos a sincronizar (cuando se implemente)

Cuenta (id, username, tipo, pagina vinculada, followers/media count, snapshots) · Media (id, tipo,
caption, permalink, timestamp, thumbnail, media URL, children en carruseles) · Insights por media (nombre
de metrica, periodo, valor, `captured_at`) como filas (`media_id, metric_name, period, value,
captured_at`), no como columnas fijas — las metricas disponibles varian por tipo de media (imagen, video,
reel, story, carrusel) y forzarlas a columnas rigidas rompe con cualquier tipo nuevo que Meta añada.

## Limite conocido que no se debe prometer: seguidores ganados por post

Instagram no da atribucion fiable de seguidores ganados por publicacion individual via API. El consultor
podra registrar manualmente (`media_id`, ranking, seguidores atribuidos, periodo, fuente, notas, actor) —
este dato manual debe distinguirse visualmente de los datos que vienen de la API, no presentarse igual.

## Webhooks

Para este caso de uso, los webhooks de Instagram no son la fuente principal de metricas — sirven para
comentarios/menciones, no para extraccion de media/Insights, que sigue siendo por consulta programada.

## Pendiente antes de implementar

1. Confirmar en la app real los permisos/scopes efectivos y requisitos de
   cuenta profesional de ambas rutas.
2. Definir frecuencia de sync por bloque: cuenta diaria, media reciente cada 3-6h, insights de contenido
   reciente varias veces al dia, historico diario/semanal, refresco de URLs antes de mostrarlas.
3. Diseñar `instagram_media_insight_values` (o tabla equivalente) como filas metric/period/value, no
   columnas fijas por metrica.

## Criterios de cierre

- No se promete seguidores por post via API — solo entrada manual claramente diferenciada.
- Rankings usan unicamente metricas soportadas por el tipo de media correspondiente.

## Correccion de estado 2026-08-20

Instagram está en `implemented_partial`: existe el adapter contractual no disponible, la foundation
DB-10, el catálogo de capacidades y la UI de estados. Sigue sin sincronización OAuth real y no crea
conexiones, assets o métricas ficticias; la activación futura reutilizará el dominio y la UI existentes
y dependerá de una conexión Meta aprobada.

- URLs/media se refrescan segun caducidad antes de mostrarse.

## Preparación de producto 2026-08-02

Instagram queda preparado como capacidad dependiente de Meta: la UI explica la
dependencia y muestra permisos faltantes mientras el conector permanezca
`not_available`. Los datos orgánicos, snapshots y media insights tendrán contrato
propio y nunca se mezclarán con Ads Insights. Ver
[`../CONTRATO_PREPARACION_CONECTORES.md`](../CONTRATO_PREPARACION_CONECTORES.md).
