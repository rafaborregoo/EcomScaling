# Fase 1.17 — Afinidad de producto

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Definir cómo debe interpretar la IA la afinidad hacia un producto concreto.

Afinidad es una estimación de relevancia persistente, no una simple visualización.

---

# 1. Señales

Puede derivarse de:
- compras;
- repetición;
- product views;
- wishlist;
- clicks;
- búsquedas.

---

# 2. Compra

Una compra suele ser señal fuerte, pero puede haber sido:
- regalo;
- compra única;
- error.

---

# 3. Recompra

La repetición refuerza afinidad.

---

# 4. Views

Las visualizaciones aportan evidencia menor que una compra.

---

# 5. Recency

La afinidad debe perder fuerza con el tiempo si no se refuerza.

---

# 6. Positive vs negative signals

Devoluciones, ocultaciones o falta persistente de respuesta pueden reducir afinidad.

---

# 7. Affinity vs intent

Puede existir:
```text
high_affinity
+
low_current_intent
```

---

# 8. Affinity vs ownership

Haber comprado un producto puede hacer menos útil recomendar exactamente el mismo SKU si no es consumible.

---

# 9. Complementarity

Afinidad a producto puede ayudar a recomendar complementos.

---

# 10. Antipatrón: viewed once = affinity

Es insuficiente.

---

# 11. Antipatrón: affinity permanente

Los intereses cambian.

---

# 12. Principio maestro

La afinidad de producto resume evidencia acumulada de relevancia hacia un producto concreto y debe mantenerse separada de intención actual.
