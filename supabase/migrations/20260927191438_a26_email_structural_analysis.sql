-- A26 v3: aporta observaciones estructurales del HTML sin confundirlas
-- con una captura renderizada ni con evidencia de rendimiento (A12).

insert into public.prompt_versions (code, version, content, checksum)
select
  p.code,
  'v3',
  p.content || E'\n\nANALISIS ESTRUCTURAL DEL HTML (A26 v3)\n' ||
  'Recibiras un campo analisis_html generado por un parser determinista del HTML almacenado. Tratalo como observacion del codigo, no como render visual ni necesariamente como copia exacta de lo enviado.\n' ||
  '- Separa siempre: (1) evidencia literal del mensaje y enlaces, (2) medidas/contadores calculados, (3) hipotesis y limites. Cita el fragmento o dato concreto que sustenta cada hallazgo.\n' ||
  '- Puedes describir elementos HTML detectados, estilos declarados, fuentes/tamanos declarados, colores declarados, media queries, textos alternativos y destinos de enlaces. No llames a los enlaces buttonLike un CTA principal confirmado.\n' ||
  '- Los valores de color NO son porcentajes de superficie. La presencia de media queries NO prueba que el diseño se vea bien en movil. El HTML analizado NO prueba posicion, prominencia, contraste renderizado, espaciado efectivo, apariencia en modo oscuro o como se recibio en un cliente de correo.\n' ||
  '- Si el HTML esta truncado, faltan plantillas, hay contenido dinamico o no existe snapshot enviado verificado, dilo expresamente y reduce la confianza. No inventes estructura, contenido, personalizacion ni causa de rendimiento.\n' ||
  '- procedencia_del_cuerpo informa de sincronizacion/actualizacion observada, no de entrega verificada. sync_window_candidate es una aproximacion entre dos syncs; provider_updated_at_precedes_send es una marca de tiempo del proveedor; ninguno revela personalizacion por destinatario. Si se usa la plantilla actual como fallback, no la cites como version enviada.\n' ||
  '- No juzgues aperturas, clics, ventas ni atribucion: no recibes esas metricas; corresponden a A12. Formula recomendaciones de copy como hipotesis comprobables y no atribuyas conversion a color, fuente o layout sin experimento.\n' ||
  '- Para evaluar composicion visual real se necesita una captura de una renderizacion identificada como simulacion o una captura de bandeja de prueba autorizada. Indica la procedencia; nunca presentes una simulacion como prueba de entrega real.\n' ||
  'Mantén la salida y el formato existentes del agente. No repitas al usuario nombres de campos internos; explica los hallazgos en español claro.',
  encode(sha256('a26_contenido_email_system_v3'::bytea), 'hex')
from public.prompt_versions p
where p.code = 'a26_contenido_email_system'
  and p.version = 'v2'
on conflict (code, version) do nothing;

update public.agent_versions
set is_active = false
where is_active
  and definition_id = (select id from public.agent_definitions where code = 'a26_contenido_email');

insert into public.agent_versions (
  definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode
)
select definition_id, 'v3', model, prompt_code, 'v3', allowed_tools, approval_mode
from public.agent_versions
where definition_id = (select id from public.agent_definitions where code = 'a26_contenido_email')
  and version = 'v2'
on conflict (definition_id, version) do update
set is_active = excluded.is_active, prompt_version = excluded.prompt_version;

do $a26_v3$
begin
  if not exists (
    select 1 from public.prompt_versions
    where code = 'a26_contenido_email_system' and version = 'v3'
      and position('ANALISIS ESTRUCTURAL DEL HTML' in content) > 0
  ) or not exists (
    select 1 from public.agent_versions v
    join public.agent_definitions d on d.id = v.definition_id
    where d.code = 'a26_contenido_email' and v.version = 'v3'
      and v.prompt_version = 'v3' and v.is_active
  ) then
    raise exception 'A26_V3_INCOMPLETO: prompt estructural/version activa ausente';
  end if;
end
$a26_v3$;
