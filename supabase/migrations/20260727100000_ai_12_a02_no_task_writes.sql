-- AI-12 (Orchestration patterns): A02 (monitor) y A04 (generador de tareas)
-- no tenian una frontera de responsabilidad escrita -- ambos podian terminar
-- proponiendo la misma tarea desde angulos distintos (comparten alertas
-- activas y ventas del periodo como contexto). El dedup por titulo exacto
-- normalizado en decideAgentOutput (ai-runtime.ts, 2026-07-27) ya cierra el
-- caso literal; esta migracion cierra el caso de raiz para A02, que es quien
-- no tenia ninguna instruccion sobre proposed_writes en su prompt v3 (a
-- diferencia de A04 v3, que ya decia explicitamente "nunca duplicando un
-- titulo ya en el backlog"). A04 sigue siendo el unico agente de diagnostico
-- que convierte hallazgos en tareas nuevas; A02 pasa a ser puramente
-- diagnostico -- sus proposed_writes quedan vacios, sus recomendaciones
-- siguen siendo texto explicando que se deberia hacer.

insert into public.prompt_versions (code, version, content, checksum)
values (
  'a02_monitor_negocio_system',
  'v4',
  'Eres el monitor del negocio de EcomScaling para la organizacion activa: hablas como un consultor experto que ya conoce estos datos, con autoridad y seguridad, nunca a modo de disculpa. Recibes metricas de ventas, financieras, de stock, de adquisicion Meta y alertas activas de los ultimos 30 dias. El objetivo indica el alcance (una tienda concreta o toda la organizacion): si es una tienda concreta, puedes nombrarla de forma natural en tu analisis (p. ej. "en Grippadel..."), pero NUNCA uses frases mecanicas tipo "Alcance:", "analisis limitado a" o "unicamente" -- eso suena a limitacion tecnica, no a consultoria. Escribe siempre en espanol de negocio natural: JAMAS repitas nombres de campo o columnas tal cual (net_profit, net_margin_pct, gross_sales...) en el texto -- tradúcelos siempre (p. ej. "beneficio neto", "margen neto", "ventas brutas"). Se breve y directo: el answer son 2-4 frases con lo esencial, no un informe. Cada finding es una frase con su cifra, no un parrafo. Prioriza lo mas importante: no listes mas de 3-4 hallazgos y 3 recomendaciones salvo que la situacion sea realmente grave. Si faltan datos (sin costes, sin Meta conectado), dilo en warnings, no en el cuerpo de la respuesta. IMPORTANTE (frontera de responsabilidad con el generador de tareas): tu proposed_writes debe ir SIEMPRE vacio ([]) -- diagnosticas y explicas que se deberia hacer en recommendations (accion + prioridad + a quien corresponde), pero nunca creas la tarea tu mismo. Convertir un hallazgo en una tarea concreta del backlog es responsabilidad exclusiva del generador de tareas, que ya ve tu mismo periodo de alertas y ventas -- si ambos crearan tareas, se duplicarian.',
  encode(sha256('a02_monitor_negocio_system_v4'::bytea), 'hex')
)
-- 2026-09-05: esta migracion reutiliza el par (code, version) que ya habia
-- insertado 20260722180000_ai_08_periodo_configurable, asi que choca con
-- `prompt_versions_unique`. En produccion consta como aplicada pero su prompt
-- NUNCA entro: prod se quedo con el contenido de ai_08 (1377 car.) en vez del
-- de aqui (1672). El fallo paso desapercibido porque la migracion se dio por
-- buena. La regla que queria meter ("no generes proposed_writes") si acabo
-- llegando por otra via en el prompt v5, y hoy sigue viva en el v6 activo, asi
-- que el efecto actual es nulo.
--
-- `do nothing` para que el set de migraciones se pueda replicar desde cero
-- (una base nueva reventaba aqui, en la 47 de 126) reproduciendo EXACTAMENTE
-- lo que hay en produccion. No se cambia el contenido a proposito: tocar el
-- prompt de un agente es una decision de producto, no un efecto colateral de
-- arreglar el replay. Lo correcto para reintroducirlo seria un prompt v7 nuevo.
on conflict (code, version) do nothing;

update public.agent_versions
set is_active = false
where definition_id = (select id from public.agent_definitions where code = 'a02_monitor_negocio')
  and version = 'v3';

insert into public.agent_versions (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode)
select id, 'v4', 'claude-opus-4-8', 'a02_monitor_negocio_system', 'v4', '[]'::jsonb, 'required_before_publish'
from public.agent_definitions
where code = 'a02_monitor_negocio'
-- Mismo caso que el insert de prompt_versions de arriba: ai_08 ya habia creado
-- la a02 v4, asi que en produccion esta fila tampoco llego a insertarse.
on conflict (definition_id, version) do update set is_active = excluded.is_active;
