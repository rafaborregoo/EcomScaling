# Fase 13.14 — Send Decision Engine

## Tipo de artefacto
`03-runtime`

## Objetivo

El Send Decision Engine produce la decisión final sobre una oportunidad de comunicación.

Debe consumir resultados de motores previos, no recalcularlos libremente.

Orden recomendado:
1. Compliance;
2. Suppression/Eligibility;
3. Product/Offer validity;
4. Contact Pressure;
5. Flow/Campaign Arbitration;
6. Timing;
7. Final decision.

Decisiones principales:
- `SEND`;
- `DELAY`;
- `SUPPRESS`;
- `NO_SEND`.

La decisión debe ser explicable, versionada e idempotente.

El motor debe aceptar `NO_SEND` como resultado normal y óptimo cuando no existe una acción suficientemente relevante o segura.

---

## Entradas conceptuales

- `action_candidate`
- `compliance_result`
- `eligibility_result`
- `pressure_result`
- `arbitration_result`
- `product_result`
- `offer_result`
- `timing_context`

---

## Salidas conceptuales

- `decision`
- `reason_codes`
- `blocking_rules`
- `selected_action`
- `next_evaluation_at`
- `decision_version`
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
