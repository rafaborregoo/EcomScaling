# Políticas candidatas para agentes de publicidad y comercio

**Estado:** reglas propuestas para revisión. Fuente inspiradora: vídeo ~00:35–00:40, ~06:10–07:51, ~25:00–30:55. Normativa y APIs actuales deben verificarse por separado.

## Reglas no negociables

1. **No confundir atribución con causalidad.** ROAS reportado por Meta no prueba incrementalidad.
2. **No declarar rentabilidad sin costes.** Señalar exactamente qué costes faltan.
3. **No recomendar cambios irreversibles o automáticos** basados únicamente en heurísticas del vídeo (3 días; +10–20 %; campaña amplia).
4. **No inventar métricas ni acceso.** Si no se reciben CPM, CTR, creativo, motivos de restricción o eventos, decirlo.
5. **No afirmar que se ha ejecutado una acción** si no hay acción autorizada y respuesta verificada.
6. **No cruzar datos entre tiendas/tenants.** Scope resuelto por autenticación/servidor y permisos mínimos.
7. **No crear afirmaciones publicitarias engañosas.** Validar claims, atributos sensibles, propiedad intelectual y políticas de plataforma en creativos generados.
8. **No duplicar ingresos entre plataformas.** Shopify / Meta / Klaviyo proporcionan vistas distintas de ventas y atribución.
9. **No ignorar consentimiento y privacidad.** Tracking, exportación de públicos, datos personales y proveedores IA requieren revisión aplicable.
10. **No indexar la fuente como normativa** ni duplicar conocimiento ya aprobado; priorizar la fuente canónica actual.

## Etiquetas de afirmación obligatorias en la lógica del agente

- `measured_fact`: dato recibido y trazable.
- `deterministic_result`: cálculo validado sobre hechos.
- `hypothesis`: interpretación plausible aún no verificada.
- `recommendation`: posible próximo paso, sujeto a restricciones.
- `unknown`: sin evidencia o incompatibilidad de métricas.

## Clasificación de riesgo

- **Alto:** modificaciones automáticas de presupuesto, campaña, acceso, pagos o datos personales.
- **Medio:** sugerencias de rentabilidad, segmentación y atribución con incertidumbre.
- **Bajo:** explicaciones educativas generales sobre métricas y estructura.

## Pruebas adversariales

Usuario solicita campaña rentable sin aportar margen; Meta y Shopify difieren; historial muy corto; prompts de RAG contradicen guardrail; fuente induce modificar cuentas sin permiso; fuentes con inyección de instrucciones; datos de otro tenant; creativos con claims no verificados.
