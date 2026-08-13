# Roadmap operativo - Agentes IA

## Objetivo

### Correccion AI-09 (2026-08-02)

AI-09 tiene una primera implementacion real en `apps/api/src/ai-runtime.ts`:
limite por turno (`maxCostUsd: 1`, `maxToolCalls: 10`), limite diario plano de
20 USD por organizacion UTC y bloqueo fail-closed con `503` si no se puede
verificar el gasto. `ai-09-organization-daily-budget.test.ts` valida el
comportamiento contra Supabase remoto. Sigue `implemented_partial` porque
faltan configuracion por plan/agente, circuit breaker distribuido y evals
completas de todos los ejecutores.

El estado se expone de forma tenant-scoped en
`GET /v1/organizations/:organizationId/ai/budget` y se muestra en `/agentes`
con loading, error y empty state. El endpoint solo responde para memberships
de la organización solicitada.

### Correccion AI-13 (2026-08-02)

El modo `shadow` queda persistido y auditable en `agent_runs.execution_mode`;
ver [AI-13](fases/AI-13-modo-shadow-auditable.md). `live` queda reservado para
una activacion futura explicita.

Construir agentes auditables, no prompts sueltos. Los calculos son deterministas; la IA interpreta, explica, propone y coordina con herramientas controladas.

Este objetivo se ejecuta dentro del [contrato global del SaaS](../../../docs/OBJETIVO_SAAS_PILOTO_Y_CRITERIOS_DE_TERMINADO.md):
los agentes deben funcionar con Shopify real en shadow mode y aceptar contexto futuro de Meta Ads, Klaviyo
e Instagram mediante contratos normalizados, sin inventar datos ni ejecutar escrituras sin aprobación humana.

### Correccion AI-11 (2026-08-02)

AI-11 pasa a `implemented_partial`: la fila AI-11 de la tabla inferior debe interpretarse con
este estado actualizado. La Fase A ya genera drafts sanitizados, los persiste, permite aprobación,
preview seguro y copiar HTML desde `/marketing`. No publica ni envía vía API; la Fase B depende de
conexión y reporting real de Klaviyo.

## Fases

| Fase   | Archivo                                                | Relacion maestro | Resultado                                                                                                                                                                                                                                                                                                                              |
| ------ | ------------------------------------------------------ | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AI-00  | `fases/AI-00-contratos-runtime.md`                     | F0-F1            | Contrato comun, tools, output schema y versionado.                                                                                                                                                                                                                                                                                     |
| AI-00A | `fases/AI-00A-tool-layer-foundation.md`                | transversal      | Tool layer tipado, autorizable, presupuestado y auditable.                                                                                                                                                                                                                                                                             |
| AI-01  | `fases/AI-01-a01-analista-llamadas.md`                 | F8               | Primer agente con revision humana.                                                                                                                                                                                                                                                                                                     |
| AI-02  | `fases/AI-02-a02-monitor-negocio.md`                   | F7-F10           | Diagnostico y tareas propuestas/automaticas segun madurez.                                                                                                                                                                                                                                                                             |
| AI-03  | `fases/AI-03-sql-gateway.md`                           | F13              | SQL analitico de solo lectura.                                                                                                                                                                                                                                                                                                         |
| AI-04  | `fases/AI-04-rag-conocimiento.md`                      | F13              | Base de conocimiento, retrieval y citas.                                                                                                                                                                                                                                                                                               |
| AI-05  | `fases/AI-05-agentes-especialistas.md`                 | F11-F14          | Meta, stock, campanas, Instagram y copiloto consultor.                                                                                                                                                                                                                                                                                 |
| AI-06  | `fases/AI-06-evaluaciones-calidad.md`                  | F8-F14           | Evals, datasets, seguridad y regression tests.                                                                                                                                                                                                                                                                                         |
| AI-07  | `fases/AI-07-memoria-acumulativa-consultor-experto.md` | F13-F14          | Informes periodicos auto-ingeridos como RAG; el agente acumula historial real por cliente.                                                                                                                                                                                                                                             |
| AI-08  | _(no creado todavia)_                                  | F14+             | Propuesto, `planned`: vincular recomendaciones con acciones, aceptacion/rechazo, KPI antes/despues — la pieza que falta para que el sistema aprenda de resultados, no solo de resumenes. Ver riesgo de diseño en AI-07.                                                                                                                |
| AI-09  | _(no creado todavia)_                                  | F14+             | Propuesto, `planned`: model routing por agente, presupuesto por organizacion y circuit breakers. Ya existe presupuesto plano por turno y fallback Anthropic/OpenAI; falta el control por organizacion/modelo.                                                                                                                          |
| AI-10  | `fases/AI-10-evidencia-comun.md`                       | F14+             | `implemented_partial` (corregido 2026-07-23, antes `planned` por un doc desactualizado) — envolvente comun IA-frontend (`AgentOutputEnvelope`, `AgentSourceReference`, `AgentProposal`) ya implementada y en uso real por A02/A04/A06/A08/A09; `freshness.status` cableado de punta a punta pero solo produce `"fresh"` hoy.           |
| AI-11  | `fases/AI-11-generador-contenido-marketing.md`         | F11-F12          | `implemented_partial` — generador de HTML de campañas/flows/pop-ups para Klaviyo (copiar-pegar, sin envio via API); Fase A persistida, editable, versionada y con aprobación/preview; Fase B (aprendizaje de resultados reales) bloqueada por INT-03/DB-09/BE-06.                                                                                                               |
| AI-12  | `fases/AI-12-ingenieria-de-agentes.md`                 | transversal      | `in_progress` — pedido explicito de Rafa: mapea las 10 disciplinas estandar de ingenieria de agentes (harness, loop, context, tool design, memoria, orquestacion, guardrails, evals, human-in-the-loop, observabilidad) contra el estado real del proyecto. No reemplaza ninguna fase existente, es una lente transversal sobre ellas. |
