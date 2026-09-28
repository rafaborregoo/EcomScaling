# Fase 19.7 — Category Learning — Runtime

## Tipo de artefacto
`03-runtime`

## Objetivo

Automatizar de forma reproducible `Category Learning`.

## Reglas específicas

- Agrupar evidencia por category_scope.
- Exigir diversidad mínima de fuentes.
- Detectar contradicciones por subcategoría.
- Versionar category learnings.

---

## Invariantes

- stable IDs;
- versionado;
- tenant isolation;
- evidence lineage;
- data quality explícita;
- `UNKNOWN` permitido;
- no causalidad inventada;
- no overwrites destructivos.

---

## Salida conceptual

```text
entity_id
scope
status
evidence_refs
confidence
version
source_refs
created_at
updated_at
```

---

## Principio maestro

El runtime conserva la historia del aprendizaje y evita que el modelo reescriba el pasado.
