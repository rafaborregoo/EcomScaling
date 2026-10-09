export type CalendarIdea = { name: string; date: string };

export function calendarHorizonDays(horizonMonths: number, today = new Date()): number {
  const end = new Date(today);
  const startDay = end.getUTCDate();
  end.setUTCDate(1);
  end.setUTCMonth(end.getUTCMonth() + horizonMonths);
  const lastDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate();
  end.setUTCDate(Math.min(startDay, lastDay));
  return Math.max(1, Math.ceil((end.getTime() - today.getTime()) / 86_400_000));
}

export function calendarMonthsTouched(start: Date, horizonDays: number): number {
  const end = new Date(start.getTime() + Math.max(1, horizonDays) * 86_400_000);
  return (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth() + 1;
}

function easterSunday(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

export function upcomingCalendarIdeas(horizonMonths: number, today = new Date()): CalendarIdea[] {
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const end = new Date(start);
  end.setUTCDate(1);
  end.setUTCMonth(end.getUTCMonth() + horizonMonths);
  end.setUTCDate(Math.min(start.getUTCDate(), new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate()));
  const ideas: Array<CalendarIdea & { timestamp: number }> = [];

  for (let year = start.getUTCFullYear(); year <= end.getUTCFullYear(); year += 1) {
    const thanksgiving = new Date(Date.UTC(year, 10, 1));
    thanksgiving.setUTCDate(1 + ((4 - thanksgiving.getUTCDay() + 7) % 7) + 21);
    const blackFriday = new Date(thanksgiving);
    blackFriday.setUTCDate(blackFriday.getUTCDate() + 1);
    const easter = easterSunday(year);
    const annualEvents = [
      { name: "San Valentín", date: new Date(Date.UTC(year, 1, 14)) },
      { name: "Semana Santa", date: new Date(easter.getTime() - 7 * 24 * 60 * 60 * 1000) },
      { name: "Inicio astronómico del verano", date: new Date(Date.UTC(year, 5, 21)) },
      { name: "Black Friday", date: blackFriday },
      { name: "Navidad", date: new Date(Date.UTC(year, 11, 25)) },
    ];

    for (const event of annualEvents) {
      if (event.date >= start && event.date <= end) {
        ideas.push({ name: event.name, date: event.date.toISOString().slice(0, 10), timestamp: event.date.getTime() });
      }
    }
  }

  return ideas.sort((a, b) => a.timestamp - b.timestamp).map(({ name, date }) => ({ name, date }));
}
