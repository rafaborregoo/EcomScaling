# Fase 11.4 — CTR — Runtime

## Tipo de artefacto
`03-runtime`

## Objetivo

Calcular `CTR` de forma determinista, reproducible y auditable.

---

## Reglas específicas

- Definir fórmula de CTR de forma única.
- Usar unique_clickers como numerador cuando corresponda.
- Usar delivered como denominador salvo configuración documentada.
- Tratar denominador cero de forma explícita.

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
