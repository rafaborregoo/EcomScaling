# E-NORA móvil

App móvil de E-NORA (Expo / React Native, TypeScript). Mismo backend que la web: `apps/api` + Supabase.

## Regla de alcance (leer ANTES de programar nada)

**La app móvil NO replica la web.** Es solo para lo más importante. Cada función que se añada debe pasar
por el **juez de alcance**; si no pasa, va a la web y no se programa aquí. Ante la duda, **no entra**.

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
| Widget de tareas abiertas (solo lectura) | Entra (limitado) | Ver qué vence y qué está vencido es sensible al tiempo; completar pide registrar un resultado, eso va a la web | 2026-10-15 |
| Detalle de stock en riesgo (hoja) | Entra | Productos agotados y con stock bajo (foto + nombre) y análisis del agente con nombres; sin explicaciones genéricas | 2026-10-15 |
| Widget de alertas activas (solo lectura) | Entra | Urgente por definición; reconocer/resolver va a la web | 2026-10-15 |
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
| Catálogo/Productos, Analítica de cartera, Mi Camino | No | Exploración y análisis: ruido en móvil | 2026-10-15 |

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
