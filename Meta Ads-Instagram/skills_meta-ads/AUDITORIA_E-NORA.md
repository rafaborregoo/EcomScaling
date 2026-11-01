# Auditoría de las cinco skills de Meta Ads

Fecha: 31/10/2026. Alcance: leer las cinco skills y todos sus archivos auxiliares; valorar su utilidad para E-NORA. No se han instalado como skills activas ni integrado en agentes, ejecutado campañas o cambiado datos de tiendas.

## Resultado de la extracción

Cinco ZIP extraídos en esta misma carpeta, respetando las cinco carpetas originales. Nueve archivos extraídos y verificados por SHA-256 contra el contenido de sus ZIP antes de borrarlos. Quedan cero ZIP. `LEEME.md` se conserva como documento original; sus pasos para subir ZIP a Claude no describen el estado actual de esta carpeta ya descomprimida.

Los hashes de archivos/ZIP y el recibo de borrado están en `.e-nora-test-lab/skills-meta-ads/extraction-receipt.json`, en la raíz del proyecto. Los archivos originales extraídos no se han modificado.

## Veredicto

Ninguna de las cinco es completamente inútil. Ninguna debe conectarse sin adaptación al runtime de NORA. Son principalmente guías de conversación para una persona, no agentes completos con datos, permisos y contratos de salida.

| Skill | Decisión | Qué aporta | Qué no incorporar tal cual |
| --- | --- | --- | --- |
| Copywriter | Aprovechar con ajustes | Brief, tres ángulos, copy y guion por escenas | Plantilla persuasiva obligatoria, promesa de «listo para publicar», longitudes universales |
| Multiplicadora | Aprovechar como módulo de experimentos | Variantes de gancho, puente narrativo, nomenclatura | Diez variantes siempre, números de ejemplo sin fuente, umbrales de test como certeza |
| Diseñadora | Aprovechar método y referencias; rehacer base/renderer si se usan en servidor | Plan por pieza, formatos, PNG y revisión visual | HTML genérico como estilo por defecto y render sin validación/aislamiento |
| Espía | Reescribir el criterio de selección | Inventario de referencias, fechas, ángulos, procedencia | Antigüedad = rentabilidad, «ganadores» públicos, inferencias de presupuesto |
| Analista | Bloqueada para uso operativo directo | Preguntas de contexto, cálculos deterministas y tabla de propuestas | Parser actual, datos ausentes convertidos a cero y reglas automáticas de inversión |

## 1. Analista de Meta Ads

Archivos revisados: [SKILL.md](./analista-meta-ads/SKILL.md) y [analizar.py](./analista-meta-ads/scripts/analizar.py).

### Qué sirve

- Pedir o recuperar objetivo, valor por conversión y costes antes de interpretar resultados.
- Separar compras de leads y hacer explícita la tasa de cierre.
- Calcular métricas en código y entregar propuestas con motivo por anuncio.
- Advertir sobre atribución, retrasos y volumen insuficiente.

### Fallos concretos

1. **Dato desconocido convertido en cero.** `num()` (líneas 56–63) usa `errors="coerce"` y `fillna(0)`. Una compra no informada o ilegible se vuelve cero; la decisión (125–127) puede entonces recomendar APAGAR por supuesto gasto sin resultados. Debe conservarse el estado desconocido y su razón.
2. **Decimales europeos de más de dos posiciones.** El patrón `,\d{1,2}$` no reconoce `0,123`: la regla termina eliminando la coma y obtiene 123. Puede distorsionar CTR y otras tasas. `1.234` es ambiguo sin declarar locale: el parser lo interpreta como 1,234 decimal, no como miles.
3. **Monedas sin validar.** Solo retira el símbolo euro. Una celda `$123.45` termina como cero por conversión fallida. No verifica moneda común entre gasto, ingresos y CPA máximo.
4. **ROAS ausente presentado como cero.** Si falta valor de compra, asigna `Valor=0` (106) y después calcula ROAS (119). «No conocemos los ingresos» no significa «los ingresos fueron cero».
5. **Granularidad y evento ambiguos.** Acepta nombre de campaña o conjunto como si fuera nombre de anuncio; usa `Resultados` si faltan compras/leads. No verifica el tipo de resultado, ID del anuncio, desglose ni filas repetidas por día. No agrega por identidad y ventana antes de decidir.
6. **Entradas numéricas sin límites.** `--margen`, `--cierre`, `--colchon`, precio, CPA máximo y mínimo de resultados carecen de validación de rango. `--margen 60` no se rechaza aunque la interfaz documente proporción 0–1. No valida costes, conteos o ingresos negativos.
7. **Caso vacío sin protección.** Tras filtrar gasto positivo, se accede a `dec[0]`/`dec[1]` (136–137) sin tratar un conjunto vacío. Debe comprobarse con pandas antes de integrarlo; esta incidencia procede de lectura estática, no de una ejecución completa.
8. **Heurísticas presentadas como decisión suficiente.** Tres conversiones y CPA por debajo del 70 % no acreditan por sí solos que escalar sea adecuado. La función no recibe atribución, frescura, presupuesto, cambios recientes o calidad del tracking, aunque el Markdown pida considerarlos.
9. **Fatiga con poca evidencia.** Sin CTR disponible, basta frecuencia >3 para etiquetar «Posible». No existe comparación temporal, control por audiencia ni verificación de que el supuesto problema sea creativo.
10. **Modelo económico demasiado simplificado para NORA.** La fórmula ticket × margen es una aproximación bajo sus supuestos. Debe conectarse a la definición de ingresos/costes/contribución del producto y distinguir LTV, periodo, devoluciones y costes cubiertos. «CPA por debajo = rentable» no debe convertirse en una afirmación absoluta sobre el negocio.

