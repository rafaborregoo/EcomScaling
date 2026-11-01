import { A01_MODEL_DECISION, A08_MODEL_DECISION } from "@e-nora/contracts";
/** Auditoría inicial 27/10/2026; A01 cerrado y asignado el 28/10/2026. */
export const AUDIT_DATE = "2026-10-27";
export const SOURCES = {
  haiku: "https://platform.claude.com/docs/en/models/haiku-5-5/overview",
  sonnet: "https://platform.claude.com/docs/en/models/sonnet-5-5/overview",
  opus: "https://platform.claude.com/docs/en/models/opus-5-5/overview",
  legacyHaiku: "https://platform.claude.com/docs/en/models/haiku-4-5/overview",
  openai: "https://developers.openai.com/api/docs/models/gpt-6-luna",
  pricing: "https://developers.openai.com/api/docs/pricing",
};

export type AgentReview = {
  code: string;
  job: string;
  reads: string;
  candidate: string;
  reason: string;
  validation: string;
};

const economical = "Haiku 5.5 / Luna";
const balanced = "Sonnet 5.5 / GPT-6.1 Sol";

export const MODEL_OPTIONS = [
  {
    id: "gpt-6.1-terra",
    provider: "OpenAI",
    use: "Fijado para A04 en código; alternativa evaluada para A02. Despliegue remoto pendiente.",
    source: "https://developers.openai.com/api/docs/models/gpt-6.1-terra",
  },
  {
    id: "claude-haiku-5-5",
    provider: "Claude",
    use: "Clasificación, extracción, resúmenes y triage a volumen",
    source: SOURCES.haiku,
  },
  {
    id: "claude-sonnet-5-5",
    provider: "Claude",
    use: "Modelo principal asignado para A08; también análisis y agentes con varias herramientas",
    source: SOURCES.sonnet,
  },
  {
    id: "claude-opus-5-5",
    provider: "Claude",
    use: "Alternativa de mayor capacidad para A08; contrastar decisiones difíciles y entregables estratégicos",
    source: SOURCES.opus,
  },
  {
    id: "claude-fable-5-1",
    provider: "Claude",
    use: "Evaluación adicional si Opus no alcanza la calidad requerida",
    source: "https://platform.claude.com/docs/en/models/overview",
  },
  {
    id: "gpt-6-luna",
    provider: "OpenAI",
    use: "Tareas delimitadas y automatización frecuente",
    source: SOURCES.openai,
  },
  {
    id: "gpt-6.1-sol",
    provider: "OpenAI",
    use: "Razonamiento y herramientas con equilibrio de coste",
    source: "https://developers.openai.com/api/docs/models",
  },
  {
    id: "gpt-6-astra",
    provider: "OpenAI",
    use: "Comparar en los casos de razonamiento más exigentes",
    source: "https://developers.openai.com/api/docs/models",
  },
];

