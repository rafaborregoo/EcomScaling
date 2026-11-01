# Diseño de experimentos y aprendizaje creativo por tenant

## Hipótesis pre-registrada
- Qué idea central se prueba y por qué (evidencia origen + timestamp).
- Audiencia/necesidad comercial prevista; etapa del funnel y CTA.
- Qué permanece controlado (oferta, landing, targeting, objetivo, atribución) y qué varía (idea, formato o hook).
- Métrica primaria económica adecuada (preferible contribución/CPA compatible con margen); métricas secundarias (CTR, CVR, retención) e invariantes.
- Presupuesto, intervalo previsto, condiciones de detención y riesgo de aprendizaje insuficiente.

## Registro de resultados
- Fecha, identificadores de anuncios, métricas y ventanas, costes, cambios durante test, incidentes de medición.
- Resultado: `NO_CONCLUYENTE | SEÑAL_POSITIVA | SEÑAL_NEGATIVA | VALIDADO_SEGUN_CRITERIO`.
- Diferenciar selección por optimización del algoritmo de experimentos controlados.
- Guardar hipótesis y efectos sólo dentro del tenant; no crear recomendaciones globales usando datos privados de terceros.

## Test de contrato
- Sin conversiones suficientes: `NO_CONCLUYENTE` aunque CTR alto.
- Cambio simultáneo de oferta y creativo: no atribuir efecto exclusivo a big idea.
- Datos incompletos de gasto: no calcular ROAS inventado.
- Nuevos compradores y ventas repetidas: no confundir compra atribuida con cliente nuevo.
