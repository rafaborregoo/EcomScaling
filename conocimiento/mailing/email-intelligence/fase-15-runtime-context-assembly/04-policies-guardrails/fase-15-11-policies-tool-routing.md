# Fase 15.11 — Tool Routing — Policies / Guardrails

## Tipo de artefacto
`04-policies-guardrails`

## Objetivo

Definir restricciones duras aplicables a `Tool Routing`.

## Reglas

- No utilizar una herramienta fuera de sus permisos.
- No ejecutar acciones que requieran aprobación humana sin aprobación.
- Cuando una fuente autoritativa es obligatoria, no sustituirla por inferencia.

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
