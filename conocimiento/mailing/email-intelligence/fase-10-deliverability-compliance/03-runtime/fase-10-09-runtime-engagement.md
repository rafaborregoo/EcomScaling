# Fase 10.9 — Engagement y deliverability — Runtime

## Tipo de artefacto
`03-runtime`

## Objetivo

Definir la lógica determinista de `Engagement y deliverability`.

---

## Reglas específicas

- Consumir engagement engine.
- Separar email engagement de commercial engagement.
- Aplicar ventanas/decay.
- Usar estado como input de frequency/sunset, no como permiso legal.

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
