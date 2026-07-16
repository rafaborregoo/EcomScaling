# SQO-02 - Observabilidad

## Entregables

- Logs JSON con request_id, user_id, organization_id, job_id y agent_run_id.
- Metricas API, worker, sync freshness, rate limits, tokens y coste IA.
- Tracing web -> API -> worker -> proveedor -> PostgreSQL.
- Alertas operativas.
- Panel interno de salud por organizacion.

## Criterios de cierre

- Un fallo de sync se puede diagnosticar sin acceder manualmente a la base.
- Hay alertas para colas bloqueadas, tokens expirados y datos desactualizados.

