# Fase 9.17 — Product Education — Tenant Context

## Tipo de artefacto
`06-tenant-context`

## Objetivo

Definir la información específica de esta tienda necesaria para `Product Education`.

## Datos del tenant

- `product_guides`
- `setup_instructions`
- `usage_warnings`
- `approved_tutorials`

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
