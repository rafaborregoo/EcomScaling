import { createElement } from "react";
import { File, FileCode, FileSpreadsheet, FileText, Image as ImageIcon, type LucideIcon } from "lucide-react";

/** «820 KB», «1,1 MB»: el tamaño de un archivo como se lee en castellano. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString("es-ES", { maximumFractionDigits: 1 })} MB`;
}

function extension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot > 0 ? filename.slice(dot + 1).toLowerCase() : "";
}

const KIND: Record<string, string> = {
  md: "Markdown",
  markdown: "Markdown",
  txt: "Texto",
  htm: "HTML",
  html: "HTML",
  jpeg: "JPG",
  xlsx: "Excel",
  xls: "Excel",
  docx: "Word",
  doc: "Word",
};

/** «PNG», «PDF», «Markdown»: el tipo por la extensión o, si no la hay, por el MIME. */
export function fileKind(filename: string, contentType?: string | null): string {
  const ext = extension(filename) || contentType?.split("/").pop()?.split("+")[0]?.toLowerCase() || "";
  return KIND[ext] ?? (ext ? ext.toUpperCase() : "Archivo");
}

/** «PNG · 820 KB». Sin tamaño, solo el tipo. */
export function fileMeta(filename: string, bytes?: number | null, contentType?: string | null): string {
  const size = bytes != null ? formatBytes(bytes) : "";
  return [fileKind(filename, contentType), size].filter(Boolean).join(" · ");
}

export function isImageFile(filename: string, contentType?: string | null): boolean {
  return Boolean(contentType?.startsWith("image/")) || /^(png|jpe?g|gif|webp|avif|svg)$/.test(extension(filename));
}

/** Icono para la miniatura de un archivo que no es imagen. */
export function fileIcon(filename: string, contentType?: string | null): LucideIcon {
  if (isImageFile(filename, contentType)) return ImageIcon;
  const ext = extension(filename);
  if (/^(csv|xlsx?|ods|tsv)$/.test(ext)) return FileSpreadsheet;
  if (/^(tsx?|jsx?|json|html?|css|sql|ya?ml)$/.test(ext)) return FileCode;
  if (/^(pdf|md|markdown|txt|docx?|rtf)$/.test(ext) || contentType?.startsWith("text/")) return FileText;
  return File;
}

/** El icono de un archivo como componente: `<FileTypeIcon filename="x.pdf" />`. */
export function FileTypeIcon({ filename, contentType }: { filename: string; contentType?: string | null }) {
  return createElement(fileIcon(filename, contentType), { "aria-hidden": true });
}
