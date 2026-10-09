# Implementación A05: iniciativas y acciones de marketing

**Estado:** implementado local; verificado por typecheck y pruebas focalizadas  
**Alcance:** A05, persistencia de sus acciones en `campaign_calendar_items` y sección Marketing → Campañas. No se publica en Klaviyo o Meta.

## Auditoría del estado actual

- A05 devuelve `campaigns[]` plano. Un elemento contiene canal, título y fecha, así que el contrato no garantiza una iniciativa con datos comunes ni varias ejecuciones relacionadas.
- El campo opcional `initiative` añadido en la primera fase es solo un nombre compartido; no contiene objetivo, audiencia, oferta o periodo y no expresa la estructura de Meta.
- El calendario guarda una fila por elemento. `metadata` puede guardar referencias jerárquicas, por lo que se puede conservar la estructura sin una migración de base de datos.
- Klaviyo distingue campañas proactivas con mensajes programados de flows reactivos con disparadores, condiciones y esperas. Una campaña omnicanal puede contener varios mensajes y rutas de audiencia.
- Meta organiza campaña → conjunto de anuncios → anuncio; el creativo pertenece al anuncio. El calendario debe mostrar como eventos los emails puntuales, los anuncios/creativos fechados y la preparación de flows; la jerarquía completa acompaña cada evento.
- Hay propuestas A05 previas en `agent_outputs` con el contrato plano. El lector y el materializador deben seguir admitiéndolas.

## Modelo acordado

Una propuesta nueva contiene `initiatives[]`. Cada iniciativa paraguas tiene nombre, objetivo, audiencia, oferta o «sin oferta», periodo, hipótesis, evidencia y métrica de éxito. No se inventan descuentos, disponibilidad, resultados ni fechas comerciales.

Dentro de una iniciativa:

- `klaviyo.campaigns[]` contiene rutas de audiencia; cada ruta contiene `messages[]` con una fecha puntual, propósito y brief de producción. Cada mensaje se materializa como un evento independiente.
- `klaviyo.flows[]` contiene disparador, fecha límite de preparación y pasos ordenados con esperas explícitas y briefs. Se materializa un evento de preparación del flow; los pasos no se presentan como envíos con fechas fijas.
- `meta_campaigns[]` contiene nombre, objetivo y periodo; cada una puede tener `ad_sets[]` con audiencia y ubicaciones; cada conjunto contiene `ads[]` con nombre, formato, fecha prevista y brief del creativo. Cada anuncio fechado se materializa como evento independiente con el contexto de campaña y conjunto.

A05 planifica estrategia, fechas y briefs. No produce HTML, copy final, imágenes, anuncios reales ni envíos. Oferta desconocida se marca como pendiente de confirmar. Fechas de email y anuncios quedan dentro de la ventana solicitada y usan la zona horaria de la tienda.

## Fases de implementación y auditoría

1. **Contrato de dominio — completado:** esquemas Zod y JSON Schema estrictos; validaciones de ventana, fecha, cardinalidad, pasos de flow y evidencia; lectura compatible de `campaigns[]` antiguo.
2. **Instrucciones y evidencia de A05 — completado:** prompt por canal y tipo de ejecución. Usa contexto estacional, RAG, historial, ventas, inventario/riesgo, resultados y planes ya existentes. Se añadió inventario sincronizado de flows Klaviyo y campaña/conjunto/anuncios Meta, limitado a la tienda seleccionada. No se pasan cuerpos de correo ni creativos; targeting detallado de Meta queda explícitamente fuera del inventario.
3. **Normalización y persistencia — completado:** una acción fechada por mensaje, anuncio o preparación de flow; metadata conserva sus padres y el índice de origen. Se mantiene idempotencia, zona horaria local y compatibilidad con propuestas antiguas.
4. **Revisión de propuesta — completado:** iniciativas agrupadas con objetivo, audiencia, oferta, periodo, evidencia e indicador; selección por cada fecha. Las acciones se etiquetan como flow automático, email o Meta.
5. **Calendario y lista de Campañas — completado:** una fila por ejecución en la fecha correspondiente; detalle de cada acción muestra toda la descripción jerárquica, también antes de crear su pieza. Flow se agenda como preparación, no como envíos con fechas fijas.
6. **Contexto y auditoría final — completado:** glosario y ADR actualizados; lectura y escritura limitadas a la tienda del plan; typecheck de IA, API y web y pruebas focalizadas de jerarquía/materialización/lista completados.

## Criterios de aceptación

- Una iniciativa de ejemplo puede contener cuatro emails en cuatro fechas bajo el mismo nombre y objetivo, y varios anuncios de Meta bajo campaña/conjunto/anuncio, cada uno con su propia fecha y formato.
- Un flow se reconoce por trigger y esperas; no se muestra como una secuencia de envíos puntuales.
- La oferta queda como confirmada con evidencia explícita o pendiente de confirmar; el agente no inventa un descuento.
- La propuesta y el calendario muestran borradores internos por fecha, con jerarquía legible en detalle.
- Volver a materializar la misma salida no duplica eventos.
- Las propuestas antiguas siguen cargando y se materializan con una jerarquía heredada de una sola acción.
- Nada de este flujo publica, envía ni crea objetos reales en Klaviyo o Meta.
