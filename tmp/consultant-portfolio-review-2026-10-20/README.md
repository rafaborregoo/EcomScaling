# Revisión de cartera del consultor — 20/10/2026

## Alcance y resultado

Dashboard local de `rafael@noraapp.es`, selector **Vista general**, sin cliente seleccionado. Auditoría y cambios aplicados en componentes, acciones, lectura de datos, color y adaptación móvil. Se mantiene la tipografía y el marco del portal.

| Hallazgo | Cambio aplicado |
| --- | --- |
| Tablero de estado ocupaba espacio con columnas vacías | Lista por prioridad con búsqueda, filtros y siguiente acción; ampliación a partir de seis clientes |
| Comparación de nueve columnas difícil de leer | Grupos de Shopify, Meta y Klaviyo por cuenta, que pasan a una columna en móvil |
| Contadores y decisiones usaban criterios distintos | La bandeja y su contador excluyen mensajes del filtro de decisiones |
| Contexto largo mezclado con acción | Resumen y evidencia principal visibles; contexto completo en desplegable nativo |
| Monedas distintas podían competir en ordenaciones | Agrupación por moneda, importes desconocidos sin comparación numérica |
| Devoluciones podían desaparecer del agregado | Se incluyen ventas negativas y ventas cero con pedidos en su moneda |
| Referencia de equilibrio ausente podía sugerir buena salud | Estado explícito de referencia ausente; distingue ROAS inferior, igual y superior |
| Cantidad de tiendas podía confundirse con cobertura | Tiendas con datos y tiendas conectadas aparecen por separado |
| Navegación móvil solapaba el selector del portal | Navegación local estática en móvil; controles medidos con mínimo de 44px |
| Importes negativos sin énfasis consistente | Color de peligro y signo en cifras, agrupaciones y detalles |

## Comprobación

- TypeScript de web y ESLint dirigido: sin errores.
- 19 pruebas de modelo correctas: 7 nuevas de cartera y 12 del modelo de KPI.
- Navegador: escritorio normal y viewport de 390×844, sin desbordamiento horizontal de página ni grupos de canal.
- Búsqueda sin resultados y restablecimiento; contador de decisiones abre tres asuntos; desplegar y cerrar evidencia; ordenar ROAS y cambiar dirección; recuperar orden por prioridad.
- Abrir cliente desde la lista y regresar a Vista general mediante el selector del portal.
- Detalle ROAS: acento azul coherente, entrada de 240ms, aviso de equilibrio ausente, Escape devuelve foco a su tarjeta. Se conserva la salida de 160ms y CSS de movimiento reducido existente.
- Consola de la sesión al cierre: sin errores registrados.
- Overrides de viewport restablecidos. Sesión de consultor devuelta a Vista general.

## Evidencia

### Ajuste estético solicitado después de la revisión

La cartera adopta la estética de cliente: lienzo sin marco exterior, controles neutros o grafito, contadores en una banda con divisores, filtros sin colores cromáticos y etiquetas sin fondos pastel. El color se conserva en títulos de canal, etiquetas de métricas, barras y estados escritos. Agenda y acción de IA también pasan a neutros.

Confirmado en navegador en escritorio y 390×844: sin desbordamiento horizontal y sin controles de cartera menores de 44px en móvil. Se restableció el viewport normal. Este ajuste modifica CSS; no se volvieron a ejecutar pruebas de lógica.

- [Resumen con estética de cliente](desktop-client-theme.png)
- [Canales con estética de cliente](channels-client-theme.png)
- [Móvil con estética de cliente](mobile-client-theme.png)

### Capturas anteriores

- [Resumen en escritorio](desktop-summary.png)
- [Resultados por canal en escritorio](desktop-channels.png)
- [Resumen móvil](mobile-summary.png)
- [Canales en móvil](mobile-channels.png)

Capturas tomadas en el navegador local con los datos existentes; son evidencia de revisión, no assets del producto. Los importes cambian por la ventana móvil de treinta días.

## Límites

La cuenta revisada devuelve un cliente, tres tiendas conectadas y una tienda con actividad de pedidos; Klaviyo requiere reconexión. No se inventan los datos ausentes. Las combinaciones de monedas y devoluciones se comprueban en pruebas de modelo, no mediante datos fabricados en la sesión. No se han probado carga masiva ni todos los fallos de servicios en navegador. Implementación local, sin despliegue.
