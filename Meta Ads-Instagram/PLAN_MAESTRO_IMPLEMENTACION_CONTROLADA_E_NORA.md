# Plan maestro de implementación controlada — e-NORA

**Fecha:** 31 de octubre de 2026, Europe/Madrid.  
**Versión del documento:** 1.0.  
**Estado:** propuesta de implementación basada en la revisión local; pendiente de validar el entorno desplegado.  
**Responsable de decisión:** dirección de producto/CTO; cada fase requiere un responsable técnico y un consultor revisor designados.  
**Alcance de esta entrega:** documentación del plan. Crear este archivo no activa agentes, modifica sus prompts, ingiere conocimiento, ejecuta migraciones ni cambia campañas.

## 1. Resultado que queremos conseguir

Convertir los materiales revisados en un proceso de consultoría que explique al cliente qué ocurre, con qué evidencia lo sabemos, qué conviene hacer primero, quién lo hará y cómo revisaremos el resultado. El valor debe verse en decisiones mejor fundamentadas, menos trabajo manual y seguimiento de las acciones; cualquier mejora de ventas o rentabilidad deberá medirse después, sin prometerla por añadir IA.

La primera inversión debe conectar y reforzar los agentes existentes. Añadir un agente tendrá sentido cuando exista una responsabilidad distinta, fuentes disponibles, un consumidor dentro del producto y evidencia de que ampliar un componente actual resulta insuficiente.

El recorrido propuesto es: **calidad del dato → diagnóstico económico y creativo → propuesta revisable → plan/tarea → ejecución autorizada → resultado observado → aprendizaje acotado al cliente**.

## 2. Alcance, fuentes y límites de la evidencia

### 2.1 Materiales incluidos

| Fuente | Aporte que se pretende aprovechar | Tratamiento |
|---|---|---|
| [V1: conocimiento de auditoría](ENORA_MetaAds_Conocimiento_Auditoria/README.md) | Medición, atribución, rentabilidad, diagnóstico y límites de recomendaciones | Fusionar lo útil con conocimiento y contratos canónicos; retirar afirmaciones sin soporte |
| [V2: presupuesto reducido](ENORA_MetaAds_Presupuesto_Reducido_Auditoria_V2/README.md) | Decidir con poca señal, incertidumbre, cadencia, caja y cohortes | Ampliar criterios de decisión y evaluación de agentes existentes |
| [V3: estrategia creativa](ENORA_MetaAds_Estrategia_Creativa_Auditoria_V3/README.md) | Investigación, objeciones, personas hipotéticas, taxonomía, briefs y aprendizaje creativo | Diseñar una ampliación gradual de A23 y del flujo consultivo, condicionada a datos |
| [Prompt final maestro de auditoría](ENORA_MetaAds_Conocimiento_Auditoria/PROMPT_FINAL_MAESTRO_AUDITORIA.md) | Alcance y reglas comunes de la revisión | Referencia de auditoría; este plan concreta una ejecución futura |

Se cubren **30 módulos**: 10 de V1 contando GAP-VIDEO, 9 de V2 y 11 de V3. También se cubren las diez áreas transversales y las 27 entradas del catálogo de evaluación de agentes.

Se ha localizado [V4: ideas ganadoras](ENORA_MetaAds_Ideas_Ganadoras_Auditoria_V4/README.md). En esta entrega solo se ha consultado su README. Su transcripción, diez fichas, contratos y prompt necesitan una revisión completa antes de incorporar conclusiones. Queda como entrada pendiente en IMP-12; no se presenta como material ya auditado.

Las transcripciones de los vídeos no tienen publicación o URL verificada en esta revisión. Sus ejemplos y promociones no demuestran rendimiento ni actualidad técnica. Holo, cursos/comunidades y Storyblocks no se convierten en recomendaciones de proveedores.

### 2.2 Cómo interpretar los estados

- **EN_CODIGO:** se ha localizado una implementación o declaración en el árbol de trabajo. No acredita despliegue, activación por organización ni disponibilidad real de datos.
- **PARCIAL:** hay piezas reutilizables, pero falta acreditar una parte del flujo, datos o consumidor necesario.
- **CANDIDATO_DOCUMENTAL:** diseño encontrado en los paquetes; todavía no acredita implementación.
- **PENDIENTE_CONTRASTE:** no hay evidencia suficiente en esta revisión para decidir si falta o ya existe con otro nombre.
- **PROPUESTA:** cambio futuro sujeto a los controles del plan.
- **NO_VERIFICABLE_PRODUCCION:** exige comprobar configuración, base de datos, conectores o despliegue.

La revisión global del software es orientativa por arquitectura y por los componentes inspeccionados. No es una certificación de todas sus rutas, permisos o cálculos. Antes de abrir tickets que creen tablas, contratos, motores o herramientas, hay que buscar el destino canónico y documentar por qué no basta ampliarlo.

### 2.3 Estado del repositorio

En la comprobación previa a crear este documento, `git status --short` devolvió **935 entradas** modificadas o sin seguimiento. La revisión anterior había contado 933; no se atribuye esa diferencia a este trabajo. El grafo también mostró posiciones de código distintas a las del árbol actual, por lo que las referencias importantes se contrastaron en los archivos actuales.

Hay archivos de migración con fechas posteriores al 31/10/2026. El nombre del archivo y su presencia no prueban ejecución. La fase IMP-00 debe identificar las migraciones efectivamente aplicadas y las versiones activas de agentes/prompts. No se ha consultado producción ni se han ejecutado pruebas como parte de esta entrega documental.

## 3. Base existente y evidencia de referencia

Las líneas corresponden a la lectura local del 31/10/2026 y pueden desplazarse con cambios concurrentes. Deben volver a localizarse al implementar.

| Ref. | Evidencia local | Qué permite reutilizar | Qué falta verificar |
|---|---|---|---|
| E01 | [agent-eval-catalog.ts](../packages/ai/src/agent-eval-catalog.ts), línea 2 | Catálogo de 27 entradas para evaluación de agentes | Activación, versión, permisos y presencia efectiva en cada flujo |
| E02 | [ai-runtime.ts](../apps/api/src/ai-runtime.ts), línea 1923, `buildAgentTools` | Declaración de herramientas con autorización, contexto de organización/tienda y recibos de llamadas | Políticas efectivas desplegadas y controles en cada ejecutor |
| E03 | [ai-runtime.ts](../apps/api/src/ai-runtime.ts), línea 16738, `runCreatividadMetaAgent` | A23 recibe rendimiento, rankings, contexto financiero, evidencia visual limitada y veredicto de medición | RPCs aplicadas, cobertura real, versiones activas y experiencia del usuario |
| E04 | [meta-measurement-verdict.ts](../apps/api/src/meta-measurement-verdict.ts), línea 58 | Veredicto determinista de medición con estados, razones, cobertura y límites | Coherencia del comportamiento desplegado con datos reales y vigencia de políticas |
| E05 | [ai-runtime.ts](../apps/api/src/ai-runtime.ts), líneas 16004, 17841 y 18091 | Entradas de A14 Operativa Meta, A24 Medición y A25 Cambios | Recorrido completo hasta interfaz, aprobaciones y resultados |
| E06 | [consultant-specialist-context.ts](../apps/api/src/consultant-specialist-context.ts), líneas 3 y 442 | Resúmenes por tienda, organización, frescura, estado y procedencia | Qué consumidores usan cada opción y cómo se indica análisis pendiente de revisión |
| E07 | [knowledge.ts](../apps/api/src/knowledge.ts), líneas 205, 386 y 704 | Creación, actualización y búsqueda de conocimiento | Inventario RAG desplegado, duplicados y RPCs efectivamente disponibles |
| E08 | [shopify-product-costs.ts](../apps/api/src/shopify-product-costs.ts), líneas 44 y 336 | Consulta e importación de costes de producto | Cobertura por tienda, antigüedad y conciliación con el cálculo financiero |
| E09 | [tool-layer.ts](../packages/ai/src/tool-layer.ts), líneas 287–299 | Descripciones de catálogo de producto, margen, creatividades, entrega, gasto y cambios | Estado de cada herramienta en registro, allowlist por agente y acceso efectivo |
| E10 | [tool-layer.ts](../packages/ai/src/tool-layer.ts), líneas 322, 323 y 326 | Calendario, pipeline de email e informe PDF con paso de previsualización | Disponibilidad por rol, exactitud de datos y recorrido de entrega del informe |
| E11 | [agent-release-admin.ts](../apps/api/src/agent-release-admin.ts), líneas 166 y 174; [agent-eval-readiness.ts](../apps/api/src/agent-eval-readiness.ts) | Evaluación y promoción de versiones; comprobaciones de preparación | Requisitos de la RPC de promoción, evidencia persistida y calibración vigente |
| E12 | [ai-agent-groups.ts](../apps/api/src/ai-agent-groups.ts), línea 8 | Agrupación de parte de los agentes automáticos por configuración de organización | Correspondencia entre catálogo, automatismos, controles visibles y activación |
| E13 | [ai-runtime.ts](../apps/api/src/ai-runtime.ts), líneas 9006, 13452, 14382 y 14693 | Arquitecto del Camino, stock, analista email y arquitecto de flujos | Datos de entrada, salida aprobable y uso por el cliente en cada caso |

