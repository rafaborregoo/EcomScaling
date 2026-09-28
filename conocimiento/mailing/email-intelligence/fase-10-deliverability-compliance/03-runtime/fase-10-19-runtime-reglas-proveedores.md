# Fase 10.19 — Reglas Gmail / Yahoo / Proveedores — Runtime

## Tipo de artefacto
`03-runtime`

## Objetivo

Definir la lógica determinista de `Reglas Gmail / Yahoo / Proveedores`.

---

## Reglas específicas

- Mantener provider_policy registry versionado.
- Evaluar cumplimiento por destination provider.
- Separar REQUIRED, RECOMMENDED y OBSERVED.
- Alertar cambios de versión/requisito.

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