También escribe un CSV `_resultado.csv` sin comprobar si existe. Acepta XLS además de XLSX, pero la instalación sugerida solo menciona `openpyxl`: la compatibilidad con XLS no queda garantizada. No hay manifiesto de dependencias, versiones fijadas ni tests propios.

**Aplicación en NORA:** aprovechar la intención para A14 y el módulo de métricas, reutilizando datos normalizados y cálculos del backend. Mantener las recomendaciones como propuestas revisables; no conectar estas etiquetas directamente a apagado o cambio de presupuesto. El script suministrado solo genera un informe local: actualmente no modifica Meta.

## 2. Copywriter de Meta Ads

Archivo revisado: [SKILL.md](./copywriter-meta-ads/SKILL.md).

### Qué sirve

- Brief compacto: producto, público, ángulo, destino, formato y prueba disponible.
- Tres ángulos diferentes, no simples reformulaciones del mismo titular.
- Guion con voz, texto en pantalla y escena/B-roll; útil como especificación de producción.
- Prohibición expresa de inventar testimonios, cifras y resultados.

### Qué adaptar

- En NORA se debe recuperar primero contexto de marca/tienda, catálogo, enlaces, campañas y restricciones. Preguntar solo lo que realmente falte; no volver a pedir datos ya disponibles.
- Un ángulo de la skill de competencia es una hipótesis, no un ganador ni evidencia para heredar sus promesas.
- Gancho → problema → agitación → solución → prueba → oferta → CTA es una opción editorial; no una estructura obligatoria para toda marca o anuncio.
- Longitudes de 125/40/30 caracteres se deben tratar como guías del pack, no como especificación universal o política verificada de todas las ubicaciones.
- Los ejemplos de resultado «en 14 días» solo son admisibles con respaldo. `[DATO REAL]` puede identificar un pendiente en borrador, pero debe bloquear la entrega final si no se sustituye o retira.
- Guion de 35 segundos no significa vídeo de 35 segundos medido. Hay que medir la locución/edición cuando se produzca.
- «Listo para publicar» debe convertirse en borrador estructurado: validación de claims, enlaces, formato y revisión humana antes de cualquier envío/publicación.

**Aplicación:** módulo editorial de A11, con los contratos de Meta/Instagram existentes y la misma entrada para los seis modelos. Produce copy y especificación de vídeo, no el vídeo por sí sola.

## 3. Multiplicadora de creatividades

Archivo revisado: [SKILL.md](./multiplicadora-creatividades/SKILL.md).

### Qué sirve

- Comprobar que cuerpo y CTA funcionan con distintos inicios; proponer una frase puente si hace falta.
- Variar argumento inicial y plano, no solo palabras.
- Mantener trazabilidad por producto, ángulo, hook, formato y fecha.
- Separar el interés inicial de la conversión final.

### Qué adaptar

- Diez variantes no deben ser una cuota fija: elegir cantidad según diversidad útil, capacidad de producción y presupuesto de prueba.
- «El error que comete el 90 %» es un ejemplo peligroso sin una fuente. La restricción de no inventar datos tiene que aplicarse a todos los tipos de gancho, no solo a la fila «Dato/cifra».
- Resultado, comparación y antes/después no están disponibles para cualquier producto; omitirlos o reformularlos cuando falte evidencia.
- 8–12 palabras en tres segundos es una aproximación, no una duración garantizada. Medir cuando exista grabación.
- Cambiar solo el hook ayuda a comparar, pero una entrega desigual de anuncios o diferencias de audiencia/tiempo impiden atribuir causalidad automáticamente. Registrar si es comparación observacional o experimento controlado.
- 48–72 horas, una vez el CPA y hook rate >25–30 % son heurísticas del pack. No garantizan muestra suficiente ni justifican apagar/escalar sin contexto.
- «Más creatividades» no garantiza menor CPA. Además de resultados, debe medirse diversidad real y coste de producción.

