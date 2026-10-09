import PDFDocument from "pdfkit";
import type { ReportChart, ReportDocument, ReportMetric, ReportTable } from "./report-templates.js";

const PAGE = { width: 595.28, height: 841.89, left: 48, right: 547, top: 46, bottom: 790 };
const COLOR = {
  ink: "#17283D",
  muted: "#607086",
  line: "#DCE3EA",
  wash: "#F4F7F8",
  teal: "#147F78",
  tealWash: "#EAF5F3",
  amber: "#9B5B16",
  amberWash: "#FFF4E5",
  white: "#FFFFFF",
};

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
  if (metric.value === null || !Number.isFinite(metric.value)) return "Sin datos";
  if (metric.format === "currency") {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: metric.currencyCode ?? currencyCode,
      maximumFractionDigits: 2,
    }).format(metric.value);
  }
  if (metric.format === "percent") return `${number(metric.value, 1)} %`;
  if (metric.format === "ratio") return `${number(metric.value, 2)}×`;
  return number(metric.value, metric.decimalPlaces ?? 0);
}

function variation(metric: ReportMetric) {
  if (metric.previous === undefined || metric.previous === null || metric.value === null || metric.previous === 0) {
    return null;
  }
  const delta = ((metric.value - metric.previous) / Math.abs(metric.previous)) * 100;
  return `${delta > 0 ? "+" : ""}${number(delta, 1)} % vs. periodo anterior`;
}

function drawRule(document: PDFKit.PDFDocument, y: number) {
  document.moveTo(PAGE.left, y).lineTo(PAGE.right, y).lineWidth(0.7).strokeColor(COLOR.line).stroke();
}

