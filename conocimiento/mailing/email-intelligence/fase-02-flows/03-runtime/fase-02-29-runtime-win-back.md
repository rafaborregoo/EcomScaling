# Fase 2.29 — Win-Back — Runtime

## Tipo de artefacto
`03-runtime`

## Objetivo

Ejecutar `Win-Back` de forma determinista, idempotente, cancelable y auditable.

---

## Eventos y estados relacionados

- `CUSTOMER_BECAME_LAPSED`
- `WINBACK_WINDOW_OPENED`
- `CUSTOMER_REACTIVATED`
- `ORDER_PLACED`
- `WINBACK_EXPIRED`

---

## Reglas específicas

- Consumir lapsed_state.
- Limitar intentos.
- Cerrar con reactivación/compra.
- Pasar a estrategia de menor presión si expira.

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
