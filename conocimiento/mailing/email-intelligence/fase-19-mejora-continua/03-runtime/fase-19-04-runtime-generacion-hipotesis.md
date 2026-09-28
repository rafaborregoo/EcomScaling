# Fase 19.4 — Generación de hipótesis — Runtime

## Tipo de artefacto
`03-runtime`

## Objetivo

Automatizar de forma reproducible `Generación de hipótesis`.

## Reglas específicas

- Registrar hypothesis candidate.
- Relacionarla con observations.
- Evitar duplicar hipótesis activas equivalentes.
- Mantener estado PROPOSED hasta revisión o experimento.

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