export const AGENT_REVIEWS: AgentReview[] = [
  {
    code: "a01_analista_llamadas",
    job: "Extraer resumen, acuerdos y tareas de llamadas",
    reads: "Transcripción y contexto del cliente",
    candidate: A01_MODEL_DECISION.label + " · asignado · revisión cerrada",
    reason:
      "Decisión de plataforma cerrada tras las pruebas de 30, 60 y 120 minutos y la revisión de todos los campos. Sol queda fijo en código para A01; Costes de IA usa el mismo ID exacto y las respuestas del laboratorio se conservan plegadas.",
    validation:
      "Validación archivada: pruebas CLI sintéticas y dos revisores automáticos, sin generación API de pago. El adaptador usa Responses con herramientas, salida JSON y razonamiento medio. La extracción de tareas mantiene la revisión y aprobación del consultor.",
  },
  {
    code: "a02_monitor_negocio",
    job: "Diagnosticar el negocio y detectar riesgos",
    reads: "Métricas multicanal, ventanas temporales y evidencias",
    candidate: "GPT-6.1 Sol · revisión cerrada y fijado en código",
    reason:
      "Decisión: Sol por su cautela financiera frente a Terra, en particular al distinguir atribución de causalidad. En un cliente con tienda y consultor estima 12,58 USD/mes frente a 5,98 de Terra; la diferencia requiere seguimiento de costes y calidad real.",
    validation:
      "35 respuestas nativas en cinco vistas, 16 campos por caso. Sol 77/0/3 frente a Terra 73/0/7; revisores automáticos, un cambio de revisor y falsos positivos documentados. Sin certificación API real.",
  },
  {
    code: "a04_generador_tareas",
    job: "Priorizar y proponer tareas",
    reads: "Diagnósticos, actividad y tareas existentes",
    candidate: "GPT-6.1 Terra · revisión cerrada y fijado en código",
    reason:
      "Por decisión del propietario se usa Terra, más económico; Sol queda como alternativa si la calidad real lo requiere. Sol concretó mejor la acción urgente y su cierre.",
    validation:
      "28 respuestas, cuatro escenarios y siete modelos. Dos revisores automáticos, con dudas y límites documentados; sin prueba de herramientas ni aprobación real. Despliegue remoto pendiente.",
  },
  {
    code: "a05_estrategia_campanas",
    job: "Diseñar y revisar campañas en el Estudio",
    reads: "Brief, catálogo, histórico y conversación",
    candidate: "GPT-6.1 Sol · revisión cerrada y fijado en código",
    reason: "Sol ofrece la mejor combinación observada de cautela y coste; Terra queda como alternativa para revisiones futuras.",
    validation:
      "21 respuestas y 16 campos por caso; falta validar herramientas, Meta y aprobación real. Despliegue remoto pendiente.",
  },
  {
    code: "a06_planificador_stock",
    job: "Prever demanda y priorizar riesgos de rotura por tienda",
    reads: "Inventario, ventas recientes, previsión semanal, tareas y campañas",
    candidate: "GPT-6.1 Terra · recomendado, decisión pendiente",
    reason: "Terra fue prudente ante el inventario histórico y los datos ausentes, y propuso la revisión de reposición con el UUID correcto en el escenario urgente. Su coste estimado es inferior a Sol para la misma carga.",
    validation: "28 respuestas válidas en cuatro casos; 16 campos revisados por dos modelos candidatos. Stock y plazos de proveedor necesitan prueba API real y revisión humana.",
  },
  {
    code: "a06_planificador_stock",
    job: "Proponer reposición y anticipar roturas",
    reads: "Inventario, demanda, previsiones y plazos",
    candidate: economical,
    reason:
      "Las cantidades deben calcularse en código; el modelo explica y prioriza.",
    validation:
      "Sin inventar stock, plazos o compras; contrastar estacionalidad y unidades.",
  },
  {
    code: "a08_gestor_conocimiento",
    job: "Auditar cobertura, índice y posibles brechas de conocimiento",
    reads: "Catálogo global y de organización, telemetría de búsqueda y candidatos semánticos",
    candidate: `${A08_MODEL_DECISION.label} asignado · fallback Claude Sonnet 5.5`,
    reason:
      "Seis respuestas con catálogo real autorizado: Terra conserva alcance y cautelas con dos revisiones internas útiles y menor coste que Sol. Sonnet es el respaldo entre proveedores.",
    validation:
      "Seis respuestas reales y doce sintéticas previas con contrato nativo. Contexto y búsqueda real preparados por runtime; CLI sin selección dinámica de herramientas ni API LLM. A08 es interno, manual y solo lectura.",
  },
  {
    code: "a09_copiloto_consultor",
    job: "Conversar, investigar contexto y usar herramientas",
    reads: "Chat, memoria, datos y resultados de herramientas",
    candidate: "Elección del usuario según plan y saldo",
    reason:
      "Es la excepción: conservar selección y mostrar el modelo realmente ejecutado.",
    validation:
      "Probar cada opción, agotamiento de saldo, herramientas y recibo de consumo.",
  },
  {
    code: "a11_generador_marketing",
    job: "Generar contenido de marketing",
    reads: "Marca, productos, brief e historial",
    candidate: "Seis modelos en comparación · revisión humana pendiente",
    reason:
      "18 borradores del Estudio en TEST ES IA: email, Meta e Instagram para Haiku, Sonnet, Opus, Luna, Sol y Terra. El propietario revisa las piezas antes de elegir modelo; Astra queda fuera de esta comparación.",
    validation:
      "18/18 contratos nativos válidos. Datos sintéticos y CLI sin herramientas ni imágenes. Se comparan diseño, voz, literal, paleta, datos y precio; cumplir el contrato no prueba calidad editorial. Corregido el guardado de metadatos largos; original conservado.",
  },
  {
    code: "a12_analista_email",
    job: "Analizar rendimiento de email",
    reads: "Métricas y contexto de Klaviyo",
    candidate: economical,
    reason: "Lectura estructurada; escalar interpretación causal compleja.",
    validation:
      "Atribución correcta, muestra suficiente y ninguna causalidad inventada.",
  },
  {
    code: "a13_operativa_shopify",
    job: "Diagnosticar operativa de tienda",
    reads: "Pedidos, catálogo, inventario y alertas",
    candidate: economical,
    reason: "Triage frecuente sobre datos estructurados.",
    validation:
      "Moneda, tienda, periodo y propuestas verificables sin escritura automática.",
  },
  {
    code: "a14_operativa_meta",
    job: "Analizar operativa publicitaria",
    reads: "Campañas, gasto, rendimiento e historial",
    candidate: balanced,
    reason:
      "Decisiones sobre inversión necesitan distinguir medición y rentabilidad.",
    validation:
      "No recomendar cambios sin muestra y atribución; respetar presupuesto.",
  },
  {
    code: "a15_analista_imagenes",
    job: "Describir y etiquetar creatividades",
    reads: "Imágenes reales y contexto de marca",
    candidate: "Haiku 5.5 / Luna; contrastar GPT-6.1 Terra",
    reason:
      "Clasificación visual acotada antes de pagar razonamiento más caro.",
    validation:
      "OCR, producto y atributos visibles; no describir imágenes que no llegaron.",
  },
  {
    code: "a16_texto_sobre_imagen",
    job: "Preparar texto para piezas visuales",
    reads: "Brief, imagen, marca y restricciones de composición",
    candidate: economical,
    reason: "Texto breve con restricciones comprobables.",
    validation:
      "Longitud, legibilidad, idioma y correspondencia entre brief y pieza.",
  },
  {
    code: "a17_plan_semanal",
    job: "Organizar el trabajo semanal",
    reads: "Objetivos, tareas, capacidad y camino activo",
    candidate: balanced,
    reason:
      "Prioridades y dependencias importan más que el volumen de lectura.",
    validation: "Plan realizable, sin duplicación y con vínculo a objetivos.",
  },
  {
    code: "a18_plan_mensual",
    job: "Planificar hitos del mes",
    reads: "Objetivos, recursos, resultados y estrategia",
    candidate: balanced,
    reason: "Planificación de horizonte largo con restricciones.",
    validation: "Hitos medibles, recursos suficientes y secuencia viable.",
  },
  {
    code: "a19_arquitecto_camino",
    job: "Construir la estrategia de Mi camino",
    reads: "Intake, diagnóstico, contexto y oportunidades",
    candidate: "Sonnet 5.5 / GPT-6.1 Sol; comparar Opus y Astra",
    reason:
      "Entregable estratégico poco frecuente: justificar calidad antes que ahorrar céntimos.",
    validation:
      "Coherencia integral, fuentes reales y objetivos ejecutables; evaluar Opus frente al modelo base.",
  },
  {
    code: "a19_revision_camino",
    job: "Revisar avance y ajustar el camino",
    reads: "Plan activo, hitos, resultados y aprendizajes",
    candidate: balanced,
    reason: "Debe decidir si mantener o cambiar una estrategia con evidencia.",
    validation:
      "No cerrar hitos sin pruebas ni confundir ejecución con resultado.",
  },
  {
    code: "a20_retencion_clientes",
    job: "Detectar oportunidades de retención",
    reads: "Clientes, cohortes, recurrencia y compras",
    candidate: "Haiku 5.5 / Luna tras reducir contexto",
    reason:
      "La línea base acumula 446.049 tokens de entrada por ejecución; revisar consultas y segmentación primero.",
    validation:
      "Cohortes, consentimiento y segmentos correctos; medir tokens por llamada, no solo por ejecución.",
  },
  {
    code: "a21_adquisicion_shopify",
    job: "Analizar adquisición y conversión",
    reads: "Tráfico, clientes, compras y embudo",
    candidate: balanced,
    reason: "Cruza atribución, conversión y unit economics.",
    validation:
      "No mezclar canales, monedas ni cohortes; separar correlación y causa.",
  },
  {
    code: "a22_postventa_shopify",
    job: "Detectar problemas de postventa",
    reads: "Pedidos, devoluciones y contexto operativo",
    candidate: economical,
    reason: "Detección y clasificación de incidencias.",
    validation:
      "No inventar políticas ni ejecutar compensaciones; evidencia por pedido.",
  },
  {
    code: "a23_creatividad_meta",
    job: "Analizar creatividades y proponer mejoras",
    reads: "Rendimiento, evidencias visuales e histórico",
    candidate: balanced,
    reason: "Une contenido visual, fatiga y rendimiento.",
    validation:
      "Separar lo observado de hipótesis y controlar muestra y rotación.",
  },
  {
    code: "a24_medicion_meta",
    job: "Evaluar integridad de medición",
    reads: "Eventos, atribución, cobertura y experimentos",
    candidate: balanced,
    reason:
      "Un falso diagnóstico de medición puede cambiar decisiones de inversión.",
    validation:
      "Detectar datos incompletos, evitar causalidad falsa y mantener las puertas de evidencia.",
  },
  {
    code: "a25_cambios_meta",
    job: "Investigar cambios en resultados",
    reads: "Historial de cambios y métricas antes/después",
    candidate: balanced,
    reason: "Investigar causas exige comparar hipótesis y ventanas.",
    validation:
      "Orden temporal correcto, factores alternativos y abstención sin evidencia.",
  },
  {
    code: "a26_contenido_email",
    job: "Auditar y revisar contenido de email",
    reads: "Mensajes, marca, inventario y revisiones previas",
    candidate: "Haiku 5.5 para triage; Sonnet para revisión",
    reason: "Separar lectura repetitiva de decisiones editoriales complejas.",
    validation:
      "Respetar muestreo, revisión, versiones y correspondencia exacta con el borrador.",
  },
  {
    code: "a27_planificador_mailing",
    job: "Planificar secuencias de mailing",
    reads: "Calendario, segmentos, productos e histórico",
    candidate: balanced,
    reason: "Coordina varios envíos con restricciones y dependencias.",
    validation:
      "Cadencias viables, segmentos compatibles y entregas sin duplicados.",
  },
  {
    code: "a28_arquitecto_flujos",
    job: "Diseñar automatizaciones de Klaviyo",
    reads: "Flows, eventos, catálogo y estrategia de retención",
    candidate: balanced,
    reason:
      "El diseño de ramas y condiciones requiere razonamiento estructural.",
    validation:
      "Eventos y condiciones válidos, exclusiones y coordinación verificadas.",
  },
  {
    code: "a29_analista_metrica",
    job: "Explicar una métrica y proponer siguientes pasos",
    reads: "Contexto específico de la métrica y feedback",
    candidate: balanced,
    reason:
      "Interpretación delimitada, pero con cifras y explicación causal delicadas.",
    validation:
      "Contrato de salida, cifras originales, alcance exacto y feedback sin duplicar ejecuciones.",
  },
];

