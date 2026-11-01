# META-SB-003 | Escasez de datos y razonamiento estadístico

**Estado:** candidato · **Fuente:** [FUENTE] ~04:32–05:59.

## Qué dice el vídeo

Compara campañas con miles de conversiones diarias frente a otras con pocas conversiones semanales y recomienda usar una calculadora de significación estadística; ejemplifica un nivel del 90 % entre anuncios A y B.

## Interpretación correcta [INFERENCIA]

- El número de eventos determina, en parte, la precisión de las estimaciones; con muestras pequeñas hay mayor variabilidad.
- **No confundir 90 % de «significación» con garantía de mejora o con probabilidad de que un creativo sea el mejor.** Depende del test, hipótesis, potencia, diseño y control del error.
- Una calculadora de proporciones puede ser inapropiada para métricas de ingresos (ROAS), asignaciones no aleatorias, datos repetidos o varias comparaciones simultáneas.
- Meta puede redistribuir impresiones dinámicamente: comparar dos anuncios observacionales puede introducir sesgo de asignación, selección y oportunidad.

## Política propuesta para e-NORA

1. Distinguir **comparación descriptiva** de **experimento con asignación controlada**.
2. Mostrar muestra, rango temporal, gasto, impresiones, clics, compras y/o ingresos por segmento antes de emitir superioridad.
3. No aplicar un umbral universal `p < 0,10` ni declarar un «ganador» por una diferencia puntual de CPA.
4. Si se realizan tests formales, especificar métrica primaria, unidad de aleatorización, tamaño muestral, ventana, corrección por múltiples tests, sesgo y criterio de parada.
5. Si la prueba no es aleatorizada, lenguaje permitido: «en el periodo observado A presentó mejor CPA atribuido»; lenguaje no permitido: «A causa un 25 % más de ventas».

## Ejemplos de respuestas

**Aceptable:** «A registra 2 compras y B 1 en los últimos 7 días. La muestra es demasiado pequeña para concluir que A es superior; conviene mantener observación o rediseñar la prueba».

**No aceptable:** «A tiene un ROAS un 40 % mayor; mueve mañana todo el presupuesto a A».

## Dependencias

Datos de anuncios/insights y control de atribución; metadatos de experimento; capacidad de distinguir evento de conversión vs acción atribuida; fuentes y fechas de cambios. Auditar si existen estas piezas.

## Solapamiento

Primer pack `META-005`, `META-006` y guardrails; posible módulo nuevo específico si no hay tratamiento formal de incertidumbre/muestras en corpus actual.
