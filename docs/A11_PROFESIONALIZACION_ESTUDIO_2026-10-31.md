# A11 · profesionalizar antes de comparar modelos

Estado: diseño del flujo, pendiente de implementar y validar. El propietario solicita detener la comparación aislada de modelos para mejorar originalidad, composición e imágenes. A09 se considera revisado; no se reabre.

## Evidencia del código revisado

- `runMarketingContentDraft` admite plantillas propias, diseño base, colores, textos literales e imágenes separadas por rol referencia/contenido.
- `buildMarketingTemplateProfile` extrae estructura, paleta, tipografía y CTA del HTML, sin análisis visual profundo ni medición de originalidad.
- Existe contrato de análisis visual de referencias (`marketing-playbook-visual.ts`), con layout, jerarquía, tipografía, CTA y límites.
- Existe biblioteca/editor de plantillas. Se debe reutilizar, evitando crear otro editor o repositorio desconectado.
- Las pruebas archivadas A11 de octubre usan Nube/Cuaderno Lino sintéticos. No sirven para elegir el modelo que mejor representa la tienda real.
- Las salidas de A11 para Meta/Instagram contienen copy e instrucciones creativas. Validar ese JSON no prueba que exista un creativo terminado o que se haya inspeccionado su calidad visual.

## Propuesta de flujo

1. **Referencias**: en el Estudio, subir capturas de emails/anuncios, identificar canal, intención y qué se quiere aprender. Guardar original y análisis visual una vez; corregible por humano. Una referencia no es una plantilla editable ni evidencia de rendimiento comercial.
2. **Contexto de marca/producto**: resolver la tienda seleccionada, contexto del negocio, productos/fotos/enlaces/precios y datos vigentes. Declarar datos ausentes; no sustituirlos por productos sintéticos ni inventar atributos.
3. **Conceptos**: proponer tres ángulos diferentes con justificación y referencia de producto. Seleccionar un concepto antes de gastar en todas las piezas finales. No confundir variaciones de titular con conceptos distintos.
4. **Composición**: emails con módulos editables, imágenes verificadas, jerarquía y adaptación móvil. Meta/Instagram con composición visual, producto, copy y exportación adaptada al formato. Generar/editar imágenes es un paso explícito y su coste se registra aparte del modelo de texto.
5. **Revisión renderizada**: comprobar legibilidad, recortes, coherencia de producto/imagen, enlaces, claims, voz y diferenciación respecto a referencias. Guardar defectos y versiones. Una revisión automática no garantiza originalidad ni rendimiento; el propietario revisa el resultado.
6. **Entrega**: solo borradores en Estudio de marketing de la cuenta TEST; compartidos con el consultor. Laboratorio IA conserva comparación/costes y decisión. No publicar ni enviar.

Plantillas = estructura técnica reutilizable y editable. Referencias = inspiración analizada. Se permite combinar patrones de referencias y proponer composiciones nuevas; no reproducir marcas/copy/composición literal por defecto ni exigir una única fórmula para toda campaña.

## Modelos y coste

Opus es candidato preferido por el propietario, no ganador medido. Comparar los seis modelos acordados, sin Astra, después de corregir contexto y flujo. Igual brief, producto y recursos; evaluar el resultado renderizado. El coste total por pieza incluye contexto/referencias no amortizadas, conceptos, composición, imagen/edición, revisión y reintentos. La amortización del análisis de referencias debe ser explícita; no asumir caché gratuita ni frecuencia mensual fija.

## Primer alcance propuesto

Una campaña de un producto real, un email y un anuncio Meta. Utilizar pocas referencias representativas antes de ampliar la biblioteca. Criterios: fidelidad al producto, claridad del ángulo, diferenciación, calidad visual y editabilidad. No se ha implementado todavía ni se ha cerrado A11 en esta fase.
