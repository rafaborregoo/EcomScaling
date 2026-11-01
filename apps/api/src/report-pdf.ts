import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import PDFDocument from "pdfkit";
import { isReportAccentColor, isReportLogo } from "./report-branding.js";
import { formatReportMetric, metricChangePct, type ReportChart, type ReportDocument, type ReportMetric, type ReportTable, type ReportTrend } from "./report-templates.js";

const PAGE = { width: 595.28, height: 841.89, left: 48, right: 547, top: 46, bottom: 790 };
// Misma marca que la app: blanco dominante, azul #1d4ed8 como único acento.
const COLOR = {
  ink: "#0F172A",
  muted: "#64748B",
  line: "#E2E8F0",
  wash: "#F8FAFC",
  brand: "#1D4ED8",
  brandWash: "#EFF4FF",
  amber: "#9B5B16",
  amberWash: "#FFF4E5",
  white: "#FFFFFF",
};

type ReportBranding = { logo?: Buffer; accentColor?: string | null };
const brandingByDocument = new WeakMap<PDFKit.PDFDocument, ReportBranding>();
const brandColor = (document: PDFKit.PDFDocument) => brandingByDocument.get(document)?.accentColor ?? COLOR.brand;
const brandWash = (document: PDFKit.PDFDocument) => {
  const color = brandColor(document);
  return `#${[1, 3, 5].map((offset) => Math.round(parseInt(color.slice(offset, offset + 2), 16) * 0.06 + 255 * 0.94).toString(16).padStart(2, "0")).join("")}`;
};

// IBM Plex Sans (OFL) en apps/api/assets/fonts. Desde src/ (tsx) está a un
// nivel, desde dist/src/ a dos. Sin los ficheros se cae a Helvetica.
const FONT_DIR = ["../assets/fonts/", "../../assets/fonts/"]
  .map((relative) => fileURLToPath(new URL(relative, import.meta.url)))
  .find((dir) => existsSync(`${dir}IBMPlexSans-Regular.ttf`));
const FONT = FONT_DIR
  ? { regular: "Plex", bold: "Plex-SemiBold", italic: "Plex-Italic" }
  : { regular: "Helvetica", bold: "Helvetica-Bold", italic: "Helvetica-Oblique" };

function registerFonts(document: PDFKit.PDFDocument) {
  if (!FONT_DIR) return;
  document.registerFont("Plex", `${FONT_DIR}IBMPlexSans-Regular.ttf`);
  document.registerFont("Plex-SemiBold", `${FONT_DIR}IBMPlexSans-SemiBold.ttf`);
  document.registerFont("Plex-Italic", `${FONT_DIR}IBMPlexSans-Italic.ttf`);
}

