# Fase 15.13 — Source of Truth — Policies / Guardrails

## Tipo de artefacto
`04-policies-guardrails`

## Objetivo

Definir restricciones duras aplicables a `Source of Truth`.

## Reglas

- No utilizar una fuente secundaria como primaria si la autoritativa está disponible.
- Conflictos entre fuentes críticas deben bloquear decisiones sensibles.
- La autoridad de fuente debe estar versionada.

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
