# A16 · Texto sobre imagen · 06/11/2026

> Alcance actualizado: modelo seleccionado sobre dos casos. Los bloqueos de exportación privada, vinculación al borrador, guardado del caption y recuperación de carruseles se corrigieron en código y TEST/local; véase la [auditoría y cierre de integración con A11](./A16_INTEGRACION_CREACION_MARKETING_2026-11-06.md). La comparación visual de seis modelos con el contexto ampliado sigue pendiente.

## Resultado

**Modelo principal: Claude Opus 5.5. Fallback: GPT-6.1 Sol.** Se compararon los seis modelos acordados, sin Astra, en dos imágenes TEST con los mismos píxeles, prompt y contrato nativo: una pieza gráfica del banco y una imagen Shopify de **The Hidden Snowboard**. La ficha y el vínculo producto/tienda se verificaron en la base de datos TEST de Prueba Borrego / E-NORA Demo.

Opus fue el más equilibrado en jerarquía, copy breve, fidelidad a los hechos y uso de espacios libres. En el snowboard nombra el producto y describe el gráfico sin repetir el OCR ni atribuir prestaciones. En el arte abstracto conserva la frase neutra y sitúa el copy debajo del círculo amarillo. Sol es el respaldo porque crea una línea descriptiva útil para el producto y una versión sencilla para la pieza abstracta, sin CTA ni hechos comerciales inventados.

## Coste de referencia

Estimación conservadora de API en frío basada en el catálogo guardado del laboratorio; no es factura ni medición de API real. Las ejecuciones comparativas usaron las suscripciones CLI.

| Modelo | Coste estimado por imagen | 20 imágenes |
|---|---:|---:|
| Claude Haiku 5.5 | $0,00204 | $0,0408 |
| Claude Sonnet 5.5 | $0,01869 | $0,3738 |
| **Claude Opus 5.5** | **$0,05376** | **$1,0752** |
| GPT-6 Luna | $0,00224 | $0,0447 |
| GPT-6.1 Sol | $0,05574 | $1,1148 |
| GPT-6.1 Terra | $0,02702 | $0,5404 |

A16 se solicita manualmente por creatividad; no tiene una frecuencia automática. La hipótesis actual de Costes, 0,33 solicitudes/día, equivale a unas 10 imágenes al mes: aproximadamente **$0,54/mes con Opus**, sin contar fallbacks. Veinte imágenes al mes serían **$1,08**. El precio final puede variar si cambian las tarifas, el tamaño de imagen, el contexto o la caché.

## Hallazgos y fallos corregidos

- Las comparaciones antiguas de A16 no incluían los píxeles adjuntos y una utilizaba Astra; quedan archivadas y no cuentan para el ranking.
- El editor ignoraba la colocación del modelo y aplicaba a todos los textos una caja central de 84% del ancho. Se amplió el contrato para devolver coordenadas `x/y/ancho` por bloque y el editor ahora las respeta y limita al lienzo.
- El esquema rechazaba la posición vertical 94% aunque fuese válida para texto en el margen inferior. El límite ahora permite hasta 96%; el editor contiene la caja al 90%.
- A16 recibía el análisis visual, pero no los datos de producto vinculados por Shopify. Ahora carga nombre, descripción y etiquetas desde una fuente asociada a la misma tienda, verificando organización y tienda. No pasa precio, stock o resultados si no están disponibles.
- Los metadatos de proveedor no se presentan como copy de marca. El CTA es opcional y se omite si no hay destino verificado; ya no se asume DM ni link en bio.
- En la muestra, Sonnet propuso «Muy pronto» sin fecha de lanzamiento; Haiku tendió a repetir el mensaje en la pieza abstracta. Opus tuvo el mejor equilibrio. La muestra es pequeña y la revisión humana del creativo sigue siendo necesaria.

## Cambios en el producto

- La política compartida asigna Opus y Sol como fallback en runtime y Costes de IA.
- La salida incluye coordenadas por bloque; el editor A16 de Marketing > Imágenes las aplica en la propuesta editable.
- El laboratorio de IA selecciona por defecto el caso final de producto, permite comparar campos entre dos modelos y muestra el copy, la paleta, la justificación y el precio.
- Se guardó la respuesta CLI de Opus como borrador de prueba sin publicar ni enviar. Se conserva en Marketing > Imágenes para revisión en las cuentas de cliente y consultor.

## Evidencia y límites

Casos finales:

- `a16_texto_sobre_imagen:real-store-runtime-2026-11-06-product-coordinates-v7`
- `a16_texto_sobre_imagen:real-store-runtime-2026-11-06-abstract-coordinates-v7`

Doce salidas completadas (seis modelos por dos casos), validadas con `instagramOverlayDraftSchema`. Los ficheros, hashes, comparaciones y costes están en `.e-nora-test-lab/ai-models/` y `.e-nora-test-lab/a16-real-2026-11-06/`. No se usó Astra ni se hicieron llamadas pagadas a API. No se publicó contenido ni se modificó Producción. No se pudo hacer una inspección visual autenticada del navegador en esta sesión; se verifican datos de interfaz y respuestas HTTP.

### Verificación de acceso al borrador

El primer chequeo encontró que el listado dependía de la política RLS de usuario y devolvía cero piezas para el consultor, aunque el acceso de aplicación a la organización era válido. El listado ahora usa el cliente de servicio solo después de comprobar membresía y filtra por las tiendas permitidas del usuario. El chequeo autenticado del 06/11/2026 confirma que cliente y consultor ven el mismo borrador `9322f8db-08ce-4d13-9039-8e548e488b34`, con sus dos bloques, y que la ruta del editor responde HTTP 200. Es un borrador de TEST, no publicado.
