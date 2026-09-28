# Fase 17.4 — Execute with Limits — Runtime

## Tipo de artefacto
`03-runtime`

## Objetivo

`EXECUTE_WITH_LIMITS` permite ejecutar automáticamente acciones dentro de un perímetro previamente autorizado. Los límites pueden afectar gasto, descuento, audiencia, volumen, frecuencia, horario, producto, campaña o canal. Si una acción supera un límite, debe escalar o bloquearse.

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
