# Fase 1.8 — Repeat Buyer — Runtime

## Tipo de artefacto
`03-runtime`

## Objetivo

Determinar de forma fiable cuándo un cliente debe clasificarse como Repeat Buyer.

---

# 1. Condición conceptual

```text
valid_completed_orders >= 2
→ REPEAT_BUYER
```

---

# 2. Pedidos válidos

El runtime debe reutilizar la misma definición de pedido válido empleada para First-Time Buyer.

---

# 3. Idempotencia

Eventos duplicados no deben inflar `valid_order_count`.

---

# 4. Identidad consolidada

Compras de la misma persona deben consolidarse cuando exista identificación fiable.

---

# 5. Transición

```text
FIRST_TIME_BUYER
→ second_valid_order
→ REPEAT_BUYER
```

---

# 6. Historial

Conviene mantener:

```text
valid_order_count
first_order_at
second_order_at
last_order_at
lifetime_revenue
lifetime_margin_if_available
```

---

# 7. Cambios posteriores

El estado Repeat Buyer puede coexistir con:
- VIP;
- high-value;
- at-risk;
- lapsed.

No debería utilizarse como única dimensión.

---

# 8. Cancelaciones/refunds

Deben seguir una política explícita para determinar si afectan al número de pedidos válidos.

---

# 9. Evento de transición

Puede exponerse:

```text
CUSTOMER_BECAME_REPEAT_BUYER
```

---

# 10. Auditoría

Debe poder explicarse qué pedidos justifican el estado.

---

# 11. Lo que este runtime no decide

No decide:
- loyalty;
- VIP;
- oferta;
- frecuencia;
- cross-sell final.

---

# 12. Principio maestro

```text
VALID_ORDER_HISTORY
→ REPEAT_BUYER
```

El estado debe ser determinista y trazable.
