# IMP-04 — Curación e ingestión incremental del conocimiento

Fecha: 3 de noviembre de 2026, Europe/Madrid. Implementación y validación local; activación remota pendiente de la entrega final. Continúa [IMP-03](IMP03_CONTRATOS_APROBACIONES_TRAZABILIDAD_2026-11-02.md) y el [plan maestro](../PLAN_MAESTRO_IMPLEMENTACION_CONTROLADA_E_NORA.md).

## Resultado

Los 30 módulos de V1, V2 y V3 tienen una decisión individual y una procedencia reconstruible. Se preparan **seis ampliaciones de documentos existentes y tres fichas nuevas**, sin archivar otros documentos. META-008 reutiliza la verificación de ejecución existente; GAP-VIDEO se aplaza y META-CR-010 se excluye por falta de evidencia verificable de los casos de marcas.

Los embeddings de esta validación se han generado con **Voyage `voyage-context-4`, 1024 dimensiones**, usando el proveedor y el chunking central del software. No se ha creado una migración SQL para importar textos. Se reutilizan las rutinas atómicas de indexación, búsqueda híbrida y tablas existentes.

Esta fase no añade un agente ni una pantalla. Aporta metodología preparada para recuperación y refuerza permisos y actualización del conocimiento. Incorporar un texto al RAG no implanta por sí solo la política determinista de poca señal, los briefs versionados, la investigación automática o el análisis audiovisual: corresponden a IMP-05 y fases posteriores.

## Inventario contrastado y alcance

La lectura remota del 03/11 encontró 584 documentos activos: **583 globales `consultant_only` y uno de organización `consultant_only`**; todos declaraban el modelo Voyage actual. Se leyeron los metadatos de los 583 globales, sin duplicados de ruta activa. No se inspeccionaron semánticamente los 583 cuerpos ni todos sus chunks: esto no certifica la ausencia de duplicados temáticos en todo el corpus.

Los seis documentos de partida son globales, activos, versión 1 y autoridad `operational`. En la captura su columna `content` era nula; el texto local original de cada uno coincidía exactamente con su checksum remoto antes de ampliarlo. Esas bases originales se conservan como cadenas JSON para no alterar sus saltos de línea. No se presenta esa copia como una exportación de cuerpos remotos.

Evidencia: [inventario resumido y versiones de partida](imp04-inventario-base-2026-11-03.json), [bases originales](../../conocimiento/meta-ads/99-auditoria/bases.json) y [manifiesto completo](../../conocimiento/meta-ads/99-auditoria/release-v1.json). El inventario completo temporal se usa para la simulación; la aplicación vuelve a paginar y comprobar el inventario real. Las seis copias Markdown auxiliares de las bases quedan fuera del índice; el mecanismo usa exclusivamente `bases.json`.

El [plan contrastado](imp04-plan-2026-11-03.json) contiene seis actualizaciones, tres altas, cero archivados y cero errores. La comprobación final, también de solo lectura, confirmó de nuevo autoridad, versión y checksum de las seis bases. No es una reserva del inventario: se vuelve a comprobar al activar.

## Destinos y decisión de cada módulo

Se han leído las 29 fichas temáticas y GAP-VIDEO. Las fusiones son síntesis editoriales de las fuentes aportadas, no una validación externa de sus ejemplos o afirmaciones técnicas cambiantes. Se conservan los paquetes originales.

