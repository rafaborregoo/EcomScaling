# Fase 1.16 — RFM

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Definir cómo debe comprender la IA el modelo RFM.

RFM analiza:

```text
Recency
Frequency
Monetary
```

para describir patrones de relación económica.

---

# 1. Recency

Cuánto tiempo ha pasado desde la última compra relevante.

---

# 2. Frequency

Cuántas compras realiza el cliente dentro del periodo considerado.

---

# 3. Monetary

Cuánto valor económico genera.

Puede medirse mediante revenue o una métrica económica más útil si existe.

---

# 4. RFM es descriptivo

No es una verdad psicológica sobre el cliente.

---

# 5. RFM y lifecycle

Puede apoyar la interpretación de:
- repeat buyer;
- high-value;
- at-risk;
- lapsed.

Pero no reemplaza lifecycle completo.

---

# 6. RFM y margen

Si existe información de margen, puede ser más útil que monetary bruto.

---

# 7. RFM y categorías

Puede calcularse globalmente o por categoría en casos avanzados.

---

# 8. RFM y ventanas

El periodo de análisis debe tener sentido para el negocio.

---

# 9. Percentiles

Una forma habitual de comparar clientes es usar distribución relativa.

---

# 10. Scores

Los scores simplifican análisis, pero pueden ocultar diferencias.

---

# 11. RFM y estrategia

Puede ayudar a diferenciar:
- campeones;
- frecuentes;
- valiosos;
- en riesgo;
- inactivos.

Los nombres concretos son convenciones, no hechos universales.

---

# 12. Antipatrón: copiar segmentos RFM genéricos

Los thresholds deben adaptarse al negocio.

---

# 13. Antipatrón: monetary = profit

No son equivalentes.

---

# 14. Preguntas que debe hacerse el agente

```text
¿Qué periodo usa RFM?
¿Cómo se calcula monetary?
¿Los thresholds son relativos o absolutos?
¿La categoría tiene ciclo largo o corto?
¿Para qué decisión se utilizará?
```

---

# 15. Principio maestro

RFM es una herramienta estructurada para describir relación económica reciente, frecuente y monetaria.

Debe interpretarse dentro del contexto del negocio.
