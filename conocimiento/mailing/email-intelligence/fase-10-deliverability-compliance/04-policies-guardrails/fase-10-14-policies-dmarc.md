# Fase 10.14 — DMARC — Policies / Guardrails

## Tipo de artefacto
`04-policies-guardrails`

## Objetivo

Definir restricciones duras aplicables a `DMARC`.

## Reglas

- Los bulk senders dirigidos a proveedores que lo exigen deben tener DMARC válido.
- Los cambios de enforcement deben seguir un rollout controlado.
- No declarar DMARC compliant si alignment falla.

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


## Fuentes oficiales de actualización

- Gmail Sender Guidelines: https://support.google.com/mail/answer/81126
- Gmail Sender Guidelines FAQ: https://support.google.com/mail/answer/14229414
- Yahoo Sender Best Practices: https://senders.yahooinc.com/best-practices/
- IETF RFC 8058: https://datatracker.ietf.org/doc/rfc8058/
- EDPB — Legal basis: https://www.edpb.europa.eu/topics/key-gdpr-concepts/legal-basis
- Directiva 2002/58/CE, art. 13: https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32002L0058

Las reglas externas deben revisarse periódicamente. Este corpus no debe considerarse sustituto de la versión vigente de la fuente oficial.

