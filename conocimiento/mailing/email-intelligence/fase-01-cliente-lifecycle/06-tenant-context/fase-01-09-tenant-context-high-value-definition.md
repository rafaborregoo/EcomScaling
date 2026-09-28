# Fase 1.9 — High-Value Customer — Tenant Context

## Tipo de artefacto
`06-tenant-context`

## Objetivo

Definir qué información específica de cada ecommerce debe existir para interpretar `HIGH_VALUE_CUSTOMER`.

---

# Configuración recomendada

La tienda debe poder definir:

```text
value_metric
high_value_method
high_value_threshold_or_percentile
include_refunds
include_returns
include_margin
evaluation_window
```

---

# Preguntas de configuración

- ¿Qué significa valor para este negocio?
- ¿Revenue o margen?
- ¿Lifetime o periodo reciente?
- ¿Qué percentil se considera alto?
- ¿Cómo afectan devoluciones?
- ¿Existe estacionalidad?

---

# Regla

Estos parámetros pertenecen al tenant.

No deben estar embebidos como conocimiento universal en el RAG.
