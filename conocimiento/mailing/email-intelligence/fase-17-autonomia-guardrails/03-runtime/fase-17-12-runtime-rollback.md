# Fase 17.12 — Rollback — Runtime

## Tipo de artefacto
`03-runtime`

## Objetivo

Rollback define cómo revertir o contener una acción automática. Debe distinguir acciones reversibles, compensables e irreversibles. El plan de rollback o compensación debe conocerse antes de ejecutar acciones de riesgo.

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
