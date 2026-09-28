# Fase 9.1 — Particularidades del dropshipping — Tenant Context

## Tipo de artefacto
`06-tenant-context`

## Objetivo

Definir la información específica de esta tienda necesaria para `Particularidades del dropshipping`.

## Datos del tenant

- `supplier_model`
- `fulfillment_model`
- `shipping_regions`
- `tracking_capabilities`
- `inventory_sync_quality`

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