**Aplicación:** subproceso de variantes/experimentos dentro de A11. Mantener cada propuesta y su parentesco con el original; no crear un agente periódico adicional por defecto.

## 4. Diseñadora de creatividades

Revisados los cuatro archivos: [SKILL.md](./disenadora-creatividades/SKILL.md), [formatos.md](./disenadora-creatividades/references/formatos.md), [base.html](./disenadora-creatividades/assets/base.html) y [render.py](./disenadora-creatividades/scripts/render.py).

### Qué sirve

- Plan por pieza, mensaje, formato y tamaño.
- Separación de estáticos y slides de carrusel; una idea por slide.
- Uso de fotos y branding reales y obligación de abrir los PNG para revisarlos.
- Exportación visual concreta, en lugar de confundir un brief con un creativo terminado.

### Qué no sirve tal cual

1. `base.html` ofrece un único estilo fijo morado, degradado, tipografías y logo de marcador. Puede servir como prueba técnica; no como motor creativo profesional ni estética común para todas las marcas.
2. El HTML tiene `overflow:hidden`. Un screenshot puede existir con contenido recortado; el renderer no comprueba desbordamiento, solapes, legibilidad, contraste, imágenes fallidas ni completitud de la pieza.
3. `size_of()` interpreta solo una forma concreta de la etiqueta meta. Con los mismos atributos reordenados devuelve el tamaño por defecto. No valida dimensiones positivas ni máximas.
4. La propia skill indica cambiar tanto meta como CSS: eso es correcto. El renderer, sin embargo, no verifica que ambos coincidan; una discrepancia puede producir recorte o espacio sobrante.
5. `networkidle` y 300 ms no verifican explícitamente `document.fonts.ready` ni que cada imagen haya cargado. Google Fonts añade una dependencia de red no fijada.
6. Para un servicio multiusuario, abrir HTML con scripts y red sin restricciones requiere otro diseño: aislamiento de trabajos, límites de recursos, URLs autorizadas, control de navegación y salidas acotadas. No se ha encontrado código malicioso en estos archivos; es una carencia para aceptar contenido de terceros en servidor.
7. Sobrescribe PNG homónimos y el ZIP de salida. Faltan versionado, procedencia de recursos, modelo utilizado, coste y separación por organización.
8. «Un anuncio que lleva seis meses activo… vende», incluido en `formatos.md`, repite la inferencia no justificada de la espía. No debe llegar al copy final como hecho.
9. Los tamaños, zonas seguras y porcentaje de texto se deben validar para cada ubicación antes de producir. Este pack no acredita por sí mismo compatibilidad actual con todas las ubicaciones.

El estilo «publicación genérica» y la nota pueden aprovecharse sin copiar interfaces. Un testimonio requiere, además de texto real, una representación fiel de su valoración; no añadir cinco estrellas automáticamente. Ganar en vídeo tampoco prueba que el mismo mensaje gane como estático: es otra hipótesis de formato.

**Aplicación:** aprovechar proceso y formatos en A11/A15/A16, con revisión visual y recursos de marca. Reutilizar el Estudio, assets y contratos de NORA. Los lienzos publicitarios de tamaño fijo no sustituyen el renderer de emails responsive ni convierten directamente nuestras 13 plantillas largas en anuncios.

## 5. Espía de competencia

Archivo revisado: [SKILL.md](./espia-competencia-meta-ads/SKILL.md).

### Qué sirve

- Registrar país, fecha de observación, enlace de origen y qué información es visible.
- Descomponer gancho, ángulo, estructura, formato y CTA.
- Declarar la muestra y adaptar ideas a la empresa en vez de copiar un anuncio.

### Qué corregir antes de utilizar

