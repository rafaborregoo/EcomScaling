import {
  CAMPAIGN_PLAN_HORIZON_DAYS,
  CAMPAIGN_PLAN_MAX_CUSTOM_DAYS,
  type CampaignPlanHorizon,
} from "@e-nora/ai";

export type CampaignPlanWindowInput = {
  horizon: CampaignPlanHorizon;
  startDate?: string | null;
  endDate?: string | null;
};

export type CampaignPlanWindowResult =
  | {
      ok: true;
      startDate: string;
      endDate: string;
      timezone: string;
      days: number;
    }
  | {
      ok: false;
      statusCode: 400;
      error: string;
      message: string;
    };

const DAY_MS = 86_400_000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDateKey(value: string) {
  if (!DATE_RE.test(value)) return null;
  const ms = Date.parse(value + "T00:00:00.000Z");
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== value)
    return null;
  return ms;
}

function dateKeyAtTimezone(now: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return part("year") + "-" + part("month") + "-" + part("day");
}

function addDays(dateKey: string, days: number) {
  const ms = parseDateKey(dateKey);
  return ms === null
    ? null
    : new Date(ms + days * DAY_MS).toISOString().slice(0, 10);
}

export function resolveCampaignPlanWindow(
  input: CampaignPlanWindowInput,
  options: { timezone?: string | null; now?: Date } = {},
): CampaignPlanWindowResult {
  const timezone = options.timezone?.trim() || "UTC";
  const now = options.now ?? new Date();
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
  } catch {
    return {
      ok: false,
      statusCode: 400,
      error: "invalid_campaign_plan_timezone",
      message: "La zona horaria de la tienda no es válida. Revisa su configuración.",
    };
  }

  const today = dateKeyAtTimezone(now, timezone);
  let startDate: string;
  let endDate: string;

  if (input.horizon === "custom") {
    if (!input.startDate || !input.endDate) {
      return {
        ok: false,
        statusCode: 400,
        error: "campaign_plan_custom_range_required",
        message: "Indica el primer y el último día del calendario.",
      };
    }
    startDate = input.startDate;
    endDate = input.endDate;
  } else {
    const days = CAMPAIGN_PLAN_HORIZON_DAYS[input.horizon];
    // La ventana incluye hoy; cada acción de hoy se valida por hora al guardar.
    startDate = today;
    endDate = addDays(startDate, days - 1) ?? startDate;
  }

  const startMs = parseDateKey(startDate);
  const endMs = parseDateKey(endDate);
  const todayMs = parseDateKey(today)!;
  if (startMs === null || endMs === null) {
    return {
      ok: false,
      statusCode: 400,
      error: "invalid_campaign_plan_date",
      message: "Las fechas deben ser días reales con formato año-mes-día.",
    };
  }
  if (startMs < todayMs) {
    return {
      ok: false,
      statusCode: 400,
      error: "campaign_plan_range_in_past",
      message: "El calendario debe empezar hoy o en una fecha futura.",
    };
  }
  if (endMs < startMs) {
    return {
      ok: false,
      statusCode: 400,
      error: "campaign_plan_range_reversed",
      message: "El último día debe ser igual o posterior al primero.",
    };
  }
  const days = Math.floor((endMs - startMs) / DAY_MS) + 1;
  if (days > CAMPAIGN_PLAN_MAX_CUSTOM_DAYS) {
    return {
      ok: false,
      statusCode: 400,
      error: "campaign_plan_range_too_long",
      message: "El calendario no puede superar los 366 días.",
    };
  }

  return { ok: true, startDate, endDate, timezone, days };
}

export function isCampaignPlanDate(value: unknown): value is string {
  return typeof value === "string" && parseDateKey(value) !== null;
}

/** Convert a wall-clock time in a store's IANA zone to one stable UTC instant. */
export function localCampaignDateTimeToUtc(
  dateKey: string,
  timezone: string,
  hour = 9,
  minute = 0,
) {
  const dateMs = parseDateKey(dateKey);
  if (dateMs === null) throw new Error("invalid_campaign_plan_date");
  if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !Number.isInteger(minute) || minute < 0 || minute > 59) {
    throw new Error("invalid_campaign_plan_time");
  }
  const targetWallTime = dateMs + (hour * 60 + minute) * 60 * 1000;
  let guess = targetWallTime;
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const parts = formatter.formatToParts(new Date(guess));
    const part = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((item) => item.type === type)?.value ?? 0);
    const renderedWallTime = Date.UTC(
      part("year"),
      part("month") - 1,
      part("day"),
      part("hour"),
      part("minute"),
      part("second"),
    );
    guess += targetWallTime - renderedWallTime;
  }
  return new Date(guess);
}
