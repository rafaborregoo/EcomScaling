# Checklist semanal de salud por cliente

Entregable de OPS-02 pendiente desde el origen del roadmap. A diferencia de los runbooks (`runbooks/RB-00X-*.md`,
reactivos ante un incidente ya ocurrido), esto es una rutina **proactiva**: revisar cada cliente activo una
vez por semana para detectar problemas antes de que el cliente los reporte. Pensado para Rafa (soporte,
R-018) mientras el equipo sea de una persona — no requiere herramientas nuevas, todo el dato ya existe en
`/consultor`.

## Cuándo

Una vez por semana, día fijo (recomendado: lunes, para arrancar la semana con el estado real de cada
cliente). Con 1-3 clientes en Piloto 1 esto toma minutos; el checklist está pensado para escalar sin
rehacerse cuando haya más.

## Dónde

`/consultor` — la lista ya viene ordenada por `attention.score` de mayor a menor (`listConsultantOrganizations`,
`apps/api/src/consultant.ts`), así que el cliente que más atención necesita siempre aparece primero. No hace
falta revisar la lista entera con el mismo detalle: el orden ya hizo el trabajo de priorización.

## Checklist por cliente (de arriba hacia abajo en la lista)

Para cada cliente, en este orden:

1. **`attention.score`** — si es sensiblemente más alto que la semana pasada, algo cambió; entrar al cliente
   antes de seguir con la lista general.
2. **`critical_alerts`/`high_alerts`** — cualquier alerta crítica abierta se revisa siempre, sin excepción,
   aunque el score total no destaque (una sola alerta crítica puede pesar menos que varias medias acumuladas
   en el score, pero importa más).
3. **`oldest_alert_days`** — una alerta abierta desde hace muchos días sin acción es una señal de que nadie
   la está viendo, no de que no importe. Si supera ~7 días, revisar por qué sigue abierta (¿se descartó sin
   marcarla?, ¿nadie la vio?).
4. **`overdue_tasks`** — tareas vencidas (ver DB-07, badge "Vencida" en `/tareas`) son compromisos que ya se
   incumplieron. Más de 2-3 acumuladas en un cliente es señal de que el consultor asignado necesita ayuda o
   redistribuir carga, no solo recordarle al cliente.
5. **Estado de sincronización de Shopify** — entrar a `/shopify/diagnostico` del cliente (o el estado de
   `integration_connections`/`deriveIntegrationHealth`, ver INT-00) y confirmar que el estado derivado es
   `healthy`/`syncing`, no `degraded`/`stale`. Si está degradado, ver `RB-001-shopify-sync-failed.md`.
6. **Tokens de integración por expirar** — cubierto automáticamente por `ops-health-check.yml` (cron cada
   2h, abre issue de GitHub si encuentra uno), pero conviene confirmar en la revisión semanal que no hay un
   issue abierto sin atender de esa fuente — ver `RB-002-oauth-token-expired.md`.
7. **`subscription.status`** — confirmar que sigue `trial`/`active`; si cambió a algo distinto sin que fuera
   una acción esperada, investigar antes de que el cliente pierda acceso sin previo aviso (recordar: hoy no
   hay endpoint de escritura para `subscription_status`, ver DB-01 — cualquier cambio vino de una acción
   manual directa en la base, revisar quién y por qué).
8. **Resúmenes de llamada pendientes de aprobación** — un resumen de A01 en `pending_approval` sin decidir
   durante varios días bloquea que el cliente vea el resumen y que se materialicen sus tareas propuestas.

## Qué hacer con lo encontrado

- Alertas/tareas vencidas → actuar directamente sobre el cliente (mismo flujo que cualquier operación normal
  de consultor), no hace falta un proceso especial.
- Sync degradado/tokens expirando → seguir el runbook correspondiente (`RB-001`/`RB-002`).
- Nada de lo anterior explica el score alto → antes de descartarlo como ruido, mirar el detalle de las
  alertas individuales — el score es una heurística (severidad + antigüedad + tareas vencidas, ver FE-07),
  no siempre captura el contexto completo.

## Qué NO cubre este checklist

- Salud comercial/satisfacción del cliente (fuera de alcance técnico, es seguimiento de Rafa como soporte).
- Métricas de negocio del cliente (ventas, ROAS) — eso es lo que el dashboard le muestra al cliente mismo,
  no parte de esta revisión operativa.
- Instagram — no aplica todavía (INT-05 no ejecuta OAuth ni sync hasta tener permisos reales).
- Meta Ads y Klaviyo — solo aplican a clientes con el conector realmente activado (Meta sigue pendiente de
  App Review; Klaviyo, de scopes aprobados). Para esos clientes, revisar además que la reconciliación
  diaria de Meta (`meta-reconcile.yml`) y la de 6 h de Klaviyo (`klaviyo-reconcile.yml`) tienen ejecuciones
  recientes en verde, y que la conexión Klaviyo no lleva semanas en `skipped` por falta de
  `conversion_metric_id`. El alta inicial se sigue con `runbooks/RB-009-alta-cliente-conectores.md`.

## Historial

Creado 2026-07-23 a partir de las señales ya existentes en el panel de consultor (FE-07) — no introduce
métricas nuevas, solo define el orden y el criterio de revisión. Revisar y ajustar el orden de prioridad una
vez haya datos reales de qué tipo de problema se detecta tarde con más frecuencia.
