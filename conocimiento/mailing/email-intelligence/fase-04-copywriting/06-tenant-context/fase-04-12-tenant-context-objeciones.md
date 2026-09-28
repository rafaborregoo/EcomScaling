# Fase 4.12 — Objeciones — Tenant Context

## Tipo de artefacto
`06-tenant-context`

## Objetivo

Definir la información específica de la tienda necesaria para aplicar correctamente `Objeciones`.

## Información del tenant

- `validated_objections`
- `faq_sources`
- `support_objections`
- `return_policy`
- `shipping_facts`

## Regla

Estos datos deben proceder de fuentes reales de la marca.

Si faltan, la IA debe reconocer la ausencia y evitar inventarlos.
