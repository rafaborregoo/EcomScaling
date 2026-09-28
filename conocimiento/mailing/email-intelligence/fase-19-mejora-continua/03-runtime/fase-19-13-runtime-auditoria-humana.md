# Fase 19.13 — Auditoría humana — Runtime

## Tipo de artefacto
`03-runtime`

## Objetivo

Automatizar de forma reproducible `Auditoría humana`.

## Reglas específicas

- Generar review queue.
- Priorizar learnings de alto impacto/riesgo.
- Registrar reviewer decision.
- Aplicar cambios mediante versiones, nunca edición silenciosa.

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
