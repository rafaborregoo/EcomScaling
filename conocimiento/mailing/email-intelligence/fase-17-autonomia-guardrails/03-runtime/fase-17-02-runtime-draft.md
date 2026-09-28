# Fase 17.2 — Draft — Runtime

## Tipo de artefacto
`03-runtime`

## Objetivo

El nivel `DRAFT` permite generar artefactos editables —copy, estrategia, brief, campaña o flow— sin publicarlos ni activarlos. Debe distinguir `DRAFT`, `APPROVED`, `PUBLISHED` y `ACTIVE`.

---

## Máquina de decisión

```text
REQUEST
→ RESOLVE AUTONOMY LEVEL
→ CHECK POLICIES
→ CHECK LIMITS
→ CHECK CONFIDENCE / MISSING INFO
→ REQUIRE APPROVAL OR EXECUTE
→ VERIFY RESULT
→ AUDIT
```

## Estados comunes

```text
PROPOSED
DRAFT
PENDING_APPROVAL
APPROVED
EXECUTABLE
EXECUTED
BLOCKED
FAILED
ROLLED_BACK
COMPENSATED
```

## Invariantes

- tenant isolation;
- action scope explícito;
- policy evaluation previa;
- límites evaluados con datos actuales;
- no escalado silencioso de autonomía;
- idempotencia cuando aplique;
- approval/version binding;
- audit trail obligatorio.

## Principio maestro

La autonomía es una propiedad del workflow y del riesgo, no una capacidad libre del modelo.
