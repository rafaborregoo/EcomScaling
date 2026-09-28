# Fase 10.11 — IP Reputation — Runtime

## Tipo de artefacto
`03-runtime`

## Objetivo

Definir la lógica determinista de `IP Reputation`.

---

## Reglas específicas

- Mantener sending_ip/pool cuando esté disponible.
- Separar shared/dedicated.
- Monitorizar bounce/complaint/volume por IP.
- No inferir reputación si proveedor no expone datos.

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
