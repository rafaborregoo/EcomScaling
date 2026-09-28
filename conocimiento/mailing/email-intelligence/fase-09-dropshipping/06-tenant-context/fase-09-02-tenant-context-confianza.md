# Fase 9.2 — Confianza — Tenant Context

## Tipo de artefacto
`06-tenant-context`

## Objetivo

Definir la información específica de esta tienda necesaria para `Confianza`.

## Datos del tenant

- `trust_assets`
- `return_policy`
- `shipping_policy`
- `support_channels`
- `approved_social_proof`

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
