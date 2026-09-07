// Helpers de fecha para rejillas de calendario/agenda (local time, semana
// empieza el lunes). Compartidos por /planificacion/calendario y el widget de
// agenda del consultor.

export const dayKey = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

export const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

export const addDays = (date: Date, amount: number) => {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
};

export const addMonths = (date: Date, amount: number) => {
  const result = new Date(date);
  result.setDate(1);
  result.setMonth(result.getMonth() + amount);
  return result;
};

export const monthStart = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), 1);

export const monthEnd = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth() + 1, 0);

export const mondayStart = (date: Date) => {
  const result = startOfDay(date);
  const day = result.getDay() || 7;
  result.setDate(result.getDate() - day + 1);
  return result;
};