La descripción de una herramienta acredita su contrato declarado. Su disponibilidad depende además del registro, la versión activa del agente, sus permisos y los conectores. La implementación debe verificar esos cuatro puntos juntos.

Un detalle relevante de A23: el código actual indica que la evidencia es descriptiva y no autoriza ordenar retiradas ni escalado. Una miniatura de vídeo permite comentar el fotograma visible; no permite inferir montaje, movimiento, ritmo o el gancho del primer segundo. Estas restricciones deben conservarse al ampliar el agente.

## 4. Encaje con todos los agentes del catálogo

La existencia de cada identificador está respaldada por E01. La tabla define su encaje propuesto; no afirma que se haya auditado exhaustivamente cada implementación. Antes de ampliar un agente se revisarán su prompt activo, contrato, presupuesto de ejecución y herramientas.

| Agente | Uso en este plan | Cambio recomendado y límite |
|---|---|---|
| A01 `a01_analista_llamadas` | Recoger objetivos, restricciones, decisiones y objeciones expresadas en consultoría | Enlazar acuerdos con evidencia y tareas; una opinión del cliente no se convierte en hecho demostrado |
| A02 `a02_monitor_negocio` | Detectar qué merece atención y resumir el estado | Consumir resultados y calidad del dato; evitar repetir el análisis completo de cada especialista |
| A04 `a04_generador_tareas` | Convertir propuestas revisables en trabajo con entregable | Añadir criterios de finalización, dependencia y enlace a decisión; deduplicar por identidad, no solo por título |
| A05 `a05_estrategia_campanas` | Coordinar objetivos, oferta y calendario | Relacionar briefs y experimentos; planificación comercial no equivale a publicación externa |
| A06 `a06_planificador_stock` | Comprobar viabilidad de ofertas y demanda | Usar cobertura y escenarios observados; no inventar plazos de proveedor o cantidades de compra |
| A08 `a08_gestor_conocimiento` | Señalar conocimiento útil, huecos y revisiones | Apoyar curación/versionado; promover contenido requiere el flujo de revisión correspondiente |
| A09 `a09_copiloto_consultor` | Consultar datos, contrastar especialistas y preparar la conversación | Mostrar procedencia y limitaciones; mantener ámbito y audiencia de cada fuente |
| A11 `a11_generador_marketing` | Transformar un brief validado en borradores | Consumir promesa y pruebas aprobadas; no inventar beneficios o testimonios |
| A12 `a12_analista_email` | Contrastar resultados y medición del canal email | Mantener atribución de Klaviyo separada de ventas Shopify y atribución Meta |
| A13 `a13_operativa_shopify` | Revisar embudo y operación de la tienda | Conectar hipótesis publicitarias con evidencias de tienda; dato parcial no equivale a fallo confirmado |
| A14 `a14_operativa_meta` | Evaluar sostenibilidad económica del gasto | Reutilizar cálculo financiero canónico; bloquear conclusiones de beneficio si faltan costes o comparabilidad |
| A15 `a15_analista_imagenes` | Analizar imágenes realmente disponibles y autorizadas | Señalar exactamente qué activo se vio; no extrapolar una miniatura a un vídeo completo |
| A16 `a16_texto_sobre_imagen` | Preparar texto visual desde un brief y activo compatibles | Revisar legibilidad, claims y versión final; validar su implementación concreta antes de ampliar el flujo |
| A17 `a17_plan_semanal` | Elegir acciones semanales compatibles con el Camino y capacidad del cliente | Consumir análisis recientes y su estado de revisión; no tratar una propuesta pendiente como aprobada |
| A18 `a18_plan_mensual` | Organizar hipótesis, campañas y dependencias del mes | Ajustar al trabajo terminado, fuentes disponibles y restricciones económicas |
| A19 `a19_arquitecto_camino` | Convertir objetivos del cliente en fases e hitos | Usar diagnósticos y restricciones; conservar versión del plan y decisiones que justifican cambios |
| A19 `a19_revision_camino` | Revisar avance y pertinencia del plan | Diferenciar tarea completada, cambio ejecutado y resultado observado; no son el mismo evento |
| A20 `a20_retencion_clientes` | Analizar recompra y valor observado de cohortes | Separar ingreso LTV, contribución acumulada, maduración y proyección |
| A21 `a21_adquisicion_shopify` | Contrastar adquisición con clientes nuevos y señales de tienda | Usar definiciones consistentes de CAC y fuente; no sustituir causalidad por atribución |
| A22 `a22_postventa_shopify` | Revisar fricciones posteriores a compra que afecten a promesa y contribución | Trabajar con motivos y cobertura disponibles; no atribuir culpas sin evidencia |
| A23 `a23_creatividad_meta` | Analizar creatividades observadas y proponer hipótesis/briefs trazables | Ampliar por módulos: taxonomía, investigación validada y experimentos; preservar límites de evidencia descriptiva |
| A24 `a24_medicion_meta` | Aportar veredicto de medición por ámbito y periodo | Reutilizar el motor determinista E04; el modelo explica sus resultados y no puede elevar la fiabilidad por su cuenta |
| A25 `a25_cambios_meta` | Investigar cambios y posibles interferencias durante una prueba | Registrar concurrencia, comparabilidad y maduración; comparación antes/después no acredita causalidad |
| A26 `a26_contenido_email` | Adaptar objeciones y mensajes aprobados al email | Compartir aprendizaje dentro del mismo ámbito, conservando contexto y límites del canal |
| A27 `a27_planificador_mailing` | Coordinar calendario, borradores y estado de envío | Consultar pipeline real; fecha planificada no prueba envío ni consentimiento |
| A28 `a28_arquitecto_flujos` | Trasladar necesidades y recompra observada a propuestas de flujos | Validar inventario/cobertura Klaviyo; no crear o enviar automáticamente por este plan |
| A29 `a29_analista_metrica` | Investigar una métrica y explicar definición, variación y calidad | Ampliar criterios de poca señal sin duplicar cálculos o declaraciones de ganadores |

No se asume que un mismo control de configuración habilite o deshabilite todas estas entradas. E12 debe contrastarse con el orquestador, los disparadores y la interfaz; cualquier diferencia se registra como incidencia antes de prometer control completo al cliente.

## 5. Arquitectura propuesta y reparto de responsabilidades

```text
Meta / Shopify / Klaviyo / fuentes de investigación autorizadas
                     ↓
Sincronización existente + ámbito + estado de cobertura/frescura
                     ↓
Cálculos y políticas deterministas del backend
          ↙                              ↘
Veredicto de medición               Economía y restricciones
          ↘                              ↙
Especialistas + conocimiento aprobado y versionado
                     ↓
Decisión trazable / brief / propuesta de tarea
                     ↓
Revisión del consultor → Camino, calendario y tareas
                     ↓
Ejecución autorizada y registrada, si corresponde
                     ↓
Resultado observado → evaluación → aprendizaje del mismo cliente
```

Los conectores obtienen datos y expresan sus límites. Los cálculos financieros, permisos y bloqueos viven en componentes deterministas. Los agentes interpretan evidencia y preparan propuestas. El consultor revisa lo que requiere criterio profesional. Los ejecutores externos verifican otra vez autorización, ámbito e identidad de la acción.

El plan no requiere crear otro runtime. Buscar primero contratos compartidos en `packages/contracts`, registro y herramientas en `packages/ai`, implementación/API en `apps/api`, consumidores en `apps/web` y trabajos existentes en `apps/worker`. Evitar concentrar nuevos subsistemas completos en el archivo `ai-runtime.ts`.

### 5.1 Disponibilidad por capacidad

No usar un único semáforo para bloquear toda la consultoría. Determinar qué afirmaciones son posibles según la evidencia:

| Capacidad | Condición mínima | Comportamiento si falla |
|---|---|---|
| Interpretar conversiones atribuidas de Meta | Ámbito definido, fuente utilizable, ventana y veredicto vigente | Describir la limitación y permitir investigación de medición; no proponer escalado a partir de conversiones no evaluables |
| Evaluar contribución | Ventas/costes comparables y cobertura suficiente para la afirmación | Mostrar qué falta; si se calcula un subtotal parcial debe identificarse como parcial |
| Analizar contenido visual | Activo importado/autorizado, identidad, tipo y ámbito validados | Usar solo texto y métricas disponibles; no describir imágenes o vídeos que no se han visto |
| Investigar necesidades y objeciones | Fuente autorizada, muestra y procedencia conocidas | Permitir hipótesis manuales etiquetadas; no presentarlas como voz medida de compradores |
| Crear un brief | Producto, promesa verificable, objetivo, evidencia e incertidumbre | Solicitar el dato específico faltante o generar un borrador limitado, según el caso |
| Evaluar un experimento | Diseño, métrica, asignación, maduración y cambios documentados | Resultado inconcluso o descriptivo; no forzar un ganador |
| Ejecutar un cambio externo | Herramienta implementada, permisos y aprobación válida para acción concreta | Conservar propuesta y explicación; ninguna ejecución implícita |

