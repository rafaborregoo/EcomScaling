import assert from "node:assert/strict";
import test from "node:test";
import {
  extractInternalPlaybookPdfText,
  MAX_INTERNAL_PLAYBOOK_PDF_BYTES,
  MAX_INTERNAL_PLAYBOOK_PDF_PAGES,
  MAX_INTERNAL_PLAYBOOK_PDF_TEXT_CHARS,
} from "./marketing-playbook-pdf.js";

function makeTextPdf(text: string, pages = 1): Buffer {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${Array.from({ length: pages }, (_, i) => `${3 + i * 2} 0 R`).join(" ")}] /Count ${pages} >>`,
    ...Array.from({ length: pages }, (_, i) => [
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${3 + pages * 2} 0 R >> >> /Contents ${4 + i * 2} 0 R >>`,
      `<< /Length ${Buffer.byteLength(`BT /F1 12 Tf 72 720 Td (${text}-${i + 1}) Tj ET`, "ascii")} >>\nstream\nBT /F1 12 Tf 72 720 Td (${text}-${i + 1}) Tj ET\nendstream`,
    ]).flat(),
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let source = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(source, "ascii"));
    source += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(source, "ascii");
  source += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) source += `${String(offset).padStart(10, "0")} 00000 n \n`;
  source += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(source, "ascii");
}

test("extracts selectable PDF text without retaining the original bytes", async () => {
  const result = await extractInternalPlaybookPdfText(makeTextPdf("Welcome offer"));
  assert.equal(result.page_count, 1);
  assert.equal(result.pages_extracted, 1);
  assert.equal(result.truncated, false);
  assert.match(result.text, /Welcome offer-1/);
});

test("extracts only the first five pages and bounds the resulting reference text", async () => {
  const result = await extractInternalPlaybookPdfText(makeTextPdf("A".repeat(4_000), 7));
  assert.equal(result.page_count, 7);
  assert.equal(result.pages_extracted, MAX_INTERNAL_PLAYBOOK_PDF_PAGES);
  assert.equal(result.truncated, true);
  assert.ok(result.text.length <= MAX_INTERNAL_PLAYBOOK_PDF_TEXT_CHARS);
});

test("rejects non-PDF input and uploads above the hard size limit", async () => {
  await assert.rejects(
    extractInternalPlaybookPdfText(Buffer.from("not a PDF")),
    /marketing_playbook_pdf_invalid/,
  );
  await assert.rejects(
    extractInternalPlaybookPdfText(Buffer.concat([
      Buffer.from("%PDF-1.4\n"),
      Buffer.alloc(MAX_INTERNAL_PLAYBOOK_PDF_BYTES),
    ])),
    /marketing_playbook_pdf_invalid/,
  );
});

test("rejects image-only PDFs because this endpoint imports text, not visual evidence", async () => {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>",
  ];
  let source = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(source, "ascii"));
    source += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(source, "ascii");
  source += `xref\n0 4\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  await assert.rejects(
    extractInternalPlaybookPdfText(Buffer.from(source, "ascii")),
    /marketing_playbook_pdf_no_selectable_text/,
  );
});
