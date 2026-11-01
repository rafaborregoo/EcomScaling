# Revisión de los detalles KPI del dashboard

Fecha: 20 de octubre de 2026. Entorno local: http://localhost:3001/dashboard?tab=todo.

## Cambios

- Los importes negativos, incluidos los costes y un beneficio negativo, usan el token de peligro en la cifra y en la barra. El signo menos permanece visible. El color se conserva al pasar el ratón.
- Las tarjetas y sus detalles identifican la métrica por `data-metric`; los colores ya no dependen de la posición de la tarjeta ni de que exista el CAC.
- Los gráficos diarios incluyen valores negativos, cero y comparación anterior dentro de su escala. Las partes negativas se distinguen en rojo.
- El rango nativo del gráfico permite explorar días con teclado y anuncia fecha e importe. Las series vacías o de un solo punto tienen una lectura explícita.
- Entrada de 240 ms y salida de 160 ms, con cancelación del cierre pendiente cuando se abre otra cifra. Escape y el botón de cierre devuelven el foco a la tarjeta. Se respeta la preferencia de movimiento reducido.
- En móvil, etiqueta e importe preceden a la barra, las acciones se apilan y los controles del detalle tienen un mínimo de 44 px.

## Comprobaciones en navegador

- Cliente: ventas, pedidos, beneficio y conversión.
- Cliente visto por el consultor: ventas, pedidos, beneficio, conversión, ticket medio, ROAS y stock.
- Cartera del consultor: ventas, pedidos, ticket medio, inversión Meta y ROAS.
- Verificados los costes rojos en ambas vistas del cliente y los ROAS bajo equilibrio en campañas.
- Verificadas las vistas móviles a 390 × 844: cascada, gráfico diario y barras de cartera, sin desbordamiento horizontal.
- Verificados el recorrido del gráfico con flechas/Home, el cierre con Escape, la devolución del foco y el cambio de cifra durante un cierre.
- Contraste del rojo observado (#a72d43) sobre blanco: 6,78:1.

El CAC no aparece con los datos actuales: su configuración se revisó por código. Los casos de escala negativa y vacía se comprobaron mediante pruebas unitarias; no se modificaron datos de negocio para fabricarlos. La reducción de movimiento se revisó por código.

## Validación

- TypeScript de web: correcto.
- ESLint de los cuatro archivos TypeScript modificados: correcto.
- Pruebas de `client-pulse-model` y `store-pulse`: 19 correctas.
- `git diff --check` de los archivos modificados en esta tarea: correcto.

## Evidencia

- `cliente-beneficio-desktop.png`
- `cliente-beneficio-mobile.png`
- `consultor-cartera-mobile.png`

Las capturas usan los datos disponibles en la sesión local durante la revisión; no son recursos que se sirven desde la aplicación.
