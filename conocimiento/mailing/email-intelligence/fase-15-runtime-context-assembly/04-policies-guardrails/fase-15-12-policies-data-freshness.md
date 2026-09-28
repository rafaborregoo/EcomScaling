# Fase 15.12 — Data Freshness — Policies / Guardrails

## Tipo de artefacto
`04-policies-guardrails`

## Objetivo

Definir restricciones duras aplicables a `Data Freshness`.

## Reglas

- Datos críticos EXPIRED deben refrescarse antes de ejecución.
- No convertir UNKNOWN en FRESH.
- Los thresholds deben ser específicos por tipo de dato o fuente.

---

## Jerarquía

```text
HARD POLICY
>
AUTHORITATIVE RUNTIME DATA
>
TENANT CONFIG
>
EXPERIENCE
>
RAG
>
MODEL INFERENCE
```

---

## Principio maestro

El context assembly no puede degradar una restricción dura ni sustituir una fuente autoritativa por conveniencia.
