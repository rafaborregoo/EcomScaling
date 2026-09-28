# Fase 10.6 — Bounces — Policies / Guardrails

## Tipo de artefacto
`04-policies-guardrails`

## Objetivo

Definir restricciones duras aplicables a `Bounces`.

## Reglas

- No continuar marketing a direcciones clasificadas como hard bounce.
- Retries deben estar limitados.
- La clasificación debe conservar el código/fuente original.

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

