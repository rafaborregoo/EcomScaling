# Fase 1.12 — Lapsed Customer

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Definir cómo debe comprender un agente el estado `LAPSED_CUSTOMER`.

Un cliente lapsed es un comprador previo cuya actividad ha superado de forma significativa el intervalo esperado de recompra o relación.

---

# 1. Lapsed no significa perdido para siempre

Puede volver a:
- visitar;
- interactuar;
- comprar;
- reactivarse.

---

# 2. Lapsed vs At-Risk

At-Risk representa deterioro.

Lapsed representa una inactividad más consolidada.

---

# 3. Ventana contextual

No existe:
```text
N days = lapsed
```
universal.

Depende de:
- producto;
- categoría;
- frecuencia;
- historial.

---

# 4. Consumibles

El lapse puede detectarse relativamente pronto cuando existe un ciclo de consumo claro.

---

# 5. Bienes duraderos

Meses sin compra pueden ser completamente normales.

---

# 6. Lapsed y engagement

Puede existir:
```text
lapsed_buyer + engaged_subscriber
```

Es decir, no compra pero sigue interactuando.

---

# 7. Lapsed y win-back

Puede ser candidato a win-back si:
- existe relación previa valiosa;
- la oportunidad sigue siendo relevante.

---

# 8. Lapsed y oferta

El incentivo debe justificarse.

No todos los clientes lapsed necesitan descuento.

---

# 9. Lapsed y aprendizaje

Puede ayudar a entender:
- retención;
- churn;
- ciclo de recompra.

---

# 10. Lapsed y categoría

Puede estar lapsed para una categoría y activo en otra.

---

# 11. Lapsed y valor

Un high-value customer lapsed puede requerir mayor prioridad de análisis.

---

# 12. Lapsed y soporte

Una mala experiencia pasada puede explicar inactividad.

---

# 13. Lapsed y silencio

Tras intentos razonables de reactivación, puede ser mejor reducir presión.

---

# 14. Antipatrón: lapsed = desengaged

Compra y engagement son dimensiones diferentes.

---

# 15. Antipatrón: misma ventana para todos

Ignora la economía real del producto.

---

# 16. Preguntas que debe hacerse el agente

```text
¿Cuándo fue la última compra?
¿Cuál era su ciclo habitual?
¿Qué compró?
¿Sigue interactuando?
¿Hubo incidencias?
¿Qué valor histórico tiene?
¿Existe una razón real para reactivarlo?
```

---

# 17. Principio maestro

Lapsed debe significar “inactividad comercial anómala respecto al contexto”, no simplemente “ha pasado mucho tiempo”.