## 6. Matriz de los 30 módulos revisados

Los destinos indicados son responsabilidades funcionales. La fase IMP-00 debe confirmar el archivo/contrato canónico concreto antes de editar. `PARCIAL` se refiere al encaje de lo revisado; no acredita disponibilidad en producción.

### 6.1 V1: fundamentos, diagnóstico y economía

| ID | Estado y referencia | Destino / decisión | Implementación mínima y aceptación |
|---|---|---|---|
| META-001 | PARCIAL; conexión, ámbito y autorización observados en E02/E03 | Reutilizar integración y diagnóstico A24 | Ficha de activos/cuentas y permisos verificables; una cuenta no autorizada queda excluida y un permiso ausente se muestra como tal |
| META-002 | EN_CODIGO parcial en despliegue; E04/E05 | Ampliar A24 y su motor determinista | Unificar cobertura, frescura, evento optimizado y limitaciones; fallo de consulta nunca se convierte en cero o medición sana |
| META-003 | PARCIAL; contexto de Meta en E03/E05 | Ampliar A14/A24/A25 según pregunta | Describir estructura/objetivo real; recomendar consolidación solo tras comprobar restricciones de objetivo, tienda, país y oferta |
| META-004 | PARCIAL; herramientas de embudo/margen en E09 | Reutilizar A13/A21 y consulta A09 | Comparaciones por periodo/fuente; cobertura incompleta impide concluir que existe una caída de conversión |
| ECO-001 | PARCIAL; E03/E08/E09 | Reutilizar motor financiero y A14 | Definiciones de ROAS/CPA/CAC/contribución y moneda explícitas; cifras del agente concilian con cálculo canónico |
| META-005 | EN_CODIGO en A23; E03/E09 | Ampliar A23 | Añadir hipótesis y briefs sin perder identidad anuncio/creativo/activo; ranking o CTR aislados no justifican retirada automática |
| META-006 | PARCIAL; A14/A25 en E05 | Ampliar política de decisión y experimentos | Cadencia dependiente de señal, maduración y riesgo; no usar aumentos porcentuales o días del vídeo como reglas universales |
| META-007 | EN_CODIGO parcial en entorno; E04/E05/E09 | Reutilizar A24 e incidencias existentes | Incidencia distingue rechazo, ausencia de entrega, permiso, sincronización y desconocido; tarea enlazada a evidencia |
| META-008 | PARCIAL; E02/E11 | Reutilizar autorización, evaluación y límites de agentes | Cada capacidad declara herramientas, efectos, coste y aprobación; texto externo se trata como dato, no como instrucción |
| GAP-VIDEO | CANDIDATO_DOCUMENTAL; sin acreditación de producción audiovisual integral | No indexar como manual; posponer producción | Mantener separados métricas de vídeo, miniaturas, inspección audiovisual real y generación; evaluar módulo opcional en IMP-11 |

### 6.2 V2: decisiones con presupuesto reducido

| ID | Estado y referencia | Destino / decisión | Implementación mínima y aceptación |
|---|---|---|---|
| META-SB-001 | CANDIDATO_DOCUMENTAL sobre base A14/A23 | Fusionar con META-006 y política de experimento | Presupuesto contextualizado por objetivo, coste esperado y riesgo aprobado; no etiquetar viabilidad solo por gasto mensual |
| META-SB-002 | PARCIAL; aprendizaje/cambios en E04/E05/E09 | Ampliar A24/A25 y revisión de experimento | Distinguir alerta urgente, monitorización y decisión estratégica; no afirmar reset de aprendizaje por cualquier cambio |
| META-SB-003 | CANDIDATO_DOCUMENTAL; suficiencia estadística por contrastar | Ampliar contrato A23/A29 y experimento | Expresar incertidumbre y diseño; observación descriptiva no recibe etiqueta de significación o ganador causal |
| META-SB-004 | CANDIDATO_DOCUMENTAL; perfiles/contexto reutilizables | Fusionar con META-CR-005 | Personas por necesidades como hipótesis; mensaje específico no implica targeting estrecho ni perfil sensible |
| META-SB-005 | PENDIENTE_CONTRASTE de fuente competitiva | Fusionar con META-CR-007 | Referencia competitiva con fuente/fecha/derechos; duración de un anuncio no demuestra rentabilidad |
| META-SB-006 | PARCIAL; objetivo configurado en contexto Meta | Ampliar A24/A14 y brief | Objetivo de negocio y objetivo Meta se mantienen distintos; no recomendar notoriedad o conversión solo por tamaño de presupuesto |
| META-SB-007 | PENDIENTE_CONTRASTE; E03 declara orgánico no medido en ese contexto | Fusionar con investigación creativa | Señal orgánica identificada como fuente separada; engagement no se presenta como ventas esperadas |
| META-SB-008 | CANDIDATO_DOCUMENTAL sobre estructura existente | Fusionar con META-003 | Inventario y motivos de separación antes de recomendar consolidar; sin cambio automático de campañas |
| ECO-SB-001 | PARCIAL; costes y herramientas de clientes/economía | Ampliar A14/A20/A21 | Separar CAC, ingreso LTV, contribución realizada, horizonte, payback y caja; costes incompletos mantienen la conclusión limitada |

### 6.3 V3: investigación y estrategia creativa

| ID | Estado y referencia | Destino / decisión | Implementación mínima y aceptación |
|---|---|---|---|
| META-CR-001 | PARCIAL; A23 y planes en E03/E13 | Ampliar A23 y A05 | Brief parte de objetivo y restricción económica; formato y gancho se justifican por una hipótesis |
| META-CR-002 | PARCIAL; catálogo/perfil de marca declarados en herramientas | Ampliar perfil/brief canónico | Promesa, beneficio y prueba con fuente; claims sin soporte se señalan y no se publican como hechos |
| META-CR-003 | PENDIENTE_CONTRASTE de fuentes multicanal | Crear capacidad de investigación solo si falta destino adecuado | Fuentes autorizadas, muestra y sesgos visibles; una ausencia de menciones no equivale a ausencia de objeción |
| META-CR-004 | PENDIENTE_CONTRASTE de reseñas/comentarios disponibles | Ampliar ingestión autorizada; A30 solo condicionado | Importar muestra controlada con procedencia y minimización; resumen trazable y borrado de derivados verificable |
| META-CR-005 | CANDIDATO_DOCUMENTAL | Fusionar con META-SB-004 | Necesidad/objeción y confianza explícitas; ninguna inferencia de salud, medicación o atributos sensibles individuales |
| META-CR-006 | CANDIDATO_DOCUMENTAL; clasificación vigente por contrastar | Ampliar contrato creativo versionado | Separar persona, ángulo, conciencia, concepto, formato, hook, objetivo y placement; permitir múltiples etiquetas y desconocido |
| META-CR-007 | PENDIENTE_CONTRASTE de herramienta/fuente | Fusionar con META-SB-005 | Extraer patrones abstractos; conservar enlace/fecha y no copiar piezas ni inventar ROAS de terceros |
| META-CR-008 | CANDIDATO_DOCUMENTAL sobre inventario A23 | Ampliar análisis de brechas | Distinguir ausencia observada, histórico incompleto y exclusión intencional; no llenar matrices por cuotas |
| META-CR-009 | PARCIAL; planes/calendario E10/E13 | Reutilizar A05/A17/A18/A19 | Briefs, responsables y dependencias ligados a tareas/calendario; roadmap creativo no impone cadencia de edición de campañas |
| META-CR-010 | CANDIDATO_DOCUMENTAL ilustrativo | No indexar como evidencia de éxito | Conservar solo ejemplos útiles etiquetados como hipotéticos; ninguna métrica o causalidad inventada para las marcas citadas |
| ECO-CR-001 | PARCIAL; catálogo, costes y stock E08/E09/E13 | Reutilizar A14/A06/A13/A20 | Evaluar oferta/bundle con costes, descuento, unidades, stock y devoluciones; aumento de AOV no implica mejora de contribución |

## 7. Diez áreas transversales

