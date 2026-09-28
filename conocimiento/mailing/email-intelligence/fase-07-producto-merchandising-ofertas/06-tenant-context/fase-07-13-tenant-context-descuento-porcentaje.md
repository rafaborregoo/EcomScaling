# Fase 7.13 — Descuento porcentual — Tenant Context

## Tipo de artefacto
`06-tenant-context`

## Objetivo

Definir los datos comerciales específicos de la tienda necesarios para `Descuento porcentual`.

## Configuración del tenant

- `percentage_discount_policy`
- `maximum_discount`
- `stacking_policy`
- `eligible_products`

---

## Source of Truth

Precio, stock, catálogo, margen, promociones y relaciones de producto deben proceder de fuentes operativas aprobadas.

---

## Principio maestro

La tienda define su economía y catálogo.

El sistema no debe convertir valores particulares en reglas universales.
