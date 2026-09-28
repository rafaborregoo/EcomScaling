# Fase 13.3 — Engagement Engine

## Tipo de artefacto
`03-runtime`

## Objetivo

El Engagement Engine estima el nivel de interacción de una persona con la marca y sus comunicaciones.

Debe combinar señales con distinta fuerza:
- clicks;
- replies;
- site activity;
- purchase activity;
- email opens con menor peso cuando corresponda;
- tiempo desde última interacción.

Debe soportar decay y producir estados como `ENGAGED`, `ACTIVE`, `COOLING`, `DISENGAGED` o equivalentes.

No debe equiparar engagement con intención ni con consentimiento.

---

## Entradas conceptuales

- `email_events`
- `site_events`
- `purchase_events`
- `reply_events`
- `recency`
- `frequency`

---

## Salidas conceptuales

- `engagement_score`
- `engagement_band`
- `signal_breakdown`
- `confidence`
- `calculated_at`
- `model_version`

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
