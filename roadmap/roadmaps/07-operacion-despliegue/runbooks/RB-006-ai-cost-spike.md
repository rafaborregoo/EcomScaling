# RB-006 - Coste de IA disparado

## Sintoma

Facturación de Anthropic más alta de lo esperado, o varios `agent_runs.status = 'budget_exceeded'`
seguidos para la misma organización/agente.

## Impacto

Coste directo. Si el corte por presupuesto (`budget_exceeded`) se repite para un agente concreto, ese
agente deja de producir diagnósticos utilizables para esa organización hasta que se investigue.

## Severidad

**SEV-3** si es un pico puntual y contenido por el presupuesto (`AgentBudgetExceededError`, ver AI-00).
**SEV-2** si el volumen de runs (no el coste por run) escala sin control — el presupuesto por run no
protege contra "demasiados runs", solo contra "un run carísimo".

## Comprobaciones iniciales

1. Runs recientes por coste, agente y organización:
   ```sql
   select organization_id, agent_version_id, status, estimated_cost_usd, input_tokens, output_tokens,
          started_at, finished_at
   from agent_runs
   where started_at > now() - interval '24 hours'
   order by estimated_cost_usd desc
   limit 30;
   ```

2. Cuántos runs terminaron en `budget_exceeded` (corte real por presupuesto, `DEFAULT_AGENT_BUDGET` en
   `apps/api/src/ai-runtime.ts`: `maxCostUsd: 1`, `maxToolCalls: 10`) frente a `succeeded`:
   ```sql
   select agent_version_id, status, count(*), avg(estimated_cost_usd)
   from agent_runs
   where started_at > now() - interval '24 hours'
   group by agent_version_id, status
   order by count(*) desc;
   ```

3. Volumen de runs por organización (¿es una organización concreta generando runs de más, o es general?):
   ```sql
   select organization_id, count(*) as runs, sum(estimated_cost_usd) as total_cost
   from agent_runs
   where started_at > now() - interval '24 hours'
   group by organization_id
   order by total_cost desc
   limit 10;
   ```

## Diagnóstico

- **Muchos `budget_exceeded` para un agente concreto**: ese agente está intentando hacer más tool calls o
  generar más tokens de lo normal — señal de que el contexto que recibe cambió (p. ej. una tienda con
  datos anómalos) o que el prompt empezó a explorar de más. Revisar `agent_tool_calls` de esos runs para
  ver qué tool se llamó repetidamente.
- **Coste alto pero sin `budget_exceeded`** (runs individuales dentro del límite pero muchos runs): el
  presupuesto por run (`DEFAULT_AGENT_BUDGET`) no cubre este caso — es un problema de volumen/frecuencia,
  no de coste por ejecución. Candidatos: caché de 24h no está funcionando (`getCachedDiagnostic`,
  revisar `lookback_days`/`store_id` de la clave de caché), o un bucle en el frontend regenerando
  diagnósticos.
- **Una sola organización concentra el gasto**: puede ser legítimo (organización grande, muchas tiendas)
  o un bug de scope (un agente iterando sobre todas las tiendas cuando debería limitarse a una,
  ver el fix de `agent_runs.store_id` en AI-05).

## Acciones

1. Si es un agente concreto en bucle de `budget_exceeded`: revisar el prompt/contexto de ese agente antes
   de subir el límite — subir `maxCostUsd` sin entender la causa solo pospone el problema.
2. Si es volumen: confirmar que la caché de 24h (`getCachedDiagnostic`) está funcionando para esa
   organización — un `from_cache: false` repetido en poco tiempo para la misma organización/tienda/periodo
   es la señal de que algo fuerza regeneración innecesaria.
3. En un pico grave sin causa clara todavía identificada: bajar `DEFAULT_AGENT_BUDGET.maxCostUsd`
   temporalmente en `ai-runtime.ts` como contención mientras se investiga (afecta a todos los agentes por
   igual — es la limitación conocida de tener un único presupuesto plano, ver AI-00).

## Rollback

Revertir cualquier cambio de prompt/contexto sospechoso a la versión anterior activa
(`agent_versions.is_active`, rollback ya soportado de facto — ver AI-06).

## Validación de recuperación

`estimated_cost_usd` diario vuelve a niveles normales; los `budget_exceeded` dejan de repetirse para el
mismo agente/organización.

## Comunicación al cliente

No aplica salvo que el pico haya degradado el servicio (agente sin diagnóstico disponible por cortes
repetidos) — en ese caso, avisar igual que un fallo de sync.

## Escalado

Si el presupuesto plano (`maxCostUsd: 1` por run) resulta insuficiente para el uso legítimo de algún
agente, es señal de que hace falta presupuesto por agente/organización (AI-09, propuesto, no
implementado) en vez de seguir subiendo el límite global.

## Evidencias a conservar

Query de `agent_runs` con el pico (coste, tokens, tool calls) y qué acción de contención se tomó — para
alimentar el diseño futuro de AI-09 con datos reales en vez de estimaciones.

## Prevención

El presupuesto por run ya existe (`AgentBudgetExceededError`, 2026-07-20). Falta: alertas automáticas de
coste anómalo (SQO-02, pendiente) y presupuesto por agente/organización en vez de plano (AI-09, propuesto).
