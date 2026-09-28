# Fase 19.11 — Deprecación — Runtime

## Tipo de artefacto
`03-runtime`

## Objetivo

Automatizar de forma reproducible `Deprecación`.

## Reglas específicas

- Cambiar learning_status a DEPRECATED.
- Excluirlo del retrieval vigente.
- Relacionar replacement cuando exista.
- Conservar evidencia e historial.

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
