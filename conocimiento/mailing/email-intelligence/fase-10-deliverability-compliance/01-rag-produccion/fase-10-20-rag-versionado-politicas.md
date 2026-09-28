# Fase 10.20 — Versionado de políticas

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Deliverability y compliance cambian.

Por ello, requisitos de proveedores, reglas internas y políticas legales no deben almacenarse como conocimiento atemporal.

Cada política relevante debe incluir:
- fuente;
- versión;
- jurisdicción/proveedor;
- fecha de vigencia;
- fecha de última verificación;
- estado.

La IA debe poder responder:
```text
¿Qué regla se aplicaba en esa fecha?
```

Esto es esencial para auditoría y evita que una actualización sobrescriba el contexto histórico.

Antipatrones: editar una regla sin historial, perder fuente, mezclar recomendación y obligación o reutilizar una policy antigua sin comprobar vigencia.

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