| Área | Trabajo propuesto | Control de aceptación | Prioridad / tareas |
|---|---|---|---|
| CONTRACT | Extender schemas compartidos y salidas actuales | Compatibilidad comprobada con consumidores antiguos; propuesta inválida no se materializa | P0/P1, IMP-03/05 |
| TAXONOMY | Definiciones creativas versionadas y mapeables | Clasificación revisable, desconocido permitido y sin mezclar etiquetas con hechos | P1, IMP-06 |
| CREATIVE_INTELLIGENCE | Unir investigación autorizada, brief e inventario | Cada insight remite a muestra y fuente; distinguir contenido no observado | P1/P2, IMP-06/09 |
| RUNTIME | Coordinar especialistas, dependencias y versiones | Sin duplicar orquestador; ejecución selectiva por fuentes y capacidad, con coste y timeout acotados | P0/P1, IMP-00/03/07 |
| EXPERIMENT | Registrar diseño, cambios, resultado y decisión | Un test no comparable termina como descriptivo o inconcluso; no genera ganador por defecto | P1, IMP-07 |
| GUARD | Reutilizar bloqueos deterministas y autorización | El modelo no eleva permisos, fiabilidad ni presupuestos; ejecutor vuelve a comprobarlos | P0, IMP-01/02/03 |
| PRIVACY | Minimizar fuentes, separar audiencias y borrar derivados | Casos entre organizaciones/tiendas/roles rechazados; borrado cubre chunks, embeddings y resúmenes vinculados | P0/P2, IMP-03/04/09 |
| DATA | Inventario de cobertura, frescura y comparabilidad | Un fallo, un null y un cero confirmado se mantienen distintos | P0, IMP-00/01/02 |
| LEARNING | Conservar aprendizajes aprobados por ámbito | Resultado observado no se promueve como regla causal universal; revisión y caducidad trazables | P1, IMP-07/08 |
| INGEST | Curar y fusionar conocimiento antes de indexar | Documento activo único por versión/ámbito definido; retirada y reversión verificables | P1, IMP-04 |

## 8. Herramientas: reutilización antes de ampliación

### 8.1 Herramientas localizadas que deben comprobarse en el entorno

| Familia | Nombres declarados/localizados | Consumidor principal y propósito |
|---|---|---|
| Conocimiento | `search_knowledge`, `get_knowledge_document` | Agentes autorizados/A09: metodología y documentos concretos con audiencia controlada |
| Meta | `meta_creative_health`, `meta_creative_diagnostics`, `meta_delivery_health`, `meta_spend_detail`, `meta_change_log` | A09 y especialistas según versión: preguntas de rendimiento, medición y cambios |
| Shopify | `shopify_margin_health`, `shopify_funnel_health`, `shopify_customer_health`, `shopify_demand_sources`, `get_shopify_product_catalog` | A09 y especialistas: tienda, economía, clientes y producto |
| Klaviyo | `klaviyo_email_content`, `klaviyo_measurement_health`, `klaviyo_performance_summary`, `klaviyo_entity_performance` | A09 y flujo email: contenido y resultados observados |
| Contexto consultivo | `get_brand_profile`, `get_strategic_plan`, `get_task_history`, `get_specialist_run_detail`, `get_campaign_calendar`, `get_email_campaign_pipeline` | Consultor y planificadores: reutilizar contexto y evitar propuestas desconectadas |
| Entregables | `generate_report` | A09/flujo autorizado: previsualizar cifras y generar PDF confirmado por backend |

Que una herramienta esté declarada no obliga a ofrecerla a todos los agentes. Los especialistas pueden recibir contexto preparado sin explorar tablas ni gastar turnos en descubrir el esquema. Mantener ese patrón cuando sea suficiente.

### 8.2 Capacidades nuevas candidatas

Los nombres siguientes son funcionales/provisionales. No son herramientas existentes ni una instrucción para crear otro registro.

| Capacidad candidata | Datos y condiciones | Consumidor / valor | Prioridad |
|---|---|---|---|
| Consultar fuentes autorizadas de voz del cliente | Carga manual o conector aprobado, procedencia, permisos, idioma, muestra y política de retención | A23 o A30 condicionado: objeciones y necesidades trazables | P2, después de IMP-03/09 |
| Consultar/etiquetar inventario creativo | Identidad y versión de anuncio/creativo/activo, periodo de asignación y clasificación revisable | A23/A15: diversidad y brechas reales | P1, IMP-06 |
| Crear/leer brief versionado | Producto, objetivo, promesa, prueba, hipótesis, fuentes y restricciones | A23/A11/A16/A26: producir desde el mismo acuerdo | P1, IMP-06 |
| Crear/consultar registro de experimento | Diseño, presupuesto autorizado, métrica, eventos, cambios y resultado | A25/A29/A17/A09: seguimiento y aprendizaje | P1, IMP-07 |
| Consultar referencias competitivas | Fuente autorizada o aportada por consultor, fecha y derechos; API/condiciones por verificar | A23/investigación: inspiración abstracta | P2, IMP-09 |
| Consultar señales orgánicas | Acceso y cobertura reales por verificar; separadas de métricas de pago | Investigación creativa: hipótesis de contenido | P2, IMP-09 |
| Inspeccionar vídeo seleccionado | Archivo autorizado, procesamiento limitado, coste y retención definidos | A23/A15: análisis de contenido realmente observado | P2 opcional, IMP-11 |

Antes de comprometer una integración externa: verificar documentación oficial actual, permisos, límites, coste y datos efectivamente retornados. Tener Shopify conectado no acredita reseñas; tener Meta conectado no acredita comentarios, orgánico ni acceso competitivo. No plantear scraping como solución automática.

## 9. Agentes adicionales: condiciones para crearlos

### A30 — Investigación de cliente y estrategia creativa, candidato

Su responsabilidad sería transformar fuentes autorizadas en insights, objeciones y oportunidades documentadas. No decide presupuestos ni declara rendimiento de anuncios. Se evaluará crear este agente si el módulo de investigación sobrecarga A23, necesita una cadencia distinta o tiene usuarios y entregables independientes.

Entrada: fuentes identificadas, alcance de consentimiento/uso, producto y pregunta de investigación. Salida: temas agregados, frecuencia dentro de la muestra, ejemplos minimizados permitidos, contradicciones, confianza, límites y posibles hipótesis. A23 consume únicamente los insights aprobados/revisables con su procedencia.

Condiciones: fuente disponible, controles IMP-03/09 aprobados, evaluación de fidelidad, coste acotado y comparación con resolver la tarea dentro del flujo actual. Sin esas condiciones se mantiene investigación manual asistida.

### Gestión de experimentos — capacidad antes que un A31

Primero implementar IMP-07 y reutilizar A25, A29, A17 y A09. Solo evaluar un agente independiente cuando haya un volumen de pruebas que justifique coordinación propia y se demuestre una mejora frente al flujo existente. El agente no sustituye el método estadístico ni decide por sí solo cuánto dinero arriesgar.

La revisión de calidad debe reutilizar evaluación, juez y feedback existentes (E11) antes de crear otro agente revisor. Los fallos se convierten en casos de evaluación y acciones de producto; un segundo modelo que opina no acredita por sí mismo la corrección.

## 10. Contratos y datos que deben quedar controlados

### 10.1 Contrato común de evidencia y decisión

Extender los schemas canónicos actuales; los nombres siguientes son una especificación conceptual y deben mapearse a los existentes.

| Grupo | Información mínima | Quién la fija o valida |
|---|---|---|
| Identidad | Organización, tienda, cuenta, anuncio/creativo/activo si corresponde | Backend desde contexto autorizado, nunca desde una afirmación libre del modelo |
| Tiempo y comparación | Inicio/fin, zona horaria, días completos, ventana de atribución, periodo de contraste | Backend y fuentes; rechazar o limitar comparaciones incompatibles |
| Procedencia | Fuente, ID, instante de sincronización/observación, versión de transformación y cobertura | Ingestión/cálculo; preservar al resumir para otros agentes |
| Observación | Métrica, valor, unidad, denominador y definición | Motor determinista; desconocido no se convierte en cero |
| Interpretación | Hipótesis, alternativas, incertidumbre y restricciones | Agente, revisable; no puede contradecir bloqueos de backend |
| Decisión | Monitorizar, investigar, proponer experimento, proponer cambio o evidencia insuficiente | Agente dentro de capacidades permitidas; validación del contrato |
| Seguimiento | Responsable, entregable, dependencia, criterio de cierre y momento/condición de reevaluación | Plan/tarea/consultor |
| Aprobación | Estado, actor, fecha, versión y alcance exacto de lo aprobado | Backend; aprobación antigua no se aplica a un payload modificado |
| Trazabilidad | Run, versión agente/prompt/contrato/política, fuentes y propuesta | Runtime; registros minimizados y acceso por rol |

La confianza verbal o numérica del modelo no concede permisos ni desbloquea una decisión. Si se utiliza una puntuación, se define su significado y se evalúa su calibración; evitar números de confianza sin método.

### 10.2 Contrato del brief creativo

Relacionar el brief con producto/oferta, objetivo de negocio, persona hipotética por necesidad, objeción, promesa y prueba aprobadas, ángulo, concepto, hook, formato, placement confirmado o propuesto, fuentes, límites, hipótesis y criterio de evaluación. Guardar versiones y aprobaciones.

Separar lo observado de lo propuesto. Una etiqueta de formato obtenida por IA necesita estado de revisión; un placement propuesto no se presenta como placement de rendimiento observado. No atribuir compras de un anuncio a cada uno de sus activos.

