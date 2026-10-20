# E-NORA móvil

App móvil de E-NORA (Expo / React Native, TypeScript). Mismo backend que la web: `apps/api` + Supabase.

## Regla de alcance (leer ANTES de programar nada)

**La app móvil NO replica la web.** Es solo para lo más importante. Cada función que se añada debe pasar
por el **juez de alcance**; si no pasa, va a la web y no se programa aquí. Ante la duda, **no entra**.

### Tres interfaces, una por rol

La app abre una interfaz distinta según `platform_role` (`components/app-shell.tsx`); no hay conmutador. El juez de alcance de
abajo vale para el **cliente**. El consultor y el administrador trabajan con la app como herramienta de decisión, y se
amplía (Rafa, 2026-10-17): lo urgente y lo que decide dónde intervenir también ocurre lejos del ordenador.

| Rol | Fichero | Pestañas | Idea |
|---|---|---|---|
| Cliente | `shell-cliente.tsx` | Inicio, Métricas, Marketing, Copiloto, Mensajes | Su tienda y su consultor |
| Consultor | `shell-consultor.tsx` | Hoy, Clientes, Trabajo, Marketing, Mensajes (el chat tiene dos páginas: Clientes y Copiloto) | Una cartera: arriba DÓNDE está (selector de cliente y tienda), abajo QUÉ hace |
| Admin de plataforma | `shell-admin.tsx` | Estado, Consultores, Clientes | Vigila la plataforma; desde un cliente abre su vista para soporte |

Consultor: cambiar de cliente o tienda no cambia de pestaña. Hoy sin cliente es la mesa de la cartera (acciones por
urgencia con aprobar/descartar en la fila); con cliente, su Pulso con el canal como filtro. Trabajo: propuestas de la IA, tareas, llamadas y clientes sin llamada de toda la cartera. Marketing: cola de revisión
de campañas (revisada / pedir cambios) y envíos de la semana pasada; con cliente, además su contenido. Sin logo en la
cabecera en ninguna interfaz. «Marcar revisado» (icono junto a los canales del cliente) y el aviso push abre al cliente del aviso. Clientes sin cliente elegido:
Estado (semáforo) y Rentabilidad (comparativa de la cartera, lo peor primero). «Escribir al cliente» (`WriteToClient` en `mensajes.tsx`, solo lo provee el consultor): icono junto a los canales, desde cada alerta y desde la hoja de una métrica, con borrador. Las propuestas de la IA se deciden solo en Trabajo (Hoy enlaza con cuántas esperan). Con un cliente abierto, la pestaña Clientes pasa a llamarse Métricas. Deslizar la cabecera pasa al cliente siguiente/anterior por urgencia («3/12» junto al nombre); el nav lleva números (alertas críticas, trabajo, mensajes). Pendiente: aportes del consultor junto al ✨ (cuando la web los tenga).

### Juez de alcance

Una función entra solo si cumple **las cuatro**:

1. **Urgente o sensible al tiempo**: alerta, aprobación o decisión que no debería esperar a estar frente al ordenador.
2. **Se resuelve en menos de un minuto** y con una mano (aprobar, rechazar, leer una cifra, responder).
3. **Tiene valor real si está en el móvil**: si no existiera aquí, el usuario perdería dinero, tiempo o una decisión.
4. **No necesita pantalla grande**: nada de editores, tablas largas, constructores, configuración ni informes extensos.

Si falla cualquiera → **ruido para la móvil** → va a la web.

### Cómo se aplica

Antes de implementar, el agente (o quien programe) añade una fila a la tabla de abajo con el veredicto y el motivo.
Sin fila con veredicto **Entra**, no se escribe código de esa función.

