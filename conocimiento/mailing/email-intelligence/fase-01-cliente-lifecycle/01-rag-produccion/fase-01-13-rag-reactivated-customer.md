# Fase 1.13 — Reactivated Customer

## Tipo de artefacto
`01-rag-produccion`

## Objetivo

Definir cómo debe interpretar un agente la reactivación de un cliente previamente inactivo, at-risk o lapsed.

Reactivación significa que aparece nueva evidencia relevante de relación.

---

# 1. Tipos de reactivación

Puede existir:
- reactivación de engagement;
- reactivación comercial;
- reactivación de compra.

No deben confundirse.

---

# 2. Click no es compra

```text
EMAIL_CLICKED
```
puede reactivar engagement.

No necesariamente lifecycle comercial.

---

# 3. Visita

Una visita puede indicar interés renovado.

---

# 4. Cart o checkout

Representan una reactivación comercial más fuerte.

---

# 5. Compra

Una nueva compra es una señal fuerte de reactivación comercial.

---

# 6. Reactivated no debe ser permanente

Es un estado/transición temporal.

Después, la persona debería volver a un lifecycle activo adecuado.

---

# 7. Reactivación y win-back

Si una campaña o flow precedió a la reactivación, puede existir asociación.

No debe asumirse causalidad sin evidencia.

---

# 8. Reactivación y oferta

Si volvió con descuento, no debe concluirse automáticamente que solo responde a descuento.

---

# 9. Reactivación y producto

El producto que reactivó la relación puede aportar nueva afinidad.

---

# 10. Reactivación y presión

Tras volver, no debe bombardearse al cliente por considerar que “ha despertado”.

---

# 11. Reactivación y experiencia

Una nueva compra merece una experiencia normal de cliente activo.

---

# 12. Antipatrón: cualquier open = reactivated customer

Una apertura no basta para concluir reactivación comercial.

---

# 13. Antipatrón: mantener etiqueta eternamente

Reactivated describe una transición.

---

# 14. Preguntas que debe hacerse el agente

```text
¿Qué estado tenía antes?
¿Qué evento produjo la reactivación?
¿Es engagement o compra?
¿Qué fuerza tiene la señal?
¿Qué debería cambiar ahora en la estrategia?
```

---

# 15. Principio maestro

Reactivación es evidencia nueva que rompe una etapa de inactividad.

La fuerza de la transición depende del evento que la produce.
