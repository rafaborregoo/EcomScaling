# Fase 17.7 — Límites económicos — Policies / Guardrails

## Tipo de artefacto
`04-policies-guardrails`

## Objetivo

Definir las restricciones duras que gobiernan `Límites económicos`.

## Reglas

- No superar hard budget o margin limits.
- No ocultar coste mediante stacking.
- No asumir costes faltantes como cero.
- Cuando falte un coste crítico, escalar o bloquear.

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
