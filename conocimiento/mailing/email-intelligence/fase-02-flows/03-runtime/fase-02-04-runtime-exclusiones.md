# Fase 2.4 — Exclusiones — Runtime

## Tipo de artefacto
`03-runtime`

## Objetivo

Definir la responsabilidad determinista del software para `Exclusiones`.

---

## Estados y eventos relevantes

- `EXCLUSION_CHECKED`
- `EXCLUSION_MATCHED`
- `FLOW_SUPPRESSED`

---

## Requisitos de ejecución

- Las exclusiones pueden tener precedencia sobre inclusión.
- Registrar la exclusión aplicada.
- Cancelar acciones pendientes cuando corresponda.
- Evaluar con datos actuales.

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
