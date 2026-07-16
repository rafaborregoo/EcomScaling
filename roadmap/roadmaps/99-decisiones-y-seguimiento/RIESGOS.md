# Riesgos activos

| Riesgo | Impacto | Mitigacion | Estado |
| --- | --- | --- | --- |
| Crear todo el esquema de una vez. | Migraciones dificiles, complejidad muerta y baja velocidad. | Seguir DB-00 a DB-11. | Activo |
| Dashboard antes de reconciliar APIs. | Perdida de confianza del cliente. | Mostrar freshness y comparar contra fuentes oficiales. | Activo |
| Agentes antes de motores deterministas. | Recomendaciones con cifras no verificables. | Motores primero, IA interpreta despues. | Activo |
| Fallo multi-tenant/RLS. | Incidente critico de privacidad. | Tests A/B desde DB-02 y SQO-00. | Activo |
| Automatizacion autonoma prematura. | Acciones incorrectas sobre negocio real. | Borradores y aprobacion humana hasta quality gates. | Activo |

j