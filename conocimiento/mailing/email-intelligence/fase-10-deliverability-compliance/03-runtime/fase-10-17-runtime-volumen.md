# Fase 10.17 — Volumen — Runtime

## Tipo de artefacto
`03-runtime`

## Objetivo

Definir la lógica determinista de `Volumen`.

---

## Reglas específicas

- Medir daily volume por destination/provider.
- Detectar threshold crossing.
- Aplicar requisitos bulk cuando corresponda.
- Alertar anomalías de crecimiento.

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
