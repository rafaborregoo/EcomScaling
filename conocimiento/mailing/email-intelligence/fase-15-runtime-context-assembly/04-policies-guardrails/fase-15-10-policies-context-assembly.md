# Fase 15.10 — Context Assembly — Policies / Guardrails

## Tipo de artefacto
`04-policies-guardrails`

## Objetivo

Definir restricciones duras aplicables a `Context Assembly`.

## Reglas

- Las policies hard deben preservarse aunque exista presión de token budget.
- El source of truth operativo debe prevalecer sobre RAG contradictorio.
- Los conflictos críticos no resueltos deben marcarse, no ocultarse.

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
