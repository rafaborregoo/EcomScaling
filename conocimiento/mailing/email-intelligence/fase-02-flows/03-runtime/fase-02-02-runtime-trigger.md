# Fase 2.2 — Trigger — Runtime

## Tipo de artefacto
`03-runtime`

## Objetivo

Definir la responsabilidad determinista del software para `Trigger`.

---

## Estados y eventos relevantes

- `NORMALIZED_EVENT`
- `TRIGGER_MATCHED`
- `TRIGGER_REJECTED`

---

## Requisitos de ejecución

- Normalizar eventos.
- Deduplicar por event_id o clave equivalente.
- Guardar timestamp y entidad asociada.
- No ejecutar acciones directamente desde el trigger.

Además:

- toda evaluación debe ser idempotente;
- los cambios importantes deben generar `reason_code`;
- los delays deben poder cancelarse;
- las reglas deben estar versionadas;
- las transiciones deben quedar auditadas;
- los datos operativos deben proceder de su source of truth.

---

## Auditoría mínima

```text
flow_definition_id
flow_version
flow_instance_id
customer_id
opportunity_key
event_id
previous_state
decision
reason_code
new_state
timestamp
```

---

## Límite de responsabilidad

Este runtime no inventa copy, descuentos, claims, consentimiento, catálogo ni datos del cliente.

---

## Principio maestro

```text
EVENT + STATE + RULES
→ DETERMINISTIC_TRANSITION
```

Nunca:

```text
EVENT
→ SEND
```
