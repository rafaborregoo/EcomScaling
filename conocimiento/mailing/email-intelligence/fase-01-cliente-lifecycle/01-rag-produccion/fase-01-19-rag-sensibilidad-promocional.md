# Fase 1.19 — Sensibilidad promocional

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Definir cómo debe interpretar la IA la sensibilidad de un cliente a descuentos y promociones.

Sensibilidad promocional es una inferencia sobre cuánto cambia el comportamiento de compra cuando existe un incentivo.

No debe inferirse a partir de una sola compra con descuento.

---

# 1. Señales útiles

- porcentaje de compras con promoción;
- respuesta a campañas promocionales;
- compra a precio completo;
- espera hasta rebajas;
- uso repetido de cupones.

---

# 2. Alta sensibilidad

Puede existir cuando el comportamiento muestra repetidamente mayor propensión a comprar bajo incentivo.

---

# 3. Baja sensibilidad

Puede existir cuando compra frecuentemente sin descuento.

---

# 4. Desconocida

Cuando falta evidencia:
```text
UNKNOWN
```

---

# 5. Sensibilidad vs necesidad

Un cliente sensible a promociones no significa que debamos ofrecer siempre descuento.

---

# 6. Sensibilidad vs margin

La estrategia debe proteger contribución.

---

# 7. Sensibilidad por categoría

Puede variar entre tipos de producto.

---

# 8. Sensibilidad temporal

Puede cambiar con:
- inflación;
- temporada;
- comportamiento;
- lifecycle.

---

# 9. Promotion dependency

Sobreexponer a descuentos puede entrenar al cliente a esperar.

---

# 10. Antipatrón: signup con cupón = discount-sensitive

Es insuficiente.

---

# 11. Antipatrón: usar descuento para confirmar sensibilidad

Puede crear el comportamiento que luego intentamos medir.

---

# 12. Preguntas que debe hacerse el agente

```text
¿Compra a precio completo?
¿Qué proporción de compras usa incentivo?
¿Responde más cuando hay descuento?
¿La categoría cambia el patrón?
¿Ofrecer descuento aquí es rentable o innecesario?
```

---

# 13. Principio maestro

La sensibilidad promocional debe basarse en comportamiento repetido y utilizarse para decidir con mayor precisión cuándo NO regalar margen.
