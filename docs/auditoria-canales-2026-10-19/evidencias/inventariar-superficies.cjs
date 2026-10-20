const fs = require('node:fs');
const path = require('node:path');
const root = process.cwd();
const out = path.join(root, 'docs/auditoria-canales-2026-10-19/evidencias');
const walk = (p) => fs.readdirSync(p, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(p,e.name)) : [path.join(p,e.name)]);
const rel = p => path.relative(root,p).replaceAll('\\','/');
const app = path.join(root,'apps/web/src/app');
const appFiles = walk(app);
const routeOf = p => '/' + path.relative(app,path.dirname(p)).split(path.sep).filter(s => s && s !== '.' && !s.startsWith('(') && !s.startsWith('@')).join('/');
const pages = appFiles.filter(p => path.basename(p) === 'page.tsx').map(p => ({route:routeOf(p),file:rel(p)})).sort((a,b)=>a.route.localeCompare(b.route));
const handlers = appFiles.filter(p => /^route\.[tj]s$/.test(path.basename(p))).map(p => ({route:routeOf(p),file:rel(p)}));
const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const patterns = [...pages,...handlers].map(p => new RegExp('^'+p.route.split('/').map(s=>/^\[\[\.\.\./.test(s)?'.*':/^\[\.\.\./.test(s)?'.+':/^\[/.test(s)?'[^/]+':escape(s)).join('/')+'/?$'));
const links = new Map();
const sourceFiles = walk(path.join(root,'apps/web/src')).filter(p => /\.[tj]sx?$/.test(p) && !/\.test\./.test(p));
for (const file of sourceFiles) {
  const text = fs.readFileSync(file,'utf8');
  const re = /\bhref\s*(?:=|:)\s*["'](\/[^"'\s]*)["']/g;
  for (const m of text.matchAll(re)) {
    const href = m[1];
    const urlPath = href.split(/[?#]/)[0];
    if (href.startsWith('//') || patterns.some(r=>r.test(urlPath)) || fs.existsSync(path.join(root,'apps/web/public',urlPath))) continue;
    const key = href;
    if (!links.has(key)) links.set(key,[]);
    links.get(key).push({file:rel(file),line:text.slice(0,m.index).split('\n').length});
  }
}
const testRoots = ['apps/web/src','apps/api/src','apps/worker/src','apps/mobile','packages','scripts'];
const tests = Object.fromEntries(testRoots.map(p=>[p,fs.existsSync(path.join(root,p))?walk(path.join(root,p)).filter(f=>!f.includes(path.sep+'node_modules'+path.sep)&&!f.includes(path.sep+'dist'+path.sep)&&/\.(test|spec)\.[cm]?[tj]sx?$/.test(f)).length:0]));
const byGroup = pages.reduce((a,p)=>{const group=p.route.split('/')[1]||'(raíz)';a[group]=(a[group]||0)+1;return a;},{});
const result = {audit_date:'2026-10-19',method:'Inventario estático de archivos actuales; enlaces literales href JSX y objetos. No incluye enlaces dinámicos, parámetros, permisos ni ejecución en navegador.',page_count:pages.length,route_handler_count:handlers.length,groups:byGroup,test_file_counts:tests,pages,route_handlers:handlers,unresolved_literal_hrefs:[...links].map(([href,locations])=>({href,locations}))};
fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'inventario-superficies.json'),JSON.stringify(result,null,2)+'\n','utf8');
console.log(JSON.stringify({page_count:pages.length,route_handler_count:handlers.length,groups:byGroup,test_file_counts:tests,unresolved_literal_hrefs:result.unresolved_literal_hrefs},null,2));
