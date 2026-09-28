# Fase 13.5 — Eligibility Engine

## Tipo de artefacto
`03-runtime`

## Objetivo

El Eligibility Engine decide si una persona puede participar en una acción concreta.

Debe evaluar en orden:
- identidad válida;
- consentimiento/base aplicable;
- suppression;
- hard exclusions;
- lifecycle/context;
- product/offer validity;
- pressure/cooldown;
- campaign/flow-specific conditions.

Debe devolver una decisión explicable y no simplemente un booleano.

Las restricciones hard deben prevalecer sobre scoring o recomendaciones de IA.

---

## Entradas conceptuales

- `action_context`
- `customer_state`
- `consent_state`
- `suppression_state`
- `exclusions`
- `pressure_state`
- `product_offer_state`

---

## Salidas conceptuales

- `eligible`
- `eligibility_state`
- `reason_codes`
- `blocking_rules`
- `evaluated_at`
- `rules_version`

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
