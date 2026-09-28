# Fase 10.4 — Unsubscribe

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Unsubscribe es la retirada o rechazo de comunicaciones de marketing.

Debe ser fácil, visible y efectiva.

La IA debe distinguir:
- unsubscribe global;
- unsubscribe por lista;
- cambio de preferencias;
- supresión por canal.

Una baja no debería convertirse en una negociación.

Antipatrones: ocultar enlace, pedir login obligatorio, formularios largos, seguir enviando después de baja o reactivar sin nueva base válida.

---

## Marco de razonamiento

La IA debe separar:

```text
LEGAL / PROVIDER REQUIREMENT
+
TECHNICAL STATE
+
SENDER REPUTATION
+
AUDIENCE QUALITY
+
MESSAGE TYPE
+
ENGAGEMENT
→ DELIVERABILITY / COMPLIANCE INTERPRETATION
```

---

## Principios

- autenticación no sustituye calidad de lista;
- buena creatividad no compensa una mala reputación;
- marketing y transaccional deben clasificarse correctamente;
- suppressions y complaints son restricciones fuertes;
- datos externos cambiantes requieren versionado;
- no inferir cumplimiento cuando faltan evidencias;
- `UNKNOWN` es preferible a inventar un estado.

---

## Preguntas que debe hacerse el agente

```text
¿Qué tipo de mensaje es?
¿Qué proveedor/jurisdicción aplica?
¿Existe consentimiento o base válida?
¿SPF, DKIM y DMARC están correctamente configurados?
¿Qué reputación y spam signals existen?
¿La persona está suprimida?
¿La regla citada sigue vigente?
¿Estamos ante requisito, recomendación o heurística?
```

---

## Principio maestro

Deliverability sostenible combina consentimiento, autenticación, calidad de audiencia, reputación y comportamiento de envío.


## Fuentes oficiales de actualización

- Gmail Sender Guidelines: https://support.google.com/mail/answer/81126
- Gmail Sender Guidelines FAQ: https://support.google.com/mail/answer/14229414
- Yahoo Sender Best Practices: https://senders.yahooinc.com/best-practices/
- IETF RFC 8058: https://datatracker.ietf.org/doc/rfc8058/
- EDPB — Legal basis: https://www.edpb.europa.eu/topics/key-gdpr-concepts/legal-basis
- Directiva 2002/58/CE, art. 13: https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32002L0058

Las reglas externas deben revisarse periódicamente. Este corpus no debe considerarse sustituto de la versión vigente de la fuente oficial.

