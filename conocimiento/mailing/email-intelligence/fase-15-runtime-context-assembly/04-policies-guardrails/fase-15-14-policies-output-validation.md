# Fase 15.14 — Output Validation — Policies / Guardrails

## Tipo de artefacto
`04-policies-guardrails`

## Objetivo

Definir restricciones duras aplicables a `Output Validation`.

## Reglas

- Una salida con violación hard debe quedar BLOCKED.
- No ejecutar una salida `REPAIR_REQUIRED`.
- La reparación no puede eliminar evidencia de un bloqueo.
- La validación debe ejecutarse sobre la versión exacta del output que vaya a utilizarse.

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