| Destino | Documento | Cambio |
|---|---|---|
| D1 | [Adquisición y embudo](../../conocimiento/fase-05/01-rag-produccion/5.01-playbooks-de-adquisicion-y-diversificacion.md) | Ampliar mismo ID |
| D2 | [Estructura y testing](../../conocimiento/fase-05/01-rag-produccion/5.02-estructura-audiencias-creative-y-testing.md) | Ampliar mismo ID |
| D3 | [Atribución y medición](../../conocimiento/fase-05/01-rag-produccion/5.02-atribucion-incrementalidad-calidad-y-madurez.md) | Ampliar mismo ID |
| D4 | [Pricing y economía](../../conocimiento/fase-05/01-rag-produccion/5.04-oferta-pricing-y-economics.md) | Ampliar mismo ID |
| D5 | [AOV y bundles](../../conocimiento/fase-05/01-rag-produccion/5.04-aov-bundles-cross-sell-y-ofertas-de-valor.md) | Ampliar mismo ID |
| D6 | [Retención y LTV](../../conocimiento/fase-05/01-rag-produccion/5.05-retencion-cohortes-ltv-y-economia-de-relacion.md) | Ampliar mismo ID |
| D7 | [Activos e incidencias](../../conocimiento/meta-ads/01-rag-produccion/META-K01_activos_medicion_e_incidencias.md) | Ficha nueva |
| D8 | [Investigación y evidencia](../../conocimiento/meta-ads/01-rag-produccion/META-K02_investigacion_personas_y_evidencia_creativa.md) | Ficha nueva |
| D9 | [Briefs y brechas](../../conocimiento/meta-ads/01-rag-produccion/META-K03_briefs_inventario_y_brechas_creativas.md) | Ficha nueva |

