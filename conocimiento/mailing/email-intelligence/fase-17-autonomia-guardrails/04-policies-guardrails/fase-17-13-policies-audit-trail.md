# Fase 17.13 — Audit Trail — Policies / Guardrails

## Tipo de artefacto
`04-policies-guardrails`

## Objetivo

Definir las restricciones duras que gobiernan `Audit Trail`.

## Reglas

- No permitir borrado silencioso de eventos de auditoría.
- No modificar retrospectivamente decisiones registradas.
- Registrar overrides, approvals y failures.
- Datos sensibles deben minimizarse o referenciarse cuando sea posible.

## Precedencia

```text
PROHIBITED ACTION
>
LEGAL / COMPLIANCE POLICY
>
HARD TENANT LIMIT
>
AUTONOMY LEVEL
>
CONFIDENCE
>
MODEL RECOMMENDATION
```

## Regla de fallo seguro

Ante conflicto crítico o ausencia de información necesaria:

```text
EXECUTE → NO
ESCALATE / BLOCK → YES
```

## Principio maestro

Un guardrail debe impedir ejecución, no limitarse a advertir al agente.