### 10.3 Registro del experimento y aprendizaje

Buscar primero entidades existentes de experimentos, playbooks, decisiones y resultados. Si no cubren la necesidad, extender el modelo con: hipótesis, brief/activo versionado, IDs de campaña/conjunto/anuncio, diseño y unidad de asignación, métrica primaria, métricas de protección, presupuesto autorizado, fechas/maduración, cambios concurrentes, fuente de resultado, comparabilidad, conclusión y aprobación.

Estados conceptuales: borrador → revisado → autorizado → en curso → pendiente de maduración → evaluado → aprendizaje revisado/archivado. Contemplar también detenido e inconcluso. Validar transiciones en servidor y conservar historial; reintentar una transición no debe duplicar tareas o resultados.

Un resultado descriptivo puede aportar aprendizaje sin recibir carácter causal. El aprendizaje conserva el ámbito del cliente, periodo, condiciones y fecha de revisión. Su promoción a metodología global exige revisión independiente de anonimización, derechos y generalización.

## 11. Reglas económicas y de poca señal

### 11.1 Definiciones económicas

Reutilizar cálculos deterministas existentes y documentar su definición antes de ampliarlos. Cada cifra debe señalar moneda, periodo, cobertura, impuestos incluidos/excluidos y si es observada, estimada o proyectada.

- **ROAS de Meta:** valor que Meta se atribuye dividido entre el gasto correspondiente, con su ventana. No es margen ni venta incremental.
- **CPA atribuido:** gasto dividido entre las conversiones atribuidas definidas. No equivale automáticamente al coste por cliente nuevo.
- **CAC combinado observado:** gasto de adquisición definido dividido entre clientes nuevos identificados para un ámbito/periodo coherentes. Declarar qué canales y costes entran; el cociente agregado no demuestra atribución causal.
- **Contribución antes de publicidad:** ventas netas según definición canónica menos costes variables incluidos. Indicar si faltan producto, comisiones, logística, devoluciones u otros componentes. No llamar beneficio neto a un subtotal.
- **Contribución después de publicidad:** contribución anterior menos gasto publicitario compatible; otros costes fijos siguen requiriendo tratamiento explícito.
- **ROAS de equilibrio:** solo calcular como inverso de la tasa de contribución previa a publicidad cuando las bases de ingresos, impuestos, costes y ámbito sean compatibles y la tasa sea positiva. Si no se cumple, explicar por qué ese umbral no es calculable o no es comparable al ROAS de plataforma.
- **LTV:** separar ingresos acumulados, contribución acumulada y proyección. Usar cohortes con seguimiento suficiente y cobertura conocida.
- **Payback:** primer horizonte observado en que la contribución acumulada comparable cubre el CAC definido, si la cobertura lo permite. No sustituye un análisis de cobros/pagos ni acredita caja disponible.

No sumar ingresos atribuidos de Meta y Klaviyo a ventas Shopify como fuentes independientes. No agregar divisas sin una política de conversión con fuente y fecha. Evitar duplicar componentes de bundles con el importe del pack. Si el coste solo está disponible como coste actual, identificar el límite antes de atribuir margen histórico exacto.

### 11.2 Política de decisión con poca señal

Separar monitorización operativa, alerta y decisión estratégica. Una incidencia confirmada de entrega puede requerir intervención rápida; elegir un creativo ganador exige evidencia distinta.

Evaluar volumen, gasto, variabilidad, maduración de conversiones, ciclo de compra, medición, cambios concurrentes y riesgo económico. Los criterios y sus versiones deben vivir en política validada y dejar razones de la decisión. No derivar automáticamente de los vídeos reglas de tres días, 7–10 días, 90 % de significación o subidas del 10–20 %.

El código actual de E04 contiene ventanas concretas para frescura/observación. Se inventariarán como políticas existentes, con su finalidad y pruebas; no se sustituyen por una cadencia supuestamente adaptativa sin demostrar qué decisión mejora y cómo se valida.

Cuando no hay señal suficiente, la salida útil es: qué sí se observó, qué interpretación sigue abierta, qué dato falta y qué condición permitirá reevaluar. La entrega desigual entre anuncios, un ranking de Meta o un antes/después no constituyen por sí solos un experimento aleatorizado.

## 12. Flujo de consultoría que verá el cliente

| Momento | Agentes y herramientas | Entregable visible | Cómo medir su utilidad |
|---|---|---|---|
| Incorporación del cliente | Contexto/permisos y cobertura; A09/A24; costes Shopify | Qué puede analizarse hoy y qué dato concreto falta | Tiempo hasta primer diagnóstico útil y número de bloqueos resueltos |
| Diagnóstico inicial | A24 → A14/A23; A25 cuando corresponda; A13/A21 para contraste | Hallazgos priorizados con fuente, periodo y limitación | Revisión factual del consultor y proporción de recomendaciones utilizables |
| Reunión de consultoría | A09 y A01 según flujo autorizado | Decisiones acordadas y preguntas pendientes | Tiempo de preparación y correcciones necesarias |
| Plan semanal | A17/A04 con Camino y análisis recientes | Acciones con responsable, entregable y criterio de cierre | Duplicados, tareas aceptadas y cumplimiento con evidencia |
| Plan mensual | A18/A19/A05, stock y restricciones económicas | Roadmap de hipótesis, campañas y dependencias | Capacidad real frente a trabajo planificado y motivos de cambios |
| Email y retención | A12/A20/A26/A27/A28 | Mensajes y flujos coherentes con necesidades y resultados | Calidad del brief, estado real de campañas y resultados observados por canal |
| Revisión de resultados | A25/A29/A09 y registro de experimentos | Qué se hizo, qué pasó y qué se puede concluir | Experimentos evaluables, inconclusos explicados y aprendizaje reutilizado |
| Informe de cliente | Herramienta de PDF y cifras previsualizadas | Informe consistente con el panel y las decisiones | Conciliación de cifras, entrega confirmada y feedback del cliente |

La interfaz debe hablar en lenguaje de negocio: evidencia y próximo paso. Los IDs, esquemas y diagnósticos técnicos quedan disponibles para consultor/administración cuando ayuden a investigar. No presentar aprobación de una tarea como prueba de mejora de resultados.

## 13. Backlog por fases y criterios de salida

**Prioridades:** P0 protege corrección, datos y permisos; P1 mejora un flujo existente; P2 amplía fuentes o capacidades opcionales.  
**Esfuerzo relativo:** S = ajuste localizado; M = cambio coordinado entre varias capas; L = nueva fuente o ciclo de vida de datos. Son orientaciones, no estimaciones de calendario. IMP-00 debe convertirlas en alcance y estimaciones revisadas.

### IMP-00 — Línea base verificable y alcance de implementación

- **Prioridad / esfuerzo:** P0 / M. Responsable: líder técnico con consultor revisor.
- **Problema:** la presencia de código y migraciones no identifica lo que usa cada cliente; el árbol tiene cambios concurrentes.
- **Trabajo:** registrar revisión de código y modificaciones incluidas, entorno, migraciones aplicadas, catálogo activo, versiones de prompts/contratos, allowlists, automatismos, modelos, conectores, roles y fuentes disponibles por capacidad. Buscar duplicados de entidades antes de diseñar otras.
- **Dependencias:** acceso autorizado al entorno que se elija; no requiere datos personales para el inventario.
- **Aceptación:** mapa origen → cálculo → agente → consumidor para cada flujo a implementar; incógnitas y responsables registrados; baseline reproducible; entorno y alcance acordados.
- **Medida:** capacidades con recorrido contrastado / capacidades incluidas en la fase, con denominador fijo.
- **Reversión:** actividad de inventario; cualquier cambio necesario se convierte en ticket separado.

### IMP-01 — Fiabilidad de medición como política compartida

- **Prioridad / esfuerzo:** P0 / M. Responsable: backend/datos. Referencias: E03/E04/E05.
- **Trabajo:** contrastar contrato y RPCs A24, frescura, cobertura de evento optimizado y estado de incidencias; asegurar que A14/A23/A25/A09 y sus consumidores interpretan el mismo veredicto vigente. Añadir granularidad por capacidad donde sea necesaria.
- **Dependencias:** IMP-00; fuentes y ámbito confirmados.
- **Validación futura:** casos con fuente caída, datos antiguos, cero confirmado, ausencia de actividad, conjuntos no mapeados, truncación y veredicto caducado.
- **Aceptación:** ningún caso crítico de la batería convierte ausencia/error en medición sana; cada conclusión limitada muestra motivo y siguiente paso; un agente no eleva el estado determinista.
- **Medida:** falsos estados de fiabilidad en los casos de referencia y coherencia entre panel, API y agente.
- **Reversión:** desactivar la ampliación por el mecanismo de configuración confirmado, recuperar versión estable y conservar diagnóstico limitado.

### IMP-02 — Economía comparable y cobertura de costes

