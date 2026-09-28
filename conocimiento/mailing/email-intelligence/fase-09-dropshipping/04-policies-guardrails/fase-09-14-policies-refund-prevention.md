# Fase 9.14 — Refund Prevention — Policies / Guardrails

## Tipo de artefacto
`04-policies-guardrails`

## Objetivo

Definir restricciones duras para `Refund Prevention`.

## Reglas

- Nunca obstaculizar una devolución válida para mejorar métricas.
- No ocultar condiciones materiales.
- La prevención debe centrarse en claridad, educación y resolución de problemas.

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
