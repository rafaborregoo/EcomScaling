# Fase 9.15 — Chargeback Prevention — Policies / Guardrails

## Tipo de artefacto
`04-policies-guardrails`

## Objetivo

Definir restricciones duras para `Chargeback Prevention`.

## Reglas

- No acusar de fraude sin evidencia.
- Priorizar resolución legítima del problema.
- Mantener evidencia factual y trazable.

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