- **Prioridad / esfuerzo:** P0 / M. Responsable: datos/finanzas de producto. Referencias: E03/E08/E09.
- **Trabajo:** inventariar definiciones financieras, costes y vigencia temporal; conciliar una muestra de fixtures/pedidos autorizados sin exponer PII; detectar moneda, periodos y costes incompletos. Reutilizar el cálculo canónico.
- **Dependencias:** IMP-00; IMP-01 cuando se usen conversiones Meta.
- **Validación futura:** descuentos, devolución parcial, impuestos, coste ausente, estimado/histórico, multicurrency, multitienda, bundle y denominador cero.
- **Aceptación:** cifras coinciden con el cálculo de referencia dentro de la precisión monetaria documentada; beneficio y ROAS no se confunden; los parciales conservan cobertura.
- **Medida:** tasa de conciliación y cobertura de costes con denominador e importe afectados.
- **Reversión:** retirar recomendaciones económicas ampliadas; mostrar únicamente cifras verificadas y limitaciones hasta corregir.

### IMP-03 — Contratos, ámbito, aprobaciones y trazabilidad

- **Prioridad / esfuerzo:** P0 / M. Responsable: backend/seguridad. Referencias: E02/E06/E12.
- **Trabajo:** mapear y extender contratos actuales de evidencia/decisión; revisar pertenencia, tienda, audiencia, configuración, herramientas y validación de ejecutores. Revisar qué análisis pendientes consumen los planificadores y qué campos pueden materializar tareas.
- **Dependencias:** IMP-00; cambios compatibles con IMP-01/02.
- **Validación futura:** dos organizaciones, dos tiendas, cliente/consultor/admin; IDs ajenos; documento interno; aprobación vencida o payload modificado; reintentos y duplicados; instrucciones maliciosas en fuentes.
- **Aceptación:** todos los casos críticos de acceso/acción de la batería pasan; ámbito fijado por servidor; propuesta pendiente no equivale a ejecución ni aprobación; recibo de acción identificable sin guardar datos innecesarios.
- **Medida:** rechazos correctos, acciones sin aprobación válida detectadas y propuestas/tareas duplicadas.
- **Reversión:** desactivar el nuevo flujo de materialización o escritura; conservar lecturas y versión estable si están autorizadas.

### IMP-04 — Curación e ingestión incremental del conocimiento

- **Prioridad / esfuerzo:** P1 / M. Responsable: conocimiento y consultor experto. Referencia: E07.
- **Trabajo:** inventario RAG real, duplicados y destinos; fusionar módulos equivalentes; corregir claims; revisar cada documento; registrar fuente, autoridad, ámbito, audiencia, versión, checksum y relación de reemplazo. Separar metodología global de hechos/aprendizajes del cliente.
- **Dependencias:** IMP-00/03; inventario y flujo de aprobación/retirada acreditados.
- **Validación futura:** recuperación por intención/agente, documentos retirados, versiones activas, citas, aislamiento y preguntas contradictorias.
- **Aceptación:** los 30 módulos tienen decisión y destino o motivo de no indexación; no hay versiones conflictivas activas en el ámbito revisado; fuentes y referencias se recuperan; rollback probado en entorno de validación.
- **Medida:** cobertura de preguntas de referencia, precisión de fuentes y recuperación de versión activa frente a retirada.
- **Reversión:** reactivar versión anterior y retirar los nuevos índices mediante el mecanismo canónico; verificar cachés y consumidores.

### IMP-05 — Política de recomendaciones con poca señal

- **Prioridad / esfuerzo:** P1 / M. Responsable: producto/analítica. Referencias: META-SB-001/002/003 y ECO-SB-001.
- **Trabajo:** extender contrato y políticas A14/A23/A24/A25/A29 con tipos de decisión, maduración, incertidumbre, razones y reevaluación; conservar reglas económicas y de permisos.
- **Dependencias:** IMP-01/02/03; conocimiento aprobado cuando sea necesario.
- **Validación futura:** pocos eventos, atribución retrasada, entrega desigual, cambios simultáneos, presupuesto insuficiente para objetivo y tracking desconocido.
- **Aceptación:** el sistema puede devolver evidencia insuficiente con un siguiente paso concreto; no aparecen ganadores, significación ni causalidad sin método compatible; decisiones explicables por política versionada.
- **Medida:** recomendaciones injustificadas detectadas en revisión y frecuencia de abstenciones útiles/inútiles, con causa.
- **Reversión:** recuperar contrato/prompt y política anterior; mantener los bloqueos P0.

### IMP-06 — Briefs, taxonomía e inventario creativo

- **Prioridad / esfuerzo:** P1 / M-L según modelo existente. Responsable: producto creativo y backend/frontend.
- **Trabajo:** confirmar modelo actual de activos y borradores; extenderlo con taxonomía revisable, evidencia de promesa/prueba, brief versionado y relación temporal anuncio/creativo/activo. Vincular A23, A15, A11 y consumidores de marketing.
- **Dependencias:** IMP-03; IMP-01/02 para recomendaciones de rendimiento/economía.
- **Validación futura:** miniatura frente a vídeo, cambio de creativo durante periodo, varios activos en un anuncio, etiquetas desconocidas, histórico parcial y claim sin prueba.
- **Aceptación:** cada brief conserva fuentes, versión y aprobador; se distingue pieza observada de propuesta; brecha no evaluable no se vende como oportunidad demostrada.
- **Medida:** briefs aceptados sin corrección sustantiva, trazabilidad completa y tiempo de preparación frente a baseline.
- **Reversión:** desactivar clasificación/brief ampliado; conservar activos y versiones existentes sin reescribir sus fuentes.

### IMP-07 — Registro de experimentos y coordinación de agentes

- **Prioridad / esfuerzo:** P1 / L si no hay entidad reutilizable. Responsable: producto/analítica y backend.
- **Trabajo:** reutilizar modelos de decisión/resultado existentes o extenderlos; guardar diseño, presupuesto autorizado, transiciones y conclusión. Coordinar A23/A25/A29 con A17/A19 sin disparar todos los agentes en cada consulta. Invalidar o revisar dependencias cuando cambien fuentes o versiones relevantes.
- **Dependencias:** IMP-01/02/03/05; IMP-06 cuando se prueben briefs/activos.
- **Validación futura:** antes/después, prueba concurrente, retrasos, interrupción, presupuesto agotado, cambios de activo y reintentos.
- **Aceptación:** cada prueba puede reconstruirse; test no comparable termina inconcluso/descriptivo; ningún presupuesto nace del criterio libre del modelo; no se duplican tareas/acciones al reintentar.
- **Medida:** pruebas con diseño completo, evaluables, concluidas, inconclusas y sus motivos; coste por prueba gestionada.
- **Reversión:** detener nuevos lanzamientos; preservar registro y cerrar/revisar pruebas en curso con responsable humano.

### IMP-08 — Experiencia del consultor, cliente e informes

- **Prioridad / esfuerzo:** P1 / M. Responsable: producto/frontend y consultor. Referencias: E06/E10/E13.
- **Trabajo:** llevar calidad, evidencia, propuestas y seguimiento a las pantallas existentes; integrar Camino/tareas/calendario; conciliar reportes con paneles y previsualización. Mostrar análisis pendiente de revisión con su estado.
- **Dependencias:** IMP-03/05; IMP-06/07 según capacidades expuestas.
- **Validación futura:** recorrido consultor y cliente, roles/audiencias, móvil, estados vacíos/error/parcial, filtros de tienda y PDF confirmado.
- **Aceptación:** el cliente entiende recomendación, evidencia y siguiente paso; las cifras coinciden con fuente/panel; no aparecen referencias internas restringidas ni confirmaciones de informes inexistentes.
- **Medida:** tiempo de preparación, correcciones, tareas aceptadas, uso de informes y feedback; revisar accesibilidad del flujo modificado.
- **Reversión:** desactivar vista ampliada y recuperar presentación estable conservando decisiones/tareas trazables.

### IMP-09 — Investigación autorizada y evaluación de A30

- **Prioridad / esfuerzo:** P2 / L. Responsable: producto/integraciones y responsable de datos.
- **Trabajo:** comenzar por una fuente acotada, por ejemplo una carga autorizada; definir muestras, procedencia, minimización, derechos, retención y borrado. Verificar APIs/condiciones oficiales si se conecta un proveedor. Comparar ampliación de A23 con agente independiente.
- **Dependencias:** IMP-03/06; flujo de conocimiento IMP-04 si se indexan derivados.
- **Validación futura:** muestra sesgada, duplicados, idiomas, datos sensibles, inyección de instrucciones, fuente retirada y borrado de resúmenes/chunks/embeddings.
- **Aceptación:** insights fieles a la muestra, sin generalización indebida; no se infieren atributos sensibles; origen reconstruible y retirada comprobada; A30 solo se aprueba si tiene ventaja y responsabilidad propias.
- **Medida:** fidelidad y cobertura de insights según revisión humana, coste por fuente/brief útil y correcciones.
- **Reversión:** parar importación y consumidores; retirar los derivados de la fuente afectada según linaje y política.

