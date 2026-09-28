# Fase 10.18 — Privacidad

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Email marketing implica tratamiento de datos personales y debe operar bajo una base jurídica válida y principios de privacidad aplicables.

En la UE, GDPR exige identificar base jurídica del tratamiento. La ePrivacy Directive establece como regla general consentimiento previo para marketing por email, con una excepción limitada para ciertos clientes existentes respecto de productos o servicios propios similares, siempre con opción clara y gratuita de oposición.

La IA no debe convertir esta explicación en una autorización automática para una tienda concreta; la normativa nacional y el contexto importan.

También deben aplicarse:
- minimización;
- finalidad;
- transparencia;
- retención;
- seguridad;
- derechos del interesado.

Antipatrones: guardar datos indefinidamente, usar datos para finalidades nuevas sin evaluación, asumir que interés legítimo permite cualquier email o utilizar datos sensibles para personalización sin base adecuada.

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

