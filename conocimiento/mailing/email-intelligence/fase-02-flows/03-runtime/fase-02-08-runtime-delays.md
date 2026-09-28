# Fase 2.8 — Delays — Runtime

## Tipo de artefacto
`03-runtime`

## Objetivo

Definir la responsabilidad determinista del software para `Delays`.

---

## Estados y eventos relevantes

- `DELAY_STARTED`
- `DELAY_COMPLETED`
- `DELAY_CANCELLED`

---

## Requisitos de ejecución

- Delays cancelables.
- Persistir wake_at.
- Revalidar al despertar.
- No depender de procesos en memoria para esperas largas.

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
