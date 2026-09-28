# Fase 15.9 — RAG Retrieval — Policies / Guardrails

## Tipo de artefacto
`04-policies-guardrails`

## Objetivo

Definir restricciones duras aplicables a `RAG Retrieval`.

## Reglas

- RAG no puede sustituir datos operativos actuales.
- El retrieval debe preservar source IDs.
- Contenido marcado deprecated no debe formar parte del contexto vigente.

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
