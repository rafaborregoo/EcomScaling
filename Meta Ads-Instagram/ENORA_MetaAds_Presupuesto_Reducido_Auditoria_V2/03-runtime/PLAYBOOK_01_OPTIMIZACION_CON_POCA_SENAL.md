# Playbook candidato 01 | Poca señal / riesgo de sobreoptimización

**Estado:** diseño no ejecutado. **No crea agente ni automatización.**

## Pregunta

«Llevo X días gastando Y € y Meta no vende, ¿qué cambio?»

## Procedimiento propuesto

1. Identificar objetivo de negocio, moneda, período, dimensiones y presupuesto total vs gasto real.
2. Validar conexión, permiso, latencia, tracking y eventos Meta/Shopify; distinguir 0 compras atribuibles de tracking faltante.
3. Identificar gasto, impresiones, clics, visitas, compras y contribución cuando existan.
4. Verificar que los costes/márgenes necesarios para decidir estén disponibles; si no, abstenerse de etiquetar «rentable/no rentable».
5. Consultar historial de cambios significativo, fase de aprendizaje **si es observable** y conversiones en una ventana relevante.
6. Clasificar: `urgent_issue`, `tracking_unreliable`, `insufficient_signal`, `unprofitable_with_evidence`, `review_experiment` o `no_action_recommended`.
7. Priorizar la recomendación económica de riesgo menor basada en evidencia; incluir supuestos y umbral de invalidación.
8. Si se propone un cambio, marcar como propuesta sujeta a revisión humana y definir qué se aprenderá.

## No hacer

- Aplicar «espera 7 días» cuando hay problemas graves.
- Ajustar automáticamente por una diferencia de 24 horas o por una regla universal de CPA.
- Inventar conversiones o tiempo de aprendizaje.
- Inferir calidad de un anuncio mediante la suma de likes y reproducciones únicamente.

## Tests sintéticos mínimos

- Día 1, cero compras y buen tracking; respuesta indeterminada.
- Campaña gastó 100 € y no registra impresiones: investigar entrega/facturación.
- Shopify confirma ventas pero Meta no: investigar medición, no exigir más presupuesto.
- ROAS alto con margen negativo: resultado económico adverso.
- 5 ad sets con 2 compras cada uno y segmentación idéntica: plantear consolidación como hipótesis.
- Campaña con 100 compras y cambios recientes: no esperar 10 días por defecto.

## Integración futura

Primero localizar playbooks/runtime existentes y evitar implementar motor duplicado. Solo proponer herramientas de lectura que realmente existan en el repo. Las fuentes y fórmulas deterministas deben quedar desacopladas del texto del LLM.
