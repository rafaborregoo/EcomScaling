# Fase 10.11 — IP Reputation

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

IP Reputation refleja la confianza asociada a las IPs que originan correo.

En infraestructura compartida, parte de la reputación depende del proveedor. En dedicada, la marca controla más directamente su patrón de envío.

Cambios bruscos de volumen o tráfico no deseado pueden deteriorar reputación.

La IA debe considerar si la tienda usa shared o dedicated IP antes de recomendar acciones.

Antipatrones: asumir que IP dedicada siempre es mejor, rotar IPs para evadir reputación o calentar una IP con tráfico de baja calidad.

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