| Módulo y fuente | Decisión | Destino | Motivo / control |
|---|---|---|---|
| [META-001](../../Meta%20Ads-Instagram/ENORA_MetaAds_Conocimiento_Auditoria/01-rag-produccion/META-001_gobernanza_activos_cuenta.md) | Fusionar | D7 | Activos y accesos observables; no presumir facturación o permisos de escritura. |
| [META-002](../../Meta%20Ads-Instagram/ENORA_MetaAds_Conocimiento_Auditoria/01-rag-produccion/META-002_tracking_eventos_calidad_datos.md) | Ampliar | D3, D7 | A24 y fuentes compatibles; discrepancia no prueba error de píxel. |
| [META-003](../../Meta%20Ads-Instagram/ENORA_MetaAds_Conocimiento_Auditoria/01-rag-produccion/META-003_estructura_objetivos_audiencias.md) | Ampliar | D2 | Objetivo y estructura contextual; consolidación no universal. |
| [META-004](../../Meta%20Ads-Instagram/ENORA_MetaAds_Conocimiento_Auditoria/01-rag-produccion/META-004_diagnostico_embudo_ads_tienda.md) | Ampliar | D1, D3 | Embudo con denominadores compatibles y causas por contrastar. |
| [ECO-001](../../Meta%20Ads-Instagram/ENORA_MetaAds_Conocimiento_Auditoria/01-rag-produccion/ECO-001_roas_cpa_margenes_rentabilidad.md) | Ampliar | D4 | Usar el motor financiero; no confundir ROAS atribuido con beneficio. |
| [META-005](../../Meta%20Ads-Instagram/ENORA_MetaAds_Conocimiento_Auditoria/01-rag-produccion/META-005_estrategia_creativos_y_evaluacion.md) | Fusionar | D2, D9 | Hipótesis, activos observados y evaluación; no producción audiovisual inventada. |
| [META-006](../../Meta%20Ads-Instagram/ENORA_MetaAds_Conocimiento_Auditoria/01-rag-produccion/META-006_optimizacion_presupuesto_aprendizaje.md) | Ampliar | D2 | Cadencia según señal, riesgo y economía; sin porcentajes ni días obligatorios. |
| [META-007](../../Meta%20Ads-Instagram/ENORA_MetaAds_Conocimiento_Auditoria/01-rag-produccion/META-007_senales_entrega_diagnostico_incidentes.md) | Fusionar | D7 | Incidente observado, hipótesis y siguiente comprobación. |
| [META-008](../../Meta%20Ads-Instagram/ENORA_MetaAds_Conocimiento_Auditoria/01-rag-produccion/META-008_ia_publicidad_limites_integraciones.md) | Reutilizar | [Verificación existente](../../conocimiento/fase-08/01-rag-produccion/8.15-verificacion-de-ejecucion.md) | Reutilizar verificación y autorización existentes; no indexar promoción de proveedores. |
| [GAP-VIDEO](../../Meta%20Ads-Instagram/ENORA_MetaAds_Conocimiento_Auditoria/05-experience-learning/GAP_VIDEO_CREATIVOS_Y_PLAN_FUENTES.md) | Aplazar | Fuera del índice | No acredita producción audiovisual; se conserva para IMP-11 fuera del índice. |
| [META-SB-001](../../Meta%20Ads-Instagram/ENORA_MetaAds_Presupuesto_Reducido_Auditoria_V2/01-rag-produccion/META-SB-001_presupuesto_reducido_criterios_y_objetivo_de_prueba.md) | Ampliar | D2 | Eliminar cortes universales de presupuesto y explicitar escenarios de señal. |
| [META-SB-002](../../Meta%20Ads-Instagram/ENORA_MetaAds_Presupuesto_Reducido_Auditoria_V2/01-rag-produccion/META-SB-002_fase_aprendizaje_cadencia_de_cambios.md) | Ampliar | D2 | Separar monitorización urgente e intervención; no inferir resets de aprendizaje. |
| [META-SB-003](../../Meta%20Ads-Instagram/ENORA_MetaAds_Presupuesto_Reducido_Auditoria_V2/01-rag-produccion/META-SB-003_escasez_datos_estadistica_experimentos.md) | Ampliar | D2 | Comparación descriptiva frente a experimento; sin significación automática. |
| [META-SB-004](../../Meta%20Ads-Instagram/ENORA_MetaAds_Presupuesto_Reducido_Auditoria_V2/01-rag-produccion/META-SB-004_cliente_ideal_nicho_y_mensaje.md) | Fusionar | D8, D6 | Necesidad y valor agregado como hipótesis; no perfiles sensibles ni targeting implícito. |
| [META-SB-005](../../Meta%20Ads-Instagram/ENORA_MetaAds_Presupuesto_Reducido_Auditoria_V2/01-rag-produccion/META-SB-005_benchmark_competidores_biblioteca_meta.md) | Fusionar | D8 | Permanencia de anuncio no demuestra resultados económicos. |
| [META-SB-006](../../Meta%20Ads-Instagram/ENORA_MetaAds_Presupuesto_Reducido_Auditoria_V2/01-rag-produccion/META-SB-006_objetivos_conversion_vs_notoriedad.md) | Ampliar | D2 | Evaluar objetivo aprobado; no invalidar awareness por presupuesto. |
| [META-SB-007](../../Meta%20Ads-Instagram/ENORA_MetaAds_Presupuesto_Reducido_Auditoria_V2/01-rag-produccion/META-SB-007_contenido_organico_como_senal_creativa.md) | Fusionar | D9 | Orgánico aporta hipótesis, no validación de rentabilidad pagada. |
| [META-SB-008](../../Meta%20Ads-Instagram/ENORA_MetaAds_Presupuesto_Reducido_Auditoria_V2/01-rag-produccion/META-SB-008_consolidacion_ofertas_campanas_adsets.md) | Ampliar | D2 | Concentrar señal solo con restricciones y justificación de estructura. |
| [ECO-SB-001](../../Meta%20Ads-Instagram/ENORA_MetaAds_Presupuesto_Reducido_Auditoria_V2/01-rag-produccion/ECO-SB-001_cac_ltv_roas_y_beneficio_absoluto.md) | Ampliar | D4, D6 | Contribución, horizonte, payback y caja; no financiar pérdidas con LTV sin evidencia. |
| [META-CR-001](../../Meta%20Ads-Instagram/ENORA_MetaAds_Estrategia_Creativa_Auditoria_V3/01-rag-produccion/META-CR-001_estrategia_creativa_objetivos_y_brechas.md) | Fusionar | D9 | Brief con problema, objetivo, hipótesis y condiciones de revisión. |
| [META-CR-002](../../Meta%20Ads-Instagram/ENORA_MetaAds_Estrategia_Creativa_Auditoria_V3/01-rag-produccion/META-CR-002_investigacion_marca_producto_promesa_prueba.md) | Fusionar | D8, D5 | Promesa y prueba, producto real y viabilidad económica. |
| [META-CR-003](../../Meta%20Ads-Instagram/ENORA_MetaAds_Estrategia_Creativa_Auditoria_V3/01-rag-produccion/META-CR-003_reputacion_investigacion_objeciones_multifuente.md) | Fusionar | D8 | Muestra autorizada, sesgos y procedencia; no simular rastreo externo. |
| [META-CR-004](../../Meta%20Ads-Instagram/ENORA_MetaAds_Estrategia_Creativa_Auditoria_V3/01-rag-produccion/META-CR-004_mineria_reviews_comentarios_y_ai.md) | Fusionar | D8 | Deduplicar, minimizar identificadores y exigir citas respaldadas. |
| [META-CR-005](../../Meta%20Ads-Instagram/ENORA_MetaAds_Estrategia_Creativa_Auditoria_V3/01-rag-produccion/META-CR-005_personas_como_hipotesis_y_validacion.md) | Fusionar | D8 | Personas como hipótesis agrupadas; no inferir salud individual. |
| [META-CR-006](../../Meta%20Ads-Instagram/ENORA_MetaAds_Estrategia_Creativa_Auditoria_V3/01-rag-produccion/META-CR-006_matriz_persona_angulo_conciencia_formato.md) | Fusionar | D9 | Separar ángulo, concepto, hook, formato, placement y objetivo; sin cuotas. |
| [META-CR-007](../../Meta%20Ads-Instagram/ENORA_MetaAds_Estrategia_Creativa_Auditoria_V3/01-rag-produccion/META-CR-007_benchmark_competencia_inspiracion_no_copia.md) | Fusionar | D8 | Resolver el conflicto V2/V3 como inspiración abstracta y prueba propia. |
| [META-CR-008](../../Meta%20Ads-Instagram/ENORA_MetaAds_Estrategia_Creativa_Auditoria_V3/01-rag-produccion/META-CR-008_gap_analysis_persona_awareness_diversidad.md) | Fusionar | D9 | Brecha potencial frente a ausencia no evaluable o exclusión intencional. |
| [META-CR-009](../../Meta%20Ads-Instagram/ENORA_MetaAds_Estrategia_Creativa_Auditoria_V3/01-rag-produccion/META-CR-009_roadmap_trimestral_mensual_creativos.md) | Fusionar | D9 | Planificación ligada a responsables y capacidad; no publicación implícita. |
| [META-CR-010](../../Meta%20Ads-Instagram/ENORA_MetaAds_Estrategia_Creativa_Auditoria_V3/01-rag-produccion/META-CR-010_casos_ilustrativos_sin_prueba_causal.md) | Excluir | Fuera del índice | Casos de marcas sin métricas verificadas; no indexar como evidencia de éxito. |
| [ECO-CR-001](../../Meta%20Ads-Instagram/ENORA_MetaAds_Estrategia_Creativa_Auditoria_V3/01-rag-produccion/ECO-CR-001_bundling_aov_margen_y_oferta.md) | Ampliar | D5 | AOV proyectado no equivale a contribución; validar composición, costes y stock. |

