const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {pathToFileURL} = require('node:url');
const {spawn} = require('node:child_process');
const {setTimeout: sleep} = require('node:timers/promises');
const assert = require('node:assert/strict');
(async () => {
 const base = __dirname;
 const root = path.resolve(process.argv[3] || path.join(base, '..'));
 assert.ok(process.argv[2], 'Pass an Edge or Chrome executable as the first argument');
 const url = pathToFileURL(path.join(root,'Start.html')).href;
 const profile = fs.mkdtempSync(path.join(base,'cl2-cdp-'));
 const browser = spawn(process.argv[2], ['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=0','--user-data-dir='+profile,url], {windowsHide:true,stdio:'ignore'});
 let ws;
 try {
  let port;
  for (let i=0;i<150 && !port;i++) {
   try {port=Number(fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split('\n')[0]);} catch {}
   if (!port) await sleep(100);
  }
  assert.ok(port,'browser debugging port missing');
  const tabs=await (await fetch('http://127.0.0.1:'+port+'/json/list')).json();
  ws=new WebSocket(tabs.find(t=>t.url===url).webSocketDebuggerUrl);
  await new Promise((ok,fail)=>{ws.onopen=ok;ws.onerror=fail;});
  const pending=new Map(), errors=[];
  let id=0;
  ws.onmessage=({data})=>{
   const msg=JSON.parse(data);
   if(msg.method==='Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
   if(msg.id) { const cb=pending.get(msg.id);pending.delete(msg.id);if(msg.error)cb.reject(msg.error);else cb.resolve(msg.result);}
  };
  const send=(method,params)=>new Promise((resolve,reject)=>{pending.set(++id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:960,deviceScaleFactor:1,mobile:false});
  async function evaluate(expression){
   const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
   if(result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
   return result.result.value;
  }
  const ready=`typeof MoleculeBuilderUI !== 'undefined' && !!document.querySelector('#adaptiveGrid')`;
  for(let i=0;i<150;i++){if(await evaluate(ready).catch(()=>false))break;await sleep(100);}
  assert.ok(await evaluate(ready).catch(()=>false),JSON.stringify(errors));
  const downloadPath=path.join(profile,'downloads');
  fs.mkdirSync(downloadPath);
  await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath});
  const fixture=fs.readFileSync(path.join(base,'../../offline/tests/fixtures/cl1-legacy-rc3.json'),'utf8');
  await evaluate('localStorage.setItem(ChemistryLibrary.KEY,'+JSON.stringify(fixture)+')');
  await send('Page.reload',{});
  const restored=`typeof Product !== 'undefined' && Product.store.state.records.length===3 && typeof Workspaces !== 'undefined' && !!document.querySelector('#adaptiveGrid')`;
  for(let i=0;i<100;i++){
   try{if(await evaluate(restored))break;}catch{}
   await sleep(100);
  }
  assert(await evaluate(restored));
  const code=fs.readFileSync(path.join(base,'cl2-browser.js'),'utf8');
  const result=await evaluate('('+code+')('+JSON.stringify(fixture)+')');
  if(process.env.OLIGO_SCREENSHOTS){
   await evaluate("window.cl2Screenshot('builtin')");
   await sleep(220);
   fs.writeFileSync(path.join(base,'CL2-Built-in.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
   await evaluate("window.cl2Screenshot('custom')");
   await sleep(220);
   fs.writeFileSync(path.join(base,'CL2-My-Custom.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
   await evaluate("window.cl2Screenshot('editor')");
   await sleep(220);
   fs.writeFileSync(path.join(base,'CL2-Editor.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
  }
  await evaluate("(document.getElementById('chemistryEditor').hidden || document.getElementById('cancelChemistryEdit').click(), window.cl2Screenshot('custom'))");
  await send('Emulation.setDeviceMetricsOverride',{width:760,height:900,deviceScaleFactor:1,mobile:false});
  await sleep(200);
  const narrow=await evaluate("(()=>{const list=document.getElementById('library').getBoundingClientRect(),detail=document.getElementById('compoundInspector').getBoundingClientRect();return detail.top>=list.bottom && detail.width<=innerWidth && document.documentElement.scrollWidth<=innerWidth})()");
  result.tests.push({name:'Narrow viewport stacks inspector with no horizontal overflow',status:narrow?'PASS':'FAIL'});
  const downloaded=()=>fs.readdirSync(downloadPath).filter(name=>/\.oligoentry$|\.olib$/.test(name));
  for(let i=0;i<50&&downloaded().length<3;i++)await sleep(100);
  const downloads=downloaded().map(name=>{
   const p=JSON.parse(fs.readFileSync(path.join(downloadPath,name),'utf8'));
   return {name,kind:p.kind,entries:p.records.length};
  });
  result.tests.push({name:'Actual browser downloads: one entry, selection and full library',status:JSON.stringify(downloads.map(x=>x.entries).sort())==='[1,2,3]'?'PASS':'FAIL'});
  result.downloads=downloads;
  result.runtimeErrors=errors;
  if(process.env.OLIGO_EVIDENCE)fs.writeFileSync(process.env.OLIGO_EVIDENCE,JSON.stringify(result,null,2));
  console.log(JSON.stringify(result));
  assert.deepEqual(errors,[]);
  assert(result.tests.every(row=>row.status==='PASS'));
  ws.send(JSON.stringify({id: ++id, method: 'Browser.close'}));
 } finally {ws?.close();browser.kill();}
})().catch(error=>{console.error(error);process.exit(1);});


