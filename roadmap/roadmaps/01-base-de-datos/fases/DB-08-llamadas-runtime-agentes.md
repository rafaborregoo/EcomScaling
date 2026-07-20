# DB-08 - Llamadas y runtime inicial de agentes

## Estado

- **Estado real:** `verification_pending`
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-07-20
- **Dependencias:** DB-00, DB-02
- **Bloqueador:** ninguno
- **Evidencia:**
  - Migraciones `db_08a` (runtime, 2026-07-18), `db_08b`/`db_08c` (SQL Gateway + hardening de rol) y `db_08d`
    (llamadas: `consulting_calls`, `call_transcripts` con indice unico parcial = una sola transcripcion
    actual, `call_ai_summaries` con RLS published-only para cliente y `run_id` que enlaza con
    `agent_runs`, `call_internal_notes` solo consultores, `call_task_links`) aplicadas en remoto.
  - Las tablas del runtime de agentes (`agent_definitions`, `agent_versions`, `prompt_versions`,
    `agent_runs`, `agent_run_steps`, `agent_tool_calls`, `agent_context_snapshots`, `agent_outputs`,
    `agent_approvals`, `agent_query_runs`) **si existen** en el esquema real — la incoherencia que
    senalaba el snapshot conceptual (retirado) estaba en ese archivo, no en las migraciones reales.
  - Output de A01 (analista de llamadas) **si tiene contrato validado**: `callSummaryOutputSchema` /
    `callSummaryJsonSchema` en `packages/ai/src/index.ts`, aplicado via `runAgentTurn` + validacion Zod +
    `checkOutputSanity` (guarda de calidad de AI-06).
  - `agent_runs` registra modelo, tokens, coste estimado, latencia y `error_message` por ejecucion.
- **Gaps identificados:**
  - Este documento mezcla runtime de agentes, llamadas/transcripciones y aprobaciones en un solo bloque de
    estado (dividir en DB-08A/B/C facilitaria auditarlos por separado).
  - Sin evidencia formal de tests de alucinacion, duplicacion de tareas, rechazo o edicion para A01.
  - Sin politica de retencion/redaccion de PII documentada para transcripciones.
  - Sin verificacion explicita de "acceso cliente antes y despues de publicar" mas alla de la policy RLS
    (no cubierto por `rls-tenant-isolation.test.ts`).
- **Siguiente accion:** anadir tests de A01 sobre casos de alucinacion/rechazo/publicacion, y documentar
  retencion de PII de transcripciones.

## Objetivo

Guardar llamadas, transcripciones, resumenes, tareas propuestas y trazabilidad del primer agente A01.

## Tablas de llamadas

- `consulting_calls`
- `call_transcripts`
- `call_ai_summaries`
- `call_task_links`

## Tablas runtime IA

- `agent_definitions`
- `agent_versions`
- `prompt_versions`
- `agent_runs`
- `agent_run_steps`
- `agent_tool_calls`
- `agent_context_snapshots`
- `agent_outputs`
- `agent_approvals`
- `agent_query_runs`

## Criterios de cierre

- Solo una transcripcion actual por llamada.
- Resumen y tareas requieren aprobacion antes de publicar al cliente.
- Cada ejecucion IA registra fuentes, coste, latencia y resultado.

