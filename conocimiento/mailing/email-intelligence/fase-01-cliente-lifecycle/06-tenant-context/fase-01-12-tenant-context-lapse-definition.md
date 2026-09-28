# Fase 1.12 — Lapsed Customer — Tenant Context

## Tipo de artefacto
`06-tenant-context`

## Objetivo

Definir las ventanas y criterios específicos de inactividad de cada ecommerce.

---

# Datos recomendados

```text
default_repurchase_cycle
lapse_factor
category_cycles
product_cycles
minimum_history_required
fallback_window
```

---

# Regla

Las ventanas de lapse pertenecen al negocio.

No deben almacenarse como conocimiento universal en el RAG.
