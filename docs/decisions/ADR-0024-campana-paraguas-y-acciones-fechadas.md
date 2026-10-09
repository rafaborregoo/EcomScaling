# ADR-0024: Iniciativa paraguas y ejecuciones por canal

## Estado

Aceptada

## Contexto

A05 necesita proponer un plan comercial con varias piezas relacionadas, fechas locales y evidencia de tienda. Un elemento plano llamado «campaña» no distingue una iniciativa común, un email puntual, un flow reactivo ni la jerarquía publicitaria de Meta. Tampoco debe hacer pasar una oferta propuesta por un descuento confirmado.

## Decisión

La salida canónica de A05 contiene iniciativas paraguas. Cada iniciativa comparte objetivo, audiencia, oferta con estado y evidencia, periodo, hipótesis y métrica de éxito.

- Klaviyo tiene campañas programadas, con rutas de audiencia y mensajes fechados individualmente, y flows reactivos con trigger, preparación y pasos secuenciales que incluyen sus esperas.
- Meta tiene campañas, conjuntos de anuncios y anuncios. Cada anuncio representa una pieza/creativo con formato, brief y fecha.
- Cada mensaje de Klaviyo, anuncio de Meta y preparación de flow crea una acción interna en el calendario. El flow se fecha por preparación; sus pasos no son envíos de fecha fija.
- La metadata del evento conserva la jerarquía y el índice estable de la acción A05. Se mantiene el esquema actual de `campaign_calendar_items`.
- El contrato plano anterior sigue admitiéndose como iniciativa heredada de una acción.

A05 propone estrategia, fechas y briefs. No produce HTML, copy final, imágenes, entidades reales en Klaviyo/Meta, envíos ni publicaciones. Una oferta solo se confirma cuando tiene evidencia explícita; de otro modo queda propuesta pendiente o sin oferta.

## Consecuencias

- La revisión presenta iniciativas agrupadas y cuenta ejecuciones por fecha.
- Marketing → Campañas y el calendario muestran una fila por acción; el detalle mantiene el objetivo y su contexto jerárquico.
- La creación repetida de acciones usa el índice de calendario estable y no duplica eventos.
- El planificador recibe el inventario sincronizado de flows y campañas Meta de la tienda seleccionada, además del contexto estacional, RAG, rendimiento e histórico ya integrado.
- Nombres, triggers y briefs de proveedores son datos y no instrucciones para el agente.
