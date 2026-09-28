# Fase 15.13 — Source of Truth — Tenant Context

## Tipo de artefacto
`06-tenant-context`

## Objetivo

Definir la configuración específica del ecommerce utilizada por `Source of Truth`.

## Configuración

- `source_registry`
- `source_precedence`
- `fallback_policy`

---

## Reglas

- toda configuración debe pertenecer a un tenant explícito;
- cambios materiales deben versionarse;
- no convertir defaults de una tienda en defaults globales;
- la configuración debe identificar su source of truth cuando corresponda.

---

## Principio maestro

La infraestructura es compartida.

La realidad operativa sigue siendo específica de cada tenant.
