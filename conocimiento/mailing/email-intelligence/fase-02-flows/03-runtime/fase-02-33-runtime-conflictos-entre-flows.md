# Fase 2.33 — Conflictos entre flows — Runtime

## Tipo de artefacto
`03-runtime`

## Objetivo

Ejecutar `Conflictos entre flows` de forma determinista, idempotente, cancelable y auditable.

---

## Eventos y estados relacionados

- `MULTIPLE_FLOW_ELIGIBILITY`
- `FLOW_PRIORITY_CHANGED`
- `HIGHER_PRIORITY_FLOW_ENTERED`
- `CONFLICT_RESOLVED`

---

## Reglas específicas

- Mantener prioridad global.
- Usar mutex groups cuando flows sean incompatibles.
- Cancelar/suspender flows subordinados.
- Resolver conflicto antes de programar la siguiente acción.
- Registrar ganador y motivo.

---

## Evaluación estándar

```text
normalize event/state
→ resolve identity
→ resolve opportunity
→ evaluate entry
→ evaluate eligibility
→ exclusions
→ conflicts
→ pressure
→ schedule
→ revalidate
→ execute / branch / exit
```

---

## Invariantes

- un evento duplicado no crea una nueva instancia equivalente;
- una conversión o salida cancela acciones pendientes;
- los datos actuales prevalecen sobre snapshots cuando se decide disponibilidad;
- cada decisión importante tiene `reason_code`;
- cada instancia conserva `flow_version`;
- el runtime no inventa copy, descuentos, beneficios ni claims.

---

## Auditoría

```text
flow_instance_id
flow_version
customer_id
opportunity_key
event_id
step_id
decision
reason_code
previous_state
new_state
created_at
```

---

## Principio maestro

El flow consume estados y fuentes de verdad; no los inventa.
