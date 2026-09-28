# Fase 7.15 — Free Shipping — Tenant Context

## Tipo de artefacto
`06-tenant-context`

## Objetivo

Definir los datos comerciales específicos de la tienda necesarios para `Free Shipping`.

## Configuración del tenant

- `free_shipping_policy`
- `shipping_regions`
- `minimum_order_threshold`
- `excluded_methods`

---

## Source of Truth

Precio, stock, catálogo, margen, promociones y relaciones de producto deben proceder de fuentes operativas aprobadas.

---

## Principio maestro

La tienda define su economía y catálogo.

El sistema no debe convertir valores particulares en reglas universales.
