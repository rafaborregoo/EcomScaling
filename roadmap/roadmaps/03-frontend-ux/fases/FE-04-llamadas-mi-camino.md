# FE-04 - Mis Llamadas y Mi Camino

## Estado

> Correccion vigente 2026-08-24: Fathom sigue sin conexion productiva ni
> materializacion de llamadas, pero ya tiene contrato de webhook, verificacion
> HMAC, parser y dedupe key en `apps/api/src/fathom-webhook.ts`. La validacion
> externa requiere una API key de prueba.

- **Estado real:** `functionally_complete_ux_validation_pending`
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-08-24
- **Dependencias:** DB-08, BE-05
- **Bloqueador:** ninguno
- **Evidencia:** `/camino` operativo; `/llamadas`: registro, transcripcion versionada, resumen
  manual/A01, aprobacion/rechazo antes de publicar, tareas y notas internas desde la llamada (ver BE-05
  para el contrato de endpoints y estados verificado en codigo).
- **Correccion importante:** "deteccion de proveedor Loom/Fathom" en el estado original sugeria una
  integracion activa. En realidad es deteccion del dominio del enlace pegado por el consultor (heuristica
  de UI), **no** una conexion via webhook real — Fathom real (webhook, firma, idempotencia) sigue sin
  implementar (ver BE-06E). No presentar esto como "integracion Fathom" hasta que exista el webhook.
- **Gaps identificados:**
  - Documento agrupa dos modulos sin relacion tecnica directa (Llamadas y Mi Camino); dividir en
    FE-04A-calls.md y FE-04B-strategic-roadmap.md facilitaria auditarlos por separado.
  - Sin documentacion de reproductor/enlace de grabacion, errores de proveedor, ni carga manual como
    fallback.
  - Mi Camino: sin documentar quien crea/activa fases, como se calcula el progreso, que pasa al reabrir
    una tarea de un hito, si los hitos pueden reordenarse, ni versionado de planes.
- **Rediseño de Mi Camino cerrado 2026-07-29**: gap real -- una vez creado el plan, ni las fases ni los
  hitos se podian editar (nombre/descripcion/fecha objetivo fijos para siempre), y crear una tarea "con
  contexto de a que hito pertenece" exigia dos llamadas separadas (crear en `/tasks`, enlazar aparte en
  `/milestones/:id/tasks`). Backend: `updatePhase`/`updateMilestone` (`apps/api/src/strategic-plans.ts`),
  y `createMilestoneTask` que crea la tarea (`source: 'strategic_plan'`) y la enlaza al hito en un solo
  paso -- reutilizado tanto por el consultor (UI) como por la IA (`ai-runtime.ts`, `proposed_writes` con
  `milestone_id` opcional, enlace best-effort via el trigger `enforce_milestone_task_link_same_org`
  existente). `getStrategicPlan` ahora embebe titulo/estado/prioridad real de cada tarea enlazada (antes
  solo el `task_id`). Frontend (`apps/web/src/app/camino/page.tsx`): rediseñado como arbol vertical
  fase→hito con linea/nodos conectores, tarjetas de hito desplegables (colapsadas si ya estan
  completadas/omitidas), edicion inline de fase e hito, y formulario para crear una tarea directamente
  dentro de un hito. 4 tests de integracion nuevos contra Supabase remoto real
  (`apps/api/src/fe-04-mi-camino-tree.test.ts`, 4/4 verde) mas 3 rutas nuevas añadidas al test de
  aislamiento cross-tenant (`be-01-cross-tenant-write-endpoints.test.ts`, 7/7 verde). Typecheck, lint y
  build de produccion de `web` limpios; sin verificar visualmente en navegador (sin Playwright/Chromium en
  este entorno).
- **Ampliado 2026-07-29 (peticion de Rafa, "como en GitHub")**: dos gaps reales mas cerrados el mismo dia.
  (1) Ni el consultor ni el cliente podian anadir una fase o un hito nuevo a un plan ya existente -- solo
  nacian con la creacion inicial del plan completo. Nuevos endpoints `createPhase`/`createMilestone`
  (`apps/api/src/strategic-plans.ts`), mismo permiso `assertCanManagePlan` que el resto (owner/manager
  tanto como consultor/admin). (2) No habia forma de saber si una fase/hito/tarea la habia propuesto el
  consultor o el cliente. Migracion `20260729130000_fe_04_mi_camino_created_by.sql` (columna `created_by`
  nullable en `strategic_plan_phases`/`_milestones`, aplicada al Supabase real) mas `attachCreatorOrigin`
  en el backend, que deriva "consultor" o "cliente" del `platform_role` del creador (no se guarda aparte,
  siempre refleja quien es consultor hoy) y lo devuelve como `created_by_origin` en cada fase/hito/tarea.
  Frontend (`apps/web/src/app/camino/page.tsx`) reescrito sobre `@xyflow/react`: fases en el tronco
  vertical, hitos como ramas horizontales conectadas por lineas/circulos reales (no CSS a mano), color de
  cada rama/punto segun quien la propuso (azul consultor, verde cliente -- mismos tokens `--color-brand`/
  `--color-success` que el resto de la app). Seleccionar un nodo abre un panel de detalle con edicion
  inline y creacion de tareas, reutilizando los mismos formularios que antes. 6 tests de integracion
  nuevos contra Supabase remoto real (create fase/hito, `created_by_origin` = 'client' verificado end to
  end) mas 2 rutas nuevas en el test de aislamiento cross-tenant. Typecheck/lint/build de `web` limpios.
- **Siguiente accion:** corregir la descripcion de "deteccion de proveedor" para no sugerir integracion
  activa, y dividir el documento en los dos submodulos. Pendiente no bloqueante: reordenar fases/hitos
  (drag-and-drop) y versionado de planes (editar un plan activo crea v2 vs mutar in-place) siguen sin
  resolver.

## Objetivo

Conectar aprendizaje mensual, resumenes aprobados, tareas y plan estrategico.

## Entregables

- Listado de llamadas.
- Link Loom/Fathom, transcripcion y resumen aprobado.
- Revision consultor antes de publicar.
- Timeline de Mi Camino con fases, hitos y progreso.
- Notas internas solo consultor.

## Criterios de cierre

- Cliente no ve borradores no aprobados.
- Hitos y tareas asociadas mantienen coherencia.
- El plan se puede editar desde panel consultor.
