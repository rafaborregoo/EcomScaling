# F3/D13 — Flujo runtime de diagnóstico temporal y regresión

## Entrada y frontera

El runtime toma el caso abierto, la serie canónica de `signals`, el estado actual de `capability_health`, el `capability_time_profile` de la capacidad, episodios previos y, cuando existen, pasos causales con sus tiempos. El motor puro vive en `packages/contracts/src/temporal.ts`; este flujo no usa el LLM para calcular fechas, pendientes, change points o lags.

La capacidad se resuelve desde la métrica y nunca se aplica una ventana universal. Si no existe un perfil explícito, se usa una ventana conservadora y la salida queda limitada hasta que el tenant declare la suya.

## Secuencia

1. `temporal-engine` carga casos `open`/`investigating`, la serie ordenada por tiempo de evento, salud actual, perfil temporal, evaluación vigente y episodios.
2. Se eliminan puntos no numéricos y se ordena por `window_end`. Con menos de tres puntos o menos de la ventana mínima, D13 conserva `unknown`/`partial`; no inventa tendencia.
3. Se calcula la desviación material, la pendiente reciente y total, la aceleración, la robustez, el change point y el onset con precisión no más fina que la fuente.
4. Se derivan por separado trayectoria corta, media y larga; el estado actual llega de D04. La serie ajustada por D12, si existe, dirige la trayectoria y la cruda queda visible.
5. Se evalúan persistencia, ruido, regresión (solo con estado previo mejor y periodo estable), recuperación de causa/sistema/impacto, régimen y congelación del baseline.
6. Cada paso causal se convierte en `temporal_lag_check`: manda `event_time`; un orden imposible o un rango incompatible queda `incompatible` y reduce la confianza.
7. Se emiten solo transiciones materiales (`new_deterioration`, `regression`, `recovery_started`, etc.). La clave única `(diagnosis_id,event_type,from_state,to_state)` hace idempotente el retry.
8. La evaluación nueva se inserta como `current`, la anterior pasa a `superseded` y cualquier cambio de trayectoria/onset se conserva en `temporal_revisions`.

## Persistencia y lectura

El adaptador es `apps/api/src/temporal-engine.ts`, ejecutable mediante `apps/worker/src/temporal-once.ts` y `.github/workflows/diagnostic-temporal-output.yml`. El panel de consultor `/v1/consultant/temporal` muestra estado, horizontes, onset, límites, eventos y lags.

La pantalla no presenta D13 como recomendación ni prioridad. Una capacidad puede estar `bad + improving` o `healthy + deteriorating`; ambas etiquetas se mantienen.

## Verificación

Los tests puros cubren estado/ trayectoria, historia corta, cambio brusco, regresión y recuperación parcial. La verificación real con `.env.local` sembró seis señales en el proyecto `kopcblejsxpkxoykldyh`, comprobó una fila temporal vigente y una transición, y borró caso, señales, diagnóstico y dependencias: cleanup confirmado a cero.
