# Fase 9.7 — UGC — Tenant Context

## Tipo de artefacto
`06-tenant-context`

## Objetivo

Definir la información específica de esta tienda necesaria para `UGC`.

## Datos del tenant

- `approved_ugc_assets`
- `ugc_rights`
- `creator_disclosure_rules`
- `brand_safety_rules`

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
