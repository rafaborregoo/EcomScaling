# SQO-02 - Observabilidad

## Estado

- **Estado real:** `planned_critical`
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-07-20
- **Dependencias:** ninguna tecnica — es la carencia mas peligrosa del proyecto en proporcion a lo
  construido, no un bloqueo externo.
- **Evidencia de que hoy no existe, no solo de que "falta pulir"**: sin libreria de logging estructurado
  (`grep -n "\"pino\"\|\"winston\"" apps/api/package.json apps/web/package.json` no devuelve nada), sin
  error tracking (sin Sentry/Datadog/equivalente en ningun `package.json`), sin correlation IDs
  documentados de extremo a extremo, sin metricas de API/worker/sync expuestas.
- **Por que es critico y no solo un "nice to have"**: cuando un cliente reporte "los pedidos de ayer no
  aparecen", hoy no hay forma rapida de saber si fallo el webhook, la cola, el token, el scope, el bulk
  operation, el mapper, la DB o el frontend — solo se puede investigar leyendo codigo y consultando la DB
  a mano.

## Entregables

- Logs JSON con request_id, user_id, organization_id, job_id y agent_run_id.
- Metricas API, worker, sync freshness, rate limits, tokens y coste IA.
- Tracing web -> API -> worker -> proveedor -> PostgreSQL.
- Alertas operativas.
- Panel interno de salud por organizacion.

## Diseño propuesto (sin implementar, para no perder el criterio)

**Cadena de correlacion** (no todos los campos existiran siempre, pero deben compartir contexto cuando
apliquen): `request_id -> connection_id -> sync_run_id -> job_id -> provider_request_id ->
webhook_event_id -> agent_run_id -> query_run_id`.

**Campos minimos de log estructurado**: `timestamp, level, service (api|worker|web), environment,
request_id, user_id, organization_id, store_id, connection_id, sync_run_id, job_id, agent_run_id,
provider, event, duration_ms, result`. Nunca loguear tokens, secrets, transcripciones completas, payloads
con PII ni prompts completos sin politica — ver tambien el gap de redaccion de logs en SQO-00.

**Metricas por bloque**: API (request count, error rate, p50/p95/p99, rate limit rejections, auth
failures) · worker (queue depth/lag, running/failed/retry/dead-letter, job duration) · integraciones por
organizacion/tienda/proveedor (ultima sync ok/fallida, freshness, token expiration, scopes faltantes,
webhooks recibidos/duplicados) · IA (runs, rechazados, tokens, coste, latencia, cache hit rate, tareas
materializadas).

**SLI/SLO iniciales a validar con infraestructura real** (numeros de ejemplo, no aprobados):

| Servicio | Indicador | Objetivo |
| --- | --- | --- |
| API | Latencia p95 lectura | <500 ms |
| Shopify | Freshness pedidos | <30 min |
| Webhooks | Procesamiento p95 | <2 min |
| A02 cache hit / miss | Latencia | <1 s / <30 s |
| IA | Runs fallidos | <2% |

**Alertas operativas minimas**: cola bloqueada, job repetidamente fallido, token proximo a expirar,
sync desactualizado, coste IA anomalo, error rate elevado — cada una con runbook (ver SQO-06 propuesto).

**Panel de salud por organizacion**: conexiones y estado, ultima actualizacion, scopes, jobs pendientes,
configuracion financiera, health score determinista (reutilizando la formula ya real de FE-07).

## Criterios de cierre

- Un fallo de sync se puede diagnosticar sin acceder manualmente a la base.
- Hay alertas para colas bloqueadas, tokens expirados y datos desactualizados.
- Se puede seguir un request extremo a extremo con la cadena de correlacion.
- Logs verificados sin secretos ni PII (compartido con SQO-00).

