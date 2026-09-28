# Fase 9.18 — Claims — Policies / Guardrails

## Tipo de artefacto
`04-policies-guardrails`

## Objetivo

Definir restricciones duras para `Claims`.

## Reglas

- Los supplier claims no son automáticamente claims aprobados.
- No utilizar certificaciones, resultados o comparaciones sin evidencia disponible.
- La IA debe abstenerse cuando falte soporte suficiente.

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