- **Un anuncio antiguo activo no demuestra rentabilidad.** El pack afirma «casi siempre rentable» sin datos de conversión, costes o beneficio del anunciante. Sustituir «ganadores» por «referencias observadas» y «por qué funciona» por «hipótesis de por qué podría ser útil».
- Fecha de inicio + activo hoy no acredita actividad continua sin pausas ni una inversión concreta.
- Duplicados, variantes o versiones nuevas no prueban escalado. Tratarlo como patrón de iteración observado.
- No inferir gasto o irrelevancia únicamente de una banda de alcance. No descartar formatos o categorías sin atender al objetivo de la investigación.
- No inventar un hueco de mercado a partir de una muestra acotada. Expresar «no observado en esta muestra».
- El conector habilitado en esta sesión declara `ad_creative_body` y `ad_creative_link_title`; la afirmación del pack de que no da copy no debe ser una limitación impuesta. Usar los campos disponibles y marcar los ausentes. Esta comprobación procede de la declaración del conector, no de haber consultado anuncios de una cuenta.
- Ordenar siempre por antigüedad y producir diez ideas sesga el resultado. Incluir relevancia, evidencia y diversidad como criterios; la antigüedad es una señal descriptiva.

**Aplicación:** investigación de referencias para A11, con fuente y fecha. No necesita un agente adicional que se ejecute a diario. Sus datos no deben mezclarse con rendimiento real de la tienda.

## Solapamientos y encaje en E-NORA

La ventaja del pack está en el proceso, no en añadir cinco agentes nuevos:

1. Contexto verificado de empresa/tienda, marca, producto y campaña.
2. Referencias e hipótesis creativas, con incertidumbre y procedencia.
3. Conceptos y copy; variantes cuando tengan una finalidad de prueba.
4. Composición/render con assets reales o demostraciones claramente identificadas.
5. Revisión de pieza y evidencia; guardar borrador/versiones en la UI correspondiente.
6. Análisis de resultados con datos y cálculos normalizados; el feedback informa el siguiente brief.

A11 cubre creación; A15/A16 aportan lectura/preparación visual y A14 la revisión operativa de publicidad. El perfil de marca existente (`apps/api/src/marketing-brand-profile.ts`) ya contempla paleta, fuentes, voz, vocabulario, textos obligatorios y restricciones de claims. No debe volver a pedirse todo en cada paso.

Las cinco descripciones «Úsala SIEMPRE» se solapan. Si se instalan sin un enrutamiento explícito, pueden introducir instrucciones y salidas redundantes. Reemplazar el encadenado conversacional por entradas/salidas acotadas, activadas según el trabajo. No ejecutar todos los módulos para cada borrador.

Estos archivos no incluyen aislamiento por tienda/organización, permisos de herramientas, contratos JSON de NORA, registro de costes, trazas, aprobación ni pruebas de inyección. Las referencias externas y sus instrucciones deben seguir siendo datos no confiables. Añadir esos controles si se adaptan al producto; no asumir que ya existen por instalar una skill.

No hay `LICENSE`, historial de versiones o lockfile de dependencias dentro del pack. Se conserva su procedencia indicada en `LEEME.md`. Esto es un inventario del contenido disponible, no una afirmación de autorización de redistribución.

## Comprobaciones realizadas y límites

- Lectura individual de los cinco SKILL.md, ambos Python, HTML, referencia de formatos y LEEME.
- Extracción íntegra de nueve archivos, hashes coincidentes y cero ZIP restantes.
- Ambos scripts Python pasan el análisis sintáctico AST con Python 3.12 ya instalado.
- Ejecutadas únicamente definiciones puras revisadas: selección de nombre de campaña como nombre, decisiones por umbral y lectura de tamaño de render. Confirmados tamaño reordenado → 1080×1350 y dimensiones 999999×999999 aceptadas por el parser.
- Reproducción escalar de las reglas numéricas: `0,123` → 123, `—` → 0, `$123.45` → 0. **No es ejecución con pandas**; se distingue en el recibo.
- No se instalaron pandas, numpy, Playwright, openpyxl o tabulate. El Python comprobado no los tiene disponibles; no se ejecutó el CLI completo del analista ni el renderer original. No se consultaron cuentas ni anuncios de Meta.
- Evidencia: `.e-nora-test-lab/skills-meta-ads/probe-results.json` y `probe.py`. Los archivos extraídos permanecen sin cambios para comparación posterior.

## Prioridad propuesta

**Primero:** adaptar brief, conceptos, variantes y criterios visuales a A11, incorporando marca/producto reales y las 13 referencias ya preparadas. Mantener creación desde cero y adaptación guiada como pruebas separadas.

**Después:** corregir investigación de competencia y cualquier cálculo que se quiera reutilizar. No usar las recomendaciones de inversión ni el renderer como servicios de producción hasta cerrar sus problemas de datos, validación y contexto.

Esta auditoría no instala las skills ni cambia la configuración de agentes. La comparación de modelos continúa pendiente.
