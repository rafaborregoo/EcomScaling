# Fase 10.5 — Suppression — Policies / Guardrails

## Tipo de artefacto
`04-policies-guardrails`

## Objetivo

Definir restricciones duras aplicables a `Suppression`.

## Reglas

- Suppression activa prevalece sobre decisiones comerciales.
- No puede eliminarse mediante scoring.
- Toda reactivación debe ser trazable.

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

