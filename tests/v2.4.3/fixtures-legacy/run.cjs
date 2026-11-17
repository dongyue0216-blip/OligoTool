const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {pathToFileURL} = require('node:url');
const {spawn} = require('node:child_process');
const {setTimeout: sleep} = require('node:timers/promises');
const assert = require('node:assert/strict');
(async () => {
 const base = __dirname;
 const root = path.resolve(process.argv[3] || path.join(base, '../..'));
 assert.ok(process.argv[2], 'Pass an Edge or Chrome executable as the first argument');
 const url = pathToFileURL(path.join(root,'Start.html')).href;
 const profile = fs.mkdtempSync(path.join(os.tmpdir(),'oligo-v241-cdp-'));
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
   if(msg.method==='Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.text);
   if(msg.id) { const cb=pending.get(msg.id);pending.delete(msg.id);if(msg.error)cb.reject(msg.error);else cb.resolve(msg.result);}
  };
  const send=(method,params)=>new Promise((resolve,reject)=>{pending.set(++id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
  await send('Runtime.enable');
  async function evaluate(expression){
   const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
   if(result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
   return result.result.value;
  }
  const ready="typeof MoleculeBuilderUI !== 'undefined' && !!document.querySelector('#adaptiveGrid')";
  for(let i=0;i<150 && !await evaluate(ready);i++)await sleep(100);
  assert.ok(await evaluate(ready));
  const ui=await evaluate("({title:document.title,header:document.querySelector('header').innerText,sidebar:document.querySelector('.side-note').innerText,url:location.href})");
  console.log(JSON.stringify(ui));
  const dir=path.join(base,'fixtures');
  const fixtures=Object.fromEntries(fs.readdirSync(dir).filter(f=>f.endsWith('.mol')).map(f=>[f,fs.readFileSync(path.join(dir,f),'utf8')]));
  const code=fs.readFileSync(path.join(base,'browser-cases.js'),'utf8');
  const result=await evaluate('('+code+')('+JSON.stringify(fixtures)+')');
  result.runtimeErrors=errors;
  if (process.env.OLIGO_EVIDENCE) {
   fs.writeFileSync(process.env.OLIGO_EVIDENCE, JSON.stringify(result, null, 2));
  }
  const counts={};
  for(const test of result.cases)for(const step of test.steps)counts[step.status]=(counts[step.status]||0)+1;
  console.log(JSON.stringify({cases:result.cases.length,counts,errors}));
  assert.equal(result.cases.length, 84);
  assert.deepEqual(counts, {PASS: 102, 'MANUAL PASS': 4, 'EXPECTED REJECTION': 8});
  assert.deepEqual(errors, []);
  ws.send(JSON.stringify({id: ++id, method: 'Browser.close'}));
 } finally {ws?.close();browser.kill();}
})().catch(error=>{console.error(error);process.exit(1);});
