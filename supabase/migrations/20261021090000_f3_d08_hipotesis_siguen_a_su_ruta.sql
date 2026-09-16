-- FASE 3 / D08 -- Una hipotesis causal no sobrevive a su ruta.
--
-- EL ESQUEMA SE CONTRADECIA CONSIGO MISMO, y no se vio hasta correr los dos
-- motores seguidos. `diagnostic_hypotheses.source_path_id` se creo en D07
-- (`20260918090000`) con `on delete set null`. Un ano de esquema despues, D08
-- (`20260919090000`) anadio el check `diagnostic_hypotheses_causal_exige_ruta`:
-- una hipotesis de tipo causal **no puede** tener `source_path_id` nulo.
--
-- Juntas significan que borrar una ruta causal es imposible en cuanto alguna
-- hipotesis se apoye en ella: Postgres intenta poner el nulo, el check lo
-- rechaza, y la transaccion entera se cae. El motor de D07 se reescribe cada
-- pasada, asi que el sintoma fue que **las rutas se acumulaban en silencio** --
-- tres por pasada, y nadie se enteraba porque el motor devolvia "3 rutas" cada
-- vez y eso es justo lo que uno espera leer.
--
-- LA CORRECCION ES `CASCADE`, NO RELAJAR EL CHECK. El check tiene razon: una
-- hipotesis causal sin ruta no es una hipotesis a la que le falta un campo, es
-- una afirmacion causal sin nada detras -- exactamente lo que el guardrail 19
-- existe para impedir. Lo que estaba mal era el `set null`, que suponia que la
-- hipotesis puede seguir viva cuando el razonamiento que la produjo ya no
-- existe. Si la ruta desaparece, la hipotesis desaparece con ella; D08 la vuelve
-- a escribir en su siguiente pasada si la ruta vuelve a salir.
--
-- LA MISMA TRAMPA ESTA PUESTA EN `root_causes.causal_path_id`, y todavia no ha
-- saltado solo porque D09 no tiene motor. `set null` mas el check
-- `root_causes_exige_cadena` --que exige la ruta en cuanto la causa sea
-- `probable` o `confirmed`-- vuelven a hacer imposible borrar la ruta. Se
-- arregla aqui, antes de que alguien lo descubra otra vez desde el otro lado.

alter table public.diagnostic_hypotheses
  drop constraint if exists diagnostic_hypotheses_source_path_id_fkey;

alter table public.diagnostic_hypotheses
  add constraint diagnostic_hypotheses_source_path_id_fkey
  foreign key (source_path_id) references public.causal_paths (id) on delete cascade;

comment on column public.diagnostic_hypotheses.source_path_id is
  'F3/D07-D08. La ruta causal de la que nacio esta hipotesis. `on delete cascade` desde el '
  '2026-10-06: con `set null` la ruta no se podia borrar nunca, porque el check '
  '`causal_exige_ruta` rechaza el nulo. Una hipotesis causal sin ruta no es una hipotesis '
  'incompleta, es una afirmacion sin nada detras.';

alter table public.root_causes
  drop constraint if exists root_causes_causal_path_id_fkey;

alter table public.root_causes
  add constraint root_causes_causal_path_id_fkey
  foreign key (causal_path_id) references public.causal_paths (id) on delete cascade;

comment on column public.root_causes.causal_path_id is
  'F3/D07-D09. La ruta causal que sostiene esta causa raiz. `on delete cascade` desde el '
  '2026-10-06, por el mismo motivo que en diagnostic_hypotheses: con `set null` la ruta no '
  'se podia borrar en cuanto una causa probable se apoyara en ella.';
