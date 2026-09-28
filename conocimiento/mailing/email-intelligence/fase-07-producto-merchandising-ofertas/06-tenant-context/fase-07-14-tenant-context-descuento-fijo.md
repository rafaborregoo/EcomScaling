# Fase 7.14 — Descuento fijo — Tenant Context

## Tipo de artefacto
`06-tenant-context`

## Objetivo

Definir los datos comerciales específicos de la tienda necesarios para `Descuento fijo`.

## Configuración del tenant

- `fixed_discount_policy`
- `minimum_order_value`
- `currency_rules`
- `stacking_policy`

---

## Source of Truth

Precio, stock, catálogo, margen, promociones y relaciones de producto deben proceder de fuentes operativas aprobadas.

---

## Principio maestro

La tienda define su economía y catálogo.

El sistema no debe convertir valores particulares en reglas universales.
