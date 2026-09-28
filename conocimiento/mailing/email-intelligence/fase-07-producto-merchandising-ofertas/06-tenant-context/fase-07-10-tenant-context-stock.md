# Fase 7.10 — Stock — Tenant Context

## Tipo de artefacto
`06-tenant-context`

## Objetivo

Definir los datos comerciales específicos de la tienda necesarios para `Stock`.

## Configuración del tenant

- `inventory_source`
- `low_stock_thresholds`
- `preorder_policy`
- `backorder_policy`

---

## Source of Truth

Precio, stock, catálogo, margen, promociones y relaciones de producto deben proceder de fuentes operativas aprobadas.

---

## Principio maestro

La tienda define su economía y catálogo.

El sistema no debe convertir valores particulares en reglas universales.
