# Consolidación de Mi Camino: siete mejoras para implementar

Fecha: 27 de octubre de 2026.

Estado: **plan de implementación pendiente**. Las casillas se cierran con evidencia de funcionamiento, no por haber escrito código. Este documento no acredita un despliegue.

Complementa [PLAN_MEJORAS_MI_CAMINO.md](PLAN_MEJORAS_MI_CAMINO.md), que aborda diagnóstico, generación, calendario y conexión con Marketing. Aquí se concreta la fiabilidad del seguimiento y el uso diario. Sus descripciones de estado deben contrastarse con el código y el despliegue actuales; no se dan por vigentes por aparecer en un documento anterior.

## Resultado que buscamos

El dueño de una tienda debe poder responder sin interpretar el funcionamiento interno:

1. Qué tengo que hacer ahora y quién se encarga.
2. Qué trabajo hemos completado y qué resultado hemos verificado.
3. Cómo va mi objetivo, con qué datos y de qué periodo.
4. Qué conviene cambiar y qué ocurrirá si acepto ese cambio.
5. Qué hemos aprendido y cómo afecta al siguiente camino.

No reharemos el módulo. Conservaremos su mapa, generación, tareas y vistas de cliente y consultor, corrigiendo las reglas compartidas antes de ampliar la interfaz. Las propuestas de textos de este documento son nuevas, salvo que se indique que ya existen.

## Orden y alcance de las entregas

| Entrega | Puntos | Resultado verificable |
| --- | --- | --- |
| A | 1 | Cifras y ventanas coherentes, con ausencia de datos explicada. |
| B | 4 | Meta y objetivos asociados comparten reglas de medición y procedencia. |
| C | 2 y 3 | Trabajo, verificación y resultado se distinguen al avanzar y cerrar. |
| D | 6 | Cliente autónomo y consultor ven acciones acordes con su responsabilidad. |
| E | 5 | Los primeros cambios estructurados pueden previsualizarse y aplicarse con seguridad. |
| F | 7 | El cierre conserva resultados y aprendizajes útiles para el siguiente camino. |

Cada entrega incluye API, contratos, interfaz, compatibilidad y pruebas afectadas. No cambiaremos permisos ni otras funciones de negocio aprovechando esta intervención. Usaremos los componentes existentes de `@/components/ui` y evitaremos dependencias nuevas.

## 1. Corregir la medición

### Situación comprobada

La revisión de A19 se ejecuta con una cadencia de tres días. En `ai-runtime.ts`, su consulta de Meta usa una ventana de tres días, mientras `calculateCaminoGoalProgress` exige al menos cinco días con datos y describe una ventana de siete. Por tanto, ese recorrido no puede satisfacer el mínimo de cobertura exigido para ROAS/CAC.

Los objetivos asociados se leen en `getObjectives` con una ventana de 30 días, aunque el objetivo tenga periodo mensual, trimestral o anual. El periodo declarado y el medido pueden diferir.

### Cómo lo abordaremos

- Separar cadencia de revisión, ventana de medición y periodo de comparación. Revisar cada tres días no obliga a medir solo tres días.
- Mantener inicialmente ROAS/CAC sobre siete días y compararlos con los siete anteriores sin solapamiento; conservar la exigencia de cinco días cubiertos. No rebajar la validación para ocultar el problema.
- Hacer que el cálculo reciba las fechas y cobertura reales de la consulta. Eliminar supuestos temporales que el llamador no garantiza.
- Precisar la semántica financiera: qué significa ventas, ingresos sin IVA, beneficio y margen en cada fuente. No intercambiar `net_sales`, `net_revenue_ex_tax`, `aov` y `aov_ex_tax` solo porque sus nombres se parezcan.
- Incorporar periodo de observación, periodo de comparación, fecha de cálculo y última sincronización a la respuesta que alimenta las cifras.
- Mantener los errores, datos incompletos y conexiones obsoletas como ausencia de medición fiable. Un cero real debe distinguirse de una consulta fallida.
- Conservar los requisitos de costes y ajustes para beneficio/margen. Si impiden medir, explicar qué dato falta y enlazar a su corrección cuando exista una pantalla apropiada.

