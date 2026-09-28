# Fase 10.20 — Versionado de políticas — Runtime

## Tipo de artefacto
`03-runtime`

## Objetivo

Definir la lógica determinista de `Versionado de políticas`.

---

## Reglas específicas

- Policy registry con versiones inmutables.
- Resolver policy por provider/jurisdiction/effective_at.
- Mantener supersedes/superseded_by.
- No alterar decisiones históricas al actualizar política.

---

## Invariantes

- conservar source of truth;
- mantener `UNKNOWN` si falta evidencia;
- las evaluaciones deben ser reproducibles;
- toda supresión o fallo debe tener reason code;
- los cambios externos deben versionarse;
- el LLM no puede modificar estados técnicos o legales.

---

## Auditoría mínima

```text
entity_id
domain
provider
channel
state
source
policy_version
decision
reason_code
evaluated_at
```

---

## Principio maestro

El runtime determina estados verificables; la IA los interpreta.
