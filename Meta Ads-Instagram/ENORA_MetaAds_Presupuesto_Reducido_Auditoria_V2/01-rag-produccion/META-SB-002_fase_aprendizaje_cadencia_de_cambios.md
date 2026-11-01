# META-SB-002 | Fase de aprendizaje y cadencia adaptativa de optimización

**Estado:** candidato · **Fuente:** [FUENTE] ~01:32–05:59.

## Conocimiento del vídeo

- Las fases de aprendizaje pueden acompañar al lanzamiento o a cambios significativos y presentar volatilidad.
- El número de eventos relevantes condiciona cuánto se tarda en obtener señal útil; presupuestos bajos suelen implicar menos conversiones.
- El ponente aconseja evitar modificaciones repetidas («helicopter parenting») y propone, como **ejemplo**, revisar cambios cada 7-10 días o más según volumen.
- Advierte que la frecuencia adecuada depende del negocio y del evento de optimización.

## Cómo convertirlo en conocimiento seguro

- **[VERIFICAR]** No codificar `learning_phase_duration = 24h/48h` ni asumir que añadir un anuncio siempre reinicia todo el aprendizaje; la plataforma, el alcance del cambio y la fase real deben contrastarse.
- **[PROPUESTA e-NORA]** La cadencia de optimización debe depender de eventos, inversión acumulada, historial, variabilidad y riesgos; nunca exclusivamente del reloj.
- Permitir **monitorización frecuente** de errores graves (tracking roto, gasto inesperado, rechazo) aunque los cambios estratégicos se recomienden con menor frecuencia.
- Separar análisis (`read-only`) de ejecución (`requires_approval`).

## Árbol de decisión propuesto

1. ¿Existe un incidente urgente? → detectar y alertar; no esperar 7 días para inspeccionarlo.
2. ¿La fuente Meta proporciona un estado de entrega/aprendizaje fiable? → leer estado real si existe, si no `learning_state_unavailable`.
3. ¿Hay suficientes compras/leads para evaluar resultado y riesgo? → si no, describir incertidumbre, no recomendar cambios basados en una mañana.
4. ¿Hubo cambios recientes significativos? → documentar variación, hora y alcance si el registro existe.
5. ¿Hay base económica/atribución? → sin ella, no elevar/cortar presupuestos en nombre de la rentabilidad.
6. ¿Acción propuesta? → explicar hipótesis, horizonte, nivel de confianza y condiciones para revisar.

## Alertas de mala generalización

- «Jamás toques una campaña durante 7 días» es incorrecto si hay errores técnicos, gasto accidental o incumplimientos.
- «Dos días bastan» tampoco es universal.
- Una frecuencia baja de conversiones no se soluciona siempre esperando más; puede exigir revisar oferta, medición o viabilidad del experimento.

## Solapamiento

Primer pack `META-006`; aportar principalmente: **cadencia dependiente del volumen** y separación monitorización/intervención. Reutilizar lógica existente si está implementada.

## Casos de prueba

3 compras/7 días vs 300 compras/7 días; aprendizaje no disponible; cambio presupuestario reciente; tracking interrumpido; gastando sin impresiones; anuncio rechazado; 0 compras con gasto superior al límite de seguridad configurado.
