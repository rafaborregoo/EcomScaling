# Fase 12.3 — Experimento — Policies / Guardrails

## Tipo de artefacto
`04-policies-guardrails`

## Objetivo

Definir restricciones duras para preservar integridad experimental y de aprendizaje.

## Reglas

- No alterar tratamiento, métrica primaria o población silenciosamente durante ejecución.
- Toda modificación material requiere nueva versión o experimento.
- La asignación no debe depender del resultado futuro.

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
