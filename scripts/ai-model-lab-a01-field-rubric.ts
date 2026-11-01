/** Rúbrica de campos v1, fijada antes de la segunda evaluación automática. */
export const A01_FIELD_RUBRIC = {
  summary:
    "Resumen fiel y comprensible: distingue hechos, hipótesis y acuerdos vigentes; recoge los cuatro compromisos, las revocaciones y el seguimiento sin inventar resultados. Evalúa cobertura y claridad, sin premiar extensión.",
  facts:
    "Solo hechos/declaraciones de la transcripción, sin traer datos exclusivos del snapshot. Stock Arena final 20, margen 35% simulado, envío desde 55 EUR. No convertir ejemplos ni petición citada en hechos. Verifica también las marcas temporales que añada.",
  decisions:
    "Conserva cuatro acuerdos finales (BIENVENIDA15 solo analizar, Nube/Luis/viernes, preparar Navidad/Inés/viernes sin lanzar, devoluciones/Elena/antes próxima llamada). No añade ideas rechazadas, responsables revocados, autorizaciones de lanzamiento o cambios Camino.",
  recommendations:
    "Revisa action, priority y rationale: son propuestas, no acuerdos ni ejecuciones. Evidencia suficiente para prioridad, hechos separados de inferencias; no dar por conocido canal, causa, pérdidas, margen ni stock ausente. Metodología nueva debe ser propuesta identificada.",
  risks:
    "Seguimiento de ABIERTA-17 y HIST-09 sin duplicarlas; límites de margen/stock y alerta Klaviyo, sin inventar causas o pérdidas. No afirmar ausencias de contexto que sí está entregado ni confundir stock Arena/Nube/Brisa.",
  proposed_tasks:
    "Exactamente cuatro tareas acordadas, sin duplicar ABIERTA-17/HIST-09. Comprueba CADA title, description, priority, owner y due_hint. Un owner consultor (Rafael/BIENVENIDA15), tres cliente (Luis/Nube, Inés/Navidad, Elena/devoluciones). Plazos literales: antes de la próxima llamada, el viernes, el viernes, antes de la próxima llamada. Descripción debe identificar persona y restricciones, sin ampliar acuerdo ni añadir impacto no medido.",
  proposed_campaign_ideas:
    "Solo una preparación Navidad/clientes recurrentes/viernes, sin aprobación de lanzamiento ni envíos ni meta cuantitativa inventada. Comprueba objective,audience,timing_hint,evidence_quote; la cita debe ser fragmento literal y respaldar el alcance. No incluir otoño.",
  proposed_camino_changes:
    "Lista vacía: objetivo 75.000 EUR sigue vigente y 90.000 EUR fue hipótesis rechazada.",
  key_quotes:
    "Cada cita debe existir literalmente en transcripción. Permite envoltorio de comillas o nombre de hablante si contenido y atribución son exactos. No permite cambiar mayúsculas dentro de un supuesto fragmento literal, inventar conectores ni fusionar fragmentos sin marcar omisión. Citas representativas, verificables y sin atribución errónea.",
  consultant_gaps:
    "Puede ser [] o contener huecos útiles. Puntúa como válido un hueco cuando la transcripción demuestra que quedó sin respuesta, decisión o siguiente paso y el contexto de tienda muestra por qué importa; incluye evidencia concreta. No exijas que sea [] solo porque el tema se mencionó. No inventes huecos a partir de datos ausentes, no repitas un asunto ya resuelto y no confundas una tarea de seguimiento acordada con una omisión del consultor.",
  conversation_signals:
    "Verifica cada label,value,about,reading,trend contra transcripción y RECUENTOS DETERMINISTAS adjuntos. Cada bloque de trabajo tiene CUATRO turnos. No afirmar tiempo de palabra a partir de número de turnos. about cliente no debe atribuir al cliente los cuatro compromisos porque uno es del consultor. Recuentos aproximados deben ser cercanos al real; no basta ~ para inventar cifras. reading debe ser inferencia/propuesta razonable, no hecho emocional inventado. trend solo sin_referencia (histórico sin medidas comparables).",
  sources:
    "Lista vacía porque no se habilitaron herramientas ni se consultaron documentos RAG. No inventar fuentes ni confundir transcripción con documento consultado.",
  confidence:
    "Indica si low/medium/high es coherente con límites explícitos y errores detectados. Este juicio solo mide coherencia interna, NO calibración estadística: no concluyas que high implica precisión medida. uncertain si no puede decidirse.",
  warnings:
    "Advierte límites materiales: caso sintético/contexto sin datos, propuestas pendientes de revisión, fuente no verificada y datos citados no confiables cuando relevante. No inventa problemas ni ausencia de histórico recibido. Comprueba exactitud de advertencias y marcas temporales.",
} as const;