function number(value: number, digits = 0) {
  return new Intl.NumberFormat("es-ES", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function reportDate(value: string, includeTime = false) {
  const date = new Date(value.length === 10 ? `${value}T00:00:00.000Z` : value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit", timeZone: "UTC" } : {}),
  }).format(date);
}

function formatMetric(metric: ReportMetric, currencyCode: string) {
  return formatReportMetric(metric, currencyCode);
}

function variation(metric: ReportMetric) {
  const delta = metricChangePct(metric);
  if (delta === null) return null;
  return `${delta > 0 ? "+" : ""}${number(delta, 1)} % vs. periodo anterior`;
}

function drawRule(document: PDFKit.PDFDocument, y: number) {
  document.moveTo(PAGE.left, y).lineTo(PAGE.right, y).lineWidth(0.7).strokeColor(COLOR.line).stroke();
}

function drawPageHeader(document: PDFKit.PDFDocument, report: ReportDocument, continuation: boolean) {
  document.save();
  const brand = report.preparedBy ?? "E·NORA";
  const logo = brandingByDocument.get(document)?.logo;
  let brandX = PAGE.left;
  if (logo) {
    try { document.image(logo, PAGE.left, 18, { fit: [68, 27], align: "center", valign: "center" }); brandX += 80; }
    catch { /* A damaged logo must not discard the report's data. */ }
  }
  document.fillColor(brandColor(document)).font(FONT.bold).fontSize(9).text(brand, brandX, 24, { width: 180, height: 12, ellipsis: "…", lineBreak: false });
  const brandWidth = Math.min(180, document.widthOfString(brand));
  document.fillColor(COLOR.muted).font(FONT.regular).fontSize(8)
    .text(continuation ? `${report.title} · continuación` : "INFORME DE RENDIMIENTO", brandX + brandWidth + 14, 25, { width: Math.max(60, (report.sample ? 430 : PAGE.right) - brandX - brandWidth - 14), height: 11, ellipsis: "…", lineBreak: false });
  if (report.sample) {
    document.roundedRect(440, 20, 107, 18, 8).fill(COLOR.amberWash);
    document.fillColor(COLOR.amber).font(FONT.bold).fontSize(7)
      .text("DATOS DE MUESTRA", 449, 26, { width: 90, align: "center" });
  }
  document.restore();
}

function ensureSpace(
  document: PDFKit.PDFDocument,
  required: number,
  report: ReportDocument,
) {
  if (document.y + required <= PAGE.bottom) return;
  document.addPage();
  drawPageHeader(document, report, true);
  document.y = 58;
}

function drawSectionTitle(document: PDFKit.PDFDocument, title: string, report: ReportDocument) {
  ensureSpace(document, 52, report);
  document.moveDown(0.5);
  document.fillColor(COLOR.ink).font(FONT.bold).fontSize(12).text(title, PAGE.left, document.y, { width: PAGE.right - PAGE.left });
  document.y += 20;
}

function drawMetrics(document: PDFKit.PDFDocument, metrics: ReportMetric[], report: ReportDocument) {
  const columns = 3;
  const gap = 10;
  const cardWidth = (PAGE.right - PAGE.left - gap * (columns - 1)) / columns;
  const cardHeight = 76;
  for (let offset = 0; offset < metrics.length; offset += columns) {
    ensureSpace(document, cardHeight + 12, report);
    const batch = metrics.slice(offset, offset + columns);
    const rowTop = document.y;
    batch.forEach((item, index) => {
      const rowOffset = batch.length === 1 ? (PAGE.right - PAGE.left - cardWidth) / 2 : 0;
      const x = PAGE.left + rowOffset + index * (cardWidth + gap);
      document.roundedRect(x, rowTop, cardWidth, cardHeight, 7)
        .lineWidth(0.7).strokeColor(COLOR.line).fillAndStroke(COLOR.white, COLOR.line);
      document.fillColor(COLOR.muted).font(FONT.regular).fontSize(8)
        .text(item.label, x + 11, rowTop + 10, { width: cardWidth - 22, height: 22, ellipsis: "…" });
      document.fillColor(COLOR.ink).font(FONT.bold).fontSize(15)
        .text(formatMetric(item, report.currencyCode), x + 11, rowTop + 32, { width: cardWidth - 22, height: 19, ellipsis: "…" });
      const change = variation(item);
      if (change) {
        document.fillColor(brandColor(document)).font(FONT.regular).fontSize(7.5)
          .text(change, x + 11, rowTop + 56, { width: cardWidth - 22, height: 11, ellipsis: "…" });
      } else if (item.note) {
        document.fillColor(COLOR.muted).font(FONT.regular).fontSize(7.5)
          .text(item.note, x + 11, rowTop + 56, { width: cardWidth - 22, height: 11, ellipsis: "…" });
      }
    });
    document.y = rowTop + cardHeight + 9;
  }
}

function formatCell(value: string | number | null) {
  if (value === null) return "—";
  if (typeof value === "number") return number(value);
  return value;
}

function drawTable(document: PDFKit.PDFDocument, table: ReportTable, report: ReportDocument) {
  const tableWidth = PAGE.right - PAGE.left;
  const weights = table.columns.map((column) => column.width ?? 1);
  const weightTotal = weights.reduce((total, width) => total + width, 0) || 1;
  const columnWidths = weights.map((width) => tableWidth * width / weightTotal);
  const columnLefts = columnWidths.map((_, index) => PAGE.left + columnWidths.slice(0, index).reduce((total, width) => total + width, 0));
  const drawTableHeader = () => {
    const headerTop = document.y;
    document.rect(PAGE.left, headerTop, tableWidth, 25).fill(COLOR.wash);
    table.columns.forEach((column, index) => {
      const x = columnLefts[index]! + 9;
      document.fillColor(COLOR.muted).font(FONT.bold).fontSize(8)
        .text(column.label, x, headerTop + 8, {
          width: columnWidths[index]! - 18,
          align: column.align ?? "left",
          ellipsis: "…",
        });
    });
    document.y = headerTop + 25;
  };
  drawTableHeader();
  if (table.rows.length === 0) {
    document.fillColor(COLOR.muted).font(FONT.regular).fontSize(9)
      .text(table.emptyMessage ?? "No hay filas disponibles para este periodo.", PAGE.left + 4, document.y + 10);
    document.y += 30;
    return;
  }
  table.rows.forEach((row, rowIndex) => {
    ensureSpace(document, 32, report);
    // Repeat the header after a page break.
    if (document.y < 65) drawTableHeader();
    const rowTop = document.y;
    if (rowIndex % 2 === 1) document.rect(PAGE.left, rowTop, tableWidth, 28).fill("#FAFBFC");
    table.columns.forEach((column, columnIndex) => {
      const x = columnLefts[columnIndex]! + 9;
      const raw = row[column.key] ?? null;
      const heat = table.heatColumns?.includes(column.key);
      if (heat && typeof raw === "number") {
        document.save();
        document.rect(columnLefts[columnIndex]! + 2, rowTop + 3, columnWidths[columnIndex]! - 4, 22)
          .fillOpacity(0.08 + Math.min(1, Math.max(0, raw) / 60) * 0.5).fill(brandColor(document));
        document.restore();
      }
      document.fillColor(COLOR.ink).font(FONT.regular).fontSize(8.5)
        .text(heat && typeof raw === "number" ? `${number(raw, 1)} %` : formatCell(raw), x, rowTop + 9, {
          width: columnWidths[columnIndex]! - 18,
          height: 12,
          align: column.align ?? "left",
          ellipsis: "…",
        });
    });
    document.y = rowTop + 28;
  });
  document.y += 6;
}

function formatChartValue(value: number, chart: ReportChart, report: ReportDocument) {
  if (chart.unit === "currency") return new Intl.NumberFormat("es-ES", { style: "currency", currency: chart.currencyCode ?? report.currencyCode, maximumFractionDigits: 0 }).format(value);
  if (chart.unit === "percent") return `${number(value, 1)} %`;
  if (chart.unit === "ratio") return `${number(value, 2)}×`;
  return number(value);
}

function drawChart(document: PDFKit.PDFDocument, section: ReportDocument["sections"][number] & { kind: "chart" }, report: ReportDocument) {
  const chart = section.chart;
  const items = chart.items;
  if (items.length === 0) {
    document.fillColor(COLOR.muted).font(FONT.regular).fontSize(9).text("Sin datos para representar.");
    document.moveDown(0.5);
    return;
  }
  const minValue = Math.min(0, ...items.map((item) => item.value));
  const maxValue = Math.max(0, ...items.map((item) => item.value));
  const span = Math.max(1, maxValue - minValue);
  for (const item of items) {
    ensureSpace(document, 29, report);
    const y = document.y + 3;
    const labelWidth = 100;
    const valueWidth = 78;
    const barLeft = PAGE.left + labelWidth;
    const barWidth = PAGE.right - PAGE.left - labelWidth - valueWidth - 8;
    document.fillColor(COLOR.muted).font(FONT.regular).fontSize(8)
      .text(item.label, PAGE.left, y + 3, { width: labelWidth - 8, height: 10, ellipsis: "…" });
    document.roundedRect(barLeft, y, barWidth, 14, 4).fill(COLOR.wash);
    const zeroX = barLeft + (Math.abs(minValue) / span) * barWidth;
    const itemX = barLeft + ((item.value - minValue) / span) * barWidth;
    const width = Math.abs(itemX - zeroX);
    if (width > 0) document.rect(Math.min(zeroX, itemX), y, Math.max(2, width), 14).fill(item.value < 0 ? COLOR.amber : brandColor(document));
    if (minValue < 0 && maxValue > 0) document.moveTo(zeroX, y - 1).lineTo(zeroX, y + 15).lineWidth(0.7).strokeColor(COLOR.muted).stroke();
    const value = formatChartValue(item.value, chart, report);
    document.fillColor(COLOR.ink).font(FONT.bold).fontSize(8)
      .text(value, PAGE.right - valueWidth, y + 3, { width: valueWidth, align: "right", height: 10 });
    document.y += 21;
  }
  document.y += 5;
}

function trendValue(value: number, trend: ReportTrend, report: ReportDocument) {
  return trend.unit === "currency"
    ? new Intl.NumberFormat("es-ES", { style: "currency", currency: trend.currencyCode ?? report.currencyCode, notation: Math.abs(value) >= 10_000 ? "compact" : "standard", maximumFractionDigits: 0 }).format(value)
    : number(value);
}

const TREND_HEIGHT = 120;

function drawTrend(document: PDFKit.PDFDocument, trend: ReportTrend, report: ReportDocument) {
  const axisWidth = 52;
  const left = PAGE.left + axisWidth;
  const width = PAGE.right - left;
  const top = document.y + 4;
  const bottom = top + TREND_HEIGHT;
  const values = trend.series.flatMap((serie) => serie.values);
  const max = Math.max(1, ...values);
  const days = trend.dates.length;
  const xAt = (index: number) => left + (days <= 1 ? 0 : (index / (days - 1)) * width);
  const yAt = (value: number) => bottom - (Math.max(0, value) / max) * TREND_HEIGHT;

  for (const fraction of [0, 0.5, 1]) {
    const y = bottom - fraction * TREND_HEIGHT;
    document.moveTo(left, y).lineTo(PAGE.right, y).lineWidth(0.5).strokeColor(COLOR.line).stroke();
    document.fillColor(COLOR.muted).font(FONT.regular).fontSize(7)
      .text(trendValue(max * fraction, trend, report), PAGE.left, y - 4, { width: axisWidth - 8, align: "right", lineBreak: false });
  }
  // Primero el periodo anterior (debajo), luego el actual con área.
  for (const serie of [...trend.series].reverse()) {
    const points = serie.values.map((value, index) => [xAt(index), yAt(value)] as const);
    if (points.length < 2) continue;
    if (serie.style === "solid") {
      document.save();
      document.moveTo(points[0]![0], bottom);
      for (const [x, y] of points) document.lineTo(x, y);
      document.lineTo(points.at(-1)![0], bottom).closePath().fillOpacity(0.08).fill(brandColor(document));
      document.restore();
    }
    document.save();
    document.moveTo(points[0]![0], points[0]![1]);
    for (const [x, y] of points.slice(1)) document.lineTo(x, y);
    if (serie.style === "dashed") document.dash(3, { space: 2 }).lineWidth(1).strokeColor(COLOR.muted).stroke();
    else document.lineWidth(1.6).strokeColor(brandColor(document)).stroke();
    document.undash();
    document.restore();
  }
  const labelAt = (index: number, align: "left" | "center" | "right") => {
    const date = trend.dates[index];
    if (!date) return;
    const label = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
    const x = align === "left" ? xAt(index) : align === "right" ? xAt(index) - 60 : xAt(index) - 30;
    document.fillColor(COLOR.muted).font(FONT.regular).fontSize(7).text(label, x, bottom + 5, { width: 60, align, lineBreak: false });
  };
  labelAt(0, "left");
  labelAt(Math.floor((days - 1) / 2), "center");
  labelAt(days - 1, "right");
  // Leyenda solo si hay comparación.
  let legendX = left;
  const legendY = bottom + 19;
  if (trend.series.length > 1) {
    for (const serie of trend.series) {
      document.save();
      document.moveTo(legendX, legendY + 4).lineTo(legendX + 14, legendY + 4);
      if (serie.style === "dashed") document.dash(3, { space: 2 }).lineWidth(1).strokeColor(COLOR.muted).stroke();
      else document.lineWidth(1.6).strokeColor(brandColor(document)).stroke();
      document.undash();
      document.restore();
      document.fillColor(COLOR.muted).font(FONT.regular).fontSize(7).text(serie.label, legendX + 18, legendY, { lineBreak: false });
      legendX += 18 + document.widthOfString(serie.label) + 16;
    }
  }
  document.y = bottom + (trend.series.length > 1 ? 34 : 20);
}

function drawNote(document: PDFKit.PDFDocument, title: string, body: string, tone: "info" | "warning", report: ReportDocument) {
  const fill = tone === "warning" ? COLOR.amberWash : brandWash(document);
  const textColor = tone === "warning" ? COLOR.amber : COLOR.ink;
  document.font(FONT.regular).fontSize(8.5);
  const bodyHeight = document.heightOfString(body, { width: PAGE.right - PAGE.left - 30, lineGap: 2 });
  const height = 35 + bodyHeight;
  ensureSpace(document, height + 8, report);
  const top = document.y;
  document.roundedRect(PAGE.left, top, PAGE.right - PAGE.left, height, 7).fill(fill);
  document.fillColor(textColor).font(FONT.bold).fontSize(8.5)
    .text(title, PAGE.left + 14, top + 11, { width: PAGE.right - PAGE.left - 28 });
  document.fillColor(tone === "warning" ? COLOR.ink : COLOR.muted).font(FONT.regular).fontSize(8.5)
    .text(body, PAGE.left + 14, top + 25, { width: PAGE.right - PAGE.left - 28, lineGap: 2 });
  document.y = top + height + 10;
}

function drawSummary(document: PDFKit.PDFDocument, section: ReportDocument["sections"][number] & { kind: "summary" }, report: ReportDocument) {
  const width = PAGE.right - PAGE.left - 40;
  document.font(FONT.regular).fontSize(9.5);
  const heights = section.points.map((point) => document.heightOfString(point, { width, lineGap: 2 }) + 7);
  const caption = section.author === "copilot" ? "Redactado por el copiloto de E-NORA a partir de las cifras de este informe." : null;
  const height = 34 + heights.reduce((total, value) => total + value, 0) + (caption ? 16 : 0);
  ensureSpace(document, height + 10, report);
  const top = document.y;
  const fill = section.author === "copilot" ? brandWash(document) : COLOR.wash;
  document.roundedRect(PAGE.left, top, PAGE.right - PAGE.left, height, 7).fill(fill);
  document.fillColor(COLOR.ink).font(FONT.bold).fontSize(11)
    .text(section.title, PAGE.left + 16, top + 12, { width: PAGE.right - PAGE.left - 32 });
  let y = top + 32;
  section.points.forEach((point, index) => {
    document.circle(PAGE.left + 20, y + 5, 2).fill(section.author === "copilot" ? brandColor(document) : COLOR.muted);
    document.fillColor(COLOR.ink).font(FONT.regular).fontSize(9.5).text(point, PAGE.left + 30, y, { width, lineGap: 2 });
    y += heights[index]!;
  });
  if (caption) {
    document.fillColor(COLOR.muted).font(FONT.italic).fontSize(7.5).text(caption, PAGE.left + 16, y + 2, { width: PAGE.right - PAGE.left - 32 });
  }
  document.y = top + height + 10;
}

export function renderReportPdf(report: ReportDocument, branding: ReportBranding = {}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const document = new PDFDocument({
      size: "A4",
      margin: 0,
      bufferPages: true,
      compress: true,
      info: {
        Title: report.title,
        Author: report.preparedBy ?? "E-NORA",
        Subject: `${report.periodStart} — ${report.periodEnd}`,
      },
    });
    brandingByDocument.set(document, { accentColor: isReportAccentColor(branding.accentColor) ? branding.accentColor : COLOR.brand, ...(branding.logo && isReportLogo(branding.logo) ? { logo: branding.logo } : {}) });
    registerFonts(document);
    const chunks: Buffer[] = [];
    document.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    document.on("error", reject);
    document.on("end", () => resolve(Buffer.concat(chunks)));

    drawPageHeader(document, report, false);
    document.fillColor(COLOR.ink).font(FONT.bold).fontSize(22)
      .text(report.title, PAGE.left, 61, { width: PAGE.right - PAGE.left, height: 54, ellipsis: "…" });
    document.fillColor(COLOR.muted).font(FONT.regular).fontSize(9)
      .text(report.subtitle, PAGE.left, document.y + 2, { width: PAGE.right - PAGE.left, height: 31, lineGap: 2, ellipsis: "…" });
    document.y += 8;
    // Posiciones fijas: cada .text() mueve document.y y desalineaba las dos columnas.
    const metaTop = document.y;
    document.fillColor(COLOR.ink).font(FONT.bold).fontSize(9)
      .text(report.organizationName, PAGE.left, metaTop, { width: 300, height: 12, ellipsis: "…" });
    document.fillColor(COLOR.muted).font(FONT.regular).fontSize(8)
      .text(`${report.storeName} · ${report.currencyCode}`, PAGE.left, metaTop + 14, { width: 300, height: 12, ellipsis: "…" });
    document.text(`PERIODO  ${reportDate(report.periodStart)} — ${reportDate(report.periodEnd)}`, PAGE.left + 306, metaTop, { width: 193, align: "right" });
    document.text(`COMPARA  ${reportDate(report.previousPeriodStart)} — ${reportDate(report.previousPeriodEnd)}`, PAGE.left + 306, metaTop + 14, { width: 193, align: "right" });
    document.y = metaTop + 36;
    drawRule(document, document.y);
    document.y += 14;

    for (const section of report.sections) {
      if (section.kind === "note") {
        drawNote(document, section.title, section.body, section.tone, report);
      } else if (section.kind === "summary") {
        drawSummary(document, section, report);
      } else if (section.kind === "trend") {
        ensureSpace(document, 54 + TREND_HEIGHT + 40, report);
        drawSectionTitle(document, section.title, report);
        drawTrend(document, section.trend, report);
      } else {
        const sectionHeight = section.kind === "metrics"
          ? 26 + Math.ceil(section.metrics.length / 3) * 85
          : section.kind === "table"
            ? 54 + section.table.rows.length * 28
            : 54 + section.chart.items.length * 21;
        ensureSpace(document, sectionHeight, report);
        drawSectionTitle(document, section.title, report);
        if (section.kind === "metrics") drawMetrics(document, section.metrics, report);
        else if (section.kind === "table") drawTable(document, section.table, report);
        else drawChart(document, section, report);
      }
      document.y += 5;
    }

    ensureSpace(document, 94, report);
    drawSectionTitle(document, "Fuentes y cobertura", report);
    for (const source of report.sources) {
      const detailWidth = PAGE.right - PAGE.left - 124;
      document.font(FONT.regular).fontSize(7.5);
      const detailHeight = Math.max(12, document.heightOfString(source.detail, { width: detailWidth, lineGap: 1 }));
      ensureSpace(document, detailHeight + 10, report);
      const dotColor = source.status === "available" ? brandColor(document) : source.status === "partial" ? COLOR.amber : COLOR.muted;
      const rowY = document.y;
      document.circle(PAGE.left + 4, rowY + 6, 3).fill(dotColor);
      document.fillColor(COLOR.ink).font(FONT.bold).fontSize(8.5)
        .text(source.provider, PAGE.left + 13, rowY, { width: 60 });
      const statusLabel = source.status === "available" ? "Disponible" : source.status === "partial" ? "Parcial" : "Sin datos";
      document.fillColor(source.status === "available" ? brandColor(document) : source.status === "partial" ? COLOR.amber : COLOR.muted)
        .font(FONT.bold).fontSize(7).text(statusLabel, PAGE.left + 76, rowY + 1.5, { width: 43 });
      document.fillColor(COLOR.muted).font(FONT.regular).fontSize(7.5)
        .text(source.detail, PAGE.left + 124, rowY + 1, { width: detailWidth, lineGap: 1 });
      document.y = rowY + detailHeight + 9;
    }
    document.fillColor(COLOR.muted).font(FONT.regular).fontSize(7.5)
      .text(`Generado ${reportDate(report.generatedAt, true)} UTC · Plantilla ${report.templateId} ${report.templateVersion}${report.sample ? " · Ejemplo ficticio" : ""} · Días naturales en UTC`, PAGE.left, document.y + 5, { width: PAGE.right - PAGE.left });

    const pages = document.bufferedPageRange();
    for (let index = 0; index < pages.count; index += 1) {
      document.switchToPage(pages.start + index);
      drawRule(document, 807);
      document.fillColor(COLOR.muted).font(FONT.regular).fontSize(7.5)
        .text(`${report.preparedBy ? `Preparado por ${report.preparedBy} con E-NORA` : "E-NORA"} · Informe basado en fuentes sincronizadas`, PAGE.left, 815, { width: 420, height: 10, ellipsis: "…", lineBreak: false });
      document.text(`${index + 1} / ${pages.count}`, PAGE.right - 60, 815, { width: 60, align: "right" });
    }
    document.end();
  });
}
