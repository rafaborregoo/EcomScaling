# Fase 9.9 — Shipping Expectations — Policies / Guardrails

## Tipo de artefacto
`04-policies-guardrails`

## Objetivo

Definir restricciones duras para `Shipping Expectations`.

## Reglas

- Nunca presentar una estimación como garantía si el tenant no la define como garantizada.
- Los plazos comunicados deben provenir de información vigente.
- Si no existe ETA fiable, usar lenguaje de incertidumbre.

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
