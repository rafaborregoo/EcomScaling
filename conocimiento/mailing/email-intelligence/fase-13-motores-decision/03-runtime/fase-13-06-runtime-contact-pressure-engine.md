# Fase 13.6 — Contact Pressure Engine

## Tipo de artefacto
`03-runtime`

## Objetivo

El Contact Pressure Engine calcula la presión total reciente sobre una persona.

Debe considerar:
- campañas;
- flows;
- intensidad promocional;
- proximidad temporal;
- repetición;
- canal;
- tipo de mensaje;
- cooldowns.

La salida debe poder distinguir presión normal, elevada, saturada o equivalentes.

El motor no debe confundir presión con engagement: una persona muy engaged puede seguir estando saturada.

---

## Entradas conceptuales

- `recent_messages`
- `message_types`
- `campaigns`
- `flows`
- `cooldowns`
- `channel_history`

---

## Salidas conceptuales

- `pressure_score`
- `pressure_band`
- `active_caps`
- `active_cooldowns`
- `reason_codes`
- `calculated_at`

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
