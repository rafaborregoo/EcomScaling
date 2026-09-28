# Fase 13.8 — Campaign Arbitration Engine

## Tipo de artefacto
`03-runtime`

## Objetivo

El Campaign Arbitration Engine decide qué campañas pueden ejecutarse cuando existen solapamientos de audiencia, calendario o presión.

Debe considerar:
- prioridad comercial;
- relevancia;
- campaign objective;
- conflicts;
- contact pressure;
- blackout windows;
- campaign vs flow competition.

Puede devolver `ALLOW`, `DELAY`, `REDUCE_AUDIENCE`, `SUPPRESS_PARTIAL` o `NO_SEND`.

No debe asumir que una campaña aprobada previamente sigue siendo válida en el momento final.

---

## Entradas conceptuales

- `campaign_candidates`
- `audience_overlap`
- `flow_context`
- `pressure_state`
- `calendar_context`
- `offer_conflicts`

---

## Salidas conceptuales

- `campaign_decisions`
- `audience_adjustments`
- `delays`
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
