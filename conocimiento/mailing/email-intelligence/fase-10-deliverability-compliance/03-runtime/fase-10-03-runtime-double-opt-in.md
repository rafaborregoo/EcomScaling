# Fase 10.3 — Double Opt-in — Runtime

## Tipo de artefacto
`03-runtime`

## Objetivo

Definir la lógica determinista de `Double Opt-in`.

---

## Reglas específicas

- Mantener PENDING_CONFIRMATION y CONFIRMED.
- Token de confirmación único/expirable.
- No activar marketing antes de confirmación cuando aplique.
- Registrar confirmed_at.

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
