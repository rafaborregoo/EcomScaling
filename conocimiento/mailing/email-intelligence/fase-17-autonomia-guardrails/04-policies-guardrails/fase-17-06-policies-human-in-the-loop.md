# Fase 17.6 — Human-in-the-loop — Policies / Guardrails

## Tipo de artefacto
`04-policies-guardrails`

## Objetivo

Definir las restricciones duras que gobiernan `Human-in-the-loop`.

## Reglas

- No escalar con contexto incompleto evitable.
- La decisión humana debe registrarse.
- No reinterpretar una decisión humana más allá de su scope.
- Las excepciones humanas deben ser explícitas y trazables.

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
