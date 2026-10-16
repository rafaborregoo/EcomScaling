# Plantilla: benchmarks sectoriales del analista de métricas

Los benchmarks son la **última** referencia del analista ([ADR-0027](decisions/ADR-0027-analista-de-metricas.md)),
igual que en la jerarquía del corpus *6.00 Benchmarks y guardrails*:

1. economía propia → 2. historia propia → 3. cohortes internas → 4. peer group → **5. sector → 6. ecommerce general**.

Por eso solo se usan si la tienda no tiene umbral económico, objetivo ni historial, y como mucho dan
"vigilar", nunca "mal".

Van en la tabla `public.metric_benchmarks` y no en el RAG: una cifra tiene que recuperarse exacta, con
su fuente y su fecha. La búsqueda semántica devuelve "algo parecido", y un 2,1 % mal recuperado es peor
que no tener benchmark.

## Columnas

| Columna | Qué poner | Ejemplo |
|---|---|---|
| `metric_id` | Id de la ficha: `mer`, `cac_new`, `conversion`, `meta_roas`, `email_open_rate` | `conversion` |
| `sector` | `general` o el mismo texto que `organizations.sector` de las tiendas a las que aplica | `moda` |
| `country` | País de los datos | `ES` |
| `p25`, `p50`, `p75` | Percentiles **en la unidad del valor**: ratio para MER/ROAS (`3.2`), tasa 0–1 para conversión y aperturas (`0.021` = 2,1 %), importe para CAC | `0.012`, `0.021`, `0.032` |
| `currency` | Solo para importes (CAC). Si no coincide con la moneda de la tienda, no se usa | `EUR` |
| `source` | Quién lo publica (corto; sale en pantalla) | `Informe X 2025` |
| `source_url` | Enlace a la fuente | |
| `as_of` | Fecha **de los datos**, no de la carga | `2025-06-30` |
| `notes` | Muestra, ticket medio, canal, cómo se mide (p. ej. "aperturas con Apple MPP") | |

Si solo hay una media, no la conviertas en percentiles inventados: déjala fuera hasta tener la
distribución, o pon `p25 = p50 = p75` y explícalo en `notes`.

## Carga

Con service role (SQL Editor del proyecto o script). Ejemplo:

```sql
insert into public.metric_benchmarks (metric_id, sector, country, p25, p50, p75, source, source_url, as_of, notes)
values ('conversion', 'general', 'ES', 0.012, 0.021, 0.032, 'Fuente', 'https://…', '2025-06-30', 'Sesiones web, todos los dispositivos')
on conflict (metric_id, sector, country, as_of, source) do update
set p25 = excluded.p25, p50 = excluded.p50, p75 = excluded.p75, source_url = excluded.source_url, notes = excluded.notes;
```

El sector de cada tienda se fija en `organizations.sector`. Si es null, se usa `general`.

## Qué no hacer

- No mezclar fuentes de años distintos en una misma fila.
- No cargar cifras de "atribución de plataforma" (ROAS de Meta) como si fueran MER de tienda.
- No usar aperturas de email como benchmark entre tiendas sin anotar que Apple Mail las infla.
