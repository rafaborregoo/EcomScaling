# Fase 1.20 — Ciclo esperado de recompra

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Definir cómo debe comprender la IA el ciclo esperado de recompra.

El ciclo de recompra es el intervalo típico o estimado entre compras relacionadas.

Es esencial para:
- replenishment;
- at-risk;
- lapsed;
- timing;
- retención.

---

# 1. No existe un ciclo universal

Depende de:
- producto;
- categoría;
- cantidad;
- uso;
- cliente.

---

# 2. Consumibles

Pueden presentar ciclos claros.

Ejemplos:
- café;
- cosmética;
- suplementos;
- alimento para mascotas.

---

# 3. Bienes duraderos

Pueden no tener replenishment natural.

---

# 4. Ciclo individual

El historial del propio cliente suele ser la evidencia más útil cuando existe suficiente muestra.

---

# 5. Ciclo de producto

Puede estimarse agregando comportamiento de compradores del mismo producto.

---

# 6. Ciclo de categoría

Es útil cuando el producto tiene poca muestra.

---

# 7. Ciclo de tenant

Puede funcionar como fallback.

---

# 8. Variabilidad

No todos los clientes recompran exactamente en el mismo intervalo.

Debe trabajarse con rangos o distribuciones cuando sea posible.

---

# 9. Cantidad

Comprar más unidades puede alargar el siguiente ciclo.

---

# 10. Suscripciones

Un modelo de suscripción tiene lógica distinta porque el próximo envío puede estar programado.

---

# 11. Replenishment timing

El email debería anticiparse a la necesidad, no llegar siempre después de que el cliente ya compró en otro sitio.

---

# 12. At-Risk

Una desviación significativa del ciclo esperado puede indicar riesgo.

---

# 13. Lapsed

Una desviación todavía mayor puede indicar lapse.

---

# 14. Estacionalidad

El ciclo puede cambiar en:
- verano;
- Navidad;
- eventos;
- temporadas.

---

# 15. Antipatrón: 30 días para todos

Puede ser totalmente incorrecto.

---

# 16. Antipatrón: asumir consumo por calendario

La cantidad y uso real importan.

---

# 17. Preguntas que debe hacerse el agente

```text
¿Es un producto consumible?
¿Qué intervalo histórico existe?
¿El cliente tiene suficiente historial?
¿Qué cantidad compró?
¿La categoría tiene estacionalidad?
¿Estamos antes, dentro o después de la ventana esperada?
```

---

# 18. Principio maestro

El ciclo esperado de recompra debe reflejar comportamiento real y naturaleza del producto.

Es una expectativa probabilística, no una fecha exacta.
