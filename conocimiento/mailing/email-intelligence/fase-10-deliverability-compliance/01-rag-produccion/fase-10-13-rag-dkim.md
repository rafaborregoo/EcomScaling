# Fase 10.13 — DKIM

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

DKIM firma criptográficamente mensajes para que el receptor pueda verificar que fueron autorizados por el dominio firmante y que partes firmadas no fueron alteradas.

Debe gestionarse por dominio y selector.

La IA debe distinguir firma presente de firma válida.

Gmail exige al menos DKIM o SPF para remitentes generales y SPF + DKIM para bulk senders; recomienda claves DKIM de 2048 bits cuando el proveedor lo soporte y exige al menos 1024 bits para correo a Gmail personal.

Antipatrones: selector obsoleto, firma rota, compartir claves inseguramente o considerar DKIM una garantía de inbox placement.

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

