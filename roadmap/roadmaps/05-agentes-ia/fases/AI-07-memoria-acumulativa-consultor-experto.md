# AI-07 - Memoria acumulativa y consultor experto

## Estado

- **Estado real:** `planned_architecture_revision_required`
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-07-20
- **Dependencias:** AI-04, AI-05
- **No implementar tal como esta redactado abajo sin revisar primero el riesgo de diseño siguiente.**

### Riesgo de diseño real: memoria alimentandose de sus propios resumenes

El diseño actual (ver "Entregables" abajo) genera informes periodicos y los re-ingiere como documentos
privados del RAG, encadenados al informe anterior. Eso puede producir degradacion acumulativa: un dato
original con una imprecision pequeña se resume, el informe mensual resume el resumen semanal, un agente
cita el informe, y el siguiente informe incorpora esa cita — la imprecision se convierte en "historia" sin
que nadie vuelva a los datos fuente. La politica de retencion propuesta en "Entregables" (informes
semanales viejos resumidos en uno mensual) agrava esto si los originales se descartan: **no deben
eliminarse los informes/datos originales**, solo excluirse del retrieval por defecto (quedando disponibles
para auditoria).

Ademas, RAG por si solo no es memoria empresarial completa. Faltan explicitamente:

- **Memoria de decisiones y restricciones del cliente** (p. ej. "el cliente no quiere descuentos >15%",
  "se rechazo ampliar stock por caja") — no aparece en metricas ni en informes automaticos generados por
  un agente; necesita captura explicita, no inferida.
- **Seguimiento de resultado de recomendaciones** (recomendacion -> aceptada/rechazada -> accion -> KPI
  antes -> KPI despues -> efecto observado) — es la pieza que realmente convierte el sistema en algo que
  aprende, y hoy no existe ni como entregable de esta fase ni de otra. Ver propuesta de fase nueva
  `AI-08-outcomes-aprendizaje.md` en `roadmap/roadmaps/05-agentes-ia/README.md`.
- Los informes generados por IA deben marcarse explicitamente `derived`/`not_canonical`/
  `generated_by_agent`/`source_snapshot_ids`, nunca con el mismo peso que un dato original — esto no esta
  en el diseño de "Entregables" actual y deberia anadirse antes de implementar.

No se ha decidido todavia si esta fase se reescribe en 4 capas (factual estructurada / episodica /
semantica-RAG / derivada) o si se mantiene el diseño actual con las correcciones de arriba — es una
decision de Rafa, no una implementada aqui.

## Contexto

AI-04 ya deja instalada la base de RAG (`knowledge_documents` + `knowledge_chunks`,
embeddings Voyage, `search_knowledge`, clasificacion global/organizacion) y AI-08
(gestor de conocimiento, ver AI-05) ya vigila ese catalogo y detecta vacios. Pero hoy
esa base solo se llena de forma manual (subida de documento/texto en `/conocimiento`)
o via transcripcion de llamada (`source_type = 'call_transcript'`, DB-08). Los agentes
automaticos (A02/A04/A06) no dejan rastro de si mismos: cada ejecucion parte de cero,
lee los ultimos 30 dias de metricas via SQL y olvida todo al terminar. No hay memoria
de que paso el mes pasado, que decisiones se tomaron, ni como evoluciono el negocio.

El objetivo de esta fase es que el agente deje de ser un analista que mira una foto
fija cada vez y pase a acumular contexto real de cada cliente a lo largo de meses,
para funcionar como un consultor que "conoce" a la tienda.

## Objetivo

Generar automaticamente informes periodicos (semanal/mensual) por organizacion y
re-ingerirlos como conocimiento privado, para que los agentes citen tendencias e
historial real en vez de reconstruir todo desde cero en cada ejecucion.

## Entregables

- Nuevo `source_type = 'periodic_report'` en `knowledge_documents` (constraint ya
  soporta extender el check; migracion minima).
- Job en `apps/worker` (cron, no manual) que por cada organizacion activa con datos:
  agrega metricas del periodo cerrado (ventas, margen, stock, tareas resueltas,
  alertas nacidas/cerradas), genera un resumen narrado corto vs. auditable (misma
  disciplina que A02: fuente + periodo declarados) y lo ingiere como documento
  `organization`-scoped, encadenado al informe anterior (referencia por fecha, no
  reescritura) para poder recorrer la serie temporal.
- Los agentes automaticos (A02/A04/A06) ganan acceso opcional a `search_knowledge`
  sobre estos informes cuando el objetivo lo justifique (p. ej. "como evoluciono el
  margen los ultimos 3 meses"), sin volverlo obligatorio en cada turno para no subir
  coste/latencia de forma innecesaria.
- Politica de retencion/consolidacion: informes semanales viejos (>90 dias) se
  resumen en uno mensual para no degradar el retrieval con ruido acumulado.
- Fuente y fecha de cada dato citado siempre visibles (mismo principio que el resto
  del roadmap: nunca datos sin trazabilidad).

## Explicitamente fuera de esta fase

- No se reentrena ni ajusta el modelo (fine-tuning): la "memoria" es contexto
  recuperado via RAG, no pesos nuevos.
- No sustituye a AI-06 (evals/calidad): un informe periodico mal generado pasa por
  la misma guarda `checkOutputSanity` antes de ingerirse.

## Dependencias

- AI-04 (RAG) y AI-05 (A02/A04/A06/A08) ya completadas — esta fase construye sobre
  ellas, no las modifica.
- Cron real en `apps/worker` (hoy todo trigger de agentes IA es manual via pagina
  visitada; ver nota de A00 diferido en AI-05).

## Criterios de cierre

- Un cliente con >=2 informes periodicos ingeridos recibe de A02 una mencion de
  tendencia real (p. ej. "el margen bajo 3 puntos frente al mes anterior") citando
  el informe fuente, no solo la ventana de 30 dias.
- El job de generacion corre solo (cron), sin intervencion manual por cliente.
- Informes corruptos o vacios nunca se ingieren (bloqueados por `checkOutputSanity`
  antes de escribir en `knowledge_documents`).
