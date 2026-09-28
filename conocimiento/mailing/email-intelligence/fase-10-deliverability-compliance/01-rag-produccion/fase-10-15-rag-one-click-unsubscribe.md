# Fase 10.15 — One-click Unsubscribe

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

One-click unsubscribe permite a clientes de correo solicitar baja directamente desde la interfaz del mailbox.

RFC 8058 define el mecanismo mediante `List-Unsubscribe` con URI HTTPS y `List-Unsubscribe-Post: List-Unsubscribe=One-Click`, cubiertos por DKIM.

Gmail exige one-click unsubscribe para mensajes promocionales/de suscripción de bulk senders. Yahoo exige soporte de fácil unsubscribe para bulk senders y recomienda el método RFC 8058.

No sustituye al enlace visible dentro del email.

Antipatrones: botón que requiere login, endpoint que muestra un formulario en lugar de procesar POST, no firmar headers relevantes o mantener al usuario activo tras solicitud.

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

