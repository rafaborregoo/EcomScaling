# Fase 19.5 — Aprendizaje local — Runtime

## Tipo de artefacto
`03-runtime`

## Objetivo

Automatizar de forma reproducible `Aprendizaje local`.

## Reglas específicas

- Mantener tenant_scope obligatorio.
- Actualizar confidence con nueva evidencia.
- Detectar contradicciones.
- No exponer aprendizaje local fuera del tenant.

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
