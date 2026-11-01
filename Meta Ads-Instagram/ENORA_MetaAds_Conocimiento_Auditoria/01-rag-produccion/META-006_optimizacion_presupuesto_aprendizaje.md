# META-006 | Gestión de presupuesto, aprendizaje y escalado

**Estado:** candidato. **Fuente:** [VÍDEO] ~10:32–12:20, ~24:55–25:30 y ~27:15–30:55.

## Conocimiento fuente [VÍDEO]

- Dimensionar presupuesto de prueba según precio, márgenes, CPA admisible y capacidad de asumir riesgo.
- Revisar primero que los anuncios estén activos, entreguen, gasten y registren eventos.
- No modificar muchas variables simultáneamente con muy pocos datos.
- El ponente sugiere mirar ventanas de varios días y plantea aumentos de 10–20 % si la rentabilidad se mantiene: **heurística contextual, no prescripción automática**.
- El rendimiento de días aislados puede ser volátil.

## Regla recomendada [PROPUESTA e-NORA]

Antes de recomendar aumento/reducción presupuestaria, comprobar: objetivo, margen y ROAS objetivo verificados, volumen suficiente de compras, dispersión de resultados, atribución, estacionalidad, evolución comparada, límites comerciales de caja, rendimiento marginal y estado de aprendizaje cuando sea observable. Si faltan datos, recomendar una prueba/diagnóstico, no una cifra precisa.

## Estados para diagnósticos

- `insufficient_data`: muestra insuficiente, no emitir cambio categórico.
- `tracking_unreliable`: suspensión de conclusiones económicas derivadas de atribución dudosa.
- `economics_unknown`: sin costes/margen, no sugerir escalado rentable.
- `review_required`: recomendación potencial, requiere decisión humana.

## Acciones prohibidas sin autorización

Modificar campañas, presupuestos, anuncios, segmentaciones, facturación o creativos. El pack sólo propone recomendaciones; cualquier integración de escritura futura exige permisos, logs, aprobaciones, límites y rollback.

## Tests propuestos

ROAS alto con muestra mínima; ROAS bajo con tracking caído; ventas con margen negativo; 1 día frente a 30; campaña que gasta sin impresiones; CPA superior al umbral con 0 o pocas compras; pico de ventas por promoción temporal.
