# Fase 15.8 — Experience Context — Policies / Guardrails

## Tipo de artefacto
`04-policies-guardrails`

## Objetivo

Definir restricciones duras aplicables a `Experience Context`.

## Reglas

- No recuperar aprendizajes de otro tenant como hechos específicos.
- Excluir aprendizajes deprecated del contexto vigente.
- Preservar scope y confidence originales.

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
