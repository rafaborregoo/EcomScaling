# Fase 11.9 — Margin — Runtime

## Tipo de artefacto
`03-runtime`

## Objetivo

Calcular `Margin` de forma determinista, reproducible y auditable.

---

## Reglas específicas

- Calcular margin desde componentes estructurados.
- No inferir costes ausentes.
- Permitir gross_margin y contribution_margin separados.
- Guardar margin_definition_version.

---

## Contrato conceptual del cálculo

Todo resultado debería conservar:

```text
metric_name
metric_value
numerator
denominator
time_window
population
source
definition_version
calculated_at
```

Cuando la métrica no use numerador/denominador, esos campos pueden no aplicar.

---

## Invariantes

- misma definición + mismos datos = mismo resultado;
- no dividir entre cero silenciosamente;
- diferenciar datos observados de estimaciones;
- no mezclar ventanas o poblaciones;
- no sobrescribir historia al cambiar una definición;
- conservar source of truth;
- el LLM no calcula ni corrige silenciosamente métricas oficiales.

---

## Data quality

El runtime debe poder señalar:

```text
COMPLETE
PARTIAL
STALE
UNKNOWN
```

y no ofrecer falsa precisión cuando faltan datos.

---

## Principio maestro

El runtime calcula.

La IA interpreta.
