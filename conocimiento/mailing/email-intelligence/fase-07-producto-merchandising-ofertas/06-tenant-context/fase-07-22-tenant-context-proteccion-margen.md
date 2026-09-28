# Fase 7.22 — Protección de margen — Tenant Context

## Tipo de artefacto
`06-tenant-context`

## Objetivo

Definir los datos comerciales específicos de la tienda necesarios para `Protección de margen`.

## Configuración del tenant

- `margin_definition`
- `hard_margin_floor`
- `soft_margin_target`
- `promotion_cost_rules`
- `stacking_policy`

---

## Source of Truth

Precio, stock, catálogo, margen, promociones y relaciones de producto deben proceder de fuentes operativas aprobadas.

---

## Principio maestro

La tienda define su economía y catálogo.

El sistema no debe convertir valores particulares en reglas universales.
