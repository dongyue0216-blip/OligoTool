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
  const result=await evaluate('('+fs.readFileSync(path.join(base,'cl3-cases.js'),'utf8')+')()');
  fs.writeFileSync(path.join(base,'CL3-'+(process.argv[2].includes('msedge')?'Edge':'Chrome')+'.json'),JSON.stringify(result,null,2));
  fs.writeFileSync(path.join(base,'CL3-Browser.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
  console.log(JSON.stringify(result));
  assert.deepEqual(errors,[]);assert(result.tests.every(t=>t.pass));
  await send('Browser.close',{});
 } finally {ws?.close();browser.kill();}
})().catch(error=>{console.error(error);process.exit(1);});
