# Fase 15.7 — Policy Context — Policies / Guardrails

## Tipo de artefacto
`04-policies-guardrails`

## Objetivo

Definir restricciones duras aplicables a `Policy Context`.

## Reglas

- Las políticas aplicables deben resolverse antes de generación cuando puedan bloquear la acción.
- Una policy hard no puede quedar degradada a contexto opcional.
- No utilizar una versión fuera de vigencia salvo fallback explícito.

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
