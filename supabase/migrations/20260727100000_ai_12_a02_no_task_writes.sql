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
);

update public.agent_versions
set is_active = false
where definition_id = (select id from public.agent_definitions where code = 'a02_monitor_negocio')
  and version = 'v3';

insert into public.agent_versions (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode)
select id, 'v4', 'claude-opus-4-8', 'a02_monitor_negocio_system', 'v4', '[]'::jsonb, 'required_before_publish'
from public.agent_definitions
where code = 'a02_monitor_negocio';
