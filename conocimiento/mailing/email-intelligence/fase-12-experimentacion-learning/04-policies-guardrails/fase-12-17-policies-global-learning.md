# Fase 12.17 — Global Learning — Policies / Guardrails

## Tipo de artefacto
`04-policies-guardrails`

## Objetivo

Definir restricciones duras para preservar integridad experimental y de aprendizaje.

## Reglas

- Ningún aprendizaje debe promocionarse a global únicamente por decisión generativa del modelo.
- La promoción requiere criterios y trazabilidad definidos.
- No incluir información específica de un tenant en conocimiento global.

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
