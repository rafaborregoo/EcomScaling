---
id: META-CV-004
titulo: "Mineria de creativos ganadores propios"
proyecto: e-NORA
version_fuente: V04
estado: CANDIDATO_NO_VALIDADO
corpus: Texto pegado(3).txt
minutos_fuente: "06:18–08:30; 12:39–13:10"
tipo: conocimiento_metodologico_condicional
uso: auditoria_previa_a_ingesta
---

# Mineria de creativos ganadores propios

> **Estado:** propuesta extraída/derivada del cuarto vídeo. NO significa que exista la funcionalidad en e-NORA ni que deba indexarse.

## 1. Qué afirma realmente la fuente (06:18–08:30; 12:39–13:10)
Primer framework: examinar los aproximadamente 20 creativos destacados del último año en cuentas con suficiente histórico, identificar su idea central y trasladar aprendizajes. El vídeo ofrece un caso anecdótico de un anuncio de gran inversión.

## 2. Interpretación propuesta para e-NORA (NO demostrada por la fuente)
Formalizar una ruta `HISTORICO_PROPIO` que use datos propios del tenant, si están disponibles. La propuesta “top 20” es una muestra de trabajo, no umbral estadístico ni definición objetiva de ganador.

## 3. Datos necesarios y procedencia
- Ads, campañas, datos de ventas y costes donde proceda; fechas, gasto, compras, ROAS y CPA.
- Vínculos a activos, permisos y eventuales modificaciones.
- Ventana de comparación definida; disponer del asset no se deduce de tener insights.

## 4. Procedimiento o regla candidata
1. Definir “ganador” con criterio económico específico del negocio y robustez mínima.
2. Filtrar según periodos y objetivos comparables.
3. Identificar mensajes recurrentes y priorizar candidatos diversificados.
4. Extraer idea/evidencia/hipótesis y enlazar con el anuncio fuente.
5. Si faltan histórico o media: ruta alternativa de V04, no simulación de winners.

## 5. Restricciones y riesgos
- La cantidad gastada en un anuncio no certifica rentabilidad.
- No tratar la afirmación anecdótica de inversión del vídeo como dato generalizable.
- Respeto estricto del aislamiento multi-tenant; no reutilizar resultados privados entre tiendas.

## 6. Ejemplos de aplicación y de rechazo
Ejemplo: “histórico de 11 anuncios (no 20), solo 3 con compras medidas; evidencia insuficiente para un ranking económico fiable”.

## 7. Encaje incremental / comprobación de duplicados
Se solapa con V01 diagnóstico de creativos, V03 inventario/gaps y V02 concentración de recursos; verificar tabla fuente de Meta e índices existentes.

## 8. Criterio de aceptación para auditoría
- Localizar equivalente en documentación, prompts, tests, código, RAG persistido y agente consumidor; no confundir presencia en archivos con ejecución.
- Verificar la fuente y permisos de todos los datos requeridos; si faltan, clasificar como metodología teórica.
- Determinar `REUTILIZAR | FUSIONAR | AMPLIAR | CREAR | DESCARTAR | BLOQUEAR` con rutas y líneas del repositorio.
- No crear contenido, ejecutar campañas, modificar repositorio ni actualizar embeddings en esta fase.
