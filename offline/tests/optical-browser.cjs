'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawn}=require('node:child_process');
const http=require('node:http');
const {pathToFileURL}=require('node:url');
const {setTimeout:sleep}=require('node:timers/promises');
async function run(executable){
 const root=path.resolve(__dirname,'..');
 const server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+new URL(req.url,'http://127.0.0.1').pathname);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404).end();return;}
  const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
  res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');
  fs.createReadStream(file).pipe(res);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'oligo-optical-browser-'));
 const child=spawn(executable,['--headless=new','--disable-gpu','--no-first-run','--disable-background-networking',
  '--user-data-dir='+profile,'--remote-debugging-port=0','about:blank'],{stdio:'ignore',windowsHide:true});
 let ws;
 try{
  const portFile=path.join(profile,'DevToolsActivePort');
  let port;
  for(let i=0;i<200&&!port;i++){
   try{port=fs.readFileSync(portFile,'utf8').split('\n')[0].trim();}
   catch(e){if(!['ENOENT','EBUSY'].includes(e.code))throw e;}
   if(!port)await sleep(100);
  }
  assert.ok(port,'Browser debugging port did not become available');
  const local=process.env.OLIGO_FILE_URL==='1';
  const url=local?pathToFileURL(path.join(root,'Start.html')).href:'http://127.0.0.1:'+server.address().port+'/Start.html';
  const page=await (await fetch('http://127.0.0.1:'+port+'/json/new?'+encodeURIComponent(url),{method:'PUT'})).json();
  ws=new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
  const pending=new Map(),errors=[];
  ws.onmessage=({data})=>{
   const msg=JSON.parse(data);
   if(msg.method==='Runtime.exceptionThrown')errors.push(msg.params.exceptionDetails);
   if(!pending.has(msg.id))return;
   const {resolve,reject}=pending.get(msg.id);
   pending.delete(msg.id);
   if(msg.error)reject(Error(msg.error.message));else resolve(msg.result);
  };
  let id=0;
  const send=(method,params={})=>new Promise((resolve,reject)=>{
   pending.set(++id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));
  });
  const evaluate=async expression=>{
   const result=await send('Runtime.evaluate',{expression,returnByValue:true});
   if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));
   return result.result.value;
  };
  await send('Runtime.enable');await send('Page.enable');
  for(let i=0;i<300;i++){
   if(await evaluate("!!document.querySelector('#adaptiveGrid')"))break;
   await sleep(100);
  }
  assert.ok(await evaluate("!!document.querySelector('#input')"),JSON.stringify(await evaluate("({url:location.href,title:document.title,body:document.body?.innerText.slice(0,350)})"))); 
  if(local){
   assert.equal(await evaluate('location.protocol'),'file:');
   const probe=await send('Runtime.evaluate',{expression:"fetch('chemistry-library/manifest.json').then(r=>r.ok,()=>false)",awaitPromise:true,returnByValue:true});
   assert.equal(probe.result.value,false,'Default file origin blocks relative fetch');
  }
  const cases=[
   ['rA',/\d+\.\d{2} µg\/OD₂₆₀/,/Validated model/],
   ['rArC',/\d+\.\d{2} µg\/OD₂₆₀/,/Validated model/],
   ['nA'.repeat(200),/≈ \d+\.\d{2} µg\/OD₂₆₀/,/parent RNA/],
   ['[FAM]'+'rA'.repeat(199),/≈ \d+\.\d{2} µg\/OD₂₆₀/,/published dye/],
   ['rArA#rC',/≈ \d+\.\d{2} µg\/OD₂₆₀/,/treated as PO/],
   ['rA[GlycerolBranch]rC',/≈ \d+\.\d{2} µg\/OD₂₆₀/,/negligible/],
   ['rArCrGrUrAeTdAcEt-AnT',/≈ 29\.24 µg\/OD₂₆₀/,/RNA nucleoside/],
   ['[PEG3]',/—/,/No positive modeled 260 nm absorption/]
  ];
  for(const [sequence,mass,details] of cases){
   await evaluate(`document.querySelector('#input').value=${JSON.stringify(sequence)}; document.querySelector('#run').click(); true`);
   const result=await evaluate(`({
    mass:document.querySelector('[data-mass-per-od]')?.textContent,
    summary:document.querySelector('.workspace-properties > summary')?.textContent,
    details:document.querySelector('.optical-details')?.textContent
   })`);
   assert.match(result.mass,mass,sequence);assert.match(result.details,details,sequence);
   assert.ok(result.summary.includes(result.mass),sequence);assert.ok(!result.summary.includes('ε₂₆₀'),sequence);
  }
  assert.equal(await evaluate(`(()=>{
   const details=document.querySelector('#builtinReactionReagentCatalog');
   details.open=true;details.dispatchEvent(new Event('toggle'));
   const row=[...details.querySelectorAll('.library-row')].find(r=>r.querySelector('button'));
   const name=row.querySelector('strong').textContent;
   const entry=Product.store.reagents('builtin').find(r=>r.name===name);
   row.querySelector('button').click();
   if(Product.store.reagents('builtin').some(r=>r.id===entry.id))return false;
   const reloaded=ChemistryLibrary.create(localStorage);
   if(!reloaded.disabledReagents().has(entry.id))return false;
   const disabled=[...details.querySelectorAll('.library-row')].find(r=>r.querySelector('strong').textContent===name);
   disabled.querySelector('button').click();
   return Product.store.reagents('builtin').some(r=>r.id===entry.id);
  })()`),true,'Disable, persist and restore a built-in reagent');
  assert.equal(await evaluate(`(()=>{
   const details=document.querySelector('#builtinChemistryCatalog');
   details.open=true;details.dispatchEvent(new Event('toggle'));
   const row=[...details.querySelectorAll('.library-row')].find(r=>r.querySelector('strong').textContent==='rA');
   row.querySelector('button').click();
   if(!document.querySelector('#customInput').value.includes('M  END'))return false;
   if(document.querySelector('#fiveOH').value===''||document.querySelector('#threeOH').value==='')return false;
   document.querySelector('#customName').value='LocalRnaA';
   document.querySelector('#saveCustom').click();
   return Lite.calculateSafe('[LocalRnaA]rC').status==='ok'&&Lite.calculateSafe('rArC').status==='ok';
  })()`),true,'Copy and save a built-in sequence block under a new name');
  assert.deepEqual(errors,[]);
  console.log(path.basename(executable)+' passed '+cases.length+' live submissions and built-in library controls on '+(local?'file://':'HTTP'));
 }finally{
  ws?.close();
  server.close();
  if(child.pid){
   const exited=new Promise(resolve=>child.once('exit',resolve));child.kill();
   await Promise.race([exited,sleep(2000)]);
  }
 }
}
(async()=>{for(const binary of process.argv.slice(2))await run(binary);})().catch(e=>{console.error(e);process.exitCode=1;});

