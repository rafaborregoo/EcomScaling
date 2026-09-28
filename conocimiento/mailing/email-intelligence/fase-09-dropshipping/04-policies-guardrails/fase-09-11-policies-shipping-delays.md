# Fase 9.11 — Shipping Delays — Policies / Guardrails

## Tipo de artefacto
`04-policies-guardrails`

## Objetivo

Definir restricciones duras para `Shipping Delays`.

## Reglas

- No inventar causa del retraso.
- No prometer fecha de resolución sin dato fiable.
- Las comunicaciones de servicio deben prevalecer sobre marketing incompatible.

---

## Precedencia

```text
POLICY
>
MODEL_RECOMMENDATION
```

El modelo puede explicar una limitación, pero no inventar hechos para evitarla.

---

## Auditoría

Registrar:
- rule_id;
- version;
- scope;
- reason;
- evidence/source;
- timestamp.

---

## Principio maestro

La presión comercial nunca justifica información falsa, engañosa o no respaldada.
