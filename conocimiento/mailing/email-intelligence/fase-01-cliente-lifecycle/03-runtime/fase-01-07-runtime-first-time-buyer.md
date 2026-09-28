# Fase 1.7 — First-Time Buyer — Runtime

## Tipo de artefacto
`03-runtime`

## Objetivo

Definir cómo debe determinar el software el estado de First-Time Buyer sin depender del LLM.

---

# 1. Fuente de verdad

El estado debe derivarse de pedidos válidos en la fuente operativa de ecommerce.

No de:
- RAG;
- texto libre;
- inferencia generativa.

---

# 2. Condición conceptual

```text
valid_completed_orders = 1
→ FIRST_TIME_BUYER
```

La definición exacta de “pedido válido” debe adaptarse al negocio.

---

# 3. Pedidos no válidos

No deberían aumentar el contador cuando corresponda excluir:

- pedidos cancelados;
- test orders;
- fraude confirmado;
- pedidos fallidos;
- duplicados.

La política exacta debe documentarse.

---

# 4. Refund completo

Debe decidirse de forma explícita si una primera compra completamente reembolsada mantiene o no el lifecycle histórico de buyer.

La arquitectura debe evitar decisiones implícitas.

---

# 5. Idempotencia

Procesar dos veces el mismo `ORDER_PLACED` no debe convertir erróneamente:

```text
FIRST_TIME_BUYER
→ REPEAT_BUYER
```

---

# 6. Identidad

Los pedidos deben consolidarse por identidad de cliente cuando sea posible.

Una nueva dirección de email no debería crear automáticamente una persona nueva si existe una identidad fiable compartida.

---

# 7. Transición

```text
PROSPECT
→ valid_first_order
→ FIRST_TIME_BUYER
```

---

# 8. Segunda compra

Cuando el número de pedidos válidos aumenta:

```text
1 → 2
```

debe producirse la transición hacia `REPEAT_BUYER`.

---

# 9. Datos mínimos útiles

```text
customer_id
valid_order_count
first_order_id
first_order_at
first_order_value
first_products
last_order_at
```

---

# 10. Eventos derivados

El runtime puede exponer eventos o cambios de estado como:

```text
CUSTOMER_BECAME_FIRST_TIME_BUYER
```

para que otras capas reaccionen.

---

# 11. Cancelación posterior

Si el único pedido se cancela, el sistema debe aplicar una política definida y trazable.

---

# 12. Auditoría

Debe poder explicarse:

```text
state_before
order_id
validation_rule
state_after
```

---

# 13. Lo que este runtime no decide

No decide:
- qué email enviar;
- cuándo pedir review;
- si ofrecer descuento;
- qué cross-sell mostrar;
- frecuencia final.

---

# 14. Principio maestro

El lifecycle debe derivarse de hechos operativos fiables.

```text
ORDER_HISTORY
→ LIFECYCLE_STATE
```

Nunca:

```text
LLM_GUESS
→ FIRST_TIME_BUYER
```