### IMP-10 — Evaluación, costes y despliegue progresivo

- **Prioridad / esfuerzo:** P0 como requisito transversal; ejecución gradual / M. Responsable: calidad/plataforma. Referencia: E11.
- **Trabajo:** reutilizar evaluaciones, juez, feedback y promoción existentes; añadir casos del plan, capturar versiones, latencia, coste, errores y resultados. Preparar configuraciones de activación/reversión mediante el mecanismo real identificado en IMP-00.
- **Dependencias:** acompaña todas las fases; no se deja al final.
- **Aceptación:** cada versión promovida tiene evidencia correspondiente, suite crítica superada, revisión del consultor y procedimiento de reversión comprobado en validación. Los límites de coste, timeout y alcance están definidos antes del piloto.
- **Medida:** cuadro de mando del apartado 14 y comparación con baseline/versiones anteriores.
- **Reversión:** detener la ampliación afectada, restaurar versión estable y tratar las decisiones ya publicadas si el fallo las afecta. Una reversión de prompt no revierte cambios externos ejecutados.

### IMP-11 — Vídeo opcional con coste limitado

- **Prioridad / esfuerzo:** P2 opcional / L. Responsable: producto creativo e infraestructura.
- **Trabajo:** medir primero demanda del consultor y carencia real. Si se justifica, procesar solo vídeos seleccionados y autorizados, con límites de duración/bytes, presupuesto, transcripción y fotogramas realmente observados. Producción/generación audiovisual sería otro alcance.
- **Dependencias:** IMP-03/06/10; activos y derechos comprobados.
- **Aceptación:** el informe identifica qué segmentos se analizaron y qué no se puede concluir; coste por activo dentro del límite configurado; fallo de procesamiento no produce una descripción inventada.
- **Medida:** utilidad revisada por consultor, coste/latencia por vídeo y ahorro de tiempo respecto a revisión manual.
- **Reversión:** desactivar procesamiento y volver a texto/métricas/imagen disponible; aplicar retención/borrado de derivados.

### IMP-12 — Revisión incremental de V4

- **Prioridad / esfuerzo:** P2 / S-M para revisión, implementación por estimar.
- **Trabajo:** leer el paquete completo y su prompt, contrastar módulos con V1–V3 y el código actual. Determinar si big idea, patrones propios y rutas de investigación añaden algo a IMP-06/07/09.
- **Dependencias:** acceso local al paquete completo y matriz existente.
- **Aceptación:** cada módulo V4 tiene decisión y destino; solo se añaden diferencias útiles y verificables. No se ingiere por estar en la carpeta.
- **Reversión:** revisión documental; cualquier incorporación posterior sigue IMP-04/10.

### Orden de ejecución

1. IMP-00 y preparación de IMP-10.
2. IMP-01, IMP-02 e IMP-03, coordinando contratos compartidos y dependencias.
3. IMP-04 e IMP-05 sobre la base P0 aceptada.
4. IMP-06 e IMP-07; después exponer las capacidades aprobadas mediante IMP-08.
5. Piloto controlado y revisión del apartado 15.
6. IMP-09, IMP-11 e incorporación de resultados de IMP-12 solo cuando su valor y fuentes estén acreditados.

## 14. Cuadro de mando y objetivos medibles

Los siguientes controles son **objetivos propuestos**, no resultados obtenidos ni SLOs existentes. Antes del piloto se fijarán baseline, fuente de cada métrica, responsable, periodo y límites aceptados. La muestra de revisión se define previamente por riesgo; registrar siempre tamaño y selección.

| Dimensión | Métrica / denominador | Objetivo o regla de salida |
|---|---|---|
| Ámbito y permisos | Casos críticos de aislamiento y acción superados / casos críticos de referencia | 100 % de la batería crítica superada; un fallo bloquea la fase. No equivale a certificar ausencia total de vulnerabilidades |
| Fiabilidad | Estados falsamente sanos en casos de fuente ausente/antigua/fallida | Cero en la batería de referencia; investigar cualquier aparición en piloto |
| Exactitud económica | Cifras conciliadas / cifras revisadas, por definición y moneda | Todas las cifras críticas de referencia conciliadas dentro de precisión documentada; discrepancia bloqueante si afecta recomendación |
| Procedencia | Decisiones que requieren evidencia y conservan referencias completas / decisiones revisadas que la requieren | 100 % en los casos de aceptación; revisar representatividad del muestreo en piloto |
| Calidad consultiva | Recomendaciones utilizables sin corrección sustantiva / recomendaciones revisadas | Objetivo fijado tras baseline; registrar tipo de corrección y desacuerdo entre revisores |
| Incertidumbre | Conclusiones no respaldadas detectadas / conclusiones revisadas | Ningún fallo crítico en referencia; comparar tasa con baseline en piloto |
| Flujo de tareas | Tareas duplicadas o sin entregable verificable / tareas propuestas | Sin duplicados por reintento en referencia; umbral operativo del piloto definido antes de abrirlo |
| Experimentos | Registros evaluables / experimentos que alcanzan revisión | No exigir que todos sean concluyentes; cada inconcluso tiene causa y siguiente paso |
| RAG | Recuperaciones con documento vigente y autorizado / consultas de referencia | Ninguna fuga de audiencia ni recuperación de retirada como vigente en casos críticos; medir pertinencia por separado |
| Eficiencia | Minutos de preparación/revisión por caso comparable | Mejorar frente a baseline sin empeorar exactitud; declarar muestra, dispersión y diferencias de complejidad |
| Coste IA | Coste por run, cliente/periodo, informe y brief útil; p50/p95 | Techos aprobados y configurados antes de activar; al alcanzar límite, detener gasto adicional y explicar estado |
| Rendimiento | Latencia p50/p95, errores, timeouts y reintentos por flujo | Límites definidos a partir de baseline y necesidad del usuario; un reintento no duplica efectos |
| Adopción | Consultores/clientes que usan entregable / elegibles invitados, con periodo | Medir uso y feedback; acceso a una pantalla no se equipara a valor recibido |
| Resultado del cliente | Contribución, CAC, recompra u objetivo elegido, con ventana y cobertura | Medir como resultado observado; afirmar efecto causal solo con diseño que lo soporte |

No usar volumen de texto, número de agentes ejecutados o número de tareas creadas como prueba principal de valor. Evitar optimizar la aceptación de propuestas a costa de ocultar incertidumbre.

## 15. Validación y activación progresiva

### 15.1 Batería mínima antes de activar cada capacidad

Leer y reutilizar pruebas existentes; añadir o ejecutar las pertinentes durante la implementación, con datos sintéticos, anonimizados autorizados o fixtures. Este documento no afirma que las pruebas actuales pasen.

| Grupo | Casos que debe incluir | Condición de bloqueo |
|---|---|---|
| Ámbito | Organizaciones/tiendas distintas, IDs ajenos, rol cliente/consultor/admin, audiencias internas | Acceso o divulgación indebidos |
| Medición | Fallo RPC, sync antiguo, pixel sin eventos, evento distinto al optimizado, cero confirmado, truncación | Estado sano o recomendación no permitida sin evidencia |
| Economía | Costes ausentes, descuentos, reembolso, divisas, multitienda, bundles, periodos distintos | Cifra crítica incorrecta o subtotal presentado como beneficio completo |
| Creativo | Imagen, miniatura, vídeo no visto, cambio de asignación y activo compartido | Descripción inventada o atribución de resultados al activo incorrecto |
| Investigación | Sesgo/duplicado, comentario malicioso, PII, atributo sensible y fuente retirada | Instrucción externa ejecutada, exposición o perfil sensible inferido |
| Decisión | Poco volumen, maduración pendiente, varias variables cambiadas, comparación descriptiva | Ganador, significación o causalidad afirmados sin diseño compatible |
| Acciones | Aprobar, rechazar, editar tras aprobación, permisos revocados, timeout y reintento | Escritura no autorizada, duplicada o sin recibo verificable |
| RAG | Preguntas equivalentes/contradictorias, activo/histórico, rol y ámbito, fuente retirada | Documento restringido o retirado presentado como vigente |
| Interfaz/informe | Estados vacíos/error/parcial, móvil, filtros, accesibilidad y PDF | Cifras discordantes, restricciones ocultas o informe confirmado sin generarse |

### 15.2 Etapas de activación

1. **Validación local/interna:** contratos y cálculo con casos de referencia. Revisión de consultor y responsables técnicos.
2. **Reproducción de casos históricos autorizados:** comparar versión anterior/nueva sobre los mismos casos; no crear acciones externas.
3. **Modo observación:** obtener propuestas sin materializar tareas o cambios, según mecanismo que se implemente/verifique. Registrar discrepancias y coste.
4. **Piloto asistido:** conjunto pequeño y explícito de organizaciones elegibles, con aprobación de consultor y revisión de cada recomendación de riesgo. Su tamaño se acuerda según casos y capacidad de supervisión; no sirve por sí solo para probar impacto económico.
5. **Ampliación por capacidad:** incorporar más organizaciones solo tras cumplir los criterios y límites acordados. Mantener exclusiones por falta de fuentes/permiso/datos.

