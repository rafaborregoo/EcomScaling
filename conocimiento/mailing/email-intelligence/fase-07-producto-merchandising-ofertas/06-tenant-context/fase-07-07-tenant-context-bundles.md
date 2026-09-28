# Fase 7.7 — Bundles — Tenant Context

## Tipo de artefacto
`06-tenant-context`

## Objetivo

Definir los datos comerciales específicos de la tienda necesarios para `Bundles`.

## Configuración del tenant

- `bundle_definitions`
- `bundle_discount_policy`
- `bundle_margin_floor`
- `bundle_inventory_rules`

---

## Source of Truth

Precio, stock, catálogo, margen, promociones y relaciones de producto deben proceder de fuentes operativas aprobadas.

---

## Principio maestro

La tienda define su economía y catálogo.

El sistema no debe convertir valores particulares en reglas universales.
