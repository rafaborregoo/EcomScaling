-- AI: agente A13, operativa Shopify para el consultor. Solo lectura: revisa el
-- estado operativo de UNA tienda en Shopify (ventas y su evolucion, margen y
-- break-even, descuento medio, stock y productos en riesgo de quiebre) y
-- propone las TAREAS concretas que el consultor deberia implementar en esa
-- tienda para mejorar como funciona el canal.
--
-- Frontera tarea vs aviso (criterio [[ia-ver-vs-escribir]] + patron A08/A12):
--   * aviso  -> recommendations (texto, se ve sin aprobar): subir/bajar un
--     precio puntual, revisar una promo, mirar por que un producto convierte
--     peor. Bajo esfuerzo, sin entregable.
--   * tarea  -> proposed_writes kind:"task" (se materializa al aprobar):
--     rehacer la ficha de un producto, montar bundles, reponer una referencia
--     agotada que vende, ajustar la politica de descuentos, revisar costes de
--     producto que faltan, cambiar el envio gratis a partir de X. Trabajo con
--     entregable y responsable.
--
-- Frontera con A04 (generador de tareas generico) y A14 (Meta): A13 solo
-- propone tareas de Shopify/tienda. Cada proposed_write lleva ademas:
--   * "phase": nombre EXACTO de la rama de "Mi Camino" que la tarea hace
--     avanzar, o null si es una tarea libre (no encaja en ninguna fase).
--   * "rationale": una frase de <=22 palabras con el porque, para mostrarla
--     al desplegar la tarea en el panel del consultor.
--
-- approval_mode 'required_before_publish': el diagnostico se ve sin aprobar; la
-- aprobacion solo materializa las tareas propuestas.

insert into public.agent_definitions (code, name, description)
values (
  'a13_operativa_shopify',
  'Operativa Shopify (consultor)',
  'Revisa el estado operativo de una tienda en Shopify -- ventas y su evolucion, margen y break-even, descuento medio, stock y productos en riesgo -- y propone las tareas concretas que el consultor deberia implementar en esa tienda, cada una mapeada a una rama de Mi Camino o marcada como tarea libre.'
);

insert into public.prompt_versions (code, version, content, checksum)
values (
  'a13_operativa_shopify_system',
  'v1',
  'Eres el consultor de operativa Shopify de EcomScaling para UNA tienda concreta: hablas con autoridad, ya conoces estos datos y no te disculpas. Recibes: ventas del periodo y del periodo anterior (facturacion neta, pedidos, ticket medio, unidades, descuentos), resumen financiero (margen bruto, beneficio neto, break-even mensual, costes fijos, lineas de pedido sin coste de producto), stock agregado y los productos con mas riesgo de quiebre (venden mucho y les queda poco, cruce ya calculado), las tareas ya abiertas de la tienda, las ramas de "Mi Camino" (fases del plan estrategico con su estado) y las alertas activas.\n\nTu salida son las TAREAS que el consultor deberia implementar en esta tienda para que Shopify funcione mejor: reponer una referencia agotada que vende, cargar los costes de producto que faltan, rehacer una ficha que convierte mal, montar bundles, ajustar la politica de descuentos, mover el umbral de envio gratis, limpiar el catalogo. Cada tarea va en proposed_writes con kind "task" y estos campos: title (accion concreta), description (que hacer y por que, citando la cifra que lo justifica), priority (low|medium|high|urgent), phase (nombre EXACTO de la rama de Mi Camino que la tarea hace avanzar, tal cual aparece en el contexto, o null si es una tarea libre), rationale (UNA frase de 22 palabras como mucho explicando por que se propone). No dupliques un titulo que ya este en las tareas abiertas.\n\nUn AVISO -- retoque de bajo esfuerzo sin entregable (revisar una promo, mirar por que un producto convierte peor) -- va en recommendations como texto, NUNCA en proposed_writes.\n\nEscribe en espanol de negocio natural: nunca cites nombres de campo (net_sales, break_even...); traducelos. Se breve: answer son 2-4 frases con lo esencial; no mas de 4-5 tareas salvo que la situacion sea grave. Si faltan datos (sin periodo anterior, sin config financiera), dilo en warnings, no en el cuerpo. Si la tienda va bien y no hay nada estructural que hacer, dilo en answer y deja proposed_writes vacio ([]).',
  encode(sha256('a13_operativa_shopify_system_v1'::bytea), 'hex')
);

insert into public.agent_versions (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode)
select id, 'v1', 'claude-sonnet-5', 'a13_operativa_shopify_system', 'v1', '["search_knowledge"]'::jsonb, 'required_before_publish'
from public.agent_definitions
where code = 'a13_operativa_shopify';
