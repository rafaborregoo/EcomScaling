export const CONSULTANT_TASK_PRESETS = [
  { id: "onboarding", label: "Alta de cliente", title: "Completar la puesta en marcha de la tienda", days: 2, steps: ["Confirmar la tienda y los accesos del equipo.", "Revisar sincronización, moneda, costes y cobertura de datos.", "Acordar una primera acción con responsable y fecha."], done: "Tienda identificada, datos revisados y primera acción acordada por escrito." },
  { id: "weekly", label: "Revisión semanal", title: "Revisar resultados y prioridades de la semana", days: 7, steps: ["Comprobar frescura y cobertura de ventas, inversión y stock.", "Revisar alertas, tareas vencidas y propuestas pendientes.", "Registrar las decisiones y la siguiente revisión."], done: "Revisión registrada con evidencia del periodo y siguientes acciones asignadas y fechadas." },
  { id: "monthly", label: "Cierre mensual", title: "Preparar el cierre y el informe mensual", days: 3, steps: ["Confirmar el mes, la tienda, la moneda y la cobertura financiera.", "Revisar resultados frente al periodo anterior y explicar sus límites.", "Generar el informe y comprobar sus destinatarios y estado de envío."], done: "Informe revisado y envío confirmado, con limitaciones y decisiones del siguiente mes documentadas." },
] as const;

export function consultantTaskPreset(id: string, now = new Date()) {
  const preset = CONSULTANT_TASK_PRESETS.find((item) => item.id === id);
  if (!preset) return null;
  const date = new Date(now);
  date.setDate(date.getDate() + preset.days);
  return { title: preset.title, description: `${preset.steps.map((step, index) => `${index + 1}. ${step}`).join("\n")}\n\nCriterio de cierre: ${preset.done}`, dueAt: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}` };
}
