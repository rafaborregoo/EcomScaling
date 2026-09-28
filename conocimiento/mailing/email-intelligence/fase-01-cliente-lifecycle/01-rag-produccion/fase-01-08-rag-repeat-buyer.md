# Fase 1.8 — Repeat Buyer

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Definir cómo debe comprender un agente de IA el estado `REPEAT_BUYER`.

Un Repeat Buyer es un cliente que ha completado más de una compra válida.

La repetición aporta evidencia de una relación comercial más fuerte que una compra aislada, pero no implica automáticamente:

- alto valor;
- VIP;
- loyalty;
- alta frecuencia futura;
- alta afinidad con toda la marca.

---

# 1. Segunda compra como transición

Conceptualmente:

```text
FIRST_TIME_BUYER
→ SECOND_VALID_PURCHASE
→ REPEAT_BUYER
```

La segunda compra confirma que la primera no fue necesariamente un hecho aislado.

---

# 2. Repetición y confianza

Comprar de nuevo suele indicar que parte de las barreras iniciales ya fueron superadas.

Puede existir más confianza sobre:

- producto;
- marca;
- entrega;
- servicio.

---

# 3. Repeat Buyer y retención

La estrategia empieza a centrarse más en:

- mantener relación;
- relevancia;
- frecuencia adecuada;
- siguiente necesidad;
- loyalty.

---

# 4. Repeat Buyer y afinidad

Las compras repetidas aportan señales fuertes sobre afinidad.

Debe distinguirse:

```text
same_product_repeat
same_category_repeat
cross_category_repeat
```

---

# 5. Recompra del mismo producto

Puede indicar:
- consumo;
- reposición;
- preferencia;
- conveniencia.

---

# 6. Recompra de misma categoría

Puede indicar afinidad con una necesidad más amplia.

---

# 7. Compra cruzada entre categorías

Puede indicar mayor amplitud de relación con la marca.

---

# 8. Repeat Buyer y frecuencia

No todos los repeat buyers compran con la misma frecuencia.

Debe considerarse:
- recencia;
- frecuencia;
- ciclo esperado.

---

# 9. Repeat Buyer y valor

Dos pedidos no convierten necesariamente al cliente en high-value.

Valor y repetición deben mantenerse separados.

---

# 10. Repeat Buyer y VIP

VIP puede depender de más factores que número de pedidos.

---

# 11. Repeat Buyer y replenishment

Puede ser especialmente relevante cuando la repetición sigue patrones temporales.

---

# 12. Repeat Buyer y cross-sell

El historial permite recomendaciones más contextualizadas.

---

# 13. Repeat Buyer y upsell

Puede existir mayor confianza para presentar opciones superiores.

Debe mantenerse coherencia con compras anteriores.

---

# 14. Repeat Buyer y loyalty

La repetición puede justificar:
- beneficios;
- reconocimiento;
- programas de loyalty.

Pero loyalty no debe asumirse solo por dos compras.

---

# 15. Repeat Buyer y campañas

Puede recibir campañas diferentes a prospects porque:
- conoce la marca;
- tiene historial;
- ya ha convertido.

---

# 16. Repeat Buyer y educación

La educación puede evolucionar desde:
- “qué es el producto”
hacia:
- “cómo aprovecharlo mejor”;
- “qué complementar”;
- “qué novedades importan”.

---

# 17. Repeat Buyer y promociones

No debe asumirse que necesita descuentos para seguir comprando.

---

# 18. Repeat Buyer y margen

Los clientes recurrentes pueden ser especialmente valiosos cuando compran con buena contribución.

---

# 19. Repeat Buyer y experiencia negativa

Una devolución o incidencia puede cambiar prioridad aunque el historial sea positivo.

---

# 20. Repeat Buyer y riesgo

Una caída inesperada en la frecuencia puede indicar `AT_RISK`.

---

# 21. Repeat Buyer y lapse

La inactividad debe evaluarse frente a su patrón y categoría.

---

# 22. Reactivación

Un repeat buyer lapsed que vuelve a comprar puede recuperar un estado activo.

---

# 23. Repeat Buyer y advocacy

Algunos clientes recurrentes pueden convertirse en:
- reviewers;
- referrers;
- UGC contributors.

Pero no debe suponerse sin señales.

---

# 24. Segmentación interna

Dentro de Repeat Buyer pueden existir diferencias relevantes:

```text
high_frequency
high_value
discount_sensitive
single_category
multi_category
at_risk
```

---

# 25. Antipatrón: repeat buyer = VIP

La recurrencia es una dimensión, no una valoración total.

---

# 26. Antipatrón: siempre vender más

La relación recurrente también necesita servicio, contenido y descanso.

---

# 27. Antipatrón: misma oferta que a prospects

Puede desaprovechar conocimiento histórico.

---

# 28. Preguntas que debe hacerse el agente

```text
¿Cuántas compras válidas existen?
¿Qué compra repetidamente?
¿Con qué frecuencia?
¿Cuándo compró por última vez?
¿Compra con descuento o a precio completo?
¿Existe una categoría dominante?
¿Su frecuencia está cambiando?
¿Está preparado para cross-sell, replenishment o loyalty?
```

---

# 29. Principio maestro

Repeat Buyer significa repetición demostrada.

```text
REPEAT_PURCHASE
→ stronger_relationship_evidence
```

La estrategia debe utilizar el historial para ser más relevante, no simplemente para aumentar presión.
