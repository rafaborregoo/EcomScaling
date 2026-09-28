import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export const MAX_INTERNAL_PLAYBOOK_PDF_BYTES = 2 * 1024 * 1024;
export const MAX_INTERNAL_PLAYBOOK_PDF_PAGES = 5;
export const MAX_INTERNAL_PLAYBOOK_PDF_TEXT_CHARS = 12_000;
const PDF_PARSE_TIMEOUT_MS = 8_000;

export type InternalPlaybookPdfExtraction = {
  text: string;
  page_count: number;
  pages_extracted: number;
  truncated: boolean;
};

export async function extractInternalPlaybookPdfText(
  input: Uint8Array,
): Promise<InternalPlaybookPdfExtraction> {
  if (
    input.byteLength < 8 ||
    input.byteLength > MAX_INTERNAL_PLAYBOOK_PDF_BYTES ||
    Buffer.from(input.subarray(0, 5)).toString("ascii") !== "%PDF-"
  ) {
    throw new Error("marketing_playbook_pdf_invalid");
  }

  const task = getDocument({
    data: new Uint8Array(input),
    enableXfa: false,
    useSystemFonts: false,
    disableFontFace: true,
    verbosity: 0,
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const extraction = (async () => {
      const document = await task.promise;
      const pageCount = document.numPages;
      if (!Number.isInteger(pageCount) || pageCount < 1) {
        throw new Error("marketing_playbook_pdf_empty");
      }

      const pageLimit = Math.min(pageCount, MAX_INTERNAL_PLAYBOOK_PDF_PAGES);
      const textParts: string[] = [];
      let remaining = MAX_INTERNAL_PLAYBOOK_PDF_TEXT_CHARS;
      let truncated = pageCount > pageLimit;
      for (let pageNumber = 1; pageNumber <= pageLimit && remaining > 0; pageNumber += 1) {
        const page = await document.getPage(pageNumber);
        const content = await page.getTextContent({ includeMarkedContent: false });
        const pageText = content.items
          .flatMap((item) => {
            if (!item || typeof item !== "object" || !("str" in item) || typeof item.str !== "string") return [];
            const value = item.str.trim();
            return value ? [value] : [];
          })
          .join(" ");
        if (!pageText) continue;
        const bounded = pageText.slice(0, remaining);
        textParts.push(`--- Página ${pageNumber} ---\n${bounded}`);
        remaining -= bounded.length;
        if (bounded.length < pageText.length) truncated = true;
      }
      const text = textParts.join("\n\n").trim();
      if (!text) throw new Error("marketing_playbook_pdf_no_selectable_text");
      return {
        text,
        page_count: pageCount,
        pages_extracted: pageLimit,
        truncated,
      };
    })();
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        void task.destroy().catch(() => undefined);
        reject(new Error("marketing_playbook_pdf_timeout"));
      }, PDF_PARSE_TIMEOUT_MS);
    });
    return await Promise.race([extraction, timeout]);
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code.startsWith("marketing_playbook_pdf_")) throw error;
    throw new Error("marketing_playbook_pdf_parse_failed");
  } finally {
    if (timer) clearTimeout(timer);
    await task.destroy().catch(() => undefined);
  }
}
