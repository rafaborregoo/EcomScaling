# Fase 12.4 — A/B Test — Experience Learning

## Tipo de artefacto
`05-experience-learning`

## Objetivo

Definir cómo debe almacenarse y reutilizarse la experiencia generada por `A/B Test`.

---

## Reglas de aprendizaje

- Conservar resultados por variante.
- Registrar efecto observado y decisión final.
- Permitir reutilizar evidencia en aprendizajes posteriores.

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
