# Fase 17.12 — Rollback — Policies / Guardrails

## Tipo de artefacto
`04-policies-guardrails`

## Objetivo

Definir las restricciones duras que gobiernan `Rollback`.

## Reglas

- Una acción autónoma de riesgo medio/alto debe declarar estrategia de rollback o compensación.
- No afirmar que una acción irreversible fue revertida.
- Rollback no puede destruir audit trail.

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
