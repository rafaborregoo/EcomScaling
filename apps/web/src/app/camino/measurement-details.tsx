"use client";

export type MeasurementInfo = {
  period_label?: string; period_start?: string; period_end?: string; calculated_at?: string;
  measured_at?: string; last_sync_at?: string | null; source?: string; unavailable_reason?: string | null;
};
export function MeasurementDetails({ measurement, source }: { measurement?: MeasurementInfo | null; source?: string }) {
  if (!measurement) return <p className="text-xs text-muted">Esta lectura anterior no conserva su periodo exacto.</p>;
  const date = (value: string) => new Date(value).toLocaleString("es-ES", { timeZone: "UTC", dateStyle: "short", timeStyle: "short" });
  return <div className="mt-2 text-xs text-muted">
    <p>Fuente: {measurement.source ?? source ?? "No indicada"} · {measurement.period_label ?? "Periodo de la revisión"}</p>
    {measurement.period_start && measurement.period_end ? <p>Periodo medido: {date(measurement.period_start)} – {date(measurement.period_end)} UTC</p> : null}
    {measurement.calculated_at || measurement.measured_at ? <p>Calculado: {date((measurement.calculated_at ?? measurement.measured_at)!)}</p> : null}
    {measurement.last_sync_at ? <p>Última sincronización: {date(measurement.last_sync_at)}</p> : null}
    {measurement.unavailable_reason ? <p>{measurement.unavailable_reason}</p> : null}
  </div>;
}