/** Revisión individual basada en las muestras del laboratorio; no modifica routing. */
export const AGENT_MODEL_ANALYSES: Record<
  string,
  {
    heading: string;
    evidence: string;
    candidates: string[];
    unresolved: string;
    readings: Record<string, string>;
    taskReview?: { scenario: string; detail: string }[];
  }
> = {
  a11_generador_marketing: {
    heading: "A11: revisión humana de los borradores del Estudio",
    evidence: "Tres casos de control por seis modelos: 18 respuestas y 18 contratos válidos. Además, Terra completa la comparación histórica de email. Se utilizó el prompt activo v11 del entorno TEST ES IA. Los casos nuevos son sintéticos y no ejecutan herramientas, generación de imágenes, envío ni publicación.",
    candidates: [],
    unresolved: "No se fija ganador. El propietario revisa con borregorafa99@gmail.com los 18 borradores [LAB A11] en Marketing > Contenido de E-NORA Demo (entorno de pruebas), abre cada pieza en el Estudio y deja su valoración. El precio es una estimación API sobre tokens CLI con sobrecarga; no es una factura. Codex no confirma el ID servido. A11 es manual; las cuatro generaciones mensuales de Costes son una hipótesis de uso, no una cadencia automática.",
    readings: {
      "claude-haiku-5-5": "Tres contratos válidos. Email con varios módulos y blanco añadido a la paleta; revisar estructura y pie de baja. Meta e Instagram listos para comparar el texto.",
      "claude-sonnet-5-5": "Tres contratos válidos. Email usa los tres colores facilitados y añade módulos; revisar la voz y el detalle. En Meta usa 'agradable al tacto', una valoración que debe contrastarse con las restricciones de afirmaciones.",
      "claude-opus-5-5": "Tres contratos válidos. Email con paleta facilitada y pie adicional; Instagram más desarrollado. El precio superior requiere una mejora editorial que confirme el propietario.",
      "gpt-6-luna": "Tres contratos válidos. Piezas más breves y precio bajo en estos casos. Revisar colores neutros añadidos al email y el enlace de baja; brevedad no equivale a menor calidad.",
      "gpt-6.1-sol": "Tres contratos válidos. Email conserva los tres bloques principales; incorpora blanco para contraste. Revisar si la voz y el resultado visual justifican el precio frente a Terra y Luna.",
      "gpt-6.1-terra": "Tres contratos válidos. Incluido en los tres canales y en el caso histórico. Email más breve y sin precio en el texto, dato que el brief permitía omitir. Comparar diseño, CTA y voz antes de elegir.",
    },
  },
  a04_generador_tareas: {
    heading:
      "A04 cerrado: GPT-6.1 Terra asignado en código",
    evidence:
      "28 respuestas nativas: cuatro casos por siete modelos, incluido Terra. Uno reproduce un snapshot real histórico y tres son sintéticos. Dos revisores automáticos, que también son candidatos, valoran 16 campos: Astra 59 sin fallo detectado / 0 fallos coincidentes / 5 dudas; Luna 57/3/4; Terra 54/0/10; Sol 53/0/11; Opus 43/6/15; Sonnet 40/7/17; Haiku 39/5/20. No son porcentajes de precisión ni fallos independientes. Algunas dudas proceden de citas del revisor que no se pudieron verificar. Los fixtures se corrigieron por periodo, nombre de tienda y cobertura; las tandas anteriores quedan archivadas y no cuentan contra los modelos.",
    candidates: [],
    unresolved:
      "Por decisión del propietario se fija Terra; Sol queda como alternativa si la calidad observada lo requiere. Sol concretó mejor la tarea urgente y su cierre, mientras Terra fue menos preciso sobre el proveedor. En 60 ejecuciones mensuales de ejemplo, Sol estima 4,11 USD por cliente y Terra 1,96; Astra 17,75 y Luna 0,16. Son cuatro respuestas por modelo, con datos CLI y sobrecarga variable: no demuestran equivalencia ni rentabilidad real. El escenario supone una ejecución diaria por organización y otra por tienda, sin refrescos manuales; hay límites, herramientas y reintentos no medidos. La decisión queda aplicada en código y requiere desplegarse para afectar al entorno remoto. Antes de producción hay que definir un límite manual: el defecto de pruebas es 1.000/día por organización y agente si no se configura otro.",
    readings: {
      "claude-haiku-5-5":
        "39/5/20. En el snapshot caducado propuso dos tareas, extendió la recuperación a cambios comerciales y usó cifras históricas con urgencia. El coste estimado del escenario mensual es 0,30–0,37 USD; su bajo precio no compensa esos fallos en esta muestra.",
      "claude-sonnet-5-5":
        "40/7/17. En el histórico mezcla referencias antiguas y propone actuaciones comerciales; en la urgencia amplía la tarea a Meta y pide cambios antes de confirmar proveedor. Estimación mensual 2,92–4,11 USD.",
      "claude-opus-5-5":
        "43/6/15. Amplía la urgencia a decisiones de venta y canales sin evidencias suficientes, y cita fuentes históricas en el caso caducado. Estimación mensual 6,36–8,73 USD.",
      "gpt-6-luna":
        "57/3/4, el menor coste estimado: 0,16 USD/mes. En el histórico no explicó qué tareas existentes avanzar y citó fuentes caducadas; en la urgencia no advirtió suficientemente la falta de plazo del proveedor. La versión de TEST consultada antes de la decisión tenía Luna.",
      "gpt-6.1-sol":
        "53/0/11; varias dudas son citas no verificables de un revisor o diferencias de criterio, no fallos confirmados. Recupera evidencia en el caso histórico, evita duplicados y concreta en la urgencia qué pedir al proveedor y cómo cerrar si no responde. Estimación: 4,11 USD/mes; ID servido por Codex sin confirmar.",
      "gpt-6-astra":
        "59/0/5, el mayor número de campos sin fallo detectado en esta revisión, pero se abstiene de crear una nueva tarea en el caso histórico y el evaluador duda de si explica qué avanzar hoy. Estimación: 17,75 USD/mes, sin ventaja suficiente demostrada frente a Sol para su sobrecoste.",
      "gpt-6.1-terra":
        "54/0/10 y 1,96 USD/mes estimados. Evita duplicar la tarea cubierta y propone recuperar datos o solicitar costes; en la urgencia su paso es menos concreto que el de Sol y no indica cómo cerrarlo si el proveedor no responde. En el caso cubierto omite la hora de vencimiento y no advierte que el plazo de suministro falta. ID servido sin confirmar.",
    },
  },
  a05_estrategia_campanas: {
    heading: "A05: GPT-6.1 Sol principal, GPT-6.1 Terra fallback",
    evidence: "Comparacion disponible en cuatro escenarios con el mismo contexto: dos replays historicos de la tienda TEST (uno con contrato nativo) y dos controles sinteticos (campana viable y duplicada/stock escaso). Los seis modelos acordados completaron las cuatro respuestas; en los tres casos con contrato nativo, cada modelo valido 3/3. En la muestra historica extensa, Sol y Terra se abstienen de lanzar acciones porque inventario y audiencias no estan verificados. La revision automatica de ese replay no es una aprobacion humana; los tres escenarios nativos siguen sin revision por campos guardada.",
    candidates: [],
    unresolved: "Sol queda como principal por la respuesta mas prudente y util en el escenario historico y una propuesta contenida en el caso viable. Terra es fallback entre proveedores: tambien separa historico de condiciones actuales y evita ejecutar con datos obsoletos; en el caso viable plantea dos envios apoyandose en un unico antecedente, por lo que conviene revisar la cadencia. Haiku/Sonnet/Opus tienden a proponer mas envios con evidencia limitada; Luna se abstiene incluso en el escenario viable. El snapshot real llega hasta el 12/10/2026, incluye stock sincronizado el 09/10 y no debe usarse para lanzar campañas actuales. Herramientas no se ejecutaron. A05 es manual, asi que 30 generaciones al mes es solo una comparacion de coste, no una frecuencia observada. La ejecucion de laboratorio por CLI no valida el ID servido ni el coste API facturado.",
    readings: {
      "claude-haiku-5-5": "Cuatro respuestas completadas. Detalla riesgos, pero propone dos envios a partir de una sola referencia historica. Aproximadamente 0,29 USD por 30 generaciones sin cache.",
      "claude-sonnet-5-5": "Cuatro respuestas completadas. Analisis util, aunque deriva objetivos y dos envios de una muestra historica muy pequena. Aproximadamente 3,80 USD por 30 generaciones sin cache.",
      "claude-opus-5-5": "Cuatro respuestas completadas. Coste alto (4,99 USD por 30 generaciones) y extrapola riesgo de rotura desde inventario obsoleto; no aporta ventaja clara para A05.",
      "gpt-6-luna": "Cuatro respuestas completadas. Rapido y barato (0,11 USD por 30 generaciones); se abstiene bien ante datos caducados, pero tambien ante el caso viable.",
      "gpt-6.1-sol": "Principal elegido. Separa datos historicos de condiciones vigentes, evita ejecuciones inventadas y propone una sola iniciativa contenida cuando el caso sintetico si tiene evidencia. Aproximadamente 2,55 USD por 30 generaciones.",
      "gpt-6.1-terra": "Fallback elegido entre proveedores. Prudente con el snapshot historico y competitivo (1,47 USD por 30 generaciones); revisar su propuesta de dos envios en el escenario viable.",
    },
  },
  a08_gestor_conocimiento: {
    heading: "A08 revisado con datos reales: Terra principal, Sonnet de respaldo",
    evidence: "31/10: seis respuestas con contrato nativo sobre el mismo contexto autorizado de Prueba Borrego: 338 documentos activos e indexados, 316 de metodología global y 22 de organización, 2.589 fragmentos y una muestra documental de 16. Corregida la auditoría que omitía 316 documentos globales. Una búsqueda real de contraste fue preparada por el arnés; los modelos CLI no eligieron herramientas. Sin Astra. Se conservan los casos sintéticos anteriores y las respuestas originales.",
    candidates: [],
    unresolved: "Terra queda asignado en código por prudencia, utilidad y coste; Sol es alternativa y Sonnet respaldo de mayor capacidad en otro proveedor. Auditoría interna y de solo lectura, visible al consultor en Conocimiento → Gestor IA. No crea tareas ni necesita aprobación para leer el resultado. Coste de referencia Terra: 0,0451 USD por ejecución; 0,1805 USD si se solicitan cuatro al mes. Es manual, sin frecuencia mensual obligatoria. Equivalencias API con tokens CLI y tarifas internas del 28/10, no factura; excluyen herramientas y reintentos. Una muestra por modelo no prueba superioridad estadística y Codex no acredita el ID servido.",
    readings: {
      "claude-haiku-5-5": "0,0069 USD/ejecución. Cifras correctas, pero eleva a incidencia urgente unos supuestos ya declarados ficticios y propone centralizar documentos por coincidencia temática sin acreditar redundancia.",
      "claude-sonnet-5-5": "Respaldo: 0,0729 USD/ejecución y 17 s. Buena síntesis y cautelas; defecto conservado: atribuye a la misma tienda dos cuestionarios cuyo store_id es null.",
      "claude-opus-5-5": "0,1845 USD/ejecución. Detecta el potencial problema de indexar cifras sin la pregunta, pero afirma no duplicidad con demasiada firmeza y supone un plazo vencido no persistido.",
      "gpt-6-luna": "El menor coste: 0,0040 USD/ejecución. Correcto en cobertura y candidatos; no explica el carácter ficticio de los valores y asigna confianza alta con evidencia parcial.",
      "gpt-6.1-sol": "Alternativa: 0,0941 USD/ejecución y 45 s. La respuesta más conservadora, sin errores materiales observados ni acciones inventadas; mayor coste que Terra para una lectura comparable.",
      "gpt-6.1-terra": "Elegido: 0,0451 USD/ejecución y 19 s. Respeta organización/tienda, cifras ficticias, muestra y telemetría incompleta. Dos recomendaciones internas razonables, sin tareas ni escrituras. ID servido no acreditado por Codex.",
    },
  },
  a06_planificador_stock: {
    heading: "A06: Haiku 5.5 asignado y piloto de stock por eventos",
    evidence: "31/10: seis respuestas válidas sobre el mismo contexto runtime real de E-NORA Demo TEST: 30 días, doce semanas observadas, ocho productos con demanda, niveles actuales y dos propuestas anteriores pendientes. Los seis usan IDs válidos y no duplican esas propuestas. Tareas nuevas: Haiku 2, Sonnet 2, Opus 3, Luna 2, Sol 6 y Terra 4. Más tareas no significa peor calidad: se revisó su evidencia y prioridad. El histórico de pruebas sintéticas se conserva; esta muestra TEST también contiene datos de demostración y no es precisión estadística.",
    candidates: ["claude-haiku-5-5", "claude-sonnet-5-5", "claude-opus-5-5", "gpt-6-luna", "gpt-6.1-sol", "gpt-6.1-terra"],
    unresolved: "Se mantiene Haiku como ejecución habitual por coste y priorización suficiente; Sol de respaldo de mayor capacidad en otro proveedor. Referencia sin caché para 30 ejecuciones: Haiku 0,44 USD, Terra 1,94 y Sol 5,44, calculados con tokens CLI y tarifas internas de referencia 28/10, no factura ni medición API. Haiku añade etiquetas source_flow_refs inaplicables y usa el plazo interno del hito en el resumen, aspectos conservados en la revisión. Sonnet es más compacto; Terra es una alternativa equilibrada y Sol desarrolla más, con repetición. Una revisión por tienda/día si cambió actividad, compartida entre cliente y consultor; leer no genera otra llamada. Piloto por eventos en shadow: no añade llamadas LLM. Se corrigió la deduplicación de propuestas pendientes también en revisión periódica. Falta validar herramientas/latencia API; Codex no acredita el modelo servido.",
    taskReview: [
      { scenario: "Runtime real E-NORA Demo · 31/10/2026", detail: "Haiku propone Arcilla y Boreal, las urgencias no cubiertas; conserva Bruma/Arena pendientes. Terra añade Cargo y Camiseta; Sol añade además Gorra y Calcetín con menor prioridad. Todas son revisiones y no cantidades de compra. Luna cuenta cuatro productos con menos de ocho días, aunque la fuente contiene cinco; Opus atribuye sin detalle la exclusión de agotados a falta de ventas." },
      { scenario: "Piloto por eventos · 30 → 10 unidades", detail: "Añadidas 18 respuestas válidas: control periódico, evento con el mismo snapshot y evento con propuesta previa pendiente, seis modelos sin Astra. Los seis revisan el riesgo sin ordenar compras y evitan duplicar la propuesta pendiente. Haiku obtiene 48/0/0 campos en esta tanda; el resultado es prometedor, aunque el conjunto es pequeño. Opus interpreta el contador descriptivo de stock bajo como si debiera coincidir con el riesgo por cobertura: no son equivalentes. El piloto conserva contexto completo, usa umbrales de revisión configurables y sigue en observación sin API. Haiku 5.5 queda asignado; Sol es su respaldo de mayor capacidad." },
      { scenario: "Stock histórico sin sincronizar", detail: "La tarea de Haiku para reconectar Shopify y validar los ocho productos es pertinente; no ordena comprar, aunque ‘esta semana’ es impreciso para el hito que vence hoy. Sonnet recomienda revisar Bolsa Mini Bruma, Sudadera Oversize Arena y Camiseta Básica tras sincronizar; Opus recomienda contar productos y resolver propuestas previas, pero cuenta dos veces los diez días. Luna, Sol y Terra piden sincronizar sin crear tarea." },
      { scenario: "Stock urgente · Camiseta Nube, 4 unidades y 4 ventas/día", detail: "Los seis proponen revisar la reposición con el UUID correcto, sin compra automática. Sol especifica mejor proveedor, entradas pendientes y aprobación; Terra marca urgencia, pero su vencimiento ‘lo antes posible’ es impreciso; Opus usa severidad crítica discutible." },
      { scenario: "Tarea T-06 ya abierta", detail: "Los seis evitan crear un duplicado; aquí no crear otra tarea es lo correcto. Luna deja vacías las recomendaciones y pierde el seguimiento del riesgo; los demás mantienen alguna orientación sin duplicar." },
      { scenario: "Inventario ausente y semanas incompletas", detail: "Haiku y Opus crean una tarea para revisar la sincronización de NUBE-01, sin proponer compra; las recomendaciones de los otros cuatro son prudentes. La tarea de Opus dice que la variante está sincronizada aunque el estado general dice inventory_not_synced; conviene corregir ese texto antes de aprobarla." },
    ],
    readings: {
      "claude-haiku-5-5": "Runtime real: 2 tareas urgentes, 9 hallazgos y confianza media. Detecta las semanas repetidas. Mantiene seguimiento del resto sin duplicar propuestas. Defecto: etiquetas de flow inventadas en campos inaplicables. Referencia: 0,44 USD/30 ejecuciones.",
      "claude-sonnet-5-5": "Runtime real: 2 tareas y 6 hallazgos, lectura compacta y prudente; detecta la anomalía semanal. Referencia CLI: 7,25 USD/30 ejecuciones; no se observa una mejora que justifique ese coste para la rutina.",
      "claude-opus-5-5": "Runtime real: 3 tareas; la revisión adicional de Cargo es razonable. Atribuye sin prueba por producto la ausencia de agotados a falta de ventas. Referencia: 10,18 USD/30 ejecuciones.",
      "gpt-6-luna": "Runtime real: 2 tareas correctas, pero cuenta cuatro productos con menos de ocho días donde hay cinco y usa confianza alta. Referencia: 0,15 USD/30 ejecuciones; el precio menor no compensa esa cautela insuficiente.",
      "gpt-6.1-sol": "Runtime real: 6 revisiones justificadas, con prioridades distintas y sin duplicar. Mejor desarrollo, pero 20 hallazgos repiten parcialmente riesgo y escenario por producto. Referencia: 5,44 USD/30 ejecuciones. Se conserva como respaldo.",
      "gpt-6.1-terra": "Runtime real: 4 tareas razonables y 9 hallazgos; buen equilibrio para más detalle, con confianza media. Omite advertir las semanas repetidas. Referencia: 1,94 USD/30 ejecuciones; alternativa, sin cambiar el modelo habitual.",
    },
  },
  a02_monitor_negocio: {
    heading: "A02 cerrado: GPT-6.1 Terra asignado; Sol como fallback",
    evidence:
      "Seis modelos ejecutados en Overview cliente y Panel consultor con datos reales de E-NORA Demo TEST, seis meses de historico y diagnosticos previos sin aprobar. Cada una de las 12 respuestas se reviso en 16 campos con dos jueces automaticos; Sonnet y Sol tambien eran candidatos. Balance combinado pass/fail/uncertain: Terra 29/0/3; Sol 30/0/2; Haiku 25/2/5; Luna 24/3/5; Sonnet 22/2/8; Opus 20/4/8. Terra cuesta unos $0.084 por una lectura Overview y otra Panel; Sol $0.182. Muestra pequena, sin valor estadistico.",
    candidates: [],
    unresolved:
      "Eleccion del propietario (29/10/2026): GPT-6.1 Terra queda como modelo fijo para A02 en las vistas cliente y consultor; GPT-6.1 Sol es fallback ante rate limit, timeout o indisponibilidad antes de consumir tokens. Sol supera un criterio mas, pero Terra no tiene fallos coincidentes y reduce alrededor del 54% el coste de este par de vistas. Octubre es parcial; Meta es atribucion, no incrementalidad; el recuento de nuevos clientes no permite confiar en CAC; los diagnosticos anteriores siguen pendientes de aprobacion. No hay ejecucion real de API/herramientas ni confirmacion del ID servido en Codex. No es una garantia estadistica ni una proyeccion mensual.",
    readings: {
      "gpt-6.1-terra": "29/0/3 en las dos vistas; $0.084 por una lectura cliente y una de consultor. Sin fallos coincidentes. Modelo elegido por calidad cercana a Sol con menor coste; respuesta visible en laboratorio.",
      "gpt-6.1-sol": "30/0/2; $0.182 por el mismo par. Un criterio mas sin fallo detectado; queda como respaldo de mayor calidad observada.",
      "gpt-6-luna": "24/3/5; $0.007. Fallos: titulo de ventas no respaldado por la cifra vs objetivo y nombre de tienda inventado como Huerta Norte en el panel.",
      "claude-haiku-5-5": "25/2/5; $0.021-$0.025. Buenas advertencias financieras, pero dos contradicciones u omisiones materiales segun la revision por campos.",
      "claude-sonnet-5-5": "22/2/8; $0.209-$0.269. Mas dudas y fallos que Terra y Sol en estas dos respuestas.",
      "claude-opus-5-5": "20/4/8; $0.410-$0.515. Coste mas alto y cuatro fallos coincidentes en el par.",
    },
  },
  a01_analista_llamadas: {
    heading:
      "A01 cerrado: GPT-6.1 Sol asignado en código para todas las duraciones",
    evidence:
      "Revisión del 28/10: dos evaluadores recibieron el prompt, contexto y transcripción completos y revisaron los 14 campos y sus subcampos en las 18 respuestas guardadas. Sol: 41 campos sin fallo detectado, 0 fallos coincidentes y 1 comprobación por resolver por una cita del propio revisor. Astra: 36/0/6; Opus: 31/3/8; Haiku: 20/9/13; Sonnet: 19/5/18; Luna: 17/15/10 (sin fallo/fallos/por resolver). No son porcentajes de precisión. Los controles iniciales de hechos no detectaban los errores de señales, citas y huecos. A 120 min, Sol estima 0,1293 USD y Opus 0,3672–0,5092 USD.",
    candidates: [],
    unresolved:
      "Decisión cerrada por el propietario el 28/10/2026: Sol queda fijado en la política compartida del runtime, laboratorio y Costes de IA. El ID gpt-6.1-sol usa Responses API, herramientas y razonamiento medio; sus tarifas y capacidades están registradas. El contexto de A01 admite transcripciones largas y rechaza un análisis que haya recortado evidencia. Las comparaciones anteriores y los fallos de otros modelos quedan archivados; no bloquean esta decisión. La validación de calidad sigue siendo CLI sintética con revisores automáticos, no una prueba de generación API pagada ni una garantía de precisión. Las tareas extraídas se crean tras revisión y aprobación del consultor.",
    readings: {
      "claude-haiku-5-5":
        "Barato, pero 9 fallos coincidentes de campo en el conjunto: resumen con recuento inventado a 30 min, ampliación de tareas, huecos de temas ya tratados, citas y señales. El precio de 30 min informado por CLI tampoco cuadra con la tarifa API de contexto largo.",
      "claude-sonnet-5-5":
        "Rápido (24–26 s), pero 5 fallos coincidentes en el conjunto: hueco indebido a 30 min, dependencia no verificada en recomendaciones a 60 min y atribución de señales del cliente. Pendientes adicionales de cobertura y evidencia.",
      "claude-opus-5-5":
        "Buen control de hechos y acuerdos, pero no es un techo de calidad: el campo de señales falla en las tres duraciones al atribuir al cliente también el compromiso del consultor. Más caro que Sol y sin ventaja de calidad demostrada en esta revisión.",
      "gpt-6-luna":
        "El menor precio, pero 15 fallos coincidentes de campo: a 120 min estima turnos muy alejados de los 338 reales, inventa huecos de temas tratados y omite seguimiento en el resumen. También hay citas modificadas, tareas sin responsable real y advertencias insuficientes.",
      "gpt-6.1-sol":
        "Modelo seleccionado y fijado para A01. Pruebas archivadas: 14/14 campos sin fallo detectado a 30 y 60 min; 13/14 a 120 min, sin fallo coincidente y una duda de cita del revisor. 0,1293 USD estimados a 120 min. La CLI no confirmó el ID servido; el código solicita el ID oficial gpt-6.1-sol.",
      "gpt-6-astra":
        "Sin fallos coincidentes, pero seis campos por resolver sobre cobertura de resumen, riesgos y confianza en el conjunto. A 120 min estima 0,6056 USD, unas 4,7 veces Sol, sin mejora de calidad observada. ID servido no confirmado.",
    },
  },
};

