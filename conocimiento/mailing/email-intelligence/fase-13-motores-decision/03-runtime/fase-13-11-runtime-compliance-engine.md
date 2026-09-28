# Fase 13.11 — Compliance Engine

## Tipo de artefacto
`03-runtime`

## Objetivo

El Compliance Engine evalúa si una acción cumple restricciones legales, de proveedor y políticas internas relevantes.

Debe poder verificar:
- consentimiento/base;
- suppression;
- unsubscribe;
- provider requirements;
- claims restrictions;
- market/jurisdiction rules;
- message classification.

Debe resolver reglas por fecha efectiva y jurisdicción/proveedor.

El motor no sustituye asesoramiento jurídico, pero sí debe impedir ejecución cuando una policy hard configurada falla.

---

## Entradas conceptuales

- `action_context`
- `customer_context`
- `market`
- `provider`
- `policy_registry`
- `consent_state`
- `suppression_state`

---

## Salidas conceptuales

- `compliant`
- `blocking_rules`
- `warnings`
- `policy_versions`
- `reason_codes`
- `evaluated_at`

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
