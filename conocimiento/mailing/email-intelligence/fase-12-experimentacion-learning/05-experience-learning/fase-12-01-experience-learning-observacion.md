# Fase 12.1 — Observación — Experience Learning

## Tipo de artefacto
`05-experience-learning`

## Objetivo

Definir cómo debe almacenarse y reutilizarse la experiencia generada por `Observación`.

---

## Reglas de aprendizaje

- Conservar observaciones con contexto y fecha.
- Vincularlas a hipótesis posteriores.
- Permitir marcar observaciones como confirmadas, descartadas o insuficientes.

---

## Estructura conceptual

El artefacto debe poder conservar:

```text
source
scope
context
evidence
result_or_learning
confidence
status
version
valid_from
last_reviewed_at
```

---

## Regla de promoción

Un dato experimental no debe convertirse directamente en RAG universal.

Debe pasar por evaluación de:
- calidad;
- repetición;
- alcance;
- contradicciones;
- actualidad.

---

## Principio maestro

La experiencia es memoria de resultados, no una colección de conclusiones sin contexto.
