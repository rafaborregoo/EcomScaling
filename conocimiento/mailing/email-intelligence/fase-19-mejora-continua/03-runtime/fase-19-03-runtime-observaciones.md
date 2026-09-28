# Fase 19.3 — Observaciones — Runtime

## Tipo de artefacto
`03-runtime`

## Objetivo

Automatizar de forma reproducible `Observaciones`.

## Reglas específicas

- Detectar cambios contra baseline.
- Crear observation candidates.
- Evitar duplicados equivalentes.
- Relacionar observación con evidence refs.

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
