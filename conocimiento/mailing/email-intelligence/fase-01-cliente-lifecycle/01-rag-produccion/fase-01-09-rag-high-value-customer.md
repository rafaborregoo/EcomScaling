# Fase 1.9 — High-Value Customer

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Definir cómo debe interpretar un agente de IA el concepto `HIGH_VALUE_CUSTOMER`.

Un cliente de alto valor es aquel cuya contribución económica o estratégica es alta respecto al contexto de la tienda.

No existe un umbral universal.

---

# 1. Valor no es solo revenue

Puede considerar:
- gasto acumulado;
- margen;
- frecuencia;
- recurrencia;
- devoluciones;
- coste de servicio;
- duración de relación.

---

# 2. Revenue vs profit

Un cliente con alto revenue puede tener baja contribución si:
- compra siempre con descuentos profundos;
- devuelve mucho;
- genera costes elevados.

---

# 3. Valor absoluto vs relativo

“Alto valor” debe definirse respecto a la distribución real del negocio.

1000 € puede ser enorme para una tienda y normal para otra.

---

# 4. Valor histórico vs esperado

Debe distinguirse:

```text
observed_value
```

de:

```text
predicted_future_value
```

El segundo es una inferencia.

---

# 5. High-Value no es VIP

Un cliente puede ser económicamente valioso sin estar dentro de un programa VIP.

VIP puede incorporar criterios relacionales o comerciales adicionales.

---

# 6. High-Value no es high intent

Valor histórico e intención actual son dimensiones distintas.

---

# 7. Estrategia

Puede justificar:
- mayor relevancia;
- reconocimiento;
- servicio;
- acceso;
- protección de la relación.

No necesariamente más descuentos.

---

# 8. Protección de margen

Un cliente valioso no debería recibir incentivos innecesarios por defecto.

---

# 9. Retención

Perder un cliente de alto valor puede tener un coste importante.

Por eso merece atención especial a señales de riesgo.

---

# 10. Experiencia

Incidencias de soporte o logística pueden tener prioridad elevada.

---

# 11. Afinidad

El historial de compras permite recomendaciones más precisas.

---

# 12. Cross-sell

Puede tener alto potencial cuando existe complementariedad real.

---

# 13. Early access

Puede funcionar como beneficio no monetario.

---

# 14. Exclusividad

Puede reforzar reconocimiento sin erosionar margen.

---

# 15. High-Value y devoluciones

El valor debe interpretarse neto de comportamientos que deterioren contribución.

---

# 16. High-Value y referral

Algunos clientes valiosos también pueden ser advocates, pero no debe suponerse.

---

# 17. High-Value y riesgo

Una caída de frecuencia puede merecer análisis más prioritario.

---

# 18. Antipatrón: gasto alto = regalar más descuento

Puede erosionar margen sin necesidad.

---

# 19. Antipatrón: ignorar contribución

Revenue sin margen puede engañar.

---

# 20. Preguntas que debe hacerse el agente

```text
¿Qué significa “valor” en esta tienda?
¿Se mide revenue, margen o ambos?
¿Es valor histórico o esperado?
¿Dónde se sitúa respecto a otros clientes?
¿Existe riesgo de pérdida?
¿Necesita reconocimiento o simplemente relevancia?
```

---

# 21. Principio maestro

`HIGH_VALUE_CUSTOMER` debe ser una clasificación relativa al negocio y respaldada por datos económicos reales.

No es una etiqueta universal ni una excusa para aumentar descuentos.
