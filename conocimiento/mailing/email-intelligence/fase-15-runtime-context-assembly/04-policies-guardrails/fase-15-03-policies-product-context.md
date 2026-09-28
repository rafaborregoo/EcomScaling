# Fase 15.3 — Product Context — Policies / Guardrails

## Tipo de artefacto
`04-policies-guardrails`

## Objetivo

Definir restricciones duras aplicables a `Product Context`.

## Reglas

- No generar claims no aprobados.
- No utilizar precio o stock stale para decisiones sensibles.
- UNKNOWN prevalece sobre datos contradictorios no resueltos.

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
