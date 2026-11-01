# A08 · conocimiento · revisión del 31/10/2026

Se continúa agente por agente después de A06. A07 (rendimiento de contenido) está inactivo y sin handler operativo; no se le atribuyen ejecuciones ni coste. El siguiente activo es A08, auditoría interna y de solo lectura del conocimiento, para consultor/plataforma. No es un agente de tareas del cliente.

## Contexto y método

TEST ES IA, organización Prueba Borrego, cliente borregorafa99@gmail.com y consultor asignado rafael@noraapp.es. Se comprobó la identidad y asignación reales. Caso `a08_gestor_conocimiento:real-org-methodology-runtime-2026-10-31`; captura `d395fa9a-fa8c-4577-a970-5478695ffcb4` detenida deliberadamente antes de la API LLM.

Contexto del runtime: 338 documentos activos, 316 globales consultant_only y 22 client_visible de esta organización; 338 indexados, 2.589 fragmentos, cero pendientes/sin fragmentos/sin embeddings. Catálogo paginado completo, pero muestra de metadatos limitada a 16. Comparación semántica acotada a 12 fuentes recientes y primer fragmento de hasta 700 caracteres. Un par candidato: cuestionarios de envío gratuito (750 €) y ticket objetivo (650 €), ambos sin tienda asignada. Similitud no acredita documentos duplicados.

Telemetría: 86 llamadas observadas, un error, nueve decisiones y ninguna señal recurrente de hueco. Registros antiguos sin match_count no permiten descartar preguntas sin resolver. Una búsqueda real search_knowledge fue preseleccionada por el arnés y adjuntada a todos los modelos; recuperó metodología global y el documento organizativo que identifica los importes como supuestos ficticios de planificación. No se probaron elecciones dinámicas de herramientas.

Se ejecutaron Haiku, Sonnet, Opus, Luna, Sol y Terra por CLI, sin Astra. Seis respuestas válidas con contrato nativo de lectura; el contrato normaliza approval_required=false y proposed_writes=[]. Se preservan los JSON originales, incluidos sus defectos. Una respuesta por modelo no prueba superioridad estadística. Codex JSONL no acredita el ID servido. No hubo llamadas API LLM ni consumo LLM facturado; las lecturas RAG/embeddings pueden consumir infraestructura propia.

## Decisión y contraste

**Terra principal, Sonnet respaldo de mayor capacidad entre proveedores, Sol alternativa.** La política compartida fija Terra y actualiza el perfil de costes a 37.831 tokens de entrada y 1.458 de salida, sin asumir caché. Aplica al runtime y a Costes/Laboratorio. Producción necesita despliegue del código; no se ha desplegado durante esta revisión.

| Modelo | Lectura | USD/ejecución sin caché | Duración CLI |
| --- | --- | ---: | ---: |
| Haiku | Cifras correctas; trata supuestos ya etiquetados como incidencia urgente y propone centralizar contenido por coincidencia temática | 0,0069 | 40 s |
| Sonnet | Buena síntesis; atribuye a la misma tienda dos documentos sin store_id. Defecto conservado y respaldo revisable | 0,0729 | 17 s |
| Opus | Detecta posible indexación de cifras sin pregunta; demasiado firme en no duplicidad y supone un plazo vencido no persistido | 0,1845 | 38 s |
| Luna | Menor coste; omite carácter ficticio de cifras y usa confianza alta con evidencia parcial | 0,0040 | 16 s |
| Sol | La respuesta más conservadora, sin errores materiales observados y sin acciones inventadas; mayor coste y latencia | 0,0941 | 45 s |
| Terra | Respeta alcance, cifras ficticias y límites; dos revisiones internas razonables sin tareas ni cambios | 0,0451 | 19 s |

Terra ofrece suficiente calidad para este corte y reduce aproximadamente a la mitad el coste de Sol. Su utilidad no se mide por cantidad de recomendaciones. La elección queda abierta a nueva evidencia, especialmente sobre herramientas dinámicas y documentos complejos.

