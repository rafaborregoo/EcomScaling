const fs = require('node:fs');
const lines = fs.readFileSync('server-full.diff','utf8').replace(/^\uFEFF/,'').split(/(?<=\n)/);
const header=[]; const hunks=[]; let current=[];
for (const line of lines) {
  if (line.startsWith('@@')) { if(current.length) hunks.push(current); current=[line]; }
  else if(current.length) current.push(line); else header.push(line);
}
if(current.length) hunks.push(current);
const markers=['getInstagramImagePreview','listVisualAssetStores','importMetaVideoFrames','reindexInstagramImage','/instagram/image-bank'];
const selected=hunks.filter(h=>h.some(line=>markers.some(marker=>line.includes(marker))));
fs.writeFileSync('server-a15.patch',[...header,...selected.flat()].join(''));
console.log(`selected ${selected.length} of ${hunks.length} server hunks`);
