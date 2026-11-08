'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {Worker,isMainThread,workerData,parentPort}=require('node:worker_threads');
const root=path.resolve(__dirname,'..');
function engine(fast=false) {
 const ctx=vm.createContext({crypto:require('node:crypto').webcrypto});
 require('./load-registry.js')(ctx);
 const prefix='app/snapshots/A/app/';
 for(const f of [prefix+'core','app/optical',prefix+'chemistry']){
  let source=fs.readFileSync(path.join(root,f+'.js'),'utf8');
  if(fast&&f.endsWith('/chemistry')){
   const hook='points:routeAvoid(g,bi,item.p)';
   assert.equal(source.split(hook).length,2);
   source=source.replace(hook,'points:[g.atoms[b.a],g.atoms[b.b]].map(({x,y})=>[x,y])');
  }
  vm.runInContext(source,ctx,{filename:f});
 }
 return vm.runInContext('({Lite,Optical,REFERENCE})',ctx);
}
function check(r){
 const o=r.optical;
 assert.equal(o.averageMW_g_mol,r.chemistry.average_mw);
 assert.equal(o.massBasis.value,r.chemistry.average_mw);
 assert.ok(o.averageMW_g_mol>0);
 if(!o.supported){
  assert.equal(o.ugPerOD260,null);
  assert.ok(o.reason);
  return o.missing[0].code;
 }
 assert.ok(Number.isFinite(o.ugPerOD260)&&o.ugPerOD260>0);
 assert.equal(o.ugPerOD260,1000*r.chemistry.average_mw/o.epsilon260);
 assert.equal(o.epsilon260,o.contributionLedger.reduce((n,t)=>n+(t.value??0),0));
 assert.equal(o.missing.length,0);
 assert.equal(o.estimated,o.assumptionLedger.length>0);
 return o.evidence.tier;
}
function focused(){
 const {Lite:L,Optical:O,REFERENCE:C}=engine();
 const run=s=>{const r=L.calculate(s);check(r);return r;};
 const verify=(s,eps,code)=>{
  const o=run(s).optical;assert.ok(Math.abs(o.epsilon260-eps)<1e-8,s);
  if(code)assert.ok(o.evidence.reasonCodes.includes(code),s);
  return o;
 };
 verify('rA',15400);verify('rArC',C.rnaNN.AC);verify('dAdCdGdT',40300);
 const seq='GUCCCCCUUGCCGUCCCAAGCA';
 verify([...seq].map(b=>'r'+b).join(''),194900);
 verify([...seq].map((b,i)=>(i%2?'m':'r')+b).join(''),194900,'PARENT_CHROMOPHORE_INHERITANCE');
 verify('rAnA',C.rnaNN.AA,'PARENT_CHROMOPHORE_INHERITANCE');
 verify('cEt-GFANA-C',C.rnaNN.GC,'PARENT_CHROMOPHORE_INHERITANCE');
 for(const [symbol,link] of Object.entries(L.linkageSymbols)){
  verify('rA'+symbol+'rC',C.rnaNN.AC,symbol?'PO_LINKAGE_INHERITANCE':undefined);
  if(symbol)assert.ok(run('rA'+symbol+'rC').optical.evidence.assumptions.some(s=>s.includes(link)));
 }
 verify('dArCrG',C.dnaMono.A+C.rnaNN.CG,'STACK_OMITTED');
 verify('rA[absic]rC',C.rnaMono.A+C.rnaMono.C,'REVIEWED_NEGLIGIBLE');
 const glycerol=verify('rA[GlycerolBranch]rC',C.rnaMono.A+C.rnaMono.C,'REVIEWED_NEGLIGIBLE');
 assert.ok(glycerol.contributionLedger.some(t=>t.source.includes('saturated glycerol')));
 verify('[FAM]rArC',20958+C.rnaNN.AC,'ADDITIVE_CHROMOPHORE');
 verify('rI',7145.35,'MODIFIED_BASE_MONOMER');verify('rCMe',3556.19,'MODIFIED_BASE_MONOMER');
 assert.equal(run('[PEG3]').optical.missing[0].code,'NO_POSITIVE_EPSILON260');
 assert.ok(!L.calculateSafe('[Unknown]rA').optical);
 const r=run('rArC');
 assert.ok(!O.analyze({graph:r.graph}).supported);
 const custom=structuredClone(r.assembly_graph);
 custom.nodes[0].block.id='unknown-optics';
 const guessed=O.analyze({graph:r.graph,assembly_graph:custom});
 assert.equal(guessed.epsilon260,C.rnaMono.C);
 assert.ok(guessed.evidence.reasonCodes.includes('UNKNOWN_BASE_ZERO'));
 assert.equal(guessed.averageMW_g_mol,r.chemistry.average_mw);
 const user=run('rArCrGrUrAeTdAcEt-AnT').optical;
 assert.ok(user.ugPerOD260>0&&user.estimated);
 console.log(JSON.stringify({focused:'pass',user:{mw:user.averageMW_g_mol,epsilon:user.epsilon260,mass:user.ugPerOD260,assumptions:user.evidence.assumptions}}));
}
function replay(file){
 const {Lite:L,REFERENCE:C}=engine(true);
 const totals={},byKind={},byLength={},noValue={},recovered={};
 const rows=fs.readFileSync(file,'utf8').trim().split('\n');
 const bump=(obj,k)=>obj[k]=(obj[k]||0)+1;
 for(const line of rows){
  const old=JSON.parse(line);
  try{
   const r=L.calculateSafe(old.sequence);
   let status;
   if(old.status==='CHEMISTRY_UNSUPPORTED'){
    assert.equal(r.errors[0].code,old.status);
    assert.equal(r.errors[0].reasonCode,old.errors[0].reasonCode);
    status=old.status;
   }else{
    assert.deepEqual(Array.from(r.assembly_graph?.nodes||[],n=>n.block.id),old.ids);
    status=check(r);
    if(old.status==='validated')assert.equal(r.optical.epsilon260,old.epsilon);
    if(status==='NO_POSITIVE_EPSILON260'){
     assert.ok(old.ids.every(id=>!['A','C','G','T','U','I','CMe'].includes(C.templates[id].base)&&id!=='{FAM}'));
     bump(noValue,old.ids.join('|'));
    }else if(old.status==='unsupported')bump(recovered,old.kind);
   }
   bump(totals,status);bump(byKind[old.kind]??={},status);bump(byLength[old.n]??={},status);
  }catch(e){throw Error(file+' '+old.kind+' '+old.sequence+' '+e.stack);}
 }
 return {file:path.basename(path.dirname(file))+'/'+path.basename(file),totals,byKind,byLength,noValue,recovered};
}
if(!isMainThread)parentPort.postMessage(replay(workerData));
else (async()=>{
 focused();
 if(!process.argv[2])return;
 const evidence=path.resolve(process.argv[2]);
 const files=fs.readdirSync(evidence,{recursive:true}).filter(f=>/cases-\d+\.jsonl$/.test(f));
 assert.equal(files.length,16);
 const results=[];
 await Promise.all(Array.from({length:Number(process.env.OLIGO_WORKERS||8)},async()=>{
  while(files.length){
   const file=files.shift();
   const summary=await new Promise((resolve,reject)=>{
    const w=new Worker(__filename,{workerData:path.join(evidence,file)});
    w.on('message',resolve);w.on('error',reject);
    w.on('exit',code=>{if(code)reject(Error('Worker exited '+code));});
   });
   results.push(summary);
   console.log(JSON.stringify({file:summary.file,totals:summary.totals}));
  }
 }));
 const totals={};
 for(const result of results)for(const [k,v] of Object.entries(result.totals))totals[k]=(totals[k]||0)+v;
 assert.equal(Object.values(totals).reduce((a,b)=>a+b),60407);
 fs.writeFileSync(process.argv[3]||'optical-replay.json',JSON.stringify({totals,results},null,2));
 console.log(JSON.stringify(totals));
})().catch(e=>{console.error(e);process.exitCode=1;});

