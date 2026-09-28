# Fase 13.13 — Evidence Engine

## Tipo de artefacto
`03-runtime`

## Objetivo

El Evidence Engine organiza y pondera evidencia generada por observaciones, experimentos y análisis.

Debe mantener:
- evidence type;
- source;
- scope;
- population;
- freshness;
- quality;
- direction;
- contradictions.

Debe poder apoyar o debilitar un learning candidate.

No debe convertir automáticamente toda evidencia en aprendizaje.

---

## Entradas conceptuales

- `observations`
- `experiment_results`
- `external_evidence`
- `current_learning`
- `scope`

---

## Salidas conceptuales

- `evidence_set`
- `evidence_quality`
- `supporting_evidence`
- `contradicting_evidence`
- `confidence_inputs`
- `lineage`

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
