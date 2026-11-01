---
id: META-CV-002
titulo: "Reconocimiento de patrones con cautela"
proyecto: e-NORA
version_fuente: V04
estado: CANDIDATO_NO_VALIDADO
corpus: Texto pegado(3).txt
minutos_fuente: "03:04–04:06; 06:38–07:25; 11:23–11:49"
tipo: conocimiento_metodologico_condicional
uso: auditoria_previa_a_ingesta
---

# Reconocimiento de patrones con cautela

> **Estado:** propuesta extraída/derivada del cuarto vídeo. NO significa que exista la funcionalidad en e-NORA ni que deba indexarse.

## 1. Qué afirma realmente la fuente (03:04–04:06; 06:38–07:25; 11:23–11:49)
La ponente utiliza reconocimiento de patrones para buscar ideas recurrentes, personas, mensajes, creadores y recursos que coinciden en distintos anuncios de buen rendimiento. Propone usar repeticiones como señal para nuevas hipótesis.

## 2. Interpretación propuesta para e-NORA (NO demostrada por la fuente)
Un agente podría agrupar creativos por **ideas comerciales verificables**, comparar resultados por ventana y detectar patrones, sin confundir frecuencia de aparición con eficacia causal.

## 3. Datos necesarios y procedencia
- Conjunto de anuncios con fecha, objetivo, inversión, impresiones, resultados, ventana de atribución, creatividad y cambios.
- Etiquetas de ideas con confianza/validación manual; histórico comparable.
- Métricas y definiciones por nivel (anuncio vs conjunto vs campaña).

## 4. Procedimiento o regla candidata
1. Normalizar periodos, objetivo, atribución, moneda y exposición.
2. Agrupar por mensaje/idea, no solo por formato ni por nombre del archivo.
3. Comparar con baseline y variabilidad; señalar posibles sesgos de selección y gasto desigual.
4. Emitir `patron_observado`, `contraste`, `hipotesis`, `confianza_cualitativa` y siguiente prueba.

## 5. Restricciones y riesgos
- Varias apariciones pueden proceder de copias del mismo creativo.
- El algoritmo puede concentrar gasto; gasto alto no implica eficacia rentable.
- No presentar “patrón ganador” sin datos de outcomes, muestras y contexto.

## 6. Ejemplos de aplicación y de rechazo
Aceptable: “tres piezas de la misma idea muestran resultados prometedores, pero las muestras no son independientes”. Rechazar: “la frase aparece cinco veces, por tanto convierte”.

## 7. Encaje incremental / comprobación de duplicados
Complementa V03 (`gap_analysis`, `research`) y V01 (`métricas`), pero necesita definir si e-NORA ya etiqueta/consolida creativos de Meta.

## 8. Criterio de aceptación para auditoría
- Localizar equivalente en documentación, prompts, tests, código, RAG persistido y agente consumidor; no confundir presencia en archivos con ejecución.
- Verificar la fuente y permisos de todos los datos requeridos; si faltan, clasificar como metodología teórica.
- Determinar `REUTILIZAR | FUSIONAR | AMPLIAR | CREAR | DESCARTAR | BLOQUEAR` con rutas y líneas del repositorio.
- No crear contenido, ejecutar campañas, modificar repositorio ni actualizar embeddings en esta fase.
