# DB-07 - Alertas, tareas y Mi Camino

## Estado

> Cierre verificado 2026-08-24: los criterios funcionales de DB-07 estan
> cubiertos por triggers de historial y aislamiento cross-tenant, tareas
> idempotentes de alertas y enlaces de Mi Camino. La separacion documental
> DB-07A/B/C queda como mejora editorial no bloqueante.

- **Estado real:** `done`
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-08-24
- **Dependencias:** DB-00, DB-02
- **Bloqueador:** ninguno
- **Evidencia:**
  - Migracion `supabase/migrations/20260717190000_db_07_alertas_tareas_plan.sql` aplicada en remoto.
  - El historial de `tasks.status` **si es automatico**: trigger `record_task_status_change` (`security definer`, `search_path = ''`) inserta en `task_status_history` en cada insert/update de estado, venga del API, del motor de reglas o de un update manual — no depende de que el codigo de aplicacion recuerde escribirlo.
  - El enlace cross-tenant **si esta bloqueado a nivel DB**: triggers `enforce_task_alert_same_org` y `enforce_milestone_task_link_same_org` impiden enlazar una tarea/hito con una alerta/tarea de otra organizacion. Esto contradice una lectura basada solo en el snapshot conceptual (retirado), que no reflejaba estos triggers.
  - Categorizacion de tareas por modulo (shopify/meta/klaviyo/general) anadida 2026-07-20, deterministica segun el origen (plantilla de alerta o agente), nunca decidida por el LLM.
- **Gaps identificados:**
  - Este documento agrupa reglas+alertas, tareas y Mi Camino en un solo bloque; separarlo (DB-07A/B/C) facilitaria auditar cada subdominio por separado.
- **Resuelto 2026-07-23 (cooldown/suppression window documentado)**: confirmado en codigo real
  (`upsertAlertWithTask`/`resolveStaleAlerts`, `apps/api/src/operations.ts`) que **no existe un cooldown
  explicito** -- una alerta resuelta puede reabrirse (nueva fila, no la misma) en la siguiente evaluacion si
  la condicion vuelve a cumplirse, sin ventana minima de espera en el codigo. Lo que si actua como cooldown
  de facto es la cadencia del cron `alert-rules.yml` (`workflow_dispatch` + `cron: "43 */6 * * *"`, cada 6h):
  como las alertas solo se evaluan cada 6h, el intervalo minimo real entre "se resolvio" y "se reabrio" es
  de hasta 6h, aunque no hay ningun debounce si la metrica sigue oscilando alrededor del umbral entre
  evaluaciones -- cada evaluacion ve un estado limpio, sin memoria de flapping previo. Dentro de una misma
  evaluacion, la deduplicacion por `fingerprint` (unico mientras `status in (open, acknowledged)`) si evita
  duplicados: una alerta viva se refresca (`last_detected_at`/`metric_value`), nunca se duplica. No es una
  laguna que bloquee el piloto (el volumen de alertas de un solo cliente no justifica un cooldown mas
  sofisticado todavia), pero es el comportamiento real, no lo que sugeria la ausencia de documentacion.
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
- **Editar fases/hitos + crear tarea con contexto cerrado 2026-07-29** (ver FE-04): antes de esta fecha
  `strategic_plan_phases`/`strategic_plan_milestones` solo se podian escribir al crear el plan o cambiar
  `status` -- nombre/descripcion/fecha objetivo quedaban fijos para siempre una vez creados. Se anadieron
  `updatePhase`/`updateMilestone` (`apps/api/src/strategic-plans.ts`) con el mismo chequeo de permisos
  (`assertCanManagePlan`) que el resto de escrituras del modulo, y `createMilestoneTask` que inserta la
  tarea y el `milestone_task_links` en la misma llamada. Verificado con 4 tests reales contra Supabase
  remoto (`fe-04-mi-camino-tree.test.ts`) mas 3 rutas nuevas en el test de aislamiento cross-tenant.
- **Resuelto 2026-07-29 (agentes IA + alertas ahora enlazan con Mi Camino por defecto)**: gap detectado el
  mismo dia -- `decideAgentOutput` (`apps/api/src/ai-runtime.ts`) solo enlazaba una tarea de IA a un hito si
  el propio LLM proponia `milestone_id`, y `upsertAlertWithTask` (`apps/api/src/operations.ts`, el motor de
  reglas que el cron de `apps/worker` invoca via `runAlertRulesForAllOrganizations` -- el worker no duplica
  esta logica, solo la llama) no enlazaba nunca. Se anadio `findCurrentMilestoneId` (`strategic-plans.ts`):
  heuristica best-effort (nunca lanza, nunca bloquea la creacion de la tarea) que busca el plan `active` de
  la organizacion, su fase `active`, y dentro de ella el hito de menor `position` que no este
  completado/omitido -- el hito "en el que esta trabajando el cliente ahora". Se usa como fallback en
  `ai-runtime.ts` cuando el LLM no propuso hito, y en `operations.ts` para toda tarea nueva generada por una
  alerta. El camino humano (`createMilestoneTask`) sigue siendo el garantizado (hito elegido a mano); esto
  es solo un mejor default para lo automatico, no reemplaza decidir si conviene separar el enlace por
  agente/regla en el futuro. Verificado: typecheck y lint de `apps/api` limpios, suite completa de tests
  reales contra Supabase remoto (171 tests, 170 pass + 1 skip preexistente sin relacion) incluyendo
  `ai-orchestration-task-dedup.test.ts` y `fe-04-mi-camino-tree.test.ts` sin regresiones.
- **Siguiente accion:** ninguna para los criterios de cierre; la division en
  DB-07A/B/C es deuda editorial no bloqueante.

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
