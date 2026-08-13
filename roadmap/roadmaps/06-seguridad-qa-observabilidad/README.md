# Roadmap operativo - Seguridad, QA y observabilidad

> Correccion 2026-08-02: SQO-04 ya no debe interpretarse como una matriz sin
> controles. CI incorpora `gitleaks`, `npm audit --omit=dev --audit-level=high`
> y `dependency-review`; el backend valida las URLs de resultados Shopify Bulk
> contra `storage.googleapis.com`, y existen pruebas Fastify de IDOR/cross-tenant.
> Siguen pendientes el escaneo de imagenes Docker, un test sistematico de cada
> query `service_role` y la ampliacion de cobertura a toda ruta nueva.

> Correccion operativa 2026-08-02: el cliente Redis de `@fastify/rate-limit`
> registra sus errores asíncronos y conserva `skipOnError`; si Redis no existe
> en desarrollo, la API usa el store local sin eventos no controlados. En
> producción serverless sigue siendo necesario configurar `REDIS_URL` para
> obtener rate limiting distribuido.

> Correccion de aislamiento de errores 2026-08-02: `sendServiceFailure` ya no
> devuelve `detail` en respuestas 5xx. El detalle de Supabase/proveedores se
> registra unicamente en logs estructurados y el cliente recibe el codigo de
> error y el mensaje funcional. Los logs tambien redactan `Bearer`, `access_token`,
> `refresh_token` y claves en URLs. Verificado con `server-failure-sanitization.test.ts`
> (4/4), typecheck del API y Prettier.

> Endurecimiento CI/OPS 2026-08-02: todos los workflows de automatizacion
> (`backup`, reconciliaciones, ingestion, purga, alertas y CI) declaran
> `permissions: contents: read` explicitamente. El workflow de salud es la
> unica excepcion necesaria porque crea/actualiza issues y mantiene solo
> `contents: read` + `issues: write`.

> La auditoria de producto FE-00/FE-03 tambien confirma que los estados vacios
> de alertas, tareas, gastos fijos y planes sin fases reutilizan `EmptyState`;
> no se introduce una variante visual paralela.

> Correccion SQO-01/INT-00 2026-08-02: CI ejecuta tambien las suites de
> `@ecomscaling/integrations` y `@ecomscaling/observability`, que cubren los
> contratos/feature flags de conectores y la redaccion de secretos/métricas.
> El workflow YAML queda verificado con Prettier.

> Correccion SQO-02 2026-08-02: la redaccion de credenciales embebidas en
> detalles de error se centraliza en `packages/observability` como
> `redactSensitiveText`; el API la reutiliza en fallos de autenticacion y de
> servicios. Suite conjunta de observabilidad/API: 9/9.

> Correccion SQO-02 2026-08-02: cada respuesta del API incluye `x-request-id`,
> usando el mismo identificador que Fastify escribe en sus logs. Verificado en
> `/health/live` mediante `observability-metrics-endpoint.test.ts` (1/1).

> Correccion SQO-02/SQO-01 2026-08-02: `server-failure-sanitization.test.ts`
> queda incluido en `apps/api:test:unit`, por lo que la proteccion de respuestas
> 5xx y la redaccion de credenciales se ejecutan tambien en el pipeline normal.
> Regresion dirigida de observabilidad + API: 5/5.

## Objetivo

Hacer que seguridad, pruebas y diagnostico no sean una fase final, sino un bloque obligatorio de cada vertical slice.

El [objetivo global del SaaS](../../../docs/OBJETIVO_SAAS_PILOTO_Y_CRITERIOS_DE_TERMINADO.md) añade como
criterio de cierre que la evidencia de tests, CI, aislamiento multi-tenant, observabilidad y documentación
sea coherente con el código y las migraciones, tanto para Shopify operativo como para conectores futuros.

## Fases

> Estado vigente de SQO-04: `implemented_partial`. La fila histórica de la
> tabla que aún diga `planned` queda superseded por esta corrección; ya están
> mitigados el SSRF concreto de Shopify Bulk y las superficies críticas de
> IDOR, mientras los gaps restantes conservan owner/alcance explícitos.

| Fase | Archivo | Relacion maestro | Resultado |
| --- | --- | --- | --- |
| SQO-00 | `fases/SQO-00-seguridad-base.md` | F1-F3 | Secret scanning, CORS, headers, permisos, RLS y matriz de acceso. |
| SQO-01 | `fases/SQO-01-testing.md` | F1-F14 | Unit, DB/RLS, contract, worker, E2E, IA evals y carga. |
| SQO-02 | `fases/SQO-02-observabilidad.md` | F1-F14 | Logs, metricas, tracing, alertas y panel interno de salud. |
| SQO-03 | `fases/SQO-03-privacidad-auditoria.md` | F2-F14 | PII, GDPR, audit logs, retencion, backups e incidentes. |
| SQO-04 | `fases/SQO-04-threat-model.md` | F1-F14 | `implemented_partial` — matriz de 17 amenazas mapeadas contra controles/tests reales; SSRF Shopify Bulk, IDOR organizacional, sanitizacion de errores 5xx y supply-chain tienen controles; quedan cobertura sistematica, imagenes Docker y runbooks. |
| SQO-05 | *(no creado todavia)* | F1-F14 | Propuesto, `planned`: disaster recovery (RPO/RTO, backups, restore, caida de DB/Redis, rollback de despliegue). |
| SQO-06 | *(no creado todavia)* | F1-F14 | Propuesto, `planned`: runbooks operativos (token expirado, sync atascado, cola bloqueada, coste IA disparado, posible fuga cross-tenant). |
