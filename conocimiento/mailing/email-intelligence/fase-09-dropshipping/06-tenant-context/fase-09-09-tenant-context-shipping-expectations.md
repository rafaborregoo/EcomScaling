# Fase 9.9 — Shipping Expectations — Tenant Context

## Tipo de artefacto
`06-tenant-context`

## Objetivo

Definir la información específica de esta tienda necesaria para `Shipping Expectations`.

## Datos del tenant

- `shipping_estimates`
- `processing_times`
- `carrier_rules`
- `shipping_regions`
- `guaranteed_delivery_policy`

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
