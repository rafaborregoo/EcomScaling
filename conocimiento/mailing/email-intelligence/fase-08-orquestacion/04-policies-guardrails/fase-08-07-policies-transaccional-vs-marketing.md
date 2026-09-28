# Fase 8.7 — Transaccional vs Marketing — Policies / Guardrails

## Tipo de artefacto
`04-policies-guardrails`

## Objetivo

Definir restricciones duras que el sistema debe respetar al aplicar `Transaccional vs Marketing`.

## Reglas

- La clasificación debe basarse en finalidad real del mensaje.
- Los límites de marketing no deben bloquear comunicaciones operativas necesarias salvo que una política explícita lo requiera.
- No disfrazar marketing como transaccional.

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