### Decisión sobre periodos

El destino de producto es explícito: un objetivo de periodo natural mide ese periodo; una ventana móvil dice «últimos N días». Para un trimestre o año en curso, mostrar acumulado hasta la fecha, no el cierre futuro. Los ratios se recalculan con numerador y denominador del intervalo, nunca sumando o promediando ratios diarios sin ponderación. El inventario es una fotografía y se etiqueta como tal.

Los objetivos antiguos no cambiarán silenciosamente de significado. Antes de migrarlos, inventariaremos sus periodos y usos en paneles, alertas y agentes. La primera entrega puede mantener su cálculo de 30 días con etiqueta explícita; la conversión a periodo natural debe quedar registrada y ser revisable. Si una fuente no permite medir un periodo con fiabilidad, la interfaz lo dirá y no ofrecerá un resultado inventado.

### Criterios de aceptación

- [ ] La revisión real de ROAS/CAC usa siete días y puede cumplir su cobertura mínima.
- [ ] Cadencia, consulta, cálculo y etiqueta coinciden para cada métrica.
- [ ] Se prueban límites de mes/año, año bisiesto y ausencia de solapamiento entre ventanas.
- [ ] Se prueban cero válido, sincronización obsoleta, error de consulta y coste de producto incompleto.
- [ ] Una prueba de integración entre constructor de consultas y cálculo detecta la discrepancia tres/siete; las pruebas aisladas actuales no bastan.

Archivos iniciales: `apps/api/src/ai-runtime.ts`, `camino-goal-progress.ts`, `camino-review-scheduling.ts`, `strategic-plans.ts` y sus pruebas. Revisar las funciones SQL de origen cuando sea necesario, reutilizando sus agregados.

## 2. Separar claramente trabajo y resultados

### Situación comprobada

El recorrido puede cerrarse cuando se cierran u omiten sus hitos. Eso no demuestra que se haya alcanzado la meta. Las vistas presentan tareas, fases y cifras, pero el lenguaje de finalización puede confundir estos significados.

### Cómo lo abordaremos

- Mantener dos lecturas visibles: **«Trabajo del camino»** y **«Resultado del objetivo»**.
- En trabajo, contar por separado tareas hechas, hitos verificados e hitos omitidos. No presentar una omisión como logro.
- En resultado, mostrar valor observado, meta, periodo y estado de medición. Si no hay lectura fiable, mostrar «Sin medición fiable» con motivo.
- Sustituir el mensaje de éxito global ambiguo por «Recorrido cerrado» cuando solo sabemos que no queda trabajo abierto. Mostrar aparte «Meta alcanzada», «Meta pendiente» o «Resultado sin verificar», según evidencia.
- Si la meta se alcanza antes de cerrar el trabajo, mostrar ese hecho sin cerrar automáticamente los hitos. Ofrecer revisar el trabajo restante.
- No combinar porcentajes de tareas con porcentajes de la meta. Documentar el denominador de cada indicador.
- Para metas de reducción o con punto de partida negativo, evitar barras que interpreten mal el progreso. Si la fracción no tiene sentido, mostrar valores y distancia a la meta.

### Criterios de aceptación

- [ ] Un camino con todas las tareas hechas y meta incumplida no se presenta como éxito económico.
- [ ] Una meta alcanzada con tareas pendientes no cierra el recorrido automáticamente.
- [ ] Los hitos omitidos se identifican y contabilizan aparte en cliente, consultor y cartera.
- [ ] El mismo camino tiene el mismo significado de estado en todas las vistas.

Archivos iniciales: `apps/web/src/app/camino/page.tsx`, `camino-map.tsx`, `camino-consultant.tsx`, `camino-routes-view.tsx`, `next-step.ts` y `apps/api/src/camino-routes.ts`.

## 3. Mejorar el cierre de hitos

### Situación comprobada