Los hashes del manifiesto fijan cada fuente y cada destino modificado; un cambio posterior bloquea la entrega hasta preparar y revisar otra versión. El criterio de hash de los nuevos textos normaliza LF y recorta extremos. Los hashes de las bases mantienen sus bytes originales. La relación de ampliación conserva el ID del documento; no crea una segunda versión activa como otro documento.

## Criterios corregidos

- Presupuesto bajo depende de objetivo, moneda, coste esperado, maduración y riesgo asumible. Se retiran los cortes de 600/3.000 USD y la estructura universal de una campaña/un conjunto.
- No hay subida obligatoria del 10–20 %, intervención cada 7–10 días, cuota de ángulos o significación estadística automática del 90 %. Comparación descriptiva y experimento controlado son distintos.
- ROAS atribuido, CAC, contribución, beneficio y caja conservan sus definiciones. Costes desconocidos no son cero; se reutiliza `financial_comparability.can_use_financial_model`.
- Las ventanas y fuentes de Meta, Shopify y Klaviyo no se suman como ventas independientes. Una discrepancia no acredita un píxel roto.
- La permanencia de anuncios competidores y el alcance orgánico aportan hipótesis; no demuestran rentabilidad. Se excluyen los supuestos casos de éxito sin métricas verificables.
- Las personas creativas se describen por necesidades e hipótesis agregadas. No se infieren atributos sensibles individuales, ni se inventan testimonios, conectores de reseñas o permisos de investigación.
- Una miniatura no acredita haber visto un vídeo. Una celda vacía no demuestra una brecha con inventario incompleto. El roadmap creativo no autoriza publicación.

