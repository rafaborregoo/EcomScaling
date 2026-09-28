# Fase 1.18 — Afinidad de categoría

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Definir cómo debe comprender la IA la afinidad hacia una categoría.

Es más amplia que afinidad de producto y puede ser útil cuando el cliente explora o compra varios SKUs relacionados.

---

# 1. Fuentes de evidencia

- compras en categoría;
- múltiples product views;
- búsquedas;
- clicks;
- repetición;
- wishlist.

---

# 2. Category affinity vs product affinity

Puede existir:
```text
high_category_affinity
+
no_dominant_product
```

---

# 3. Repetición

Comprar distintos productos de la misma categoría refuerza afinidad.

---

# 4. Diversidad

Explorar muchos productos de una categoría puede indicar consideración amplia.

---

# 5. Intent separado

Afinidad alta no significa querer comprar ahora.

---

# 6. Taxonomía de catálogo

La calidad de la afinidad depende de categorías coherentes.

---

# 7. Jerarquías

Puede existir:
```text
beauty > skincare > serums
```

La afinidad puede propagarse parcialmente entre niveles, con cautela.

---

# 8. Cambio de intereses

Debe existir decay y actualización.

---

# 9. Antipatrón: una vista = category affinity

No basta.

---

# 10. Principio maestro

La afinidad de categoría describe relevancia persistente hacia un grupo de productos y debe derivarse de múltiples señales cuando sea posible.