`assessMilestoneCompletion` comprueba tareas abiertas y una evidencia textual de 20–2.000 caracteres. No valida que el resultado descrito sea cierto ni que se haya alcanzado una métrica. Omitir también puede cerrar la fase.

### Cómo lo abordaremos

- Separar disponibilidad para revisión y resultado verificado. Terminar las tareas deja el hito **listo para verificar**, sin certificar el resultado.
- Distinguir hitos medibles mediante datos conectados e hitos de comprobación humana. No obligar a inventar una métrica para un hito cualitativo.
- En hitos medibles, guardar la regla de éxito estructurada: métrica, dirección, umbral y periodo. En hitos cualitativos, guardar el criterio que debe revisar una persona.
- Al verificar, guardar quién verificó, cuándo, qué criterio estaba vigente y qué evidencia se utilizó. Para datos conectados, guardar una instantánea de la lectura y su procedencia.
- No usar el porcentaje de tareas como sustituto de esa verificación.
- Si la métrica fiable no cumple el criterio, impedir declararlo verificado. Permitir revisar el criterio o cerrar el trabajo como excepción con motivo explícito, sin convertir la excepción en resultado logrado.
- Conservar la omisión como decisión distinta, exigiendo motivo y explicando su efecto en la fase.
- Mantener la posibilidad de reabrir. Una reapertura conserva evidencias y decisiones anteriores.
- Mantener cierres históricos como «Cierre anterior sin verificación estructurada» cuando falte información; no fabricar evidencias retroactivas.

### Primera implementación acotada

Reutilizar los estados y campos que ya sean suficientes. Añadir persistencia únicamente para la verificación y su procedencia si el modelo actual no la representa. No crear un motor genérico de aprobaciones. La verificación humana será posible tanto para el propietario/gestor como para el consultor autorizado; no se introducirá una doble firma obligatoria.

### Criterios de aceptación

- [ ] Tareas completadas sin evidencia no equivalen a hito verificado.
- [ ] Se puede verificar un hito cualitativo con evidencia y autor identificados.
- [ ] Un hito cuantitativo no se verifica con una lectura fallida o fuera de periodo.
- [ ] Ignorar o cancelar tareas no oculta esas decisiones al verificar.
- [ ] Omitir, cerrar por excepción y verificar producen mensajes y resultados distintos.
- [ ] La transición de fase y la reapertura son coherentes incluso ante reintentos o dos acciones simultáneas.

Archivos iniciales: `apps/api/src/camino-milestone-readiness.ts`, `strategic-plans.ts`, contratos de Camino y formularios de cierre en web. Revisar los contratos de generación e importación para conservar los criterios estructurados sin exigirlos retroactivamente.

## 4. Unificar objetivos y seguimiento

### Situación comprobada

La meta principal vive en el plan y su revisión; los objetivos asociados se consultan mediante otro recorrido. Hay claves, ventanas y formas de progreso diferentes. Unificar no significa que todos deban tener la misma ventana: significa que su regla sea explícita y compartida.

### Cómo lo abordaremos

- Definir una representación común de medición con métrica, fuente, unidad, moneda, dirección, ventana, cobertura, valor, fecha y motivo de indisponibilidad.
- Mantener la distinción de producto entre meta del camino y objetivos de hito. Compartir resolución de métricas y reglas, evitando dos implementaciones que calculen distinto lo mismo.
- Registrar el punto de partida con su intervalo y procedencia. Compararlo solo con lecturas temporalmente compatibles; una suma de 180 días no es comparable directamente con un mes.
- Distinguir meta fijada, lectura observada y ritmo esperado. El ritmo es una referencia de gestión, no una predicción del modelo.
- Hacer que mapa, mesa del consultor, tarjetas de cartera y agentes consuman esa información, sin recalcularla en el navegador.
- Mostrar en el detalle de cada cifra «Fuente», «Periodo medido» y «Última actualización». Los valores manuales identificarán además quién los actualizó.
- Mantener la moneda de origen. Separar claramente cambiar formato y convertir divisas; no introducir conversión implícita.
- Una edición de meta conserva cifra anterior, nueva cifra, autor y motivo, y deja claro que una revisión anterior corresponde a la meta previa.

