# Fase 7.16 — BOGO — Tenant Context

## Tipo de artefacto
`06-tenant-context`

## Objetivo

Definir los datos comerciales específicos de la tienda necesarios para `BOGO`.

## Configuración del tenant

- `bogo_rules`
- `eligible_products`
- `reward_products`
- `margin_floor`

---

## Source of Truth

Precio, stock, catálogo, margen, promociones y relaciones de producto deben proceder de fuentes operativas aprobadas.

---

## Principio maestro

La tienda define su economía y catálogo.

El sistema no debe convertir valores particulares en reglas universales.
