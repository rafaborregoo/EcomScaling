# AI-05 - Agentes especialistas

## Estado

- **Estado real:** `in_progress` (global; cada agente tiene su propio estado real, ver tabla abajo — un
  solo estado para todo AI-05 oculta que A04/A06/A08/A09 y A03/A05/A07 estan en situaciones muy distintas)
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-07-20
- **Dependencias:** AI-00, AI-02
- **Evidencia:** `apps/api/src/ai-runtime.ts`, `getCachedDiagnostic`.

| Agente | Estado real | Nota |
| --- | --- | --- |
| A04 (tareas) | `shadow_pilot` | Cruza backlog con alertas/ventas; se solapa conceptualmente con A02 (ver gap abajo). |
| A06 (stock) | `shadow_pilot` | Rediseñado tras incidente real (ver abajo); el cruce critico ya llega precalculado, aunque `sql_select` sigue disponible como complemento (no retirado del `allowed_tools`). |
| A08 (conocimiento) | `shadow_pilot` | Validado en vivo con catalogo vacio; razono sin alucinar. |
| A09 (copiloto) | `in_progress` | Sin cambios en esta revision. |
| A03 (Meta Ads) | `blocked` | Bloqueado por credenciales de Meta (mismo bloqueador que INT-02/BE-04). |
| A05 (estrategia campañas) | `blocked` | Depende de A03. |
| A07 (Instagram) | `blocked` | Depende de INT-05/Meta. |
| A00 (orquestador) | `deferred` | Decision explicita, ver abajo — no es "pendiente", es "decidido no hacerlo todavia". |

Los tres agentes automaticos (A02/A04/A06) respetan la tienda activa del selector del header
(`agent_runs.store_id`) tras detectar que mezclaban todas las tiendas de la organizacion sin avisarlo;
prompts reescritos (A02 v2, A04 v2, A06 v3) para ser concisos y prohibir citar nombres de columna crudos.

**A06 — incidente real documentado**: la v1 dejaba que el modelo cruzara stock/venta el solo via
`sql_select`, y se colgo en el limite de 8 tool calls con una respuesta final vacia (~500s). Fix: el cruce
llega ya calculado en el contexto (evidence pack), no vuelto a calcular por el modelo — este es el patron
que AI-02 todavia no adopto (ver AI-02).

**Riesgo de proliferacion real, no solo teorico**: A02 (detecta hallazgos) y A04 (prioriza/genera tareas)
no tienen una frontera de responsabilidad escrita en ningun documento — hoy ambos pueden terminar
proponiendo tareas similares desde angulos distintos. Recomendado (sin implementar): A02 emite
`recommended_actions`, no tareas completas; A04 es el unico que convierte hallazgos aceptados + backlog en
plan priorizado.

**A00 (orquestador) — decision: diferir.** Con 5 agentes automaticos (A02/A04/A06/A08/A09) el valor de un
orquestador que decida cual ejecutar es marginal: cada uno ya se autoactiva por pagina (dashboard/
conocimiento) con su propia cache de 24h, sin solaparse ni competir por prioridad. Un A00 real (que decida
que agente correr, en que orden, o consolide sus salidas) aporta valor cuando exista (a) disparo por
cron/webhook para varios agentes a la vez sin que un humano abra cada pagina, o (b) suficientes agentes
como para que leer 4-5 tarjetas por separado sea mas lento que un resumen consolidado. Ninguno de los dos
se cumple hoy (todo trigger es manual via pagina visitada). Revisar cuando se desbloqueen A03/A05/A07
(Meta) o se introduzca un cron real en `apps/worker` para agentes IA.

## Objetivo

Activar agentes por dominio cuando existan datos fiables.

## Agentes

- A03 Analista de Meta Ads y creatividades.
- A04 Generador y priorizador de tareas.
- A05 Estratega de campanas.
- A06 Planificador inteligente de stock.
- A07 Analista de Instagram.
- A08 Gestor de conocimiento.
- A09 Copiloto del consultor.
- A00 Orquestador / Consultor EcomScaling IA.

## Criterios de cierre

- Cada agente tiene ficha, prompt, tools, output schema, evals y limites.
- Acciones externas permanecen como propuesta hasta nueva aprobacion ejecutiva.
