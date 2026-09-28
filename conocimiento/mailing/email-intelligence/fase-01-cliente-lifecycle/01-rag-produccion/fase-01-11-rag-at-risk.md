# Fase 1.11 — At-Risk Customer

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Definir cómo debe interpretar un agente a un cliente `AT_RISK`.

At-Risk describe una relación cuyo comportamiento empieza a desviarse negativamente de lo esperado.

No significa que el cliente ya esté perdido.

---

# 1. Señales posibles

- mayor tiempo desde compra;
- caída de frecuencia;
- caída de engagement;
- incidencias;
- devoluciones;
- menor actividad.

Ninguna señal aislada debe universalizarse.

---

# 2. Riesgo relativo

El riesgo debe compararse con el patrón normal de:
- cliente;
- categoría;
- tienda.

---

# 3. At-Risk vs Lapsed

```text
AT_RISK
```
significa deterioro o desviación.

```text
LAPSED
```
implica una inactividad más consolidada.

---

# 4. At-Risk y lifecycle

Puede afectar principalmente a compradores previos.

---

# 5. At-Risk y frecuencia histórica

Un cliente mensual que lleva dos meses sin comprar puede ser más preocupante que uno que compra una vez al año.

---

# 6. At-Risk y producto

El ciclo natural del producto condiciona interpretación.

---

# 7. At-Risk y engagement

Caer en clicks o visitas puede reforzar la señal, pero no siempre equivale a churn comercial.

---

# 8. At-Risk y soporte

Una mala experiencia reciente puede aumentar riesgo.

---

# 9. At-Risk y promociones

El descuento no debe ser respuesta automática.

Puede ser más útil entender:
- fricción;
- necesidad;
- satisfacción;
- relevancia.

---

# 10. At-Risk y personalización

La estrategia puede basarse en:
- historial;
- categoría;
- producto;
- patrón de recompra.

---

# 11. At-Risk y prevención

El objetivo es intervenir antes de que la relación se vuelva inactiva.

---

# 12. At-Risk y no-send

Si no existe una razón relevante para contactar, una campaña genérica puede no solucionar el problema.

---

# 13. Antipatrón: 90 días = at-risk para todos

Las ventanas universales son poco fiables.

---

# 14. Antipatrón: descuento = retención

Puede enmascarar problemas sin resolverlos.

---

# 15. Preguntas que debe hacerse el agente

```text
¿Qué patrón tenía antes?
¿Qué ha cambiado?
¿Respecto a qué expectativa?
¿Existe una incidencia?
¿La caída es de compra, engagement o ambas?
¿Qué intervención tiene sentido?
```

---

# 16. Principio maestro

At-Risk es una desviación respecto al comportamiento esperado.

La IA debe interpretar el riesgo en contexto, no mediante un calendario universal.