| Función | Veredicto | Motivo | Fecha |
|---|---|---|---|
| Login + identidad (`/v1/bootstrap`) | Entra | Base necesaria para todo lo demás | 2026-10-15 |
| Selector de dashboard Todo / Shopify / Meta / Klaviyo | Entra (limitado) | Cifras clave y gráficos de línea interactivos por vista (ampliado por Rafa 2026-10-15); sin tablas largas, creatividades ni análisis IA | 2026-10-15 |
| Inicio rediseñado: una cifra principal con pastillas para cambiarla, «Para hoy» (propuestas, alertas, stock, tareas o «Todo en orden»), filas de canal que abren su vista y enlace a Métricas | Entra | Pedido por Rafa 2026-10-17: menos datos de primeras y más intuitivo. Mismo esquema en las cuatro vistas; el detalle (beneficio, más vendidos, embudo, atribuido, interacción) en hojas a un toque | 2026-10-17 |
| Periodo «Hoy» en Todo y Shopify (desde las 00:00 de la tienda vs el mismo día de la semana pasada) | Entra | Pedido por Rafa 2026-10-17: es lo que se mira al abrir la app. Todo arranca en «Hoy» | 2026-10-17 |
| Cifra de negocio arriba en Todo: beneficio neto (con costes completos) o ventas por € en anuncios | Entra | Pedido por Rafa 2026-10-17: responde «¿gano dinero?» antes que «¿cuánto vendo?» | 2026-10-17 |
| «Para hoy» en Meta (ROAS bajo el mínimo rentable) y Klaviyo (campañas que salen hoy) | Entra | Pedido por Rafa 2026-10-17: avisos reales del día, solo lectura | 2026-10-17 |
| Tocar una notificación push abre donde se resuelve (Mensajes o «Para hoy») | Entra | Pedido por Rafa 2026-10-17: sin esto, el aviso abre la app donde estuviera | 2026-10-17 |
| Widget de tareas abiertas: ver y completar con una línea de resultado | Entra (limitado) | Ver qué vence es sensible al tiempo. Ampliado por Rafa 2026-10-17: completar con una línea de resultado (queda como comentario, igual que el Pulso de la web) cabe en un minuto; asignar, editar o medir el resultado con cifras sigue en la web | 2026-10-17 |
| Tareas vencidas del cliente en Hoy/Pulso del consultor | No | Pedido por Rafa 2026-10-17: ruido para el consultor; ya no son acción, ni cuentan en el semáforo ni en el badge. Viven en Tareas (web) y en Trabajo (solo las suyas) | 2026-10-17 |
| Propuestas de la IA y «reponer stock» en la interfaz del consultor | No | Pedido por Rafa 2026-10-18: son del cliente; el consultor no los ve (ni en Pulso, ni en Shopify, ni en Trabajo, ni en el badge) | 2026-10-18 |
| Hoy del consultor sin cliente: ranking de salud por tiendas (peor primero) y ficha de tienda en hoja (Resumen, Por pedido, Marketing, Avisos) | Entra | Pedido por Rafa 2026-10-17: Hoy se rehace de cero y esto es lo primero; lo demás (acciones, gráficos) se añade después | 2026-10-17 |
| Hoy del consultor sin cliente: ranking de salud por tiendas (peor primero) y ficha de tienda en hoja (Resumen, Por pedido, Marketing, Avisos) | Entra | Pedido por Rafa 2026-10-17: Hoy se rehace de cero y esto es lo primero; lo demás (acciones, gráficos) se añade después | 2026-10-17 |
| Detalle de stock en riesgo (hoja) | Entra | Productos agotados y con stock bajo (foto + nombre) y análisis del agente con nombres; sin explicaciones genéricas | 2026-10-15 |
| Notas del consultor en tarjetas: verlas en «Para hoy» del cliente y marcarlas como vistas | Entra (limitado) | Pedido por Rafa 2026-10-18: es un aviso de su consultor y se despacha en un toque; escribir notas y verlas sobre cada tarjeta sigue en la web | 2026-10-18 |
| Widget de alertas activas: marcar vista y resolver | Entra | Urgente por definición. Ampliado por Rafa 2026-10-17: marcar vista o resolver es un toque; las reglas de alertas siguen en la web | 2026-10-17 |
| Nav inferior: Inicio, Métricas, Marketing, Copiloto, Mensajes | Entra | Elegidos por Rafa 2026-10-15; máximo 5, ninguno más sin quitar otro | 2026-10-15 |
| Métricas: Todo / Shopify / Meta / Klaviyo (selector de cabecera) | Entra (limitado) | Cifras de fondo en rejilla con variación vs periodo anterior (ventas, embudo, rentabilidad, clientes, captación, salud de email) y top 5 por canal; sin gráficos (están en Inicio), sin fichas de detalle ni promociones. Ampliado por Rafa 2026-10-16 | 2026-10-16 |
| Analista de métricas: veredicto por cifra (punto de color + hoja con el porqué) | Entra (limitado) | Leer en segundos si una cifra va bien o mal y por qué; solo lectura, mismas reglas que la web (ADR-0027). Sin chat ni acciones desde la hoja | 2026-10-16 |
| Métricas › Klaviyo: campañas enviadas con orden por éxito, «Ver más» y ficha completa (cifras, clics por enlace) | Entra (limitado) | Pedido por Rafa 2026-10-17: leer en segundos qué campaña funcionó; solo lectura, sin vista previa del email ni edición | 2026-10-17 |
| Marketing: Hoy, Campañas, Flows (solo lectura) | Entra (limitado) | Qué hay que mandar y en qué estado; crear contenido, plantillas, audiencias y banco de imágenes van a la web | 2026-10-15 |
| Selector de tienda (arriba en Configuración) | Entra | Pedido por Rafa 2026-10-16: con varias tiendas, todas las cifras de la app (Pulso, Métricas, Marketing) salen de la tienda elegida o de todas; sin él la móvil no coincidía con la web | 2026-10-16 |
| Marketing: Flows — ver los de Klaviyo (cifras) y los diseñados en la web (pasos) | Entra (limitado) | Pedido por Rafa 2026-10-16: solo lectura, hoja con cifras o con la secuencia de pasos; crear y editar flows sigue en la web | 2026-10-16 |
| Marketing: Crear campaña de email (plantillas, bloques, marca, revisión, prueba, programar) | Entra (limitado) | Pedido por Rafa 2026-10-16: el cliente crea y envía por su cuenta desde el móvil. Solo email; Meta, Instagram, popup, constructor de flows e importar de Klaviyo siguen en la web | 2026-10-16 |
| Copiloto: chat de preguntas cortas | Entra (limitado) | Sin informes, sin editar y sin elegir modelo | 2026-10-15 |
| Mensajes consultor↔cliente: leer y responder | Entra (limitado) | Sin adjuntos, llamadas ni piezas de marketing | 2026-10-15 |
| Configuración (menú de 3 barras) | Entra (limitado) | Perfil, notificaciones, seguridad, integraciones (estado), Copiloto IA, consultor, plan (lectura), ayuda y legal. Costes, objetivos, equipo y roles, reglas de alertas y datos de tienda se quedan en la web | 2026-10-15 |
| Propuestas de la IA: aprobar / descartar | Entra | Decisión de segundos que bloquea al agente; confirma una vez por tanda y el API decide permisos | 2026-10-15 |
| Cartera del consultor | Entra | Responde "qué cliente necesita atención hoy"; tocar un cliente abre su Pulso | 2026-10-15 |
| Push de los avisos de la campana | Entra | Sin push, nada de lo urgente llega con la app cerrada | 2026-10-15 |
| Alertas de agentes y anomalías (push) | Entra | Urgente; es el motivo principal de tener móvil | 2026-10-15 |
| Aprobar / rechazar acciones de la IA | Entra | Decisión de segundos que bloquea al agente si espera | 2026-10-15 |
| KPIs del día (3-4 cifras clave) | Entra | Lectura rápida; limitado a cifras, sin gráficos largos. Hecho: pantalla Pulso (ventas, pedidos, ticket, stock en riesgo) | 2026-10-15 |
| Mensajes consultor↔cliente (responder) | Entra | Respuesta corta y sensible al tiempo | 2026-10-15 |
| Copiloto: preguntas cortas | Entra (limitado) | Solo consulta puntual; sin generar informes ni editar | 2026-10-15 |
| Informes | No | Lectura extensa; en móvil solo llega el aviso "informe listo" vía alertas | 2026-10-15 |
| Constructor de flows, editor de Meta/Instagram/popup | No | Editores: necesitan pantalla grande (el de email sí entra, ver arriba) | 2026-10-15 |
| Conectar integraciones (OAuth Shopify/Meta/Klaviyo) | No | Poco frecuente; se hace en la web | 2026-10-15 |
| Configuración, Plan y plazas, facturación | No | Poco frecuente, sin urgencia | 2026-10-15 |
| Camino de la tienda en Trabajo (consultor): fase en curso con nombre, objetivo, cifras y tareas; deslizar a las otras fases; cambiar nombre de fase, y añadir o editar tareas (título, prioridad, fecha) | Entra (limitado) | Pedido por Rafa 2026-10-18: el consultor ajusta el camino desde el móvil con formularios de una línea; el mapa, crear caminos, hitos y reordenar siguen en la web. Un cliente solo se elige con tienda | 2026-10-18 |
| Trabajo › Tareas (consultor): crear tarea (título, prioridad, fecha, responsable, interna o propuesta al cliente) y cambiar fecha y responsable de cualquier tarea | Entra (limitado) | Pedido por Rafa 2026-10-19: formulario corto en hoja. Título y prioridad solo se editan en tareas del Camino (la API no tiene otra ruta); el consultor completa su trabajo interno o lo asignado a él (círculo o hoja, con una línea de resultado); las tareas del cliente las sigue cerrando el cliente | 2026-10-19 |
| Trabajo sin cliente elegido: primero las cuentas con propuestas de la IA (una fila por cuenta, sus propuestas en hoja); las tareas solo con un cliente elegido. Tareas internas del consultor etiquetadas con una tienda | Entra | Pedido por Rafa 2026-10-19; la etiqueta de tienda también en la web (/tareas) | 2026-10-19 |
| Trabajo › Tareas (consultor): «La IA propone» con las tareas de `/v1/consultant/proposed-tasks`, aprobar por tanda (desmarcando las que sobran) o descartar | Entra | Pedido por Rafa 2026-10-19; revisa el «No» del 2026-10-18 solo para estas propuestas de la cartera (las del cliente siguen fuera) | 2026-10-19 |
| Catálogo/Productos, Analítica de cartera, Mi Camino (mapa y editor) | No | Exploración y análisis: ruido en móvil | 2026-10-15 |

### Reglas de diseño

- **Sin duplicados:** si un gráfico ya muestra un dato (ventas, pedidos, ticket, conversión, inversión, ROAS…), no se repite en una tarjeta de cifra debajo.
- **Sin subtextos explicativos:** una línea de contexto como mucho (prioridad y fecha, gravedad y fecha). Nada de descripciones largas.
- **Tareas:** solo las vencidas, sin fecha o que vencen en 2 semanas (misma regla que el Dashboard de la web).

## Desarrollo

```
cp .env.example .env      # en el móvil, EXPO_PUBLIC_API_URL = IP de tu PC, no localhost
npm run dev:api           # desde la raíz
npm run dev -w @e-nora/mobile
```

### Probar en iPhone

Xcode solo existe en Mac; no hace falta para desarrollar.

- **Día a día:** instala *Expo Go* en el iPhone, escanea el QR (PC y móvil en la misma wifi).
- **Build real / TestFlight:** `eas build --platform ios` (compila en la nube de Expo, sin Mac). Requiere cuenta
  de Apple Developer (99 USD/año).
