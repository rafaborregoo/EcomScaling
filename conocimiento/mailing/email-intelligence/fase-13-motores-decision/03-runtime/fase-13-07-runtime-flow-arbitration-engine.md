# Fase 13.7 — Flow Arbitration Engine

## Tipo de artefacto
`03-runtime`

## Objetivo

El Flow Arbitration Engine resuelve conflictos entre múltiples flows elegibles para la misma persona.

Debe:
- detectar mutex groups;
- comparar prioridad;
- considerar estado más avanzado;
- proteger post-purchase y soporte;
- cancelar o suspender flows inferiores;
- permitir coexistencia solo cuando esté definida.

Ejemplo habitual:
`Browse < Product < Cart < Checkout`.

El motor debe operar sobre oportunidades, no únicamente sobre nombres de flows.

---

## Entradas conceptuales

- `eligible_flows`
- `flow_instances`
- `customer_state`
- `pressure_state`
- `support_state`
- `transactional_state`

---

## Salidas conceptuales

- `selected_flows`
- `suppressed_flows`
- `delayed_flows`
- `reason_codes`
- `arbitration_version`

Estas salidas describen responsabilidades del motor. Los contratos formales de agentes y schemas de IA se definen en la Fase 14.

---

## Pipeline mínimo

```text
INPUTS
→ NORMALIZE
→ VALIDATE
→ APPLY RULES
→ RESOLVE CONFLICTS
→ COMPUTE
→ EXPLAIN
→ OUTPUT
```

---

## Invariantes

- determinismo: mismos inputs + misma versión de reglas = mismo resultado;
- idempotencia donde existan eventos o transiciones;
- source of truth explícito;
- estados `UNKNOWN` cuando falte evidencia;
- reason codes obligatorios en decisiones relevantes;
- versionado de reglas;
- auditoría de inputs esenciales y resultado;
- separación entre cálculo y generación de lenguaje.

---

## Observabilidad

El motor debe poder explicar:

```text
qué datos usó
qué reglas aplicó
qué reglas bloquearon
qué resultado produjo
qué versión estaba activa
cuándo se calculó
```

---

## Principio maestro

Este motor debe ser ejecutable sin necesidad de que un LLM improvise lógica de negocio.
