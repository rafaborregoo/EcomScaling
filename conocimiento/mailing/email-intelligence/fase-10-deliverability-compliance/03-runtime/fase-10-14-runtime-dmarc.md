# Fase 10.14 — DMARC — Runtime

## Tipo de artefacto
`03-runtime`

## Objetivo

Definir la lógica determinista de `DMARC`.

---

## Reglas específicas

- Verificar record DMARC.
- Evaluar alignment SPF/DKIM.
- Ingerir aggregate reports si están disponibles.
- Versionar cambios de policy.

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
