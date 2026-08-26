# RB-011 - SLO HTTP degradado o chequeo de SLO caido

## Sintoma

Dos casos distintos bajo el mismo runbook, porque comparten el mismo finding de
`runOpsHealthCheck` (`apps/api/src/ops-health-check.ts`, `checkHttpSlo`):

- **`http_slo_degraded`**: la instancia de la API desplegada en `API_BASE_URL` respondio en
  `/health/slo` con `status = "degraded"` o `"critical"` — el error rate o el p95 de latencia de las
  ultimas peticiones HTTP incumplen el presupuesto configurado (`errorRateBudget`/`p95LatencyBudgetMs`
  en `evaluateHttpSlo`, `packages/observability/src/index.ts`).
- **`http_slo_check_failed`**: el propio chequeo no pudo completarse (timeout, red caida, `401`/`5xx`) —
  la observabilidad esta rota, no necesariamente el servicio real.

## Impacto

- Degradado: clientes reales estan viendo errores 5xx o respuestas lentas ahora mismo.
- Critico: el doble del presupuesto configurado — impacto mayor, tratar como incidente activo.
- Check failed: no se sabe si el servicio esta bien o mal; el riesgo es la ceguera, no el servicio en si
  (a menos que el fallo sea justamente porque la API esta caida — comprobar `/health/live` aparte).

## Severidad

- **SEV-1** si `status = "critical"` o si `http_slo_check_failed` coincide con la API realmente caida.
- **SEV-2** si `status = "degraded"` de forma sostenida (mas de un ciclo del chequeo).
- **SEV-3** si `http_slo_check_failed` es puntual y `/health/live` de la misma instancia responde bien
  (probable timeout transitorio de red entre el runner del cron y la API, no un problema del servicio).

## Comprobaciones iniciales

1. Confirmar que la instancia sigue viva independientemente del SLO:
   ```bash
   curl -sf "$API_BASE_URL/health/live"
   ```
2. Leer el reporte completo de SLO (mismo secreto interno que usa el chequeo):
   ```bash
   curl -sf -H "x-internal-secret: $INTERNAL_API_SECRET" "$API_BASE_URL/health/slo"
   ```
   Trae `requestCount`, `errorCount`, `errorRate`, `p95LatencyMs` y `violations` (`error_rate` y/o
   `p95_latency`) — permite distinguir si el problema es tasa de error, latencia, o ambas, sin acceder a
   Supabase ni a logs.
3. Si `http_slo_check_failed` con un error de red/timeout: repetir el `curl` del paso 1 manualmente antes
   de escalar — puede ser un problema del runner de CI, no de la API.

## Diagnostico

- **`errorRate` alto**: revisar `/health/metrics` (mismo secreto) para ver `http_requests_total` por
  `route`/`status_code` y localizar que ruta concentra los 5xx — el SLO es agregado, no dice cual endpoint.
- **`p95LatencyMs` alto sin errores**: buscar una dependencia lenta (Supabase, proveedor externo en el
  camino sincrono de una ruta) antes de asumir que es carga; `evaluateHttpSlo` es process-local, asi que
  un p95 alto en una sola instancia detras de balanceador no implica que todas las instancias esten
  afectadas por igual (ver Prevencion).
- **`http_slo_check_failed` recurrente sin que la API este caida**: revisar que `INTERNAL_API_SECRET`
  configurado en el cron coincida con el de la instancia desplegada — un secreto desalineado da `401` de
  forma indefinida, indistinguible de un problema real sin leer el `status` del finding.

## Acciones

1. **Degradado por error rate**: tratar como cualquier incidente de errores 5xx — revisar el deploy mas
   reciente y el log estructurado (`request_id`/`organization_id`, ver SQO-02) de las peticiones fallidas
   por ruta identificada en el paso de Diagnostico.
2. **Degradado por latencia**: revisar la dependencia lenta identificada; si es Supabase, comparar con el
   estado de Supabase (status page) antes de asumir que es codigo propio.
3. **Critico**: escalar como SEV-1 inmediatamente, no esperar al siguiente ciclo del cron para confirmar.
4. **Check failed**: corregir el secreto/URL de configuracion si aplica; si la API esta realmente caida,
   seguir el runbook de caida de servicio correspondiente (no existe uno dedicado todavia mas alla de
   `/health/ready`, ver BE-00).

## Rollback

Si el incidente coincide con un deploy reciente, revertir ese deploy es la accion mas rapida — el SLO es
una senal agregada de las ultimas peticiones, no de un dato persistido, asi que no hay estado que limpiar
tras revertir.

## Validacion de recuperacion

- `/health/slo` vuelve a `status = "ok"` (o `"no_traffic"` fuera de horas de trafico) de forma sostenida
  durante al menos un ciclo completo del chequeo.
- `http_slo_check_failed` deja de aparecer en corridas consecutivas.

## Comunicacion al cliente

Solo si `degraded`/`critical` coincidio con un periodo donde clientes reales pudieron ver errores o
lentitud notable — mismo criterio que el resto de runbooks (RB-001).

## Escalado

Igual que el resto de runbooks: sin guardia formal (R-018). `critical` se trata como incidente de
plataforma desde el primer finding, no tras repetirse.

## Evidencias a conservar

El JSON completo de `/health/slo` en el momento del incidente (contiene los conteos agregados, no
prompts ni PII) y, si se identifico una ruta concreta via `/health/metrics`, esos conteos tambien.

## Prevencion

**Preparado 2026-08-26, no conectado todavia**: `checkHttpSlo` (`apps/api/src/ops-health-check.ts`) ya
consulta `/health/slo` de una instancia real cuando `API_BASE_URL` e `INTERNAL_API_SECRET` estan
configurados en el entorno del cron (`.github/workflows/ops-health-check.yml`); sin ambos, el chequeo se
omite en silencio en vez de fallar — mismo criterio de "preparado, no conectado" que el resto de
conectores de la cola. Falta desplegar una instancia real accesible desde el runner y configurar esos dos
secretos para que esta alerta empiece a producir findings reales; hasta entonces, `/health/slo` sigue
siendo diagnostico de una sola instancia (`packages/observability`, sin backend compartido), asi que en un
despliegue con varias instancias detras de balanceador esta alerta sub-representa el error rate/latencia
agregados reales (ver gap general de SQO-02 sobre backend de metricas compartido).