### Criterios de aceptación

- [ ] Misma métrica, tienda y ventana producen el mismo valor en todas las superficies.
- [ ] Diferentes ventanas aparecen identificadas y no parecen cifras contradictorias.
- [ ] Un cambio de meta no combina una evaluación antigua con el objetivo nuevo como si fuera actual.
- [ ] Los valores manuales y conectados se distinguen, y ninguna tienda lee el agregado de otra por error.
- [ ] Los planes antiguos con punto de partida no comparable se muestran con explicación y opción de revisión.

Archivos iniciales: `apps/api/src/strategic-plans.ts`, `camino-goal-progress.ts`, `camino-routes.ts`, `camino-objective-changes.ts`, `packages/ai/src/index.ts` y tipos de las vistas de Camino. Extraer un módulo compartido solo si sustituye duplicación real.

## 5. Hacer útil y aplicable la revisión de IA

### Situación comprobada

Las propuestas guardan descripción, motivo, evidencia y objetivo del cambio. Aceptarlas registra una decisión, pero no modifica el plan. El usuario debe editarlo y luego marcar la propuesta como aplicada. El texto libre actual no es un cambio ejecutable seguro.

### Cómo lo abordaremos

- Conservar las revisiones como recomendaciones. Añadir cambios estructurados y validados solo para acciones concretas que podamos ejecutar con las reglas del dominio.
- Primera entrega: edición de fecha de un hito, nombre/descripción y cifra de meta. No interpretar texto libre para ejecutar operaciones.
- Cada propuesta aplicable incluye identidad del plan y elemento, versión esperada, valores anteriores/nuevos y motivo. La interfaz muestra una comparación antes de confirmar.
- Validar fechas, dependencias, alcance de tienda y permisos en servidor. Una propuesta obsoleta se vuelve a revisar; no sobrescribe trabajo posterior.
- Aplicar el cambio y registrar su aplicación de forma atómica, con protección frente a doble clic y reintento. No puede quedar «aplicada» si la modificación falló.
- Preservar propuestas antiguas como recomendaciones manuales, claramente etiquetadas.
- Conservar el circuito manual para cambios no soportados. Mostrar «Aceptar para aplicar manualmente» frente a «Revisar y aplicar» cuando proceda.
- Para rectificar, registrar un cambio compensatorio que respete la versión vigente. No ofrecer un «deshacer» que sobrescriba ediciones posteriores.
- Añadir altas y retiradas de hitos en otra entrega, cuando estén resueltas sus consecuencias sobre tareas, objetivos y fases. Retirar nunca implica borrar tareas silenciosamente.

### Criterios de aceptación

- [ ] La previsualización muestra exactamente lo que cambiará.
- [ ] Confirmar una edición soportada cambia el dato y registra autor, antes/después y propuesta de origen.
- [ ] Doble clic, reintento y dos editores simultáneos no duplican ni pisan cambios.
- [ ] Una propuesta de otra tienda o sobre una versión antigua se rechaza sin mutaciones parciales.
- [ ] Las propuestas históricas no aparecen falsamente como ejecutables.
- [ ] Aplicar un cambio de Camino no envía campañas ni ejecuta acciones externas.

Archivos iniciales: `apps/api/src/strategic-plans.ts` (`recordCaminoChangeProposalAction`), `apps/web/src/app/camino/proposal-decision.tsx`, contratos de revisión en `packages/ai` y persistencia de propuestas/eventos.

## 6. Afinar la experiencia por responsabilidad

### Situación comprobada

Cliente y consultor ya tienen superficies distintas y reglas de cierre de tareas. El mapa del cliente incluye mensajes que presuponen un consultor. El texto del responsable y el usuario efectivamente asignado deben mantenerse coherentes.

### Cómo lo abordaremos

