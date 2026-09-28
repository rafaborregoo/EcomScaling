# Fase 13.6 — Contact Pressure Engine — Policies / Guardrails

## Tipo de artefacto
`04-policies-guardrails`

## Objetivo

Definir restricciones duras que `Contact Pressure Engine` debe respetar.

## Reglas

- Los hard caps no pueden ser superados salvo override autorizado.
- Los cooldowns deben respetarse dentro de su ámbito.
- Todo override debe quedar auditado.

---

## Precedencia

```text
HARD_POLICY
>
ENGINE_SCORE
>
MODEL_RECOMMENDATION
```

Una puntuación alta nunca convierte una acción prohibida en válida.

---

## Auditoría

Toda regla aplicada debe poder conservar:
- `rule_id`;
- `rule_version`;
- `scope`;
- `result`;
- `reason`;
- `evaluated_at`.

---

## Principio maestro

Los límites duros son ejecutables y auditables, no sugerencias semánticas.
