# Fase 19.1 — Captura de resultados — Runtime

## Tipo de artefacto
`03-runtime`

## Objetivo

Automatizar de forma reproducible `Captura de resultados`.

## Reglas específicas

- Ingerir resultados desde fuentes autoritativas.
- Relacionar ejecución con request/action/version IDs.
- Capturar métricas primarias y guardrails.
- Registrar data quality y source timestamps.

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