- Cliente autónomo: priorizar hito actual, siguiente tarea realizable, plazo, criterio de éxito y resultado medido. Eliminar llamadas a un consultor inexistente. Ofrecer acceso al asistente existente solo donde su capacidad y destino estén comprobados.
- Cliente acompañado: mostrar el trabajo del cliente y permitir abrir la conversación contextual con su consultor.
- Consultor: priorizar bloqueos, retrasos, datos que impiden verificar y decisiones pendientes; mantener acceso a toda la estructura.
- Mostrar responsable de ejecución y persona asignada sin contradicciones. Distinguir trabajo compartido de trabajo sin asignar. Si una tarea del consultor no tiene consultor disponible, avisar y permitir reasignar; no dejarla aparentemente atendida.
- Conservar la regla actual: el consultor resuelve sus tareas e internas autorizadas, y no decide por el cliente las ajenas. Los permisos se aplican también desde API.
- En cartera, distinguir atención por retraso, por datos insuficientes y por decisión pendiente. No interpretar siempre «Al ritmo» como salud económica.
- Usar la cadencia «cada tres días» en los textos que explican seguimiento. Mostrar fecha de última revisión y si está pendiente, fallida o desactualizada.
- Mantener notas internas privadas y explicar que «Escribir sobre este hito» abre la conversación de la organización; no simular comentarios separados por hito.

### Criterios de aceptación

- [ ] Un cliente sin consultor no ve mensajes que indiquen que alguien está preparando o revisando su trabajo.
- [ ] Una tarea sin responsable efectivo no parece asignada a una persona inexistente.
- [ ] Cliente y consultor identifican qué acción les corresponde sin abrir varias pantallas.
- [ ] Los permisos coinciden en mapa, mesa, Tareas y API; las notas internas no llegan al cliente.
- [ ] El recorrido es usable con teclado y en móvil, con estados que no dependen solo del color.

Archivos iniciales: `camino-map.tsx`, `camino-consultant.tsx`, `camino-routes-view.tsx`, `page.tsx`, `draft-notice.tsx`, `apps/api/src/camino-task-mapping.ts`, `operations.ts` y componentes de conversación.

## 7. Cerrar el ciclo de aprendizaje

### Situación comprobada

Ya hay revisiones fechadas, aprendizajes que pueden aprobarse y contexto de caminos anteriores. El cierre del recorrido no garantiza una evaluación final que reúna lo pretendido, lo realizado y lo observado.

### Cómo lo abordaremos

- Al cerrar el recorrido, crear un resumen final por versión usando lo persistido. La parte determinista puede existir aunque la IA no esté disponible.
- Incluir meta inicial y cambios aprobados, fechas, última medición válida y su periodo, trabajo realizado, hitos verificados/omitidos y decisiones pendientes.
- Si faltan datos, mostrar «Recorrido cerrado; resultado pendiente de verificar». No detener el cierre del trabajo ni inventar una conclusión económica.
- Separar resultado observado, interpretación y atribución causal. Mejorar después de una tarea no demuestra que esa tarea causara el cambio.
- Permitir confirmar, corregir o descartar aprendizajes antes de reutilizarlos en Conocimiento. Guardar alcance de tienda, autor, evidencia, fecha y limitaciones.
- Dar acceso a «Preparar el siguiente camino», reutilizando el proceso de creación existente. La nueva propuesta recibe el resumen y los aprendizajes vigentes; nace en borrador.
- Si el camino se reabre, conservar el cierre anterior como instantánea histórica e identificarlo como anterior a la reapertura. No sobrescribir lo que se afirmó en aquel momento.
- Mantener los resúmenes separados por tienda. No agregar porcentajes o resultados de objetivos incompatibles en una conclusión de cartera.

### Criterios de aceptación

- [ ] Al cerrar, se puede consultar qué se buscaba, qué se hizo y qué resultado pudo medirse.
- [ ] Hay un resumen útil aunque falle la generación de texto de IA.
- [ ] Un aprendizaje no confirmado no se presenta como conocimiento aprobado.
- [ ] El siguiente camino recibe el contexto correcto sin repetir tareas cerradas salvo justificación.
- [ ] Reabrir y volver a cerrar conserva las decisiones y evidencias previas.

