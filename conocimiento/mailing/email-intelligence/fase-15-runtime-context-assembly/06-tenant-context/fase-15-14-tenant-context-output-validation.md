# Fase 15.14 — Output Validation — Tenant Context

## Tipo de artefacto
`06-tenant-context`

## Objetivo

Definir la configuración específica del ecommerce utilizada por `Output Validation`.

## Configuración

- `output_validation_rules`
- `approval_requirements`
- `allowed_claim_patterns`

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
