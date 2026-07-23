# DB-07 - Alertas, tareas y Mi Camino

## Estado

- **Estado real:** `verification_pending`
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-07-20
- **Dependencias:** DB-00, DB-02
- **Bloqueador:** ninguno
- **Evidencia:**
  - Migracion `supabase/migrations/20260717190000_db_07_alertas_tareas_plan.sql` aplicada en remoto.
  - El historial de `tasks.status` **si es automatico**: trigger `record_task_status_change` (`security definer`, `search_path = ''`) inserta en `task_status_history` en cada insert/update de estado, venga del API, del motor de reglas o de un update manual — no depende de que el codigo de aplicacion recuerde escribirlo.
  - El enlace cross-tenant **si esta bloqueado a nivel DB**: triggers `enforce_task_alert_same_org` y `enforce_milestone_task_link_same_org` impiden enlazar una tarea/hito con una alerta/tarea de otra organizacion. Esto contradice una lectura basada solo en el snapshot conceptual (retirado), que no reflejaba estos triggers.
  - Categorizacion de tareas por modulo (shopify/meta/klaviyo/general) anadida 2026-07-20, deterministica segun el origen (plantilla de alerta o agente), nunca decidida por el LLM.
- **Gaps identificados:**
  - Este documento agrupa reglas+alertas, tareas y Mi Camino en un solo bloque; separarlo (DB-07A/B/C) facilitaria auditar cada subdominio por separado.
  - Sin `cooldown`/`suppression window` explicito documentado para alertas (existe deduplicacion por `fingerprint`, pero no una ventana de reapertura documentada).
- **Resuelto 2026-07-21**: el test que faltaba ya existe. `rls-tenant-isolation.test.ts` (ampliado en la ronda DB-02) incluye "el trigger de integridad rechaza una tarea que enlaza una alerta de otra organizacion", que confirma contra el Supabase remoto real que `enforce_task_alert_same_org` rechaza el enlace cross-tenant.
- **Resuelto 2026-07-23 (SLA/overdue formalizado)**: la definicion ya existia en codigo pero solo en un
  sitio (`consultant.ts`, health score del panel de consultor: `due_at` en el pasado + estado
  `pending`/`in_progress`) y **nunca se mostraba al cliente real que gestiona sus propias tareas** -- la
  vista `/tareas` recibia `due_at` en cada respuesta de la API desde siempre pero no lo renderizaba, asi que
  el criterio de cierre "un fallo comun tiene pasos claros" no se cumplia para tareas vencidas (el cliente no
  tenia forma de saber que una tarea estaba vencida sin abrir el panel de consultor). Se formalizo la misma
  regla (`isTaskOverdue` en `apps/web/src/app/tareas/page.tsx`) y se aplico a la UI del cliente: fecha de
  vencimiento visible en cada tarea con `due_at`, badge "Vencida" (tono `danger`) solo si esta en el pasado
  y la tarea sigue abierta -- una tarea completada con `due_at` pasado nunca muestra el badge, es el
  comportamiento correcto, no un bug. **Verificado en navegador real con Playwright**: 3 tareas reales
  sembradas (pendiente+vencida, pendiente+futura, completada+vencida), login real, las 3 renderizan
  exactamente lo esperado (badge solo en la primera, fecha en las tres), cero errores de consola. Typecheck
  de `web` limpio.
- **Siguiente accion:** decidir si vale la pena dividir este documento en DB-07A/B/C.

## Objetivo

Convertir datos en operacion: reglas, alertas, tareas accionables y plan estrategico vivo.

## Tablas

- `alert_rule_templates`
- `organization_alert_rules`
- `alerts`
- `tasks`
- `task_status_history`
- `task_comments`
- `strategic_plans`
- `strategic_plan_phases`
- `strategic_plan_milestones`
- `milestone_task_links`
- `milestone_internal_notes`

## Criterios de cierre

- Una alerta puede generar tarea idempotente.
- Cambios de estado de tarea tienen historial.
- Notas internas no son visibles para cliente.
- No se puede enlazar una tarea de A con una alerta, hito o plan de B.
