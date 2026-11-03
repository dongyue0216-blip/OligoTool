'use strict';
// A -> B field mapping only; A owns every detection and transformation.
const ReactionFamilyAPI=(()=>{
 const familyIds={cap:'CAP',condensation:'Condensation',click:'Click'};
 const engine=()=>Reactions.v2;
 function analyze({family,inputs}){
  const api=engine(),id=familyIds[family],raw=api.candidates(id,inputs);
  const roles=new Set(Object.values(api.registry).filter(t=>t.family===id).flatMap(t=>t.roles));
  return {raw,reason:raw.status==='UNSUPPORTED'?raw.reason:null,candidates:raw.candidate_sites.map(groups=>[...roles].flatMap(role=>groups[role]||[]).map(s=>({...s,id:s.site_id,motif:s.motif_type,label:null}))),assignments:raw.candidates.map(c=>({id:c.candidate_id,siteIds:c.sites.map(s=>s.site_id),roles:c.roles,orientation:c.orientation,activation_required:c.semantics.includes('activation_required'),raw:c}))};
 }
 function append(workflow,{family,secondary,assignmentId}){
  const native=engine().append(workflow.reaction_workflow_v2||engine().workflow(workflow.current),familyIds[family],secondary,assignmentId);
  const r=native.steps?.at(-1)?.result||native;
  if(!r.product_graph||!r.step)throw Error(r.detail||r.reason||r.status);
  const next=Sandbox.clone(workflow),step=Sandbox.clone(r.step);
  step.step_index=next.steps.length+1;step.status='APPLIED';
  step.reaction_v2={family:r.family,candidate:r.candidate,selected_atom_ids:r.selected_atom_ids,mapping:r.mapping,semantics:r.semantics};
  next.steps.push(step);next.current=Sandbox.clone(r.product_graph);
  next.reaction_workflow_v2=native;next.reaction_v2_offset=workflow.reaction_v2_offset??workflow.steps.length;
  const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};next.steps.forEach(freeze);
  return next;
 }
 function checkpointWorkflow(workflow,n){
  const next=Sandbox.clone(workflow);next.steps=next.steps.slice(0,n);next.current=Sandbox.clone(next.steps[n-1].output);
  if(next.reaction_workflow_v2){
   const count=n-next.reaction_v2_offset;
   if(count>0){const w=next.reaction_workflow_v2;w.steps=w.steps.slice(0,count);w.current=Sandbox.clone(w.steps.at(-1).result.product_graph);next.reaction_workflow_v2=engine().reload(w);}
   else{delete next.reaction_workflow_v2;delete next.reaction_v2_offset;}
  }
  return next;
 }
 return {analyze,append,checkpointWorkflow,available:()=>!!engine()};
})();
