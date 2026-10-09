-- A19 v15 / detallador v3: un hito puede llevar hasta 8 tareas.
--
-- Hasta v14 el limite era 6 por hito. Con los carriles de trabajo, un hito de
-- fecha clave lleva sus tareas de temporada Y las rutinas de crecimiento del
-- periodo; con 6 se recortaban justo las rutinas. Idempotente: solo anade la
-- regla si la version aun no la lleva.
update public.prompt_versions
set content = content || E'\n\nLIMITE DE TAREAS POR HITO (sustituye cualquier límite anterior)\nUn hito lleva como máximo 8 tareas: las de su fecha o su objetivo más las rutinas de crecimiento del periodo. Las rutinas de crecimiento nunca se recortan para hacer sitio a otras tareas; recorta antes lo menos valioso.',
    checksum = encode(sha256(convert_to(content || E'\n\nLIMITE DE TAREAS POR HITO (sustituye cualquier límite anterior)\nUn hito lleva como máximo 8 tareas: las de su fecha o su objetivo más las rutinas de crecimiento del periodo. Las rutinas de crecimiento nunca se recortan para hacer sitio a otras tareas; recorta antes lo menos valioso.', 'UTF8')), 'hex')
where code in ('a19_arquitecto_camino_system', 'a19_detallador_tareas_system')
  and version in ('v15', 'v3')
  and not (code = 'a19_arquitecto_camino_system' and version = 'v3')
  and not (code = 'a19_detallador_tareas_system' and version = 'v15')
  and content not like '%LIMITE DE TAREAS POR HITO%';
