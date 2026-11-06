# A11 · comparación con productos de la cuenta de prueba

Fecha: 02/11/2026. Entorno: TEST, Prueba Borrego / E-NORA Demo, propietario borregorafa99@gmail.com y consultor rafael@noraapp.es. Estado: ejecuciones terminadas, revisión editorial guardada y acceso de las dos cuentas comprobado. Recomendación provisional; asignación de modelo sin modificar. Inspección visual del navegador bloqueada.

## Dónde verlo

Dentro de la cuenta, Marketing → Laboratorio de marketing: `http://localhost:3001/marketing?section=laboratorio`.

Filtros de email, Meta e Instagram y creación original/guiada. Tabla de seis modelos con coste API equivalente, duración CLI y confirmación del ID servido. Dos vistas A/B para comparar, email con vista adaptable o de 360 px, acceso al borrador editable, comprobaciones, revisión editorial, encargo/productos y respuestas rechazadas. Simulador mensual configurable: A11 genera al pedir una pieza, no al abrir cliente/consultor. Cuatro piezas es solo el ejemplo inicial del simulador, no un cron ni una frecuencia medida.

La comparación muestra la respuesta original conservada, aunque después se edite el borrador. El editor conserva su comportamiento y permisos. No se han programado ni enviado campañas.

## Entrada y protocolo

- Productos registrados en Shopify: The Collection Snowboard: Hydrogen, 600 EUR, y Selling Plans Ski Wax, 9,95 EUR. Fotografías y enlaces exactos del catálogo de la tienda; inventario no comprobado. No son los productos ficticios Cuaderno Lino/Nube de la tanda anterior.
- Perfil de marca real guardado: E-NORA, paleta y Arial, tono y restricciones. Histórico editorial normal y conclusiones aprobadas recientes de la misma tienda. El histórico excluye ahora borradores del laboratorio.
- Seis modelos: claude-haiku-5-5, claude-sonnet-5-5, claude-opus-5-5, gpt-6-luna, gpt-6.1-sol y gpt-6.1-terra. Sin Astra.
- Tres canales × dos métodos × seis modelos = 36 combinaciones finales. Una ejecución por combinación, sin reparar el copy, recortar respuestas o esconder el primer fallo de la tanda final.
- Contexto, prompt y contrato idénticos entre los seis modelos de cada caso. Dos imágenes transmitidas por canales visuales: bloques base64 en Claude y `--image` en Codex, con SHA-256 comprobados. Orden explícito tabla/cera, independiente del orden de retorno del RPC.
- Claude Code y Codex con autenticación CLI guardada, sin claves API de NORA en sus procesos, sin herramientas adicionales, configuración del usuario/proyecto desactivada y sin publicación. Es una simulación de generación con contexto precargado, no una prueba integral de herramientas o de facturación API.
- Respuestas originales, recibos, hashes, uso, costes y fallos conservados. Claude informa el ID servido; Codex JSONL no lo confirma y se etiqueta como solicitado, no verificado.

## Resultado final

35 respuestas pasan el contrato nativo y están guardadas como borradores, con snapshot de versión. Una respuesta de Opus para Instagram original devuelve un creative_brief de 2160 caracteres frente al límite de 2000: se conserva la respuesta íntegra y el error, sin presentarla como borrador válido.

| Modelo | Contratos válidos | API equivalente de sus seis pruebas, USD | Lectura editorial |
| --- | --- | --- | --- |
| Haiku | 6/6 | 0,0424–0,0483 | Ahorro y dirección concreta; revisar tono y lenguaje de Instagram |
| Sonnet | 6/6 | 0,4218–0,5285 | Buen desarrollo editorial; una afirmación de disponibilidad en Meta sin inventario verificado |
| Opus | 5/6 | 1,0715–1,2849 | Narración de email más desarrollada, mayor coste y un incumplimiento de longitud |
| Luna | 6/6 | 0,0214 | El más barato; afirmaciones de disponibilidad en texto plano/email y anuncios, propuesta más genérica |
| Sol | 6/6 | 0,5585 | Primer candidato provisional por copy preciso y fiabilidad; revisar el pie legal trasladado a Instagram |
| Terra | 6/6 | 0,1935 | Alternativa económica, más escueta; revisar «Disponible por…» en Instagram |

Pasar el contrato no equivale a tener una pieza lista para enviar ni un diseño visualmente superior. Los chequeos mecánicos examinan imágenes/enlaces, importes y copy principal/HTML/texto plano; no inventan una puntuación de diseño. Las etiquetas de disponibilidad se revisan editorialmente, porque la expresión puede ser ambigua. Todos los emails necesitan revisar mecanismo de baja, datos del remitente y configuración de envío. No se han medido aperturas, ventas ni conversión comercial.

Recomendación: Sol como primer candidato global, Sonnet como segundo candidato editorial y Opus como opción para un email más narrativo. No se cambia automáticamente el modelo ni el fallback: falta comparar visualmente las piezas con el propietario. Haiku y Terra siguen siendo candidatos económicos, no modelos descartados por categoría.

