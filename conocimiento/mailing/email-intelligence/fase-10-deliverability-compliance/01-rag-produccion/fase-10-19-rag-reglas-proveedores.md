# Fase 10.19 — Reglas Gmail / Yahoo / Proveedores

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Los proveedores de mailbox mantienen requisitos técnicos y de comportamiento que pueden cambiar con el tiempo.

A septiembre de 2026, Gmail exige a todos los remitentes hacia cuentas Gmail autenticación SPF o DKIM, DNS directo/inverso válido, TLS, formato RFC 5322 y spam rate inferior al 0,3%. Para remitentes de 5.000+ mensajes/día a Gmail personal exige SPF + DKIM + DMARC, alineación DMARC y one-click unsubscribe para mensajes promocionales/de suscripción, además de enlace visible de baja. Gmail recomienda mantener spam por debajo del 0,1% y evitar alcanzar 0,3%.

Yahoo exige para todos los remitentes al menos SPF o DKIM, DNS válido y spam rate inferior a 0,3%; para bulk senders requiere SPF + DKIM, DMARC al menos p=none con alignment, y soporte de unsubscribe sencillo, indicando que las bajas deben respetarse dentro de 2 días.

Estas reglas son configuración externa versionada. La IA debe consultar la versión vigente cuando vaya a auditar cumplimiento.

Antipatrones: copiar requisitos una vez y considerarlos eternos, usar el mismo threshold para todos los proveedores, ignorar fecha de vigencia o no distinguir requisito de recomendación.

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

