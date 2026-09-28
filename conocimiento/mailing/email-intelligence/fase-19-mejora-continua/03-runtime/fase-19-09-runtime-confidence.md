# Fase 19.9 — Confidence — Runtime

## Tipo de artefacto
`03-runtime`

## Objetivo

Automatizar de forma reproducible `Confidence`.

## Reglas específicas

- Calcular confidence desde factores estructurados.
- Aplicar decay cuando la evidencia envejece.
- Reducir confidence ante contradicciones.
- Separar evidence confidence de model confidence.

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
