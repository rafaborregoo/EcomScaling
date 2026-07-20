# INT-05 - Instagram

## Estado

- **Estado real:** `planned`
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-07-20
- **Dependencias:** INT-00, INT-02 (Meta)
- **Bloqueador:** ninguno propio; depende de que INT-02 amplie `META_SCOPES` con
  `instagram_basic`/`instagram_manage_insights` primero (hoy no los pide, ver INT-02) y de que la app de
  Meta este aprobada (mismo bloqueador que INT-02/BE-04).
- **Codigo:** ninguno (`grep -rl instagram apps/api/src -i` no devuelve implementacion, solo el valor del
  enum `provider` en las migraciones de DB-04).

## Decision de conexion

Instagram se descubre desde la conexion Meta existente, **no** un segundo flujo OAuth independiente — es
la decision de diseño, todavia sin implementar. Consecuencias:

- Solo cuentas profesionales Business o Creator; sin soporte para cuentas personales.
- La API de Insights de Instagram solo devuelve datos para media de cuentas profesionales, asi que una
  cuenta personal simplemente no tendria datos, no un error explicito que haya que manejar aparte.
- Los datos organicos (Instagram) se mantienen separados de Ads Insights (Meta) en el modelo de datos,
  aunque compartan la misma conexion OAuth.

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

1. Ampliar scopes de Meta en INT-02 (bloqueante, no se puede empezar Instagram sin esto).
2. Definir frecuencia de sync por bloque: cuenta diaria, media reciente cada 3-6h, insights de contenido
   reciente varias veces al dia, historico diario/semanal, refresco de URLs antes de mostrarlas.
3. Diseñar `instagram_media_insight_values` (o tabla equivalente) como filas metric/period/value, no
   columnas fijas por metrica.

## Criterios de cierre

- No se promete seguidores por post via API — solo entrada manual claramente diferenciada.
- Rankings usan unicamente metricas soportadas por el tipo de media correspondiente.
- URLs/media se refrescan segun caducidad antes de mostrarse.
