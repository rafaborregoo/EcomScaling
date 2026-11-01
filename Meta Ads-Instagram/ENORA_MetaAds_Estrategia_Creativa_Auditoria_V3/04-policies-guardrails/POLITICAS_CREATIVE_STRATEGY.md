# Guardrails — Creative Strategy v03

**Estas políticas son candidatas y requieren conciliación con las políticas canónicas de e-NORA.**

## Límites de verdad

1. Las ideas sobre Grüns, Oats Overnight y Rhode son **hipótesis ilustrativas**, no resultados de campañas.
2. «Vi anuncios de competidores» no autoriza declarar rentabilidad, conversiones, CPM o ROAS del competidor.
3. Reseñas/comentarios no identifican de forma representativa a todos los compradores. Denominadores, sesgos y periodo deben declararse.
4. Una variante de formato, un ángulo, una persona, un concepto y un objetivo de campaña **no son entidades intercambiables**.
5. Las ideas elaboradas por IA requieren evaluación por evidencia, claridad de claims y restricciones del negocio; no existe garantía de rendimiento.
6. No recomendar automáticamente segmentación por edad/género, salud, medicación o estados sensibles a partir de reviews.
7. Claims de impacto en salud, antes/después o resultados funcionales: revisión previa y políticas aplicables, sin inventar aval científico.

## Límites de acción

- Auditoría: solo lectura del repo e índices; no ejecuciones de campaña, publicación, scraping masivo ni cambios a tiendas.
- Producción: cualquier sugerencia de test se formula como **propuesta**, nunca ejecución confirmada sin acciones explícitas y permisos.
- Separar fuentes externas públicas de información propietaria de tenants, contratos de uso y PII.
- Validar permisos y retention, sanitización, minimización y trazabilidad al enviar contextos a proveedores LLM.
- No convertir promociones de terceros en recomendaciones de herramientas ni insertar ofertas/descuentos como conocimiento técnico.

## Decisiones

- Marcar cada afirmación: `EVIDENCIA_PROPIA`, `FUENTE_EXTERNA`, `HIPOTESIS`, `NO_VERIFICABLE`.
- Si los agentes ya implementan reglas equivalentes: **fusionar con una sola fuente de verdad**, no clonar prompts/chunks.
- Para cualquier sugerencia a futuro, exigir prueba de límites en tests de contrato y seguridad.
