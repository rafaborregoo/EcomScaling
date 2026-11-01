---
id: META-CV-008
titulo: "Dos rutas segun madurez y disponibilidad de datos"
proyecto: e-NORA
version_fuente: V04
estado: CANDIDATO_NO_VALIDADO
corpus: Texto pegado(3).txt
minutos_fuente: "06:18–07:10; 10:23–12:39; 12:39–14:10"
tipo: conocimiento_metodologico_condicional
uso: auditoria_previa_a_ingesta
---

# Dos rutas segun madurez y disponibilidad de datos

> **Estado:** propuesta extraída/derivada del cuarto vídeo. NO significa que exista la funcionalidad en e-NORA ni que deba indexarse.

## 1. Qué afirma realmente la fuente (06:18–07:10; 10:23–12:39; 12:39–14:10)
El vídeo diferencia una ruta para marcas con suficientes creativos históricos y otra basada en investigación de contenido orgánico cuando no existe ese histórico; también permite usar ambas rutas en una marca madura que quiere explorar nuevos segmentos.

## 2. Interpretación propuesta para e-NORA (NO demostrada por la fuente)
El agente debería seleccionar rutas por disponibilidad **verificada** de datos, objetivo de aprendizaje y madurez. `HISTORICO_PROPIO`, `EXPLORACION_ORGANICA` o `COMBINADA`. La elección no debe basarse en ingresos supuestos.

## 3. Datos necesarios y procedencia
- Inventario de activos, cobertura temporal e informes de resultados del tenant.
- Acceso real a contenido orgánico autorizado o ejemplos suministrados.
- Objetivos de crecimiento y necesidades comerciales documentadas.

## 4. Procedimiento o regla candidata
1. Evaluar evidencia interna: suficiente / limitada / ausente / acceso denegado.
2. Si suficiente, empezar por ideas propias; si limitada, considerar investigación externa o entrevistas/reseñas.
3. Si ambas fuentes existen, combinar conservando su origen y calidad.
4. Si no hay ninguna, pedir datos, ofrecer metodología genérica y abstenerse de afirmar descubrimientos.

## 5. Restricciones y riesgos
- Un presupuesto histórico de $100k/mes en el vídeo es ejemplo, no requisito del motor.
- Fallback no debe acceder automáticamente a redes ajenas.
- Fuentes externas y privadas no deben mezclarse ni compartirse entre tenants.

## 6. Ejemplos de aplicación y de rechazo
Casos: tienda nueva sin anuncios → sugerir investigación de problema y primer test, no “top 20”; tienda con ads e histórico → evaluar conceptos propios antes de pedir producción nueva.

## 7. Encaje incremental / comprobación de duplicados
Conecta V01 performance, V02 bajo presupuesto, V03 investigación; auditar si ya existe router/selección de playbooks.

## 8. Criterio de aceptación para auditoría
- Localizar equivalente en documentación, prompts, tests, código, RAG persistido y agente consumidor; no confundir presencia en archivos con ejecución.
- Verificar la fuente y permisos de todos los datos requeridos; si faltan, clasificar como metodología teórica.
- Determinar `REUTILIZAR | FUSIONAR | AMPLIAR | CREAR | DESCARTAR | BLOQUEAR` con rutas y líneas del repositorio.
- No crear contenido, ejecutar campañas, modificar repositorio ni actualizar embeddings en esta fase.
