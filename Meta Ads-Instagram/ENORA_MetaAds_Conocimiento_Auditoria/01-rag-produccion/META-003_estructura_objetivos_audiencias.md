# META-003 | Campañas, conjuntos, anuncios, objetivos y audiencias

**Estado:** candidato. **Fuente:** [VÍDEO] ~07:51–16:40.

## Modelo conceptual [VÍDEO]

- **Campaña:** objetivo de marketing y, según configuración, distribución presupuestaria.
- **Conjunto de anuncios:** ubicación de conversión, evento, audiencia, ubicaciones y algunas configuraciones de presupuesto.
- **Anuncio:** identidad, creativo, copy, destino y CTA.
- Para un ecommerce que busca compras, el objetivo/evento de venta puede alinear la entrega con la conversión final.
- Segmentar de forma amplia y dejar que el anuncio comunique la propuesta es una estrategia presentada en el vídeo, **no regla aplicable a todas las cuentas**.
- Excluir compradores previos puede ser útil cuando el objetivo es captación neta, bajo las restricciones y capacidades de Meta.

## Diagnóstico contextual [PROPUESTA e-NORA]

Ante una campaña con tráfico y pocas compras: primero verificar intención del objetivo, evento de optimización, calidad de datos, periodo, creatividad, oferta y volumen. No concluir “objetivo incorrecto” solo por tratarse de Traffic: puede formar parte de una estrategia válida con objetivos distintos.

### Datos necesarios

- Campaña / ad set / anuncio / IDs / estados / objetivo / evento.
- Inversión, impresiones, clics salientes, landing views, compras y valor según cobertura.
- Región y ventana temporal para interpretar segmentación.
- Configuración de audiencia/placements solo si la API/conector y permisos efectivamente la proporcionan.

## Guardrails

- No afirmar acceso a la configuración de intereses, exclusiones o audiencias cuando solo hay métricas.
- No recomendar automáticamente cambiar a Sales ni desactivar una campaña sin contexto comercial.
- No proponer segmentaciones discriminatorias o contrarias a políticas de anuncios especiales.
- Verificar vigente nomenclatura y campos API de Meta antes de implementación.

## Prueba sugerida

Mismo dato de bajo ROAS con objetivos de Sales y Traffic: salidas distintas, conscientes del objetivo declarado; ambas mencionan incertidumbres.
