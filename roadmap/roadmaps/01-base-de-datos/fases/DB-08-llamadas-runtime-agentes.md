# DB-08 - Llamadas y runtime inicial de agentes

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