A08 es manual, a nivel de organización. Leerlo desde otra cuenta no genera una nueva auditoría. Cuatro ejecuciones Terra equivaldrían a 0,1805 USD; treinta a 1,3536 USD. Son escenarios, no una frecuencia programada ni un gasto mensual comprometido. Tarifas internas de referencia del 28/10/2026 y tokens CLI: no factura ni consumo API garantizado. Herramientas, embeddings, fallback y reintentos se cuantifican aparte. El contador global conserva A08 como uso manual pendiente de frecuencia.

## Fallos corregidos

- El catálogo/RPC de A08 excluía 316 documentos globales consultant_only aunque la búsqueda sí podía consultar metodología. Nuevo alcance coherente: metodología global autorizada y documentos client_visible de la organización; sin notas privadas locales, system_only ni documentos privados de otros tenants.
- Tres RPC nuevos, estables e invoker, con EXECUTE solo service_role. Migración `20261031081043_a08_authorized_methodology_audit.sql` aplicada y verificada en TEST y producción. Las funciones anteriores no cambian. TEST: nuevo 338/316/22; anterior 22/0/22; organización inexistente 316/316/0. Sin acceso anon/authenticated ni security definer.
- La evidencia antes llamada «contenido exacto» es un extracto parcial: ahora su estado y prompt lo declaran explícitamente.
- Gestor IA se ofrecía al cliente pese al 403 del backend. La pestaña y contenido están reservados a consultor/plataforma, con aviso informativo en enlace profundo. La auditoría autorizada muestra también hallazgos de índice/cobertura antes ocultos por el filtro de incidencias internas.
- El fallback de una primaria OpenAI siempre invocaba OpenAI incluso si el ID configurado era Claude. Ahora se despacha al proveedor correcto; se conserva el respaldo interno OpenAI de los otros agentes. Solo ante fallo permitido previo a observar consumo; no tras error de contrato/presupuesto. Se prueba el despacho Sonnet/Anthropic, Sol/OpenAI y ausencia de credenciales.

## Resultado en la UI y verificación

Run compartido `06b13a98-e496-4083-b875-fc8d02901a70`, output `3a5f3a8c-f473-464b-bb9c-5ae793d5bc21`, published, approval_required=false, shadow, origen `cli-lab:a08-real-org-2026-10-31`, coste API null. Solo se persiste la respuesta seleccionada, sin modificar documentos ni crear tareas.

**Consultor → Prueba Borrego → Conocimiento → Gestor IA** (`/conocimiento?section=ia`): cuatro hallazgos, dos recomendaciones y sus límites. Cliente no ve esta auditoría interna: lectura y ejecución devuelven 403 con su identidad real. El consultor recibe exactamente el output seleccionado, sin aprobación previa para leerlo. La traza genérica también exige rol consultor/plataforma.

Laboratorio: ficha A08 con Terra, respaldo, coste unitario y escenarios; comparaciones/respuestas plegadas, caso real por defecto al abrirlas. Auditoría y Costes leen la misma política.

Scripts reproducibles: `a08-capture-real-org.mts`, `a08-review-real-org.mts`, `a08-share-and-verify-real-org.mts`. Artefactos locales `a08-real-org-reference.json`, `a08-real-org-review.json` y resultados del reporte. Inspector de persistencia idempotente.

Verificación: 17 pruebas focalizadas correctas (alcance, paginación, telemetría, política de costes y despacho de respaldo); build de contratos y typecheck web correctos. Revisión React de permisos, tablas, claves y hooks sin problemas nuevos. La comprobación de payload con identidades reales no equivale a captura visual autenticada.

Cierre: typecheck API también correcto, API local reiniciada con el código nuevo y health, Conocimiento y Laboratorio HTTP 200. La prueba de costes confirma Terra/OpenAI, perfil nuevo y cadencia manual cero. Relectura idempotente del inspector conserva el output elegido y los 403 del cliente. No fue posible una captura visual: el host de navegador de Computer Use está indisponible; no se presenta la verificación de datos/rutas como prueba visual.
