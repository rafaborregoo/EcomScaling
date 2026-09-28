# Fase 10.8 — List Hygiene

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

List Hygiene mantiene una base de envío saludable reduciendo contactos inválidos, desengaged persistentes y señales de riesgo.

Incluye:
- bounce handling;
- complaint suppression;
- sunset;
- corrección de fuentes de adquisición deficientes;
- eliminación de duplicados.

No significa borrar indiscriminadamente contactos antiguos.

La IA debe distinguir valor histórico, engagement actual y elegibilidad de envío.

Antipatrones: mantener volumen por vanity metrics, limpiar solo cuando hay crisis, comprar bases o eliminar compradores valiosos sin revisar contexto.

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

