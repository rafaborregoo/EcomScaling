# Fase 13.12 — Measurement Engine

## Tipo de artefacto
`03-runtime`

## Objetivo

El Measurement Engine calcula métricas oficiales de campañas, flows, cohorts y experimentos.

Debe centralizar definiciones de:
- delivered;
- clicks;
- CTR;
- conversion;
- revenue;
- RPR;
- AOV;
- margin;
- profit;
- unsubscribe;
- complaints;
- bounce;
- flow metrics;
- campaign metrics;
- cohort metrics;
- attribution;
- incrementality.

Las métricas deben ser reproducibles y versionadas.

El LLM interpreta resultados; no calcula la cifra oficial.

---

## Entradas conceptuales

- `event_streams`
- `order_data`
- `cost_data`
- `metric_definition`
- `population`
- `time_window`
- `attribution_model`

---

## Salidas conceptuales

- `metric_results`
- `data_quality`
- `definition_versions`
- `source_refs`
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