Un fallo de aislamiento, ejecución no aprobada, cálculo económico materialmente incorrecto o conclusión dañina por ausencia de datos obliga a detener la capacidad afectada y revisar sus salidas publicadas. Para errores de utilidad/coste, usar los umbrales previamente definidos; no cambiar los criterios después de ver el resultado para justificar la ampliación.

Antes de cada promoción: registrar versión, cambios, evidencia, métricas, límites conocidos, responsable, alcance de activación y procedimiento de reversión. Verificar que la promoción real exige la evidencia correspondiente; la existencia de un botón o RPC no basta.

## 16. Presupuesto, privacidad y operación

### 16.1 Coste y ejecución

Configurar límites por ejecución y por organización/periodo: modelo, tokens/contexto, llamadas a herramientas, duración, reintentos, concurrencia y gasto externo cuando exista. Confirmar primero qué soporta la plataforma actual. Una capacidad nueva que necesita un límite no disponible permanece sin activar hasta implementarlo.

No ejecutar toda la flota para responder una pregunta. Reutilizar resultados compatibles por ámbito, periodo, fuentes y versiones; invalidarlos si cambian condiciones relevantes. Confirmar la política real de caché y frescura antes de ampliarla. Evitar reintentos de efectos externos sin idempotencia y conciliación de respuesta.

### 16.2 Datos y permisos

Registrar fuente, finalidad, acceso autorizado, audiencia, condiciones de uso, minimización, política de retención y responsable del borrado. Los plazos concretos se establecen para cada fuente y contrato aplicable antes de importarla; este plan no los inventa.

Las reseñas, comentarios, descripciones y documentos externos son datos no confiables. No obedecer instrucciones que contengan. Extraer agregados por necesidad y objeción evitando identificadores, contactos, inferencias sensibles y testimonios no autorizados. Los logs deben conservar la evidencia necesaria con datos minimizados y permisos coherentes.

El borrado o retirada debe alcanzar registros derivados, resúmenes, chunks, embeddings y cachés vinculados según el linaje y política acordados. Un aprendizaje de cliente conserva su ámbito; no se comparte con otros clientes mediante RAG global por defecto.

### 16.3 Registro de riesgos y respuesta

| Riesgo | Señal observable | Respuesta y propietario |
|---|---|---|
| Evidencia de código distinta a entorno real | RPC ausente, versión activa inesperada, consumidor no conectado | IMP-00; plataforma bloquea la activación y actualiza inventario |
| Datos incompletos parecen ceros | Cobertura/frescura ausente y métricas a cero tras error | Datos/backend corrige contrato y revisa recomendaciones afectadas |
| Recomendaciones repetidas o contradictorias | Tareas duplicadas, distintos agentes con periodos/definiciones incompatibles | Producto/consultor reconcilia dependencias y evidencia; no promedia opiniones |
| Coste y latencia crecen sin utilidad | Mayor coste por caso, más llamadas o timeouts sin ahorro de trabajo | Plataforma limita ejecución; producto revisa contexto y necesidad de agentes |
| Fuente de investigación no utilizable | Permiso/derecho no acreditado o cobertura desconocida | Responsable de datos detiene importación y revisa derivados |
| Aprendizaje sobreajustado al cliente o periodo | Regla general a partir de una muestra pequeña | Consultor conserva hipótesis contextual y pide nueva evidencia |
| Rollback técnico deja efectos externos | Presupuesto/anuncio ya cambiado o comunicación enviada | Operaciones concilia efectos con autorización; no promete deshacerlos solo cambiando versión |

## 17. Encaje con el resto del software y revisión pendiente

| Área | Encaje con la implementación | Qué debe contrastarse antes de ampliarla |
|---|---|---|
| Cartera y espacio del consultor | Priorizar clientes por datos/restricciones/acciones y preparar reuniones | Criterio de prioridad, ámbito multiorganización, filtros y ausencia de ranking engañoso |
| Portal del cliente | Presentar diagnóstico, decisiones, tareas y progreso | Visibilidad por rol, lenguaje, estados pendientes y coherencia de cifras |
| Camino, planes, hitos y tareas | Ejecutar y seguir el trabajo acordado | Versionado, dependencias, responsables, deduplicación y transición aprobada |
| Calendario y marketing | Relacionar oferta, brief, producción y campaña | Planificación frente a envío/publicación real y capacidades de cada conector |
| Shopify | Economía, producto, stock, adquisición, retención y postventa | Cobertura temporal y financiera; lo sincronizado no se presume historial completo |
| Klaviyo | Mensajes, medición, programación y propuestas de flujos | Permisos, cobertura, consentimiento y estados reales; no sumar atribución a ventas |
| Conocimiento y memoria | Recuperar metodología y aprendizaje vigente | Inventario real, audiencia, autoridad, versiones, contradicciones y retirada |
| Administración de IA | Evaluación, configuración, coste y trazabilidad | Correspondencia entre catálogos, versiones activas, automatismos y controles visibles |
| API, base de datos y workers | Ejecutar trabajo acotado, consistente y observable | Autenticación, RLS, ámbitos de service clients, migraciones, reintentos y recuperación |
| Interfaz general | Hacer comprensible el proceso y estados | Accesibilidad, móvil, rendimiento y errores en las pantallas modificadas |
| Facturación, planes comerciales y otras áreas no recorridas en detalle | Podrían limitar acceso o consumo de nuevas capacidades | Auditoría específica pendiente; no se asignan capacidades ni compromisos comerciales desde este documento |

Esta tabla orienta el trabajo posterior sobre el software completo. Las áreas no recorridas en detalle conservan ese estado; no se declaran auditadas por aparecer aquí.

## 18. Destino del contenido y control de cambios

| Tipo de archivo de los paquetes | Destino recomendado |
|---|---|
| Transcripciones y fichas de fuente | Archivo de procedencia; no indexar enteras como metodología de producción |
| 29 fichas temáticas RAG de V1/V2/V3 | Resolver individualmente mediante la matriz de 30 módulos, que incluye GAP-VIDEO; fusionar, corregir, aprobar o descartar según inventario real |
| Contratos y taxonomías candidatos | Especificación de requisitos; mapear a schemas canónicos y versionar cambios compatibles |
| Playbooks candidatos | Ampliación de flujos existentes solo tras confirmar datos, controles y consumidores |
| Políticas y guardarraíles | Reglas revisadas en backend/contratos/evaluaciones, con explicación al usuario cuando cambien la decisión |
| Experiencia y aprendizaje | Registro contextual de hipótesis y resultados; promoción de conocimiento mediante revisión |
| Requisitos de datos | Inventario de capacidades y cobertura por fuente/tienda; no promesa de que el conector devuelve esos campos |
| Matrices y documentos de auditoría | Evidencia y seguimiento del plan; no conocimiento comercial que el agente deba recuperar por defecto |
| Prompts maestros de auditoría | Instrucciones de revisión; mantener diferenciados de prompts de agentes en producción |
| V4 | Pendiente de revisión completa IMP-12; no asumir integración ni duplicar documentos existentes |

Este archivo será el plan de referencia de esta propuesta. Los prompts de auditoría existentes conservan su función. Al implementar una fase, actualizar aquí estado, evidencia y decisiones, enlazando tickets/cambios y resultados reales; no marcar una fase como terminada solo porque exista el código.

## 19. Registro de avance inicial

| Entregable | Estado al crear este archivo | Evidencia necesaria para cerrarlo |
|---|---|---|
| Plan y encaje V1–V3 con agentes | DOCUMENTADO | Este archivo y revisión del usuario/CTO |
| Inventario de producción y fuentes por organización | PENDIENTE, IMP-00 | Versiones/migraciones/configuración contrastadas y ámbito definido |
| Controles P0 y línea base de evaluación | PENDIENTE de validación, aunque hay componentes en código | Resultados de casos, responsables y configuraciones efectivas |
| Curación e ingestión V1–V3 | PENDIENTE, IMP-04 | Decisiones por módulo, aprobaciones e inventario RAG actualizado |
| Política de poca señal, briefs y experimentos | PROPUESTO | Implementación compatible, evaluación y consumidor real |
| Piloto consultivo y cuadro de mando | PENDIENTE | Baseline, límites, cohortes elegibles y resultados revisados |
| Nuevas fuentes, A30 y vídeo | CONDICIONADO | Valor demostrado, fuentes, permisos, coste y controles aprobados |
| Revisión completa de V4 | PENDIENTE, IMP-12 | Lectura completa y matriz incremental |

Al cerrar cada fase registrar: responsable, fecha, alcance, revisión de código, migraciones y prompts aplicados, pruebas/evaluaciones pertinentes, métricas con denominador, incidencias, decisión de activación y reversión disponible. Los resultados que el cliente vea deben poder reconstruirse desde esa evidencia.
