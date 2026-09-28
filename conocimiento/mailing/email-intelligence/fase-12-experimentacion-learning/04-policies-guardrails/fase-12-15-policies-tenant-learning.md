# Fase 12.15 — Tenant Learning — Policies / Guardrails

## Tipo de artefacto
`04-policies-guardrails`

## Objetivo

Definir restricciones duras para preservar integridad experimental y de aprendizaje.

## Reglas

- Los aprendizajes tenant no deben cruzar a otro tenant como hechos específicos.
- La información identificable o confidencial debe permanecer aislada.

---

## Precedencia

```text
EXPERIMENT_INTEGRITY_POLICY
>
MODEL_RECOMMENDATION
```

---

## Principio maestro

El modelo puede proponer hipótesis y explicar resultados, pero no alterar silenciosamente el diseño, la evidencia o la historia del experimento.