## Cómo lo utilizará el software

| Consumidor existente | Aporte de esta entrega | Control que se mantiene |
|---|---|---|
| A08, gestor de conocimiento | Fuentes, destinos y versión de una entrega reconstruibles | Gestión global reservada a administrador; no se atribuye revisión humana al agente de implementación |
| A09 y consultor | Explicar diagnósticos, límites y siguiente comprobación con metodología recuperable | Datos reales de la organización y tienda autorizadas; documentos internos fuera de la vista cliente |
| A14 y A24 | Distinguir entrega, activos, incidente y calidad de medición | Las herramientas y el veredicto determinista acreditan los hechos; un texto no concede capacidades |
| A23 | Investigación, promesa/prueba, taxonomía, briefs y brechas con incertidumbre | No crea todavía el inventario ni el almacenamiento de briefs de IMP-06 |
| A25 y A29 | Comparabilidad, cambios simultáneos, maduración y límites de muestras pequeñas | La política ejecutable se completa en IMP-05; el RAG no sustituye una barrera de backend |
| Economía, adquisición y retención | Conectar oferta, AOV, contribución, LTV y caja | Cálculos del motor canónico y cobertura suficiente; no recalcular cifras libremente con el LLM |

El administrador conserva `/admin/conocimiento`. La metodología global alimenta a los agentes que ya tienen herramientas/contexto autorizados para consultarla; no se habilitan herramientas adicionales a toda la flota. El consultor mantiene acceso a las organizaciones asignadas y a sus documentos internos. El cliente ve su documentación permitida y las explicaciones del flujo del producto, no el corpus interno de consultoría. El aprendizaje privado de un cliente no se incorpora al global.

## Controles implementados

El [gestor de entregas](../../scripts/knowledge-release.mjs) carga un manifiesto con fuente, decisión, destino, autoridad, ámbito, audiencia, perfil y hashes. Rechaza rutas exteriores, inventario de clientes, modelos incompatibles, conflictos de versión, audiencia/autoridad alteradas y objetivos nuevos ya ocupados por contenido distinto. El plan selecciona nueve documentos y usa `prune:false`; no retira textos ajenos de las carpetas compartidas.

La aplicación exige el digest exacto de la entrega revisada y una sesión de administrador activo. Ese paso declara una revisión humana de activación: esta implementación no la da por realizada. Al aplicar, se registra `human_approved_ai`, actor y autoridad `operational`; no se eleva el material a verdad canónica por proceder de un vídeo.

Cada operación guarda primero una intención y la base de reversión, y después comprueba la versión, hash, ámbito, perfil y metadatos resultantes. Los recibos se escriben mediante archivo temporal y sustitución. Un fallo deja estado parcial; `--resume` conserva las bases y evita repetir embeddings confirmados, incluso si se perdió la respuesta de indexación. Las actualizaciones usan el mismo ID y la comprobación optimista de la RPC existente.

En [knowledge.ts](../../apps/api/src/knowledge.ts), las lecturas completas y actualizaciones comprueban audiencia y tienda además de organización. Las revisiones inválidas u obsoletas y las conexiones de tienda ajenas se rechazan antes de llamar a Voyage. La excepción de metodología global de agentes solo permite `consultant_only`, sin abrir `system_only` o audiencias desconocidas. La herramienta de lectura completa respeta la tienda seleccionada y conserva el conocimiento compartido de organización. El importador genérico tampoco ejecuta el archivado final cuando una importación ha fallado o se ha cortado con límite.

## Validación realizada

[Registro verificable de la prueba local](imp04-validacion-local-2026-11-03.json), asociado al digest de la entrega:

