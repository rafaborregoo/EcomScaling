# Fase 10.7 — Complaints — Policies / Guardrails

## Tipo de artefacto
`04-policies-guardrails`

## Objetivo

Definir restricciones duras aplicables a `Complaints`.

## Reglas

- Una complaint válida debe impedir nuevo marketing al contacto afectado.
- No reactivar automáticamente.
- Los thresholds externos deben versionarse por proveedor.

---

## Precedencia

```text
LEGAL / PROVIDER / HARD POLICY
>
COMMERCIAL RECOMMENDATION
```

El modelo puede explicar una restricción, pero no debe saltársela.

---

## Versionado

Toda regla externa debe incluir:
- source;
- status;
- effective_at;
- checked_at;
- jurisdiction/provider;
- version.

---

## Principio maestro

Compliance y deliverability crítica no deben depender de decisiones libres del modelo.