export const FINDINGS = [
  {
    priority: "Alta",
    title: "El cliente podía cambiar el modelo de muchos agentes",
    resolved: true,
    evidence:
      "agent-schedule.ts · resolveAgentModel; ai-runtime.ts · runAgentTurnWithFallbackCore",
    detail:
      "La preferencia global del cliente prevalecía sobre la plataforma. Se corrigió el resolver: los especialistas usan plataforma y después defecto; el copiloto conserva su elección según plan y saldo.",
    action:
      "Corregido en código y probado. Retirado el selector global de especialistas por cliente. Pendiente desplegar para que lo use el servidor publicado.",
  },
  {
    priority: "Alta",
    title: "Costes podía sustituir un modelo desconocido por otro",
    resolved: true,
    evidence: "ai-cost-model.ts · toKnownModel; costes-ia/page.tsx · modelById",
    detail:
      "Se eliminaron la conversión de IDs y el respaldo al primer modelo de la tabla. Si falta una tarifa exacta, el simulador avisa y no presenta un total inventado. La mezcla de modelos del copiloto y los fallbacks aún requieren una proyección específica.",
    action:
      "Protección corregida en código. Sigue pendiente ampliar el catálogo y modelar el uso real del copiloto y los fallbacks.",
  },
  {
    priority: "Alta",
    title: "Contabilidad de caché unificada y créditos ponderados del Copiloto",
    resolved: true,
    evidence:
      "packages/ai/src/provider-capabilities.ts · ModelPricing / estimateCostUsd; index.ts · createTurnAccounting",
    detail:
      "El coste se acumula por llamada: Claude suma entrada nueva, lecturas y escrituras de caché (5 minutos y 1 hora); OpenAI distingue entrada nueva y cacheada sin duplicarla. Los resultados finales conservan ese coste. A09 descuenta 200.000 créditos por USD registrado e incluye el consumo de todos los modelos en la misma bolsa.",
    action:
      "Aplicado en código y base de pruebas. Pendiente desplegar API, web y migración en producción. Los costes históricos se conservan con la tarifa y contabilidad con las que se registraron; no se corrigen retroactivamente.",
  },
  {
    priority: "Alta",
    title:
      "Los adaptadores heredados de Sol 6 y Luna fuerzan razonamiento none",
    evidence: "packages/ai/src/index.ts · runAgentTurnOpenAI · requestBase",
    detail:
      "El adaptador heredado Chat Completions de GPT-6 Sol y Luna fuerza reasoning_effort: none cuando hay tools. A01 con GPT-6.1 Sol ya usa Responses y razonamiento medio, con pruebas de herramientas, streaming y JSON; los otros agentes conservan su configuración.",
    action:
      "Evaluar Responses para los agentes que necesitan herramientas y razonamiento; comprobar calidad y latencia con el mismo dataset.",
  },
  {
    priority: "Media",
    title: "El catálogo de capacidades y el de selección no coinciden",
    evidence:
      "provider-capabilities.ts · MODEL_CAPABILITIES / MODEL_PRICING; agent-schedule.ts · AGENT_MODEL_IDS",
    detail:
      "Corregidas la tarifa de respaldo de GPT-6 Sol y las entradas de capacidades de Sol y Luna. Haiku 5.5 aún no está en el selector de agentes; el modo reducido del copiloto sigue en Haiku 4.5 (200K).",
    action:
      "Actualizar capacidades, compatibilidad de SDK y tarifas tras comprobar acceso a los modelos; no sustituir IDs sin probar streaming, tools y JSON.",
  },
  {
    priority: "Media",
    title: "La media de tokens no representa todos los clientes",
    evidence:
      "ai-cost-model.ts · MIN_MEASURED_RUNS / BASELINE; costes-ia/cost-sim.ts · totals",
    detail:
      "Con tres ejecuciones se usa una media de 30 días; si no, una línea base de pruebas. No segmenta por modelo, versión, tienda o tamaño. Las medias por ejecución pueden sumar varias llamadas y no permiten deducir el tramo de contexto de cada petición.",
    action:
      "Medir p50/p95, llamadas por ejecución, retries, fallos facturados y coste por cliente activo; incluir escenarios de caché fría.",
  },
  {
    priority: "Media",
    title: "El fallback no es simétrico entre proveedores",
    evidence:
      "ai-runtime.ts · runAgentTurnWithFallbackCore / runOpenAiFallback",
    detail:
      "La rama Claude puede usar OpenAI ante fallos previos al consumo registrado. La rama de modelo gpt seleccionado retorna directamente y no incorpora un fallback equivalente a Anthropic. A02 usa gpt-4.1 como respaldo específico.",
    action:
      "Definir respaldo aprobado por agente, comprobar compatibilidad y registrar intento, modelo ejecutado y coste acumulado.",
  },
  {
    priority: "Media",
    title: "La estimación de IA no es el coste completo del software",
    evidence: "ai-cost-model.ts; ai-model-pricing.ts; packages/ai/src/index.ts",
    detail:
      "Costes proyecta tokens y frecuencias con topes globales; no calcula toda la infraestructura, almacenamiento, integraciones, embeddings, audio ni soporte. La sincronización de precios usa LiteLLM como fuente intermedia y una caché de una hora.",
    action:
      "Separar coste variable de IA, infraestructura compartida y coste operativo; mostrar origen y frescura de cada dato y reconciliar con factura del proveedor.",
  },
] as const;
