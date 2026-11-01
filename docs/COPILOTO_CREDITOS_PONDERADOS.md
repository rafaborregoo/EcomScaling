# A09 · Saldo de créditos por coste

Decisión del 29 de octubre de 2026: el usuario elige el modelo y todos consumen
una bolsa mensual compartida. Se sustituye el conteo literal de tokens por
créditos ponderados según coste API registrado.

- Cuota por defecto: 1.000.000 créditos = 5 USD de presupuesto API.
  Se toma 5 USD como referencia inicial próxima al coste de un millón de tokens
  combinados de Sol/Sonnet con el reparto histórico de entrada y salida. Es una
  decisión comercial inicial, no una equivalencia universal entre tokens y USD.
- Conversión: 200.000 créditos por USD; redondeo hacia arriba por ejecución.
- El coste conserva entrada, salida, lectura y escritura de caché, todas las
  llamadas del turno y herramientas facturadas que registra el runtime.
- No se añaden los tokens de razonamiento a la salida: ya están incluidos.
- Claude informa entrada sin caché; OpenAI incluye caché en su entrada. El
  cálculo distingue ambos formatos y evita omisiones y duplicaciones.
- El coste usa las tarifas guardadas en cada ejecución y no revalúa el pasado.
  Los runs históricos pueden tener la contabilidad anterior de caché.
- Una ejecución con uso y coste desconocido impide calcular el saldo y atender
  nuevos turnos hasta corregir la tarifa; no se considera gratuita.
- La cuota conserva el nombre técnico `copilot_monthly_tokens` para mantener
  compatibilidad con el alta de suscripciones; su unidad pasa a ser créditos.
- Cliente: saldo de su organización. Consultor: saldo de su consultora, incluso
  cuando trabaja dentro de una tienda de cliente.
- Se mantienen las reglas existentes de acceso a modelos según plan y el modo
  reducido al agotar saldo. El coste de ese modo sigue registrado: el presupuesto
  de créditos no es un tope absoluto de factura. Un turno en curso puede superar
  el saldo disponible y varios turnos pueden comenzar simultáneamente.

La UI del Copiloto muestra saldo y desglose por modelo. El selector y Platform
Admin > Costes IA / Laboratorio A09 comparan un ejemplo común de 10.000 tokens de
entrada y 1.000 de salida sin caché. Se elimina la promesa de preguntas restantes.
La comparación de créditos no es una evaluación de calidad.

## Verificación y despliegue

Migración: `20261029093918_copilot_cost_weighted_credits.sql`.
Aplicar antes de la API nueva: necesita la RPC `copilot_credit_usage`.
RPC restringida a `service_role`, con `security invoker`; el servidor valida
la organización antes de invocarla. No se cambian concesiones de suscripciones.

Las tarifas de referencia se contrastaron con:

- https://platform.claude.com/docs/en/about-claude/pricing
- https://developers.openai.com/api/docs/models/gpt-6-luna

Estado: implementación local; migración aplicada al proyecto TEST ES IA.
Producción pendiente de despliegue. Las verificaciones no generan llamadas de IA.

Verificado: 135 pruebas de contratos, saldo, contabilidad, caché, adaptadores y reintentos;
comprobación de tipos de API y web. En la base de pruebas coinciden los créditos
de las dos bolsas con la suma independiente de costes. La RPC no es ejecutable
por `anon` ni `authenticated`. Los avisos de seguridad de Supabase no aumentaron
con la migración.
