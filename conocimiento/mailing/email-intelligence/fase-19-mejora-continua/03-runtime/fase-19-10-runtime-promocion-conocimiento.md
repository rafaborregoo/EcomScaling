# Fase 19.10 — Promoción de conocimiento — Runtime

## Tipo de artefacto
`03-runtime`

## Objetivo

Automatizar de forma reproducible `Promoción de conocimiento`.

## Reglas específicas

- Evaluar promotion criteria.
- Crear nueva versión en el scope destino.
- Mantener lineage hacia evidencia origen.
- No borrar el learning de origen.

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