## Costes y límites

Tanda final: **2,3090–2,6349 USD de API equivalente**, incluyendo la respuesta rechazada. Pasadas anteriores conocidas: **4,5115–5,2895 USD**, conservadas en la sección de auditoría; seis intentos interrumpidos carecen de uso final completo. No sumarlos como si fueran un importe cobrado: se ejecutó con CLI y estos cálculos trasladan sus tokens a tarifas API. Incluyen sobrecarga/caché del CLI, que puede diferir de una llamada API de NORA. No hay medición mensual real ni coste de producción de imágenes/vídeo en esta tanda.

Tarifas estándar consultadas el 02/11/2026 en [OpenAI](https://developers.openai.com/api/docs/pricing) y [Anthropic](https://platform.claude.com/docs/en/about-claude/pricing); se usa el calculador existente `lab-price.ts`. La banda de Anthropic contempla la duración de escritura de caché no diferenciada por la medición disponible.

El contrato actual de Meta e Instagram entrega texto y dirección visual. **Ninguno produce un PNG terminado en este flujo.** La UI muestra fotos de origen y las instrucciones, y no construye a mano un diseño distinto atribuyéndoselo al modelo. El email sí contiene HTML original comparable. La revisión editorial se basa en texto, HTML, datos y contrato; la herramienta Computer Use detuvo Chrome porque no pudo verificar con seguridad la URL activa. No se ha realizado una inspección visual autenticada ni se declara un ganador definitivo de diseño.

Una tienda y dos productos no justifican extrapolar el resultado a todo el catálogo o a cualquier marca. El modo guiado utiliza principios internos seleccionados, no las capturas privadas ni el HTML de las trece referencias; no se ha certificado que mejore siempre al modo original.

## Fallos encontrados y correcciones

1. Preparación inicial: el RPC ordenaba los productos de otra forma y el brief numeraba sus fotos al revés. Tanda excluida; se ordenan por IDs seleccionados y se guardan ID/título/URL/hash de cada adjunto.
2. Contratos sociales: el JSON Schema omitía límites que Zod exigía al guardar, incluyendo tone, call_to_action y creative_brief. Alineados y cubiertos por regresión; Anthropic recibe las restricciones no admitidas como descripciones mediante el adaptador existente.
3. Creación de una pieza: el contexto enviaba variant_count=3 por defecto y algunos modelos entregaban tres anuncios en un campo. El contador solo se comunica para la tarea hooks. Corregido en el runtime y en el preparador.
4. Contaminación del histórico: los borradores del laboratorio podían entrar como historial editorial normal. Ahora se excluyen por request.ai_lab, manteniendo organización y conexión exactas.
5. Comparaciones persistentes: filtro labBatch sobre el endpoint existente, con límites y validación, para que las nuevas piezas de la cuenta no oculten la comparación por la paginación normal. Conserva permisos y aislamiento por tienda.
6. Precios desconocidos: la UI anterior asumía importes numéricos. Ahora muestra «No disponible» ante null.
7. Revisión: se examina también el texto plano del email; una afirmación de disponibilidad puede aparecer allí aunque no figure en el HTML. No se corrigen silenciosamente las respuestas comparadas.

Las rondas se conservan separadas: v1 excluida por preparación; v2 detectó cinco rechazos; v3 probó el contrato corregido; v4 es la comparación final con una sola pieza por petición e histórico sin borradores de laboratorio. Los doce emails de v2 se reutilizaron en v3 sin volver a cobrarlos en el sumatorio; v4 genera todas sus piezas nuevas. No se mezclan resultados de esas rondas para fabricar una tasa de éxito.

## Verificación y artefactos

14 pruebas focalizadas correctas para aislamiento/contexto/contador, assets, chequeos de salida, filtrado de comparaciones y límites comunicados; typecheck API/web y build de AI correctos. ESLint focalizado sin errores; el hook de borradores conserva una advertencia previa de dependencias y las fotos de catálogo usan sus URLs exactas.

Autenticación real de propietario y consultor, sin cambiar roles: ambos reciben 35 borradores del batch final y el manifiesto de 36 combinaciones; versiones accesibles, labBatch malformado rechazado con 400 y otra organización denegada. Página HTTP 200. Verificación por API, no visual. No hay nuevas migraciones ni despliegue de producción.

Recibos privados en `.e-nora-test-lab/a11-real-2026-11-02-v4/`: `report.json`, `audit-evidence.json`, `draft-manifest.json`, `visibility-receipt.json`, esquemas y recibos CLI por caso/modelo. Otras rondas en sus directorios v1/v2/v3.

Scripts: `a11-real-model-comparison.mts`, `a11-audit-real-comparison.mts`, `a11-record-editorial-review.mts`, `a11-persist-real-comparison.mts` y `a11-verify-real-comparison.mts`. Persistir actualiza solo metadatos de revisión y preserva ediciones humanas, con control de versión concurrente. No repetir generación sobre el mismo batch para sustituir un fallo; crear otra ronda si se cambia el experimento.
