# AI-09 - Routing, presupuesto y circuit breaker

> Correccion de implementacion 2026-08-21: `AI_PLAN_BUDGETS_JSON` ya vincula los presupuestos
> diarios y por turno al `plan_code` de la suscripcion activa, incluyendo multiplicador de complejidad.
> La configuracion es opcional, server-side y conserva defaults seguros; queda pendiente unicamente
> la agregacion APM multi-instancia y definir los valores comerciales finales antes de live.

> Correccion documental 2026-08-21: esta fase ya no es una propuesta sin archivo.
> El runtime y sus tests existen; el estado sigue siendo parcial porque la configuracion
> por plan y la observabilidad APM multi-instancia requieren decisiones/infraestructura externa.

## Estado

- **Estado real:** `implemented_partial`
- **Evidencia runtime:** `apps/api/src/ai-runtime.ts`
- **Evidencia de configuración:** `packages/config/src/index.ts`
- **Evidencia de tests:** `apps/api/src/ai-09-provider-circuit-breaker.test.ts`,
  `packages/config/src/index.test.ts`, `packages/ai/src/index.test.ts`
- **Bloqueador:** ninguno para el piloto en shadow; no se habilita live por inferencia del modelo.

## Implementado

- Routing opcional por `agent_code` mediante `AI_MODEL_ROUTING_JSON`, con modelo Anthropic/OpenAI,
  límite de coste por turno y límite de tool calls sanitizados.
- Presupuesto duro por turno en `packages/ai`, con corte cuando se supera coste o número de tools.
- Presupuesto diario por organización en UTC, fail-closed si no puede leerse el gasto.
- Circuit breaker por organización: tres fallos persistidos del proveedor en cinco minutos bloquean
  nuevos turnos durante la ventana de protección.
- El routing inválido o ausente conserva defaults seguros y no requiere claves de proveedor para
  validar configuración.

## Límites honestos

- `AI_PLAN_BUDGETS_JSON` ya vincula los límites al `plan_code` de la suscripción activa y permite
  conservar defaults conservadores cuando un plan no tiene override. Falta decidir los valores
  comerciales finales, no implementar el enlace técnico.
- Las métricas son auditables por `agent_runs`, pero la agregación APM multi-instancia queda pendiente
  hasta conectar infraestructura externa.
- Todas las ejecuciones del piloto persisten `execution_mode = shadow`; cualquier propuesta de escritura
  requiere aprobación humana antes de materializarse.

## Criterios de activación futura

1. Configurar routing y presupuestos por plan sin exponer secretos al cliente.
2. Validar métricas agregadas y alertas en un entorno multi-instancia.
3. Mantener circuit breaker, aprobación humana y shadow como guards obligatorios antes de cualquier live.
