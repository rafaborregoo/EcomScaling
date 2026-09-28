# Fase 12.20 — Deprecación de aprendizajes — Policies / Guardrails

## Tipo de artefacto
`04-policies-guardrails`

## Objetivo

Definir restricciones duras para preservar integridad experimental y de aprendizaje.

## Reglas

- Un aprendizaje deprecado no debe utilizarse como recomendación vigente.
- La deprecación no debe borrar evidencia ni decisiones históricas.

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