- 27 entradas preparadas con Voyage real: nueve textos nuevos/ampliados, seis bases y doce preguntas. Corpus acotado a 106.955 caracteres. Se reutilizó la caché para repetir SQL sin nuevas llamadas; no se ha medido la factura monetaria ni el número de reintentos HTTP internos del proveedor.
- Nueve documentos activos en un solo espacio vectorial; doce preguntas con el destino esperado entre los ocho primeros resultados. Se verifica que ID, título, índice y contenido de cada cita correspondan al chunk actual. Esto mide recuperación, no la calidad final de una respuesta generada por un LLM.
- Reemplazo obsoleto rechazado sin modificar documento o chunks. Un vector inválido revierte la transacción completa.
- Aislamiento de organización, tienda y audiencia con vectores adversarios idénticos. La prueba de RLS usa políticas sintéticas restrictivas y no sustituye probar toda la cadena de migraciones/JWT real.
- Documentos archivados, borrados y sustituidos excluidos de búsqueda activa. Reversión: seis cuerpos originales restaurados con versión creciente y tres documentos nuevos archivados; sus IDs dejan de aparecer en recuperación.
- 20 pruebas del importador y del gestor de entregas; 26 regresiones de API, permisos, metodología y búsqueda; 292 pruebas del paquete IA. Compilación de API correcta.

La verificación general completó el resto de guardas y detectó dos pruebas de email sin registrar, ajenas a la curación. Se registraron, pasaron sus siete casos y se volvió a ejecutar correctamente la guarda de pertenencia a la suite. La comprobación de enlaces se repite sobre estos documentos finales.

La base de la prueba se creó con nombre aleatorio `enora_imp04_test_*` en PostgreSQL local y se eliminó al terminar. Se ejecutaron los cuerpos reales de las RPC de creación, reemplazo y búsqueda sobre un esquema mínimo aislado. No hubo escrituras en Supabase remoto. Quedan para la entrega final las sesiones reales de cliente/consultor/admin, la recuperación en el corpus completo y el efecto sobre respuestas reales de cada agente. No se ha recorrido la UI en navegador en esta fase.

## Operación y reversión para la entrega final

Desde la raíz, `npm run conocimiento:release:build` reconstruye el manifiesto. `npm run conocimiento:release` solo prepara el plan con el inventario remoto. Para un plan offline se admite `--inventory=<snapshot relativo>`; no permite escrituras. Revisar la diferencia, fuentes y digest antes de activar. Los comandos de aplicación siguientes son instrucciones de operación y **no se han ejecutado**.

```powershell
npm run conocimiento:release -- --apply=<digest-revisado>
npm run conocimiento:release -- --resume=tmp/<recibo>.json --apply=<digest-revisado>
npm run conocimiento:release -- --rollback=tmp/<recibo>.json
npm run conocimiento:release -- --rollback=tmp/<recibo>.json --apply=<digest-del-recibo>
```

La primera ejecución de rollback sin `--apply` muestra el resumen y digest del recibo; no escribe. Para aplicar se requiere `KNOWLEDGE_ADMIN_TOKEN` vigente, configuración de servicio y API compatible con las comprobaciones de revisión. No incluir claves o tokens en el documento ni en comandos guardados. El proyecto destino debe coincidir con el manifiesto/recibo. Los recibos son privados de operación y no se publican como contenido del cliente.

La reversión lee el recibo original y no depende de que los ficheros curados sigan iguales. Restaura contenido y metadatos previos, archivando exclusivamente las creaciones de la entrega. Comprueba que nadie haya cambiado esas versiones; ante conflicto se detiene sin sobrescribir. Se vuelven a generar los embeddings de las bases con el proveedor canónico: se restaura contenido, no se promete identidad binaria de vectores ni retroceder el contador de versiones. Si una creación quedó con respuesta desconocida e ID pendiente, reanudar y conciliar el recibo antes de revertirla.

Después de activar o revertir, repetir las preguntas sobre el corpus completo y verificar consumidores y cachés existentes antes de darlo por publicado. La curación global no implementa el borrado de reseñas privadas y todos sus derivados; ese linaje y su política pertenecen a IMP-09.

## Siguiente bloque

**IMP-05: política ejecutable de recomendaciones con poca señal**, reutilizando A14/A23/A24/A25/A29 y las barreras económicas y de permisos existentes. Se transformarán estos criterios metodológicos en decisiones estructuradas, razones y condiciones de reevaluación verificables por backend.
