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
  - Sin politica de retencion/redaccion de PII documentada para transcripciones.
- **Correcciones 2026-07-21 (la auditoria anterior subestimaba lo ya construido):**
  - **"Sin evidencia formal de tests de alucinacion/rechazo para A01"** era incorrecto: `checkOutputSanity`
    (AI-06, `packages/ai/src/index.test.ts`) ya es generico por duck-typing sobre `summary`/`proposed_tasks`
    y tiene tests explicitos con forma de A01 ("acepta una salida de resumen de llamada con proposed_tasks
    (A01)", "rechaza proposed_tasks con titulo vacio (A01)").
  - **"Sin verificacion de acceso cliente antes/despues de publicar"** ya tiene test: `rls-tenant-isolation.test.ts`
    incluye "el cliente no ve un resumen de llamada en borrador, pero si en cuanto se publica" (`call_ai_summaries`,
    status `draft` -> `published`), confirmado contra el Supabase remoto real.
- **Siguiente accion:** documentar retencion/redaccion de PII de transcripciones; evaluar dividir el documento en DB-08A/B/C.

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
