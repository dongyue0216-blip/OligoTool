async fixture=>{
 const tests=[];
 const check=(v,m)=>{if(!v)throw Error(m);};
 const test=async(name,fn)=>{try{await fn();tests.push({name,status:'PASS'});}catch(e){tests.push({name,status:'FAIL',error:e.stack});}};
 const $=id=>document.getElementById(id);
 const wait=async f=>{for(let i=0;i<1000;i++){if(f())return;await new Promise(r=>setTimeout(r,20));}throw Error('UI timeout');};
 await SmallFragmentDepictor.ready;
 await test('Infinity storage reads baseline and writes isolated copy',()=>{
  const key='infinity-acceptance-'+crypto.randomUUID();
  localStorage.setItem(key,'baseline');
  check(InfinityStorage.getItem(key)==='baseline','legacy read');
  InfinityStorage.setItem(key,'experiment');
  check(localStorage.getItem(key)==='baseline','baseline changed');
  check(InfinityStorage.getItem(key)==='experiment','isolated value missing');
  localStorage.setItem(key,'later-baseline');
  check(InfinityStorage.getItem(key)==='experiment','experiment overwritten');
  localStorage.removeItem(key);localStorage.removeItem(InfinityStorage.prefix+key);
 });
 await test('Optical exception preserves explicit unsupported diagnostic',()=>{
  const result=Optical.analyze(new Proxy({},{get(){throw Error('Injected optical failure');}}));
  check(!result.supported&&result.evidence.reasonCodes.includes('OPTICAL_ANALYSIS_ERROR')&&result.reason.includes('Injected optical failure'),'silent optical error');
 });
 await test('Optical error leaves real sequence and reaction chemistry usable',()=>{
  const analyze=Optical.analyze;
  try{
   Optical.analyze=(snapshot,...args)=>analyze(new Proxy(snapshot,{
    get(target,key){if(key==='graph')throw Error('Injected optical parameter access failure');return target[key];}
   }),...args);
   const state=MoleculeBuilder.start('[C6N]rArC');
   check(state.formula&&state.graph.atoms.length>0&&!state.optical.supported,'sequence chemistry rejected');
   const entries=BatchWorkflow.catalog(new Map());
   const smcc=[...entries.values()].find(r=>r.id==='builtin:linker1:smcc');
   const plan=MoleculeBuilder.quick(state,smcc.graph).candidates[0];
   const product=MoleculeBuilder.react(state,{family:plan.family,secondary:smcc.graph,candidateId:plan.candidate_id});
   check(product.formula&&product.operation.mapping.length===2&&!product.optical.supported,'reaction chemistry rejected');
  }finally{Optical.analyze=analyze;}
 });
 await test('Reaction checkpoint round-trip and corrupted mapping rejection',()=>{
  const state=MoleculeBuilder.start('[C6N]rArC');
  const smcc=[...BatchWorkflow.catalog(new Map()).values()].find(r=>r.id==='builtin:linker1:smcc');
  const plan=MoleculeBuilder.quick(state,smcc.graph).candidates[0];
  const product=MoleculeBuilder.react(state,{family:plan.family,secondary:smcc.graph,candidateId:plan.candidate_id});
  const raw=MoleculeBuilder.exportJSON(product),restored=MoleculeBuilder.restore(raw);
  check(JSON.stringify(restored)===JSON.stringify(product),'round-trip changed state');
  for(const mutate of [
   x=>{x.operation.inputAtomMaps[0][0]=999999;},
   x=>{x.operation.inputAtomMaps[0][1]=x.operation.inputAtomMaps[0][0];x.graph.provenance.input_atom_maps=x.operation.inputAtomMaps;},
   x=>{x.operation.graphEdits.after.atoms[0].h++;},
  ]){
   const changed=JSON.parse(raw);mutate(changed);let rejected=false;
   try{MoleculeBuilder.restore(changed);}catch{rejected=true;}
   check(rejected,'corrupted checkpoint accepted');
  }
 });
 await test('Cancellation retains completed chemistry and stage timings',async()=>{
  let stop=false;const phases=[];
  const result=await Batch.run(Array.from({length:5},(_,i)=>({ID:'cancel'+i,Sequence:'rArC'})),{sequenceOnly:true,cancelled:()=>stop,progress:p=>{phases.push(p.phase);if(p.done===1)stop=true;}});
  check(result.cancelled&&result.rows.length===1&&result.rows[0]['Workflow Status']==='PASS','cancel state wrong');
  check(result.stageTimings.sequenceAndCheckpoint.calls===1&&phases.includes('chemistry'),'timing or phase missing');
 });
 await test('Bilingual Batch 2.1 file upload preview calculation and export controls',async()=>{
  document.querySelector('[data-page="batch"]').click();
  const w=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(w,XLSX.utils.aoa_to_sheet([['Sequence No.','Compound ID','Sequence'],['1','normal','rArCrG'],['2','bad','rA[UnknownInfinity]'],['3','pmo','pApTpC']]),'Sequences');
  const transfer=new DataTransfer();transfer.items.add(new File([XLSX.write(w,{type:'array'})],'acceptance.xlsx'));
  $('sequenceBatchFile').files=transfer.files;$('sequenceBatchFile').dispatchEvent(new Event('change',{bubbles:true}));
  $('sequenceBatchPreview').click();await wait(()=>!$('sequenceBatchRun').disabled);
  check($('sequenceBatchStatus').textContent.includes('2 / 3'),'validation denominator');
  $('sequenceBatchRun').click();await wait(()=>!$('sequenceBatchDownload').disabled);
  check($('sequenceBatchStatus').textContent.includes('2 / 3')&&!$('sequenceBatchStructures').disabled,'result denominator or structures');
  const table=$('sequenceBatchFile').closest('article').querySelector('table');
  check(table.textContent.includes('UnknownInfinity')&&table.textContent.includes('C'),'error/chemistry missing');
  $('sequenceBatchDownload').click();$('sequenceBatchStructures').click();await wait(()=>!$('sequenceBatchStructures').disabled);
  $('language').value='en';$('language').dispatchEvent(new Event('change',{bubbles:true}));
  check($('sequenceBatchDownload').textContent==='Download results'&&$('sequenceBatchStatus').textContent.includes('2 / 3'),'language changes results');
 });
 await test('Current A/C fixture invariants and replay',()=>{
  const result=SandboxValidation.run();
  check(result.pass,JSON.stringify(result.rows.filter(r=>r.status==='FAIL')));
  tests.push({name:'A/C invariant detail',status:'PASS',checks:result.checks,rows:result.rows.length});
 });
 await test('Every built-in binary reaction plan survives swapped inputs',()=>{
  const entries=[...BatchWorkflow.catalog(new Map()).values()].filter(r=>r.source==='builtin');
  const starts=['[C6N]rArC','[p]rA'].map(s=>MoleculeBuilder.start(s).graph);
  let pairs=0,plans=0;
  for(const start of starts)for(const reagent of entries){
   const forward=Reactions.v2.findCompatibleReactionPlans(start,reagent.graph);
   const reverse=Reactions.v2.findCompatibleReactionPlans(reagent.graph,start);
   const signature=result=>JSON.stringify(result.plans.map(c=>[c.transformation_id,c.orientation,c.status]).sort());
   check(signature(forward)===signature(reverse),'swap candidates');
   for(const c of forward.plans){
    const a=Reactions.v2.transform(c.family,[start,reagent.graph],c.candidate_id);
    const b=reverse.plans.find(x=>x.transformation_id===c.transformation_id&&x.orientation===c.orientation);
    const z=Reactions.v2.transform(b.family,[reagent.graph,start],b.candidate_id);
    check(a.product_graph&&z.product_graph&&a.properties.formula===z.properties.formula,'swap product');
    plans++;
   }
   pairs++;
  }
  tests.push({name:'finite pair denominator',status:'PASS',reagents:entries.length,pairs,plans});
 });
 return {tests,protocol:location.protocol};
}
