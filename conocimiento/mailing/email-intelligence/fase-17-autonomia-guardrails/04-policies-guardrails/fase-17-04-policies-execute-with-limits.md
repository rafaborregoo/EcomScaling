# Fase 17.4 — Execute with Limits — Policies / Guardrails

## Tipo de artefacto
`04-policies-guardrails`

## Objetivo

Definir las restricciones duras que gobiernan `Execute with Limits`.

## Reglas

- Solo ejecutar dentro de límites vigentes.
- Nunca fraccionar una acción para eludir un límite.
- Si un límite crítico es UNKNOWN, no ejecutar.
- Toda ejecución debe quedar auditada.

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
