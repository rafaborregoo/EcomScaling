# BE-05 - Operaciones: alertas, tareas, llamadas y planes

## Estado

> Correccion 2026-08-02: el gap de asociar un resumen a la transcripcion exacta queda cerrado con la
> migracion `20260802100000_be_05_call_summary_transcript_binding.sql`. Los flujos manual y A01 guardan
> `call_ai_summaries.transcript_id`; la UI no presenta como vigente un resumen publicado de una version
> posterior. Las filas históricas conservan `NULL` y no se sobrescriben.

- **Estado real:** `functionally_complete_verification_pending` (funciona, pero el documento no
  demuestra cobertura integral — "validado con datos reales" sin organizacion/entorno/caso concretos no
  es evidencia verificable).
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-07-20
- **Dependencias:** DB-07, DB-08
- **Bloqueador:** ninguno
- **Endpoints reales de llamadas** (`apps/api/src/server.ts`, prefijo `/v1/organizations/:organizationId`):

  | Metodo | Ruta                                  | Efecto                                                                                                                                                                    |
  | ------ | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | GET    | `/calls`                              | Lista llamadas (RLS recorta resumenes `published`-only y notas internas para el cliente).                                                                                 |
  | POST   | `/calls`                              | Crea llamada.                                                                                                                                                             |
  | PATCH  | `/calls/:callId`                      | Actualiza llamada.                                                                                                                                                        |
  | PUT    | `/calls/:callId/transcript`           | Nueva version de transcripcion (indice unico parcial = una sola actual).                                                                                                  |
  | POST   | `/calls/:callId/summary`              | Crea resumen manual (`draft`).                                                                                                                                            |
  | POST   | `/calls/:callId/analyze`              | Genera resumen via agente A01 (`pending_approval`, igual que el manual).                                                                                                  |
  | POST   | `/call-summaries/:summaryId/decision` | Aprueba o rechaza — **aprobar y publicar son la misma accion**: el update pasa `status` directo a `published` en un solo paso (`decideSummary`, `apps/api/src/calls.ts`). |
  | POST   | `/calls/:callId/internal-notes`       | Nota interna, solo consultor.                                                                                                                                             |
  | POST   | `/calls/:callId/tasks`                | Tarea enlazada a la llamada.                                                                                                                                              |

- **Evidencia verificada en codigo (no solo afirmada):**
  - `decideSummary` solo permite decidir resumenes en estado `draft`/`pending_approval`
    (`.in("status", ["draft", "pending_approval"])`) — un resumen `published` o `rejected` no puede
    re-decidirse via este endpoint.
  - No existe ningun endpoint de edicion de un `call_ai_summaries` ya creado: no hay forma de editar
    silenciosamente un resumen publicado via API (coincide con lo que pide la auditoria, simplemente no
    estaba documentado).
  - El resumen puede originarse manual (`POST /summary`) o via A01 (`POST /analyze`, con `run_id`
    enlazando a `agent_runs`) — ambos caminos convergen al mismo flujo de aprobacion.
- **Gaps identificados:**
  - "Validado con datos reales" no especifica organizacion, entorno, casos ni resultado — no hay test
    automatizado que preserve esa garantia.
  - Sin definicion explicita de que pasa si llega una transcripcion nueva cuando ya existe un resumen
    aprobado sobre la version anterior (¿invalida el resumen? ¿lo deja huerfano?).
  - Documento agrupa 4 subdominios (motor de alertas, tareas/notificaciones, llamadas, Mi Camino) —
    recomendado dividir en BE-05A (motor de alertas), BE-05B (tareas/notificaciones), BE-05C (llamadas),
    BE-05D (planes estrategicos) para auditar cada uno por separado.
- **Siguiente accion:** decidir y documentar que pasa con un resumen aprobado cuando llega una
  transcripcion nueva, y anadir tests automatizados que reemplacen la validacion manual como evidencia.

## Objetivo

Convertir metricas en ejecucion diaria para cliente y consultor.

## Entregables

- Motor de reglas deterministas.
- Creacion idempotente de alertas y tareas.
- Workflow de llamadas Loom: transcripcion manual, resumen IA, revision y publicacion.
- Servicios de Mi Camino.
- Notificaciones.

## Criterios de cierre

- Tarea creada por alerta no se duplica.
- Cambios de estado quedan auditados.
- Resumen de llamada no se publica sin aprobacion.
