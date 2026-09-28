# Fase 17.11 — Acciones prohibidas — Policies / Guardrails

## Tipo de artefacto
`04-policies-guardrails`

## Objetivo

Definir las restricciones duras que gobiernan `Acciones prohibidas`.

## Reglas

- Una prohibited_action nunca puede ejecutarse.
- No existe override generativo.
- Cualquier intento debe quedar auditado.
- Las prohibiciones específicas del tenant se suman a las globales salvo policy explícita superior.

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
