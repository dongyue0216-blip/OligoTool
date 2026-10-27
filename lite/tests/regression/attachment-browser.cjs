const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),fs=require('fs'),path=require('path'),assert=require('assert');
(async()=>{
 const root=path.resolve(__dirname,'../..'),browser=await chromium.launch({channel:'msedge',headless:true});
 try{
 const page=await browser.newPage({viewport:{width:1700,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('file:///'+root.replaceAll('\\','/')+'/Start.html');
 const result=await page.evaluate(()=>{
 const cases=[],cards=[];
 for(const pattern of ['(p)*X','X*(p)','(p)X','(p)**X','X**(p)']){
  const group=[];
  for(const res of ['eA','eCMe','eG','rA','mA','+A']){
   const seq=pattern.replace('X',res),r=Lite.calculate(seq),p=r.graph.atoms.findIndex(a=>a.e==='P'),P=r.graph.atoms[p];
   const local=r.graph.bonds.filter(b=>b.a===p||b.b===p).map(b=>{let a=r.graph.atoms[b.a===p?b.b:b.a];return [a.e,b.o,+(a.x-P.x).toFixed(8),+(a.y-P.y).toFixed(8)];});
   group.push(JSON.stringify(local));cards.push('<section><h3>'+seq+'</h3>'+Lite.svg(r.graph)+'</section>');cases.push({seq,formula:r.chemistry.formula,local});
  }
  if(new Set(group).size!==1)throw Error('Phosphorus geometry mismatch '+pattern);
 }
 return {cases,html:'<!doctype html><meta charset="utf-8"><title>v0.6.0 attachment visual regression</title><style>body{font:16px Arial;background:#eef2f7}.grid{display:grid;grid-template-columns:repeat(6,1fr);gap:12px}section{background:white;padding:10px}svg{width:100%;height:480px}</style><h1>MOE / RNA / OMe / LNA — canonical phosphorus geometry</h1><div class="grid">'+cards.join('')+'</div>'};
 });
 fs.writeFileSync(path.join(root,'tests/visual/attachment-gallery.html'),result.html);
 await page.goto('file:///'+root.replaceAll('\\','/')+'/tests/visual/attachment-gallery.html');
 const offsets=await page.locator('svg text[data-atom]').evaluateAll(es=>es.map(e=>{const bb=e.querySelector('tspan').getBBox();return Math.abs(bb.x+bb.width/2-Number(e.getAttribute('x')))}));assert(Math.max(...offsets)<.04);
 await page.screenshot({path:path.join(root,'tests/visual/attachment-ps.png')});
 await page.locator('section').nth(18).scrollIntoViewIfNeeded();await page.screenshot({path:path.join(root,'tests/visual/attachment-ps2.png')});
 await page.goto('file:///'+root.replaceAll('\\','/')+'/Start.html');
 for(const seq of ['(p)*eA','(p)*eCMe','(p)*eG','eA*(p)','(p)eI','(p)**eCMe']){await page.locator('#sequence').fill(seq);await page.locator('#calculate').click();assert.equal(await page.locator('#error').textContent(),'');assert(await page.locator('#structure svg').count());}
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(root,'tests/evidence/ATTACHMENT_BROWSER.json'),JSON.stringify({browser:'Edge',cards:result.cases.length,maxLabelOffset:Math.max(...offsets),cases:result.cases,errors},null,2));console.log('30 browser visual comparisons passed; label offset '+Math.max(...offsets));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
