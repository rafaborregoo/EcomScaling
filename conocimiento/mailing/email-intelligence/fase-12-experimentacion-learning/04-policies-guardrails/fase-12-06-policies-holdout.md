# Fase 12.6 — Holdout — Policies / Guardrails

## Tipo de artefacto
`04-policies-guardrails`

## Objetivo

Definir restricciones duras para preservar integridad experimental y de aprendizaje.

## Reglas

- Un sujeto asignado a holdout no debe recibir la intervención experimental por otra ruta equivalente.
- La contaminación debe registrarse y considerarse en el análisis.

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
