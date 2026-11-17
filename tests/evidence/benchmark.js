async fixture=>{
 const timings={};
 function measure(label, fn){
  const start=performance.now();
  try{return fn();}finally{const t=timings[label]||={ms:0,calls:0};t.ms+=performance.now()-start;t.calls++;}
 }
 function wrap(obj,key,label=key){
  const original=obj[key];
  obj[key]=function(...args){return measure(label,()=>original.apply(this,args));};
 }
 await SmallFragmentDepictor.ready;
 wrap(ReagentSource,'parseUpload','reagent parse');wrap(BatchWorkflow,'catalog','catalog');
 wrap(Lite,'calculate','sequence calculation incl parse/assembly');
 wrap(MoleculeBuilder,'start','start checkpoint inclusive');
 wrap(Reactions.v2,'detect','explicit motif detection');
 wrap(Reactions.v2,'findCompatibleReactionPlans','reaction discovery inclusive');
 wrap(Reactions.v2,'transform','reaction transform inclusive');
 wrap(MoleculeBuilder,'react','reaction checkpoint inclusive');
 wrap(Lite,'graphProperties','graph properties explicit');
 wrap(Optical,'analyze','optical');
 wrap(MoleculeBuilder,'record','presentation record');wrap(LocalViewers,'chemicalDrawing','layout inclusive');
 wrap(Lite,'svg','atom SVG');wrap(Lite,'quality','drawing quality');wrap(Lite,'cdxml','CDXML');
 wrap(StructurePresentation,'schematic','schematic SVG');
 const {registry,errors}=await BatchWorkflow.upload([new File([fixture],'lipid.mol')]);
 if(errors.length)throw Error(errors.join('; '));
 const reagentId=[...BatchWorkflow.catalog(registry)].find(([,r])=>r.source==='upload')[0];
 const rows=[21,60,100,150].map(n=>({ID:'lipid-'+n,Sequence:'[C6N]'+'rArCrGrU'.repeat(Math.ceil(n/4)).slice(0,n*2),operations:[{step:1,action:'add',reagentId}]}));
 const probes=[];
 for(const row of rows){
  const times={}, time=(name,fn)=>{const t=performance.now();const value=fn();times[name]=performance.now()-t;return value;};
  const parsed=time('parse',()=>Lite.parse(row.Sequence));
  const assembly=time('assemblyValidation',()=>Lite.validateChemistry(parsed));
  const graph=time('graphExpansion',()=>Lite.expandAssemblyGraph(assembly));
  time('motifDiscovery',()=>Reactions.v2.findCompatibleReactionPlans(graph,registry.get('lipid.mol').graph));
  probes.push({nt:row.ID,times});
 }
 const samples=[];
 for(const formats of [[],['cdxml','schematic.svg','mol','svg'],[],['cdxml','schematic.svg','mol','svg']]){
  const states=[];
  const result=await Batch.run(rows,{structures:registry,formats,onResult:s=>states.push(s)});
  if(states.length!==rows.length)throw Error(JSON.stringify(result.rows));
  measure('XLSX generation',()=>XLSX.write(Batch.workbook(result),{type:'array',compression:true}));
  let files=[];
  if(result.zip){
   const t=performance.now();
   const data=await result.zip.generateAsync({type:'uint8array'});
   timings['ZIP generation']={ms:performance.now()-t,bytes:data.length};
   for(const name of Object.keys(result.zip.files))files.push([name,await result.zip.file(name).async('string')]);
  }
  const normalize=value=>{const ids=new Map();return JSON.stringify(value).replace(/[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}/gi,id=>{if(!ids.has(id))ids.set(id,'UUID'+ids.size);return ids.get(id);});};
  const hash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(normalize(value)))),b=>b.toString(16).padStart(2,'0')).join('');
  samples.push({formats,elapsed:result.elapsedMs,timings:structuredClone(timings),stages:result.stageTimings,states:await Promise.all(states.map(hash)),files:await Promise.all(files.map(async ([name,data])=>[name,await hash(data)])),rows:result.rows.map(r=>[r.ID,r.Formula,r['Average MW'],r.epsilon260,r['Structure Status']])});
  for(const key of Object.keys(timings))delete timings[key];
 }
 return {protocol:location.protocol,agent:navigator.userAgent,probes,samples};
}