function drawPageHeader(document: PDFKit.PDFDocument, report: ReportDocument, continuation: boolean) {
  document.save();
  document.fillColor(COLOR.ink).font("Helvetica-Bold").fontSize(9).text("E·NORA", PAGE.left, 24);
  document.fillColor(COLOR.muted).font("Helvetica").fontSize(8)
    .text(continuation ? `${report.title} · continuación` : "INFORME DE RENDIMIENTO", 106, 25, { width: 340 });
  if (report.sample) {
    document.roundedRect(440, 20, 107, 18, 8).fill(COLOR.amberWash);
    document.fillColor(COLOR.amber).font("Helvetica-Bold").fontSize(7)
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
  document.fillColor(COLOR.ink).font("Helvetica-Bold").fontSize(12).text(title, PAGE.left, document.y, { width: PAGE.right - PAGE.left });
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
      document.fillColor(COLOR.muted).font("Helvetica").fontSize(8)
        .text(item.label, x + 11, rowTop + 10, { width: cardWidth - 22, height: 22, ellipsis: "…" });
      document.fillColor(COLOR.ink).font("Helvetica-Bold").fontSize(15)
        .text(formatMetric(item, report.currencyCode), x + 11, rowTop + 32, { width: cardWidth - 22, height: 19, ellipsis: "…" });
      const change = variation(item);
      if (change) {
        document.fillColor(COLOR.teal).font("Helvetica").fontSize(7.5)
          .text(change, x + 11, rowTop + 56, { width: cardWidth - 22, height: 11, ellipsis: "…" });
      } else if (item.note) {
        document.fillColor(COLOR.muted).font("Helvetica").fontSize(7.5)
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
      document.fillColor(COLOR.muted).font("Helvetica-Bold").fontSize(8)
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
    document.fillColor(COLOR.muted).font("Helvetica").fontSize(9)
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
      document.fillColor(COLOR.ink).font("Helvetica").fontSize(8.5)
        .text(formatCell(row[column.key] ?? null), x, rowTop + 9, {
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
    document.fillColor(COLOR.muted).font("Helvetica").fontSize(9).text("Sin datos para representar.");
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
    document.fillColor(COLOR.muted).font("Helvetica").fontSize(8)
      .text(item.label, PAGE.left, y + 3, { width: labelWidth - 8, height: 10, ellipsis: "…" });
    document.roundedRect(barLeft, y, barWidth, 14, 4).fill(COLOR.wash);
    const zeroX = barLeft + (Math.abs(minValue) / span) * barWidth;
    const itemX = barLeft + ((item.value - minValue) / span) * barWidth;
    const width = Math.abs(itemX - zeroX);
    if (width > 0) document.rect(Math.min(zeroX, itemX), y, Math.max(2, width), 14).fill(item.value < 0 ? COLOR.amber : COLOR.teal);
    if (minValue < 0 && maxValue > 0) document.moveTo(zeroX, y - 1).lineTo(zeroX, y + 15).lineWidth(0.7).strokeColor(COLOR.muted).stroke();
    const value = formatChartValue(item.value, chart, report);
    document.fillColor(COLOR.ink).font("Helvetica-Bold").fontSize(8)
      .text(value, PAGE.right - valueWidth, y + 3, { width: valueWidth, align: "right", height: 10 });
    document.y += 21;
  }
  document.y += 5;
}

function drawNote(document: PDFKit.PDFDocument, title: string, body: string, tone: "info" | "warning", report: ReportDocument) {
  const fill = tone === "warning" ? COLOR.amberWash : COLOR.tealWash;
  const textColor = tone === "warning" ? COLOR.amber : COLOR.ink;
  document.font("Helvetica").fontSize(8.5);
  const bodyHeight = document.heightOfString(body, { width: PAGE.right - PAGE.left - 30, lineGap: 2 });
  const height = 35 + bodyHeight;
  ensureSpace(document, height + 8, report);
  const top = document.y;
  document.roundedRect(PAGE.left, top, PAGE.right - PAGE.left, height, 7).fill(fill);
  document.fillColor(textColor).font("Helvetica-Bold").fontSize(8.5)
    .text(title, PAGE.left + 14, top + 11, { width: PAGE.right - PAGE.left - 28 });
  document.fillColor(tone === "warning" ? COLOR.ink : COLOR.muted).font("Helvetica").fontSize(8.5)
    .text(body, PAGE.left + 14, top + 25, { width: PAGE.right - PAGE.left - 28, lineGap: 2 });
  document.y = top + height + 10;
}

export function renderReportPdf(report: ReportDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const document = new PDFDocument({
      size: "A4",
      margin: 0,
      bufferPages: true,
      compress: true,
      info: {
        Title: report.title,
        Author: "E-NORA",
        Subject: `${report.periodStart} — ${report.periodEnd}`,
      },
    });
    const chunks: Buffer[] = [];
    document.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    document.on("error", reject);
    document.on("end", () => resolve(Buffer.concat(chunks)));

    drawPageHeader(document, report, false);
    document.fillColor(COLOR.ink).font("Helvetica-Bold").fontSize(22)
      .text(report.title, PAGE.left, 61, { width: PAGE.right - PAGE.left, height: 54, ellipsis: "…" });
    document.fillColor(COLOR.muted).font("Helvetica").fontSize(9)
      .text(report.subtitle, PAGE.left, document.y + 2, { width: PAGE.right - PAGE.left, height: 31, lineGap: 2, ellipsis: "…" });
    document.y += 8;
    document.fillColor(COLOR.ink).font("Helvetica-Bold").fontSize(9)
      .text(report.organizationName, PAGE.left, document.y, { width: 300, height: 12, ellipsis: "…" });
    document.fillColor(COLOR.muted).font("Helvetica").fontSize(8)
      .text(`${report.storeName} · ${report.currencyCode}`, PAGE.left, document.y + 14, { width: 300, height: 12, ellipsis: "…" });
    document.text(`PERIODO  ${reportDate(report.periodStart)} — ${reportDate(report.periodEnd)}`, PAGE.left + 306, document.y, { width: 193, align: "right" });
    document.text(`COMPARA  ${reportDate(report.previousPeriodStart)} — ${reportDate(report.previousPeriodEnd)}`, PAGE.left + 306, document.y + 14, { width: 193, align: "right" });
    document.y += 38;
    drawRule(document, document.y);
    document.y += 14;

    for (const section of report.sections) {
      if (section.kind === "note") {
        drawNote(document, section.title, section.body, section.tone, report);
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
      document.font("Helvetica").fontSize(7.5);
      const detailHeight = Math.max(12, document.heightOfString(source.detail, { width: detailWidth, lineGap: 1 }));
      ensureSpace(document, detailHeight + 10, report);
      const dotColor = source.status === "available" ? COLOR.teal : source.status === "partial" ? COLOR.amber : COLOR.muted;
      document.circle(PAGE.left + 4, document.y + 6, 3).fill(dotColor);
      document.fillColor(COLOR.ink).font("Helvetica-Bold").fontSize(8.5)
        .text(source.provider, PAGE.left + 13, document.y, { width: 60 });
      const statusLabel = source.status === "available" ? "Disponible" : source.status === "partial" ? "Parcial" : "Sin datos";
      document.fillColor(source.status === "available" ? COLOR.teal : source.status === "partial" ? COLOR.amber : COLOR.muted)
        .font("Helvetica-Bold").fontSize(7).text(statusLabel, PAGE.left + 76, document.y, { width: 43 });
      document.fillColor(COLOR.muted).font("Helvetica").fontSize(7.5)
        .text(source.detail, PAGE.left + 124, document.y, { width: detailWidth, lineGap: 1 });
      document.y += detailHeight + 7;
    }
    document.fillColor(COLOR.muted).font("Helvetica").fontSize(7.5)
      .text(`Generado ${reportDate(report.generatedAt, true)} UTC · Plantilla ${report.templateId} ${report.templateVersion}${report.sample ? " · Ejemplo ficticio" : ""}`, PAGE.left, document.y + 5, { width: PAGE.right - PAGE.left });

    const pages = document.bufferedPageRange();
    for (let index = 0; index < pages.count; index += 1) {
      document.switchToPage(pages.start + index);
      drawRule(document, 807);
      document.fillColor(COLOR.muted).font("Helvetica").fontSize(7.5)
        .text("E-NORA · Informe basado en fuentes sincronizadas", PAGE.left, 815, { width: 350 });
      document.text(`${index + 1} / ${pages.count}`, PAGE.right - 60, 815, { width: 60, align: "right" });
    }
    document.end();
  });
}
