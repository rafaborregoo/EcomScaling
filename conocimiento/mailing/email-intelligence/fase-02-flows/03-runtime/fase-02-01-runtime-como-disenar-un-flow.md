# Fase 2.1 — Cómo diseñar un flow — Runtime

## Tipo de artefacto
`03-runtime`

## Objetivo

Definir la responsabilidad determinista del software para `Cómo diseñar un flow`.

---

## Estados y eventos relevantes

- `FLOW_DEFINITION`
- `FLOW_VERSION`
- `FLOW_INSTANCE`
- `FLOW_STEP`
- `FLOW_EXIT`

---

## Requisitos de ejecución

- Separar definición e instancia.
- Versionar flows.
- Cada instancia debe conocer oportunidad, paso y estado.
- Todo delay debe ser cancelable.
- Revalidar antes de cada acción.

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
