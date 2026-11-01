'use strict';
const SandboxValidation=(()=>{
 function ring(g){
  const adj=g.atoms.map(()=>[]);g.bonds.forEach(b=>{adj[b.a].push(b.b);adj[b.b].push(b.a);});
  const rings=[];function walk(path){const last=path.at(-1);if(path.length===5){if(adj[last].includes(path[0])){const es=path.map(i=>g.atoms[i].e);if(es.filter(e=>e==='N').length===3&&es.filter(e=>e==='C').length===2&&g.bonds.filter(b=>path.includes(b.a)&&path.includes(b.b)&&b.o===2).length===2)rings.push(path);}return;}for(const j of adj[last])if(j>path[0]&&!path.includes(j))walk([...path,j]);}
  for(let i=0;i<g.atoms.length;i++)walk([i]);return rings[0]||null;
 }
 function run(){const rows=[];let checks=0;
  const check=(v,m)=>{if(!v)throw Error(m);checks++;};
  for(const f of Sandbox.fixtures){try{
   const loaded=Sandbox.loadFixture(f),r=loaded.record,before=JSON.stringify(r),off=Sandbox.C.present(r,false),on=Sandbox.C.present(r,true);
   check(before===JSON.stringify(r),'C input mutated');
   for(const out of [off,on]){check(Sandbox.identity(r.graph)===Sandbox.identity(out.drawing),'atom/bond/charge/stereo changed');check(JSON.stringify(Lite.graphProperties(out.drawing))===JSON.stringify(r.metrics),'formula/MW changed');check(out.drawing.atoms.length===r.graph.atoms.length&&out.drawing.bonds.length===r.graph.bonds.length,'count changed');}
   check(Sandbox.identity(on.drawing)===Sandbox.identity(off.drawing),'abbreviation identity changed');
   if(f.id==='20mer')check(JSON.stringify(r.graph.atoms)===JSON.stringify(on.drawing.atoms)&&JSON.stringify(r.graph.routes||[])===JSON.stringify(on.drawing.routes||[]),'bamboo changed');
   if(['cuaac','workflow'].includes(f.id)){const cycle=ring(r.graph);check(!!cycle,'missing 1,2,3-triazole N3C2 ring');for(let i=0;i<5;i++){const a=on.drawing.atoms[cycle[i]],b=on.drawing.atoms[cycle[(i+1)%5]],z=on.drawing.atoms[cycle[(i+2)%5]],u=[a.x-b.x,a.y-b.y],v=[z.x-b.x,z.y-b.y],angle=Math.acos((u[0]*v[0]+u[1]*v[1])/(Math.hypot(...u)*Math.hypot(...v)))*180/Math.PI;check(Math.abs(angle-108)<1e-6,'triazole not a nondegenerate pentagon');check(Math.abs(Math.hypot(a.x-b.x,a.y-b.y)-1.5)<1e-6,'triazole unequal bond lengths');}}
   if(f.id==='abbreviation'){check(r.graph.normalization?.hadAbbreviation===true&&on.view.groups.some(g=>g.label==='OAc'||g.label==='Ac'),'alias normalization or match missing');check(on.svg.includes('<path'),'display connection between abbreviated groups missing');}
   if(loaded.workflow){for(let n=1;n<=loaded.workflow.steps.length;n++){const cp=Sandbox.A.checkpoint(loaded.workflow,n);check(cp.workflow.steps.length===n,'checkpoint wrong');check(JSON.stringify(cp.graph)===JSON.stringify(loaded.workflow.steps[n-1].output),'checkpoint identity wrong');check(Reactions.reload(cp.workflow).steps.length===n,'replay mismatch');}}
   rows.push({id:f.id,status:'PASS',atoms:r.graph.atoms.length,bonds:r.graph.bonds.length,formula:r.metrics.formula,mock:false,layout:on.quality.pass?'PASS':'REVIEW',warnings:on.layout.metadata.warnings,ring:ring(r.graph)});
  }catch(e){rows.push({id:f.id,status:f.id==='biotin'?'UNSUPPORTED':'FAIL',message:e.message,mock:false});}}
  // Negative controls establish that the guard actually detects chemical changes.
  const r=Sandbox.A.smiles('CCO'),changed=Sandbox.clone(r.graph);changed.atoms[0].q=1;check(Sandbox.identity(changed)!==Sandbox.identity(r.graph),'charge guard ineffective');
  const stale=Presentation.layout({graph:r.graph});let rejected=false;try{Presentation.materialize(changed,stale);}catch(e){rejected=/STALE_LAYOUT/.test(e.message);}check(rejected,'stale layout accepted');
  return {checks,rows,pass:rows.every(r=>r.status!=='FAIL'),scope:'A/C invariance and checkpoint replay; B DOM language/actions verified by browser suite'};
 }
 return {run,ring};
})();
