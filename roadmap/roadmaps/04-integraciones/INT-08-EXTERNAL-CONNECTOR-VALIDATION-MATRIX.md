# INT-08 - Matriz de validación externa de conectores

## Propósito

Convertir la llegada de credenciales y aprobaciones en una ejecución repetible.
Esta matriz no inventa datos ni marca un conector como operativo por tener un
flag: cada fila exige evidencia del proveedor, del sync y de la UI.

## Regla común de promoción

Un conector sólo pasa a `operational` cuando se cumplen todas las pruebas de su
fila y `provider.activation.ready` es verdadero. La secuencia obligatoria es:

1. configurar secretos en el entorno aislado de validación;
2. completar OAuth/instalación y comprobar scopes efectivos;
3. validar identidad y selección de cuenta/tienda;
4. ejecutar sync inicial y repetirlo de forma incremental;
5. provocar o esperar un error recuperable y demostrar recuperación;
6. comprobar freshness, deduplicación, tenant, UI, agentes y observabilidad;
7. promover sólo con evidencia redactada, `traceId`/`job_id` y rollback claro.

Nunca se copian secretos ni payloads completos a commits, tests, logs o
LangSmith. Las pruebas destructivas se ejecutan sólo en una cuenta/tienda de
validación autorizada.

## Matriz por proveedor

| Proveedor | Precondiciones externas | Pruebas obligatorias | Evidencia de salida | Criterio de fallo |
| --- | --- | --- | --- | --- |
| Shopify | App/custom distribution autorizada, tienda de prueba, scopes y webhook URL | OAuth/HMAC, instalación, scopes, sync inicial, incremental, webhooks duplicados, uninstall/reconnect, 429/5xx y reconciliación | connection id, scopes, sync runs, counts/reconcile, webhook fingerprints, resultado UI | secreto expuesto, webhook no idempotente, tenant incorrecto, freshness fuera de SLA o diferencia sin explicación |
| Meta Ads | App Review/business verification, `META_APP_ID/SECRET`, scopes aprobados, usuario y ad account de prueba | OAuth, identidad verificable, selección de cuenta, insights inicial/incremental, paginación/batch, 429/5xx, reautorización y permisos insuficientes | account id enmascarado, scopes efectivos, filas/periodos, sync runs, errores normalizados y trazas | datos fabricados, cuenta no verificable, scope no concedido, conversiones duplicadas, circuito ausente o UI con salud falsa |
| Klaviyo | App OAuth aprobada, cuenta de prueba, scopes y versión API fijados | OAuth/refresh, scopes, paginación segura, Reporting API por tipo, `Retry-After`, 403/token caducado y backfill | account id enmascarado, revision, páginas, reportes, retries, freshness y estado UI | links fuera de host, retry de permisos, periodos mezclados, `unavailable` oculto o token persistido |
| Instagram | App Meta aprobada, cuenta profesional, Página vinculada o Instagram Login según estrategia, scopes efectivos | descubrimiento, media/insights, permisos, paginación, límites, cuenta sin media y dependencia Meta | estrategia, identidad enmascarada, métricas/periodos, errores y activación | cuenta no profesional, datos orgánicos mezclados con Ads, dependencia Meta ignorada o datos demo presentados como reales |

## Checklist operativo

- [ ] Entorno de validación aislado y snapshot/rollback disponible.
- [ ] Scopes solicitados y concedidos registrados por separado.
- [ ] Conexión asociada al `organization_id` correcto; sin lectura cross-tenant.
- [ ] Primer sync idempotente y segundo sync sin duplicados.
- [ ] Periodos y zonas horarias documentados; precisión de totales conocida.
- [ ] Rate limit/error transitorio probado con retry/backoff.
- [ ] Timeout y circuito abierto probados sin espera indefinida.
- [ ] `partial` seguido de `succeeded` demuestra recuperación; un error aislado no.
- [ ] Agentes reciben `available`, `unavailable` o `stale` y se abstienen si falta evidencia.
- [ ] UI distingue `configured`, `connected`, `degraded`, `stale`, `denied` y `not_implemented`.
- [ ] Sólo se conservan ids enmascarados, estados, tiempos, agregados y trazas redactadas.

## Evidencia local ya disponible

- Meta, Klaviyo y Shopify: suite contractual offline 15/15 verificada el
  2026-08-26.
- Activación por capacidades y recuperación: `INT-07-CAPABILITY-AWARE-ACTIVATION-GATE.md`.
- Estados de salud: `INT-06-STATUS-HEALTH-UI-CONTRACT.md`.
- Preparación general: `CONTRATO_PREPARACION_CONECTORES.md`.
- Resiliencia común: módulo de resiliencia de `packages/ai`.

## Qué queda fuera hasta que existan proveedores

No se puede demostrar desde este repositorio la aprobación de Meta/Shopify, la
concesión real de scopes, la estabilidad de una cuenta externa o la exactitud
de sus datos. Esos estados permanecen `blocked_external` y no impiden terminar
la interfaz, contratos, agentes, evals ni controles locales.
