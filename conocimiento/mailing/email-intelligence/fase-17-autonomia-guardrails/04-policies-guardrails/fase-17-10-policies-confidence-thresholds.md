# Fase 17.10 — Confidence Thresholds — Policies / Guardrails

## Tipo de artefacto
`04-policies-guardrails`

## Objetivo

Definir las restricciones duras que gobiernan `Confidence Thresholds`.

## Reglas

- Confidence alta no permite violar policies.
- Confidence sin calibración suficiente no habilita autonomía elevada.
- Información crítica faltante puede forzar downgrade de autonomía.

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