Archivos iniciales: `apps/api/src/strategic-plans.ts`, `camino-intake.ts`, `ai-runtime.ts`, `plan-horizon-context.ts` y vistas de seguimiento y finalización. Reutilizar el historial y la aprobación de aprendizajes existentes.

## Persistencia, compatibilidad y despliegue

- Antes de cada entrega, contrastar el árbol local, el esquema aplicado y la versión desplegada. El repositorio tiene trabajo en curso: conservar los cambios ajenos y no deducir despliegue por la existencia de una migración.
- Introducir cambios de datos de forma aditiva, conservar lectores compatibles y probar registros antiguos sin los campos nuevos.
- No rellenar verificaciones, periodos o valores históricos con suposiciones. Un dato desconocido permanece desconocido.
- Cuando haya migraciones, seguir el procedimiento del repositorio: idempotentes, registradas y aplicadas con `npm run db:push` en el entorno correspondiente. No ejecutar migraciones remotas como parte de redactar este plan.
- Para cambios que deben guardarse juntos, usar una operación transaccional; evitar secuencias de escrituras que dejen el plan parcialmente cambiado.
- Mantener aislamiento de organización/tienda y autorización de servidor en todas las lecturas y mutaciones.
- Publicar primero en un entorno de prueba con una tienda de demostración. Separar «implementado local», «validado» y «desplegado» en el registro de avance.

## Verificación transversal

Escenarios mínimos de aceptación de producto:

| Caso | Qué debe comprobarse |
| --- | --- |
| Cliente autónomo con Shopify | Crear, activar, trabajar, verificar, revisar y cerrar sin depender de un consultor. |
| Cliente con consultor | Reparto y cierre de tareas con permisos correctos; conversación y notas privadas. |
| Varias tiendas | Métricas, propuestas y aprendizajes de cada tienda permanecen separados. |
| Meta de reducción | Menor CAC o menos agotados se interpretan como mejora, sin invertir el progreso. |
| Beneficio no fiable | Costes incompletos impiden un veredicto económico firme. |
| Integración obsoleta o caída | Ausencia de datos explicada, sin confundirla con cero ni con fracaso del negocio. |
| Plan antiguo | Sigue siendo legible y no adquiere verificaciones o periodos inventados. |
| Concurrencia y reintento | Dos decisiones o una petición repetida no duplican ni dejan estados incompatibles. |
| Trabajo cerrado y meta pendiente | El cierre explica ambas situaciones sin una felicitación engañosa. |

Reutilizar las pruebas existentes y añadir pruebas de reglas, permisos y transiciones con riesgo real. Para las lecturas, probar el recorrido consulta → cálculo → respuesta → etiqueta, además de las funciones aisladas. Ejecutar las comprobaciones de tipos y las pruebas afectadas por cada entrega; comprobar visualmente las superficies modificadas.

## Seguimiento de implementación

| Entrega | Implementación local | Validación | Despliegue |
| --- | --- | --- | --- |
| A. Medición | Pendiente | Pendiente | Pendiente |
| B. Reglas compartidas | Pendiente | Pendiente | Pendiente |
| C. Estados y verificación | Pendiente | Pendiente | Pendiente |
| D. Responsabilidades e interfaz | Pendiente | Pendiente | Pendiente |
| E. Aplicación de propuestas | Pendiente | Pendiente | Pendiente |
| F. Cierre y aprendizajes | Pendiente | Pendiente | Pendiente |

Al completar cada entrega, añadir aquí archivos cambiados, pruebas y resultados, compatibilidad aplicada, entorno validado y limitaciones que permanezcan. No marcar la siguiente entrega como terminada por depender de código compartido ya introducido.

**Primer paso de ejecución:** reproducir la discrepancia de ventanas de Meta con una prueba que use los argumentos reales de revisión, corregir la fuente de la discrepancia y comprobar la lectura completa. Después abordar el contrato de periodos antes de modificar las barras o los mensajes de éxito.
