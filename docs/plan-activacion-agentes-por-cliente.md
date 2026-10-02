# Activación de agentes por cliente

## Objetivo

Permitir únicamente al platform admin activar o desactivar agentes por organización cliente y elegir el modelo. Si una organización no tiene ajustes explícitos, todos los agentes activos del catálogo se habilitan por defecto; el admin puede desactivarlos durante pruebas.

## Plan

1. **Persistencia y permisos** — guardar ajustes explícitos de agentes y modelo por organización; permitir lectura y escritura solo a `platform_admin`; eliminar la configuración al borrar el cliente.
2. **Panel de administración** — seleccionar cliente, elegir modelo y activar/desactivar cada agente de forma independiente, con acciones para activar o desactivar todos.
3. **Control de ejecución** — rechazar ejecuciones si el agente solicitado no está activo para ese cliente; enviar la llamada al proveedor indicado por el modelo.
4. **Evolución operativa** — añadir gestión cifrada de claves por cliente si se requiere BYOK e historial de cambios.

## Entregado en esta implementación

- Migraciones de `organization_ai_agent_runtime_config`, con una fila única por cliente y una lista de agentes activos; sin ajustes explícitos, el runtime habilita los agentes activos del catálogo.
- API administrativa para consultar y actualizar agentes y modelo por cliente, con validación de rol, organización, agentes y modelo.
- Panel de **Configuración de IA** con filtro por consultor asignado, selector de cliente exacto, selector de modelo, toggles independientes y acciones para activar o desactivar todos los agentes.
- El runner de diagnóstico verifica la configuración antes de ejecutar y usa el modelo del cliente, incluyendo la selección explícita de proveedor.
- Modelos disponibles: Claude Sonnet 5.5 / Opus 5.5 y OpenAI GPT-6 Luna / GPT-6 Sol.

## Despliegue

Aplicar la migración nueva antes de habilitar agentes. La clave del proveedor elegido debe estar configurada en el runtime (`OPENAI_API_KEY` o `ANTHROPIC_API_KEY`). La clave se mantiene fuera de la base de datos; la gestión BYOK por cliente queda como siguiente fase si cada cliente aportará una clave propia.
