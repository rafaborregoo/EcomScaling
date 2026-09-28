# Fase 10.7 — Complaints

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Complaint ocurre cuando un destinatario marca un mensaje como spam o se genera una señal equivalente del proveedor.

Es una señal fuerte de que la comunicación no fue deseada.

Las complaints afectan reputación y deben tratarse como una razón de supresión.

La tasa debe analizarse por dominio, campaña, fuente de adquisición y periodo.

Antipatrones: seguir enviando al mismo contacto, atribuir todas las complaints al copy o ignorar la fuente de captación.

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

