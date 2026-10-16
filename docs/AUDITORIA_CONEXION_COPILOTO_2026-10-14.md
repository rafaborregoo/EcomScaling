# Auditoría de conexión y errores del copiloto — 14 de octubre de 2026

## Resultado y causa comprobada

Las preguntas nuevas también fallaban. El flujo de reintento no explicaba ese 400: los dos últimos runs fallidos del A09 v15 en el entorno de `.env.local` (16:00:39 y 16:07:04 UTC) registraban `The compiled grammar is too large`. Los fallos anteriores de `maxItems` y del enum nullable eran errores distintos del mismo contrato.

Se reprodujo el 400 enviando a Anthropic el esquema real del chat, con un mensaje sintético, sin herramientas ni información de tiendas. Request de reproducción: `req_011Cg2RVzSi96nEqYtevg338`. La prueba pasaba en mocks porque estos no compilan gramáticas.

## Cambios aplicados

- Colecciones del contrato enviado al modelo: `[]` en lugar de `array | null`, incluidas series de las cifras. La interfaz ya admite arrays vacíos y no dibuja una minigráfica sin suficientes puntos.
- Texto opcional: cadena vacía cuando no procede. Se reducen las uniones a cinco, manteniendo `null` donde tiene significado: dirección, impacto, esfuerzo y coste desconocido.
- Zod conserva la compatibilidad con respuestas históricas que contienen `null` y sigue validando límites, enums y costes. No se han eliminado campos funcionales del copiloto.
- `answer` se declara primero en las propiedades del esquema. El extractor de streaming exige que sea el primer campo; antes se declaraban primero `key_figures` y `ui_actions`, por lo que la respuesta podía llegar únicamente al finalizar.
- Los reintentos solo crean un ID nuevo tras un `chat_turn_failed` confirmado por el servidor. Una desconexión de red o un estado ambiguo conserva el ID para recuperar una respuesta guardada sin duplicar consumo. El indicador de fallo confirmado se conserva en la recuperación de sesión.
- `buildAgentTools` se exporta para que la verificación construya las declaraciones reales y compruebe el cableado sin ejecutar conectores.

## Ruta auditada

| Tramo | Conexión y comprobación |
|---|---|
| Interfaz | `CopilotPanel.ask` envía pregunta, conversación, tienda/vista, modelo e ID del turno a `/consultant-chat/stream`. |
| HTTP | `server.ts` resuelve autenticación, transmite eventos NDJSON, mantiene heartbeat y propaga cancelación al desconectar. El archivo del servidor se conserva. |
| Autorización y contexto | `runConsultantChatTurn` verifica membresía, propiedad de la conversación, tienda activa, alcance de evidencia, saldo y presupuesto antes del modelo. Tests de alcance y contexto aprobados. |
| Modelo | La versión activa local A09 es v15. El selector Sonnet resuelve a `claude-sonnet-5`; las pruebas reales usaron ese modelo. |
| Tools | Las 24 configuradas tienen entrada en el registro y contrato. En alcance de tienda se declaran 23: SQL se omite deliberadamente mediante `!storeId`. En alcance de organización se declaran las 24. Sin denegaciones al probar el catálogo con todos los conectores simulados como disponibles. |
| Proveedor | `runAgentTurn` adapta el esquema antes de `messages.stream` o `messages.create`; conserva el mismo contrato a través del ciclo de tools. |
| Ejecución | La prueba real observa `running → done`, una ejecución de la tool sintética y su resultado devuelto al modelo. Los ejecutores reales de conectores se sustituyen por stubs que fallan si se invocan. |
| Validación y UI | El JSON final supera `chatOutputSchema`; el texto extraído por `createCopilotAnswerStream` coincide exactamente con `output.answer`. La UI recibe previews y finalmente el payload validado. |

## Evidencia de verificación

| Prueba | Resultado |
|---|---|
| Esquema anterior, pregunta sintética sin tools, Anthropic real | 400 reproducido: gramática demasiado grande. |
| Solo retirar arrays nullable, sin tools | Respuesta correcta. |
| Solo retirar arrays nullable, con tool | Sigue el 400, tanto con streaming como sin él. |
| Esquema compacto, `runAgentTurn`, tool sintética, streaming | Correcto; una ejecución; texto transmitido igual al validado. |
| Esquema compacto, `runAgentTurn`, tool sintética, sin streaming | Correcto; una ejecución y salida validada. |
| Catálogo real de tienda: 23 declaraciones más la tool sintética | Correcto; ninguna ejecución de conectores reales. |
| Catálogo real de organización: 24 declaraciones más la tool sintética | Correcto; ninguna ejecución de conectores reales. |
| Opus 5 y Haiku 4.5, cada uno con tool sintética y streaming | Ambos correctos; una ejecución y texto transmitido igual al validado. |
| Regresión del contrato real | Se comprobó en rojo y en verde: colecciones vacías, máximo cinco uniones y `answer` primero. |
| Suite del paquete IA | 266 pruebas aprobadas, cero fallos. |
| Pruebas del API relacionadas con copiloto, evidencia, alcance, tools e informes | 68 pruebas aprobadas, cero fallos. |
| Compilación IA y typechecks de API y web | Correctos. |
| API local | `dist/index.js` generado a las 18:26:35 de Madrid; proceso del API iniciado después de esa generación. `/health/live` responde `status: ok`. |

Comando repetible, con paquete compilado y credenciales en el entorno:

```powershell
npm run build -w @e-nora/ai
npx dotenv -o -e .env.local -- tsx scripts/verify-copilot-provider.mts --live --configured-tools
npx dotenv -o -e .env.local -- tsx scripts/verify-copilot-provider.mts --live --configured-tools --organization-scope
npx dotenv -o -e .env.local -- tsx scripts/verify-copilot-provider.mts --live --no-stream
npx dotenv -o -e .env.local -- tsx scripts/verify-copilot-provider.mts --live --model=opus
npx dotenv -o -e .env.local -- tsx scripts/verify-copilot-provider.mts --live --model=haiku
```

La opción `--live` es obligatoria. Estas pruebas consumen tokens del proveedor con contenido sintético, no saldo de una organización. `--configured-tools` solo lee la configuración activa de A09 para construir declaraciones: no consulta métricas de clientes ni ejecuta conectores ni escribe en la base de datos.

## Límites de esta verificación

Se ha verificado con el proveedor real la ruta de runtime, las declaraciones de tools, el ciclo de ejecución sintético, el streaming y Zod. Los tests locales cubren selección de modelo, aislamiento de tienda, evidencia y acciones de UI. Esto no certifica la salud actual de cada integración externa ni la exactitud de todas sus consultas: no se ejecutaron tools contra datos reales de la tienda. Tampoco se lanzó una nueva pregunta autenticada desde la sesión del usuario, que incorpora contexto privado. El fallback OpenAI no se probó contra su API real en esta auditoría.

Estos cambios de código no requieren migraciones y no se ha desplegado producción durante esta corrección.

Referencia del proveedor: [limitaciones y complejidad de Structured Outputs de Anthropic](https://platform.claude.com/docs/en/build-with-claude/structured-outputs#schema-complexity-limits). El proveedor limita tanto las características admitidas como el tamaño de la gramática combinada con tools; que un esquema sea JSON Schema válido no garantiza que compile.
