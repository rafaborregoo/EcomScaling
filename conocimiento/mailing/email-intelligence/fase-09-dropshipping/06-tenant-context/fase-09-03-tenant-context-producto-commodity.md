# Fase 9.3 — Producto commodity — Tenant Context

## Tipo de artefacto
`06-tenant-context`

## Objetivo

Definir la información específica de esta tienda necesaria para `Producto commodity`.

## Datos del tenant

- `product_differentiators`
- `service_differentiators`
- `bundle_strategy`
- `brand_positioning`

---

## Source of Truth

La información debe proceder de:
- ecommerce;
- proveedor;
- carrier;
- soporte;
- catálogo;
- políticas aprobadas;
según corresponda.

No debe reconstruirse mediante inferencia del LLM cuando exista una fuente operativa.

---

## Principio maestro

El tenant context describe la realidad concreta de la operación.
