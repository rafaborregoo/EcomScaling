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
| AI-07 | `fases/AI-07-memoria-acumulativa-consultor-experto.md` | F13-F14 | Informes periodicos auto-ingeridos como RAG; el agente acumula historial real por cliente. |
| AI-08 | *(no creado todavia)* | F14+ | Propuesto, `planned`: vincular recomendaciones con acciones, aceptacion/rechazo, KPI antes/despues — la pieza que falta para que el sistema aprenda de resultados, no solo de resumenes. Ver riesgo de diseño en AI-07. |
| AI-09 | *(no creado todavia)* | F14+ | Propuesto, `planned`: model routing por agente, presupuesto por organizacion y circuit breakers. Ya existe presupuesto plano por turno y fallback Anthropic/OpenAI; falta el control por organizacion/modelo. |
| AI-10 | `fases/AI-10-evidencia-comun.md` | F14+ | `implemented_partial` (corregido 2026-07-23, antes `planned` por un doc desactualizado) — envolvente comun IA-frontend (`AgentOutputEnvelope`, `AgentSourceReference`, `AgentProposal`) ya implementada y en uso real por A02/A04/A06/A08/A09; `freshness.status` cableado de punta a punta pero solo produce `"fresh"` hoy. |
| AI-11 | `fases/AI-11-generador-contenido-marketing.md` | F11-F12 | `planned` — generador de HTML de campañas/flows/pop-ups para Klaviyo (copiar-pegar, sin envio via API); Fase A (generador) sin dependencias, Fase B (aprendizaje de resultados reales) bloqueada por INT-03/DB-09/BE-06. |
| AI-12 | `fases/AI-12-ingenieria-de-agentes.md` | transversal | `in_progress` — pedido explicito de Rafa: mapea las 10 disciplinas estandar de ingenieria de agentes (harness, loop, context, tool design, memoria, orquestacion, guardrails, evals, human-in-the-loop, observabilidad) contra el estado real del proyecto. No reemplaza ninguna fase existente, es una lente transversal sobre ellas. |
