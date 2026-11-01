import fs from 'node:fs';
import {createCanvas, DOMMatrix, ImageData, Path2D} from '@napi-rs/canvas';
import {renderReportPdf} from '../../apps/api/src/report-pdf.ts';
import {buildSampleReportDocument} from '../../apps/api/src/report-data.ts';
Object.assign(globalThis, {DOMMatrix, ImageData, Path2D});
const logo = createCanvas(180,60); const mark=logo.getContext('2d'); mark.fillStyle='#14532D'; mark.fillRect(0,0,180,60); mark.fillStyle='white'; mark.font='bold 32px sans-serif'; mark.fillText('DEMO',32,42);
const pdf=await renderReportPdf({...buildSampleReportDocument('resumen_multicanal'), preparedBy:'Consultora Demo'}, {accentColor:'#14532D',logo:logo.toBuffer('image/png')});
fs.writeFileSync('tmp/pdfs/consultant-branding-check.pdf',pdf);
const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
const document=await getDocument({data:new Uint8Array(pdf),useSystemFonts:true}).promise;
for(const number of [1,document.numPages]) { const page=await document.getPage(number); const viewport=page.getViewport({scale:1.3}); const canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height)); await page.render({canvasContext:canvas.getContext('2d'),viewport,canvas}).promise; fs.writeFileSync('tmp/pdfs/consultant-branding-page-'+number+'.png',canvas.toBuffer('image/png')); }
console.log(JSON.stringify({pages:document.numPages,pdfBytes:pdf.length,rendered:[1,document.numPages]}));

