# Fase 17.8 — Límites de audiencia — Policies / Guardrails

## Tipo de artefacto
`04-policies-guardrails`

## Objetivo

Definir las restricciones duras que gobiernan `Límites de audiencia`.

## Reglas

- No exceder audience cap autorizado.
- No incluir suppressions para aumentar volumen.
- No ampliar audiencia automáticamente fuera del segmento aprobado.
- Los límites deben evaluarse sobre audiencia final, no estimada inicial.

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
