# Roadmap operativo - Agentes IA

## Objetivo

Construir agentes auditables, no prompts sueltos. Los calculos son deterministas; la IA interpreta, explica, propone y coordina con herramientas controladas.

## Fases

| Fase | Archivo | Relacion maestro | Resultado |
| --- | --- | --- | --- |
| AI-00 | `fases/AI-00-contratos-runtime.md` | F0-F1 | Contrato comun, tools, output schema y versionado. |
| AI-01 | `fases/AI-01-a01-analista-llamadas.md` | F8 | Primer agente con revision humana. |
| AI-02 | `fases/AI-02-a02-monitor-negocio.md` | F7-F10 | Diagnostico y tareas propuestas/automaticas segun madurez. |
| AI-03 | `fases/AI-03-sql-gateway.md` | F13 | SQL analitico de solo lectura. |
| AI-04 | `fases/AI-04-rag-conocimiento.md` | F13 | Base de conocimiento, retrieval y citas. |
| AI-05 | `fases/AI-05-agentes-especialistas.md` | F11-F14 | Meta, stock, campanas, Instagram y copiloto consultor. |
| AI-06 | `fases/AI-06-evaluaciones-calidad.md` | F8-F14 | Evals, datasets, seguridad y regression tests. |

