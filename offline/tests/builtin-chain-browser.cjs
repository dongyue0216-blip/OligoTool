'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawn}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const root=path.resolve(process.argv[2]||path.join(__dirname,'..'));
const edge=process.env.EDGE_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'oligo-audit-edge-'));
const browser=spawn(edge,['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
 const portFile=path.join(profile,'DevToolsActivePort');
 for(let i=0;i<100&&!fs.existsSync(portFile);i++)await delay(100);
 const port=fs.readFileSync(portFile,'utf8').split(/\r?\n/)[0];
 const targets=await (await fetch('http://127.0.0.1:'+port+'/json/list')).json();
 const ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
 const pending=new Map(),exceptions=[];let next=0;
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const {resolve,reject}=pending.get(m.id);pending.delete(m.id);m.error?reject(Error(m.error.message)):resolve(m.result);}if(m.method==='Runtime.exceptionThrown')exceptions.push(m.params.exceptionDetails);};
 await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
 const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++next;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 try{
  await call('Runtime.enable');
  await call('Page.navigate',{url:pathToFileURL(path.join(root,'Start.html')).href});
  async function evaluate(expression){
   const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
   if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);
   return r.result.value;
  }
  for(let i=0;i<100;i++){if(await evaluate('typeof Product!=="undefined"'))break;await delay(100);}
  const result=await evaluate('('+async function(){
   const ready=await SmallFragmentDepictor.ready;
   const details=document.querySelector('#builtinChemistryCatalog');
   details.open=true;await new Promise(resolve=>setTimeout(resolve,100));
   const exact=Array.from(details.querySelectorAll('.library-row')).find(row=>row.querySelector('strong').textContent==='{absic}')?.textContent??null;
   const host=document.createElement('div');document.body.append(host);
   const checks=[];
   function probe(symbol,record){
    try{
     LocalViewers.mount(host,record,{title:symbol,mode:'chemical'});
     const svg=host.querySelector('.structure-canvas svg');
     if(!svg||!svg.querySelector('line,path,polygon,text'))throw Error('missing rendered chemical SVG');
     if(/NaN|Infinity/.test(svg.getAttribute('viewBox')||''))throw Error('invalid viewBox');
     checks.push({symbol,ok:true,marks:svg.querySelectorAll('line,path,polygon,text').length});
    }catch(error){checks.push({symbol,ok:false,error:error.message});}
   }
   for(const r of ChemistryLibrary.builtinCatalog().filter(r=>r.assemblyReady)){
    const seq=r.symbol.replace(/^\{(.*)\}$/,'[$1]')+(r.type==='Terminal syntax'?'rA':'');
    probe(r.symbol,Sandbox.A.sequence(seq));
   }
   for(const r of Object.values(REACTION_REAGENTS))probe(r.name,Sandbox.record(r.graph));
   const input=document.querySelector('#input');document.querySelector('#kind').value='sequence';
   input.value='rA[absic]rA';document.querySelector('#run').click();
   const spacer={formula:UI.current?.metrics.formula,error:document.querySelector('#error').textContent,
    cleared:!document.querySelector('#viewer svg')&&!UI.current};
   let userOverride=null,exportEvidence=null;
   if(exact){
    const custom=Lite.selectAttachments(Lite.parseSmiles('OCCCN'),0,null);
    try{Product.store.add('absic',custom);}catch(error){userOverride=error.message;}
    input.value='rA[absic]rA';document.querySelector('#run').click();
    const captured=[];
    const create=URL.createObjectURL,click=HTMLAnchorElement.prototype.click;
    URL.createObjectURL=blob=>{captured.push(blob.text());return 'blob:audit';};
    HTMLAnchorElement.prototype.click=()=>{};
    const controls=[...document.querySelectorAll('#sequenceExports button')];
    if(controls.map(b=>b.textContent).join('|')!=='Export ChemDraw (.cdxml)|Export Schematic (.svg)')throw Error('Unexpected export controls');
    try{controls[0].click();}
    finally{URL.createObjectURL=create;HTMLAnchorElement.prototype.click=click;}
    const [cdxml]=await Promise.all(captured),record=JSON.parse(JSON.stringify(UI.current));
    const mol=Lite.mol(UI.rendered.drawing),sdf=mol+'\n$$$$\n';
    const xml=new DOMParser().parseFromString(cdxml,'application/xml');
    exportEvidence={formula:record.metrics.formula,mol:Lite.parseMol(mol,{manualMarkers:true}).formula,
     sdf:Lite.parseMol(sdf,{manualMarkers:true}).formula,cdxmlAtoms:xml.querySelectorAll('n').length,graphAtoms:record.graph.atoms.length,
     sameTopology:[...xml.querySelectorAll('b')].every((b,i)=>{
      const edge=record.graph.bonds[i];
      return +b.getAttribute('B')===edge.a+10&&+b.getAttribute('E')===edge.b+10;
     })&&xml.querySelectorAll('b').length===record.graph.bonds.length};
   }
   return {ready,exact,spacer,checks,userOverride,exportEvidence};
  }.toString()+')()');
  fs.writeFileSync(process.argv[3]||'builtin-browser-audit.json',JSON.stringify({...result,exceptions},null,2)+'\n');
  assert.equal(exceptions.length,0);
  assert(result.checks.length>100);
  assert.deepEqual(result.checks.filter(r=>!r.ok),[]);
  assert.equal(result.spacer.formula,'C25H34N10O15P2');
  assert(!result.spacer.cleared);
  if(result.exact){
   assert.match(result.userOverride,/Reserved built-in/);
   assert.equal(result.exportEvidence.formula,'C25H34N10O15P2');
   assert.equal(result.exportEvidence.mol,result.exportEvidence.formula);
   assert.equal(result.exportEvidence.sdf,result.exportEvidence.formula);
   assert.equal(result.exportEvidence.cdxmlAtoms,result.exportEvidence.graphAtoms);
   assert(result.exportEvidence.sameTopology);
  }
  if(process.env.OLIGO_GRAMMAR_SCREENSHOT){
   await call('Emulation.setDeviceMetricsOverride',{width:1040,height:500,deviceScaleFactor:1,mobile:false});
   await evaluate('globalThis.captureGrammar=true');
  }
  const exports=await evaluate('('+async function(){
   const expected='Export Schematic (.svg)';
   const host=document.querySelector('#viewer'),input=document.querySelector('#input');
   const rows=[];
   async function check(viewer,toolbar,name){
    const mode=viewer.querySelector('.viewer-mode');mode.value='schematic';mode.onchange();
    const density=viewer.querySelector('.schematic-density');
    if(!density)throw Error(name+' has no supported schematic');
    density.value='compact';density.onchange();
    const screen=viewer.querySelector('.structure-canvas svg');
    const original=screen.cloneNode(true);
    original.querySelector('[data-scene-background]').remove();
    LocalViewers.instances.get(viewer).setViewport({scale:9,x:210,y:-100});
    const capture=[];
    const create=URL.createObjectURL,click=HTMLAnchorElement.prototype.click;
    URL.createObjectURL=blob=>{capture.push(blob);return 'blob:audit';};
    HTMLAnchorElement.prototype.click=()=>{};
    try{[...toolbar().querySelectorAll('button')].find(b=>b.textContent===expected).click();}
    finally{URL.createObjectURL=create;HTMLAnchorElement.prototype.click=click;}
    if(capture.length!==1||capture[0].type!=='image/svg+xml')throw Error(name+' missing SVG download');
    const svg=new DOMParser().parseFromString(await capture[0].text(),'image/svg+xml').documentElement;
    const screenMarkup=[...original.children].map(node=>new XMLSerializer().serializeToString(node));
    const exportMarkup=[...svg.children].map(node=>new XMLSerializer().serializeToString(node));
    if(JSON.stringify(screenMarkup)!==JSON.stringify(exportMarkup))throw Error(name+' scene differs');
    if(svg.querySelector('image,foreignObject,[data-scene-background]')||svg.getAttribute('viewBox')===screen.getAttribute('viewBox'))
     throw Error(name+' viewport or background leaked into export');
    const mounted=document.importNode(svg,true);
    document.body.append(mounted);
    const box=mounted.getBBox(),v=mounted.viewBox.baseVal;
    const bounds=v.x<=box.x&&v.y<=box.y&&v.x+v.width>=box.x+box.width&&v.y+v.height>=box.y+box.height;
    mounted.remove();
    if(!bounds||!+svg.getAttribute('width')||!+svg.getAttribute('height'))throw Error(name+' invalid bounds');
    rows.push(name);
   }
   for(const [name,seq] of [['DNA','dAdCdGdT'],['RNA','rArCrGrU'],
    ['24-mer mixed','[InvAb]ENA-A*rAUgnENA-C#rCENA-GrAENA-UrUENA-TrAENA-IrCENA-CMerArUrArC[absic][InvAb]rArArA'],
    ['TNA/GNA','AtA*Ugn']]){
    input.value=seq;document.querySelector('#run').click();
    await check(host,()=>document.querySelector('#sequenceExports'),name);
   }
   const standalone=document.createElement('div');document.body.append(standalone);
   const M=MoleculeBuilder,s=M.start('[GlycerolBranch]AtA*Ugn');
   const branch=M.branch(s,{siteId:M.available(s)[0].id,sequence:'rC*rG',linkage:'PS'});
   LocalViewers.mount(standalone,MoleculeBuilderUI.record(branch),{exports:{name:'branch'}});
   await check(standalone,()=>standalone.querySelector('.exports'),'branch');
   const azide=REACTION_REAGENTS.azide.graph,secondary=REACTION_REAGENTS['builtin:linker1:bcn'].graph;
   const candidateId=Reactions.v2.candidates('Click',[azide,secondary]).candidates[0].candidate_id;
   const product=M.react(M.fromGraph(azide),{family:'Click',secondary,candidateId});
   LocalViewers.mount(standalone,MoleculeBuilderUI.record(product),{exports:{name:'click'}});
   await check(standalone,()=>standalone.querySelector('.exports'),'click product');
   LocalViewers.mount(standalone,Sandbox.record(Lite.parseSmiles('CCO').graph),{exports:{name:'unknown'}});
   if(![...standalone.querySelectorAll('.exports button')].find(b=>b.textContent===expected).disabled)
    throw Error('Unsupported schematic must disable export');
   return rows;
  }.toString()+')()');
  assert.equal(exports.length,6);
  const grammar=await evaluate('('+function(){
   const input=document.querySelector('#input');
   input.value='[InvAb]ENA-A*rAUgnENA-C#rCENA-GrAENA-UrUENA-TrAENA-IrCENA-CMerArUrArC[absic][InvAb]';
   document.querySelector('#run').click();
   const record=UI.current;
   const host=document.querySelector('#viewer');
   LocalViewers.mount(host,record,{mode:'schematic',schematicDensity:'compact'});
   const svg=host.querySelector('svg');
   const stats={residues:svg.querySelectorAll('[data-residue]').length,
    ena:svg.querySelectorAll('[data-bridge="ethylene"]').length,
    inverted:svg.querySelectorAll('[data-sugar-shape="invertedSugar"]').length,
    badges:svg.querySelectorAll('[data-linkage] rect[rx="3"]').length,
    spacerBaseFree:!svg.querySelector('[data-family="spacer"]').querySelector('[data-component="base"]')};
   const drawing=StructurePresentation.schematic(record,{density:'compact'}).svg;
   const select=host.querySelector('.viewer-mode');select.value='chemical';select.dispatchEvent(new Event('change'));
   stats.chemicalIntact=UI.current===record&&host.dataset.presentation==='chemical'&&!!host.querySelector('svg');
   if(globalThis.captureGrammar){
    const sheet=document.createElement('div');
    sheet.id='grammar-capture';
    sheet.style='position:fixed;inset:0;z-index:99999;background:#fff;padding:20px';
    sheet.innerHTML=drawing;
    sheet.firstElementChild.style='width:1000px;display:block';
    document.body.append(sheet);
   }
   return stats;
  }.toString()+')()');
  if(grammar){
   assert.equal(grammar.residues,21);
   assert.equal(grammar.ena,7);
   assert.equal(grammar.inverted,2);
   assert.equal(grammar.badges,20);
   assert(grammar.spacerBaseFree&&grammar.chemicalIntact);
   fs.writeFileSync(process.argv[3]||'builtin-browser-audit.json',JSON.stringify({...result,grammar,exports,exceptions},null,2)+'\n');
   if(process.env.OLIGO_GRAMMAR_SCREENSHOT){
    const height=await evaluate('Math.ceil(document.querySelector("#grammar-capture svg").getBoundingClientRect().height)+40');
    const screenshot=await call('Page.captureScreenshot',{format:'png',clip:{x:0,y:0,width:1040,height,scale:1},captureBeyondViewport:true});
    fs.writeFileSync(process.env.OLIGO_GRAMMAR_SCREENSHOT,Buffer.from(screenshot.data,'base64'));
   }
  }
  console.log(result.checks.length+' Chemical viewer mounts passed');
 }finally{await call('Browser.close').catch(()=>{});ws.close();}
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>browser.kill());



