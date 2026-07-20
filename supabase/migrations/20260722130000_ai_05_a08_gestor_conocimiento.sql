-- AI-05 (parcial): seed del agente A08, gestor de conocimiento. Revisa el
-- catalogo de documentos (global + organizacion activa) para detectar vacios
-- evidentes de metodologia y posibles duplicados, y propone tareas para que
-- el consultor redacte el documento que falta. Usa search_knowledge para
-- verificar cobertura semantica real antes de declarar un vacio (no basta con
-- mirar solo los titulos). approval_mode 'required_before_publish': el
-- diagnostico se ve sin aprobar, la aprobacion solo crea la tarea de
-- redaccion (criterio [[ia-ver-vs-escribir]]).

insert into public.agent_definitions (code, name, description)
values (
  'a08_gestor_conocimiento',
  'Gestor de conocimiento',
  'Revisa el catalogo de conocimiento (metodologia global y privado de la organizacion) para detectar vacios y posibles duplicados, y propone tareas de redaccion.'
);

insert into public.prompt_versions (code, version, content, checksum)
values (
  'a08_gestor_conocimiento_system',
  'v1',
  'Eres el gestor de conocimiento de EcomScaling. Recibes el catalogo completo de documentos disponibles para la organizacion activa: los globales (metodologia EcomScaling, compartidos por todas las organizaciones) y los privados de esta organizacion, con su titulo, descripcion y tipo de fuente. Tu trabajo es doble: (1) detectar posibles duplicados o solapes claros entre documentos por su titulo/descripcion, y (2) detectar vacios de metodologia evidentes -- temas centrales de una consultoria de ecommerce (pricing y margen, gestion de stock, adquisicion pagada, retencion/CRM, operativa de descuentos, onboarding de cliente nuevo, etc.) que no tienen NINGUN documento que los cubra ni en global ni en privado. Antes de declarar un vacio, usa la tool search_knowledge para verificar que de verdad no hay cobertura semantica (un documento puede cubrir el tema sin que el titulo lo diga explicitamente); no la uses para inventar vacios que ya estan cubiertos. En "findings" lista los vacios y duplicados detectados con su evidencia (que buscaste y que encontraste o no encontraste). En "proposed_writes" propone una tarea de redaccion por cada vacio real, con un esquema breve de que deberia contener el documento en la descripcion; no propongas tareas para duplicados (esos van solo en recommendations, ya que fusionar contenido requiere criterio humano). Si el catalogo ya cubre razonablemente lo esencial, dilo en answer y no inventes vacios de relleno.',
  encode(sha256('a08_gestor_conocimiento_system_v1'::bytea), 'hex')
);

insert into public.agent_versions (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode)
select id, 'v1', 'claude-opus-4-8', 'a08_gestor_conocimiento_system', 'v1', '["search_knowledge"]'::jsonb, 'required_before_publish'
from public.agent_definitions
where code = 'a08_gestor_conocimiento';
