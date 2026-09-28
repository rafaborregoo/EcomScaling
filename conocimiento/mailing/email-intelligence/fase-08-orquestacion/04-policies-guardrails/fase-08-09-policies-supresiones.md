# Fase 8.9 — Supresiones — Policies / Guardrails

## Tipo de artefacto
`04-policies-guardrails`

## Objetivo

Definir restricciones duras que el sistema debe respetar al aplicar `Supresiones`.

## Reglas

- Una suppression activa debe bloquear comunicaciones dentro de su ámbito.
- No puede ser anulada por prioridad comercial.
- La reactivación requiere una condición explícitamente autorizada.

---

## Precedencia

Cuando una policy hard entra en conflicto con una recomendación de IA:

```text
POLICY
>
MODEL_RECOMMENDATION
```

La IA puede explicar el conflicto, pero no debe invalidar la política.

---

## Auditoría

Toda aplicación o excepción autorizada debe quedar registrada con:
- rule_id;
- version;
- reason;
- scope;
- timestamp.

---

## Principio maestro

Los guardrails limitan lo que puede ejecutarse, aunque el modelo considere atractiva otra acción.
