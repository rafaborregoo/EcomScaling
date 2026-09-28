# Fase 1.7 — First-Time Buyer

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Definir cómo debe comprender un agente de IA el estado `FIRST_TIME_BUYER`.

Un First-Time Buyer es una persona cuya primera compra válida ya se ha producido y cuya relación con la marca entra en una etapa nueva.

El cambio esencial es:

```text
PROSPECT
→ FIRST_TIME_BUYER
```

La primera compra elimina algunas incertidumbres, pero abre otras relacionadas con experiencia, entrega, satisfacción y segunda compra.

---

# 1. Qué cambia después de la primera compra

La persona ya ha demostrado:

- suficiente confianza para pagar;
- interés real en al menos un producto;
- capacidad de completar el proceso de compra.

Pero todavía no ha demostrado:

- satisfacción;
- recurrencia;
- fidelidad;
- alto valor;
- intención de volver a comprar.

---

# 2. Objetivo estratégico principal

La prioridad suele desplazarse desde:

```text
FIRST_PURCHASE_CONVERSION
```

hacia:

```text
POST_PURCHASE_EXPERIENCE
+
SECOND_PURCHASE_DEVELOPMENT
```

La primera venta no debe tratarse como final del journey.

---

# 3. Reassurance

Después de comprar pueden aparecer:

- dudas;
- buyer remorse;
- incertidumbre por envío;
- preguntas de uso.

Una buena comunicación debe reforzar que la decisión fue razonable y que la marca controla la experiencia.

---

# 4. Educación postcompra

Puede ser especialmente útil cuando el producto requiere:

- preparación;
- instalación;
- aprendizaje;
- cuidado;
- expectativas de resultado.

La educación aumenta la probabilidad de que el cliente obtenga valor real.

---

# 5. No acelerar demasiado la siguiente venta

Un error habitual es pasar inmediatamente de:

```text
thank_you
```

a:

```text
buy_more
```

sin permitir que el cliente reciba, pruebe y valore la primera compra.

---

# 6. Segunda compra

La segunda compra es una transición crítica porque aporta evidencia de repetición.

El sistema debe identificar oportunidades como:

- complemento;
- reposición;
- ampliación;
- nueva categoría;
- misma necesidad.

---

# 7. Cross-sell

Puede ser apropiado cuando existe una complementariedad clara.

No debe confundirse con recomendar cualquier producto adicional.

---

# 8. Upsell postcompra

Debe manejarse con cautela.

No debería hacer sentir al cliente que compró una opción incorrecta.

---

# 9. Review

Una solicitud de review tiene sentido cuando ya existe suficiente experiencia con el producto.

No inmediatamente después del pago.

---

# 10. UGC

También debe respetar el tiempo de experiencia real.

---

# 11. Soporte preventivo

Preguntas frecuentes sobre:

- uso;
- envío;
- instalación;
- mantenimiento;

pueden anticiparse mediante email.

---

# 12. First-Time Buyer y dropshipping

Puede requerir más:

- tracking;
- expectativas claras;
- reassurance;
- soporte.

Especialmente cuando el delivery time es superior al de retail convencional.

---

# 13. Primera compra con descuento

No debe asumirse que el cliente necesitará descuentos futuros.

La respuesta a una promoción inicial no define su sensibilidad promocional permanente.

---

# 14. Primera compra a precio completo

Puede ser una señal positiva sobre disposición a pagar, pero sigue siendo una observación limitada.

---

# 15. Primera compra de alto valor

El ticket alto puede aumentar importancia de:

- reassurance;
- servicio;
- información;
- soporte.

No convierte automáticamente al cliente en VIP.

---

# 16. Primera compra pequeña

No implica bajo potencial futuro.

El cliente puede aumentar valor con repetición.

---

# 17. Primera compra y afinidad

La compra aporta evidencia fuerte de afinidad con el producto o necesidad.

Pero no demuestra que toda la categoría sea relevante permanentemente.

---

# 18. Primera compra y lifecycle

Mientras no exista una segunda compra válida, sigue siendo razonable distinguirlo de `REPEAT_BUYER`.

---

# 19. Primera compra y presión

El postcompra debe coordinarse con campañas y flows generales.

La experiencia de cliente tiene prioridad sobre una sucesión agresiva de promociones.

---

# 20. Señales posteriores importantes

Ejemplos:

```text
ORDER_DELIVERED
PRODUCT_USED
REVIEW_LEFT
SUPPORT_TICKET_OPENED
RETURN_REQUESTED
SECOND_ORDER_PLACED
```

Estas señales cambian la estrategia.

---

# 21. Devolución

Una devolución no borra automáticamente el hecho histórico de primera compra, pero sí cambia la relación y el contexto comercial.

---

# 22. Cancelación

Debe distinguirse entre una compra realmente completada y una orden cancelada antes de consolidarse.

La definición operativa pertenece al runtime.

---

# 23. Antipatrón: buyer = loyal customer

Una primera compra no demuestra fidelidad.

---

# 24. Antipatrón: vender inmediatamente otra vez

Primero debe protegerse la experiencia.

---

# 25. Antipatrón: review demasiado pronto

No existe todavía experiencia suficiente.

---

# 26. Antipatrón: descuento como siguiente paso obligatorio

La segunda compra puede lograrse mediante relevancia.

---

# 27. Preguntas que debe hacerse el agente

```text
¿Es realmente la primera compra válida?
¿Ya recibió el producto?
¿Existe alguna incidencia?
¿Necesita educación?
¿Existe una complementariedad real?
¿Es demasiado pronto para vender de nuevo?
¿Qué debería ocurrir antes de pedir una review?
¿Qué señal indicaría que está preparado para una segunda compra?
```

---

# 28. Principio maestro

La primera compra no termina la relación.

La transforma.

```text
FIRST_PURCHASE
→ EXPERIENCE
→ VALUE_REALIZATION
→ TRUST_CONFIRMATION
→ SECOND_PURCHASE_OPPORTUNITY
```

El objetivo del agente debe ser convertir una compra aislada en una relación satisfactoria y potencialmente recurrente.
