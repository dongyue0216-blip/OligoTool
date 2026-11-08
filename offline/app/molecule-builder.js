'use strict';
// A: immutable molecule checkpoints. Layout consumes this provenance; it never edits topology.
const MoleculeBuilder=(()=>{
 const copy=x=>JSON.parse(JSON.stringify(x));
 const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
 const fail=s=>{throw Error('MOLECULE_BUILDER: '+s);};
 function sitesFor(result,path){
  const graph=result.graph,used=new Set(result.assembly_graph.edges.flatMap(e=>[e.source.node+':'+e.source.site,e.target.node+':'+e.target.site]));
  for(const t of result.assembly_graph.terminations)if(t.kind==='linkage')used.add(t.at.node+':'+t.at.site);
  return result.assembly_graph.nodes.flatMap(n=>Object.values(n.block.sites).map(s=>{
   const atom=graph.provenance.atoms.findIndex(p=>p.node===n.id&&p.kind==='building-block'&&p.local_atom===s.atom);
   if(atom<0)fail('attachment provenance missing');
   return {...copy(s),id:path+'/'+n.id+'/'+s.id,node:n.id,path,atom,localAtom:s.atom,block:n.block.id,label:s.direction==='branch'?'Branch '+s.index:s.direction,status:used.has(n.id+':'+s.id)?'occupied':'available'};
  }));
 }
 function components(graph){
  const pending=new Set(graph.atoms.map((_,i)=>i)),adj=graph.atoms.map(()=>[]),out=[];
  for(const b of graph.bonds){adj[b.a].push(b.b);adj[b.b].push(b.a);}
  while(pending.size){const seed=pending.values().next().value,atoms=[],queue=[seed];pending.delete(seed);while(queue.length){const i=queue.pop();atoms.push(i);for(const j of adj[i])if(pending.delete(j))queue.push(j);}atoms.sort((a,b)=>a-b);out.push({id:'component-'+atoms[0],atomIndices:atoms});}return out;
 }
 function validateComponents(graph,parts){for(const c of parts){const map=new Map(c.atomIndices.map((v,i)=>[v,i]));Reactions.validate({atoms:c.atomIndices.map(i=>graph.atoms[i]),bonds:graph.bonds.filter(b=>map.has(b.a)).map(b=>({...b,a:map.get(b.a),b:map.get(b.b)}))});}}
 function finish(value){
  Lite.core.molecularGraph(value.graph);
  const laneIds=new Set(),owned=new Set();
  for(const lane of value.assemblyGraph.lanes){
   if(laneIds.has(lane.id)||lane.parent&&!laneIds.has(lane.parent)||lane.points.length!==lane.atomIndices.length)fail('invalid assembly lane hierarchy');laneIds.add(lane.id);
   if(lane.assembly)Lite.core.validateAssembly(copy(lane.assembly),Lite.linkageDefinitions);
   for(const [k,i]of lane.atomIndices.entries()){if(!Number.isInteger(i)||!value.graph.atoms[i]||owned.has(i)||!Number.isFinite(lane.points[k].x)||!Number.isFinite(lane.points[k].y))fail('invalid lane atom mapping');owned.add(i);}
  }
  const ids=new Set();for(const s of value.attachmentSites){
   const lane=value.assemblyGraph.lanes.find(l=>l.id===s.path),node=lane?.assembly?.nodes.find(n=>n.id===s.node),source=node?.block.sites[s.id.slice(s.id.lastIndexOf('/')+1)];
   if(!source||ids.has(s.id)||!['available','occupied','removed'].includes(s.status)||source.atom!==s.localAtom||source.direction!==s.direction||source.element!==s.element||source.compatibility_domain!==s.compatibility_domain||JSON.stringify(source.allowed_linkage_classes)!==JSON.stringify(s.allowed_linkage_classes))fail('invalid AttachmentSite provenance');ids.add(s.id);
   if(s.status!=='removed'&&(!Number.isInteger(s.atom)||!lane.atomIndices.includes(s.atom)))fail('invalid AttachmentSite atom mapping');
  }
  value.components=components(value.graph);validateComponents(value.graph,value.components);
  value.graphRevision=value.graphRevision??value.history.length;
  if(!Number.isInteger(value.graphRevision)||value.graphRevision<0)fail('invalid graph revision');
  value.chemistryResolution=value.chemistryResolution||{status:'exact',basis:'validated explicit atom graph'};
  if(value.chemistryResolution.status!=='exact')fail('partial/unresolved chemistry cannot materialize an exact state');
  value.materialization=value.materialization||{status:value.history.some(o=>o.type==='ReactionOperation')?'provenance-only':'expandable-exact',graphRevision:value.graphRevision};
  if(!['expandable-exact','provenance-only'].includes(value.materialization.status)||value.materialization.graphRevision!==value.graphRevision)fail('invalid materialization status/revision');
  value.interactionAnnotations=value.interactionAnnotations||[];
  const annotationIds=new Set();for(const a of value.interactionAnnotations){
   if(!a.id||annotationIds.has(a.id)||!a.kind||!Array.isArray(a.participants)||a.participants.length<2||a.kind==='basePair'&&a.participants.length!==2)fail('invalid interaction annotation');annotationIds.add(a.id);
   for(const p of a.participants)if(!Number.isInteger(p.atomIndex)||!value.graph.atoms[p.atomIndex])fail('unresolved interaction participant');
  }
  for(const site of value.attachmentSites){site.nodeInstanceId=site.nodeInstanceId||site.path+'/'+site.node;site.siteId=site.siteId||site.id.slice(site.id.lastIndexOf('/')+1);}
  const identities=new Set();for(const site of value.attachmentSites){const key=JSON.stringify([site.nodeInstanceId,site.siteId]);if(identities.has(key)||site.nodeInstanceId!==site.path+'/'+site.node||site.siteId!==site.id.slice(site.id.lastIndexOf('/')+1))fail('invalid stable site identity');identities.add(key);}
  value.assemblyGraph.covalentEdges=value.assemblyGraph.covalentEdges||[];
  value.schemaVersion=1;value.schema='oligo-molecule-state';value.properties=Lite.graphProperties(value.graph);
  value.reactiveSites=value.components.length===1?Reactions.v2.detect([value.graph]).candidate_sites[0]:{status:'UNSUPPORTED',reason:'Select a covalent component for reaction analysis'};
  value.formula=value.properties.formula;value.average_mw=value.properties.average_mw;value.exact_mass=value.properties.exact_mass;
  if(typeof Optical!=="undefined")value.optical=Optical.analyze(value);
  value.graph.photometry=copy(value.optical);return freeze(value);
 }
 function start(sequence){
  const r=Lite.calculate(sequence);r.graph.photometry=copy(r.optical);
  return finish({id:crypto.randomUUID(),parentStateId:null,operation:null,history:[],graph:r.graph,assemblyGraph:{schema_version:'hierarchical-assembly-graph/1',lanes:[{id:'main',parent:null,assembly:r.assembly_graph,sequence:r.canonical_sequence,atomIndices:r.graph.atoms.map((_,i)=>i),points:r.graph.atoms.map(a=>({x:a.x,y:a.y})),routes:(r.graph.routes||[]).map(v=>({...copy(v),atoms:[r.graph.bonds[v.bond].a,r.graph.bonds[v.bond].b]}))}],branchEdges:[]},attachmentSites:sitesFor(r,'main'),optical:r.optical});
 }
 function fromGraph(graph){const g=copy(graph);return finish({id:crypto.randomUUID(),parentStateId:null,operation:null,history:[],graph:g,assemblyGraph:{schema_version:'hierarchical-assembly-graph/1',lanes:[{id:'main',parent:null,assembly:null,sequence:null,atomIndices:g.atoms.map((_,i)=>i),points:g.atoms.map(a=>({x:a.x,y:a.y})),routes:[]}],branchEdges:[]},attachmentSites:[],optical:g.photometry||{supported:false,status:'UNSUPPORTED',reason:'Imported structure optical parameters unavailable'}});}
 function available(state){return state.attachmentSites.filter(s=>s.direction==='branch'&&s.status==='available'&&free(state.graph,s));}
 function free(g,s){const a=g.atoms[s.atom];return !!a&&a.e===s.element&&a.h===1&&!a.q;}
 function branch(state,{siteId,sequence,linkage='PO',childEnd='start'}){
  const parent=available(state).find(s=>s.id===siteId);if(!parent)fail('branch site unavailable or occupied');
  if(!['start','end'].includes(childEnd))fail('invalid child endpoint');
  const link=Lite.core.requireLinkage(Lite.linkageDefinitions,linkage);
  const child=Lite.calculate(sequence),laneId='lane-'+crypto.randomUUID(),childSites=sitesFor(child,laneId),nodes=child.assembly_graph.nodes;
  const n=childEnd==='start'?nodes[0]:nodes.at(-1),direction=childEnd==='start'?'upstream':'downstream';
  let candidates=childSites.filter(s=>s.node===n.id&&s.status==='available'&&s.direction===direction);
  // Single-attachment endpoint may orient freely unless explicitly fixed.
  if(!candidates.length&&Object.keys(n.block.sites).length===1)candidates=childSites.filter(s=>s.node===n.id&&s.status==='available'&&s.reversible!==false);
  if(candidates.length!==1)fail('child endpoint unavailable / ambiguous');const target=copy(candidates[0]);
  Lite.core.validateSite(state.graph,parent,link,'internal','source');
  Lite.core.validateSite(child.graph,target,link,'internal','target');
  const g=copy(state.graph),offset=g.atoms.length,lo=offset+child.graph.atoms.length;
  g.atoms.push(...copy(child.graph.atoms),...copy(link.graph.atoms));
  g.bonds.push(...child.graph.bonds.map(b=>({...b,a:b.a+offset,b:b.b+offset})),...link.graph.bonds.map(b=>({...b,a:b.a+lo,b:b.b+lo})),{a:parent.atom,b:lo+link.center,o:1,s:0},{a:lo+link.center,b:offset+target.atom,o:1,s:0});
  g.atoms[parent.atom].h--;g.atoms[offset+target.atom].h--;
  const operation={id:crypto.randomUUID(),type:'AssemblyOperation',kind:'BranchElongation',siteId,sequence:child.canonical_sequence,linkage,childEnd};
  g.provenance={atoms:[...copy(state.graph.provenance?.atoms||g.atoms.slice(0,offset).map(()=>null)),...child.graph.provenance.atoms.map(p=>({...copy(p),lane:laneId})),...link.graph.atoms.map((_,i)=>({kind:'branch-linkage',operation:operation.id,local_atom:i}))],bonds:[...copy(state.graph.provenance?.bonds||state.graph.bonds.map(()=>null)),...child.graph.provenance.bonds.map(p=>({...copy(p),lane:laneId})),...Array(link.graph.bonds.length+2).fill(null).map(()=>({kind:'branch-linkage',operation:operation.id}))]};
  delete g.sites;delete g.layout;delete g.routes;delete g.depiction_overpasses;
  const attachments=copy(state.attachmentSites);attachments.find(s=>s.id===siteId).status='occupied';
  for(const s of childSites){if(s.id===target.id)s.status='occupied';s.atom+=offset;attachments.push(s);}
  const ag=copy(state.assemblyGraph);ag.lanes.push({id:laneId,parent:parent.path,assembly:child.assembly_graph,sequence:child.canonical_sequence,atomIndices:child.graph.atoms.map((_,i)=>i+offset),points:child.graph.atoms.map(a=>({x:a.x,y:a.y})),routes:(child.graph.routes||[]).map(v=>({...copy(v),atoms:[child.graph.bonds[v.bond].a+offset,child.graph.bonds[v.bond].b+offset]}))});
  ag.branchEdges.push({id:operation.id,parentLane:parent.path,childLane:laneId,parentSite:siteId,childSite:target.id,parentAnchor:parent.atom,childAnchor:offset+target.atom,linkage,linkageAtoms:link.graph.atoms.map((_,i)=>lo+i),linkageBonds:[g.bonds.length-2,g.bonds.length-1]});
  // Branched nearest-neighbor extinction is not validated by the existing optical engine.
  const optical={supported:false,status:'UNSUPPORTED',reason:'Branched sequence extinction model not validated; molecular masses remain graph-derived',components:[copy(state.optical),copy(child.optical)]};
  return finish({id:crypto.randomUUID(),parentStateId:state.id,operation,history:[...state.history,operation],graph:g,assemblyGraph:ag,attachmentSites:attachments,presentationGroups:copy(state.presentationGroups||[]),interactionAnnotations:copy(state.interactionAnnotations),materialization:{...copy(state.materialization),graphRevision:state.graphRevision+1},graphRevision:state.graphRevision+1,optical});
 }
 function react(state,{family,secondary=null,candidateId}){
  if(state.components.length!==1)fail('multi-component reaction selection not implemented');
  const inputs=secondary?[state.graph,secondary]:[state.graph],result=Reactions.v2.transform(family,inputs,candidateId);
  if(!result.product_graph)fail(result.detail||result.reason||result.status);
  const map=result.product_graph.provenance.input_atom_maps[0],ag=copy(state.assemblyGraph),attachments=copy(state.attachmentSites);
  for(const s of attachments){const atom=map[s.atom];s.atom=atom;if(atom===null||atom===undefined)s.status='removed';else if(s.status==='available'&&!free(result.product_graph,s))s.status='occupied';}
  for(const lane of ag.lanes){const kept=lane.atomIndices.map((i,k)=>({i:map[i],p:lane.points[k]})).filter(v=>v.i!==null&&v.i!==undefined);lane.atomIndices=kept.map(v=>v.i);lane.points=kept.map(v=>v.p);lane.routes=(lane.routes||[]).map(r=>({...r,atoms:r.atoms.map(i=>map[i])})).filter(r=>r.atoms.every(i=>i!==null&&i!==undefined));}
  for(const edge of [...ag.branchEdges,...(ag.covalentEdges||[])]){edge.parentAnchor=map[edge.parentAnchor];edge.childAnchor=map[edge.childAnchor];edge.linkageAtoms=edge.linkageAtoms.map(i=>map[i]).filter(i=>i!==null&&i!==undefined);delete edge.linkageBonds;}
  const groups=copy(state.presentationGroups||[]);for(const group of groups)group.mapping=group.mapping.map(i=>i===null?null:map[i]??null);if(secondary)groups.push({graph:copy(secondary),mapping:copy(result.product_graph.provenance.input_atom_maps[1])});
  const operation={id:crypto.randomUUID(),type:'ReactionOperation',kind:family,candidate:copy(result.candidate),mapping:copy(result.mapping),inputStateIds:[state.id],inputStates:[copy(state)],secondaryInput:secondary?copy(secondary):null,inputAtomMaps:copy(result.product_graph.provenance.input_atom_maps),reactionDefinition:copy(result.step.definition),reactionDefinitionVersion:result.step.definition.schema_version,graphRevision:state.graphRevision+1,graphEdits:{encoding:'exact-product-snapshot/1',before:copy(inputs),after:copy(result.product_graph)},siteRemapping:attachments.map((s,i)=>({identity:{nodeInstanceId:s.nodeInstanceId,siteId:s.siteId},beforeAtom:state.attachmentSites[i].atom,afterAtom:s.atom??null,status:s.status}))};
  if(result.candidate.product_state||result.candidate.transformation_id==='spaac/2'){
   const provenance=result.product_graph.provenance;
   operation.graphEdits.removedAtoms=copy(provenance.removed_atoms);
   operation.graphEdits.removedBonds=copy(provenance.removed_bonds);
   operation.graphEdits.newAtoms=[];
   operation.graphEdits.newBonds=result.product_graph.bonds.filter((_,i)=>provenance.bonds[i].kind==='reaction');
   operation.graphEdits.edits=copy(provenance.edits);
  }
  const optical=result.product_graph.photometry||{supported:false,status:'UNSUPPORTED',reason:'Reaction optical properties unavailable'};
  const next=finish({id:crypto.randomUUID(),parentStateId:state.id,operation,history:[...state.history,operation],graph:result.product_graph,assemblyGraph:ag,attachmentSites:attachments,presentationGroups:groups,graphRevision:state.graphRevision+1,materialization:{status:'provenance-only',graphRevision:state.graphRevision+1,reason:'Reaction product graph is authoritative; lane assemblies are provenance'},interactionAnnotations:remapAnnotations(state.interactionAnnotations,map),optical});
  // Record native reaction workflow for C's established triazole / fragment geometry.
  return next;
 }
 function remapAnnotations(rows,map){return copy(rows||[]).map(a=>({...a,participants:a.participants.map(p=>({...p,atomIndex:map[p.atomIndex]??null})),status:a.participants.some(p=>map[p.atomIndex]==null)?'unresolved':a.status})).filter(a=>{if(a.status==='unresolved')fail('reaction removes annotated participant; resolve annotation before reaction');return true;});}
 function annotate(state,annotations){return finish({...copy(state),id:crypto.randomUUID(),parentStateId:state.id,interactionAnnotations:copy(annotations)});}
 function combine(states){
  if(!Array.isArray(states)||states.length<2)fail('two or more states required');
  const graph={atoms:[],bonds:[],provenance:{atoms:[],bonds:[]}},lanes=[],attachmentSites=[],branchEdges=[],covalentEdges=[],annotations=[],presentationGroups=[];
  states.forEach((state,k)=>{const prefix='part-'+k+'/',offset=graph.atoms.length,rename=x=>prefix+x;
   graph.atoms.push(...copy(state.graph.atoms));graph.bonds.push(...state.graph.bonds.map(b=>({...b,a:b.a+offset,b:b.b+offset})));graph.provenance.atoms.push(...copy(state.graph.provenance?.atoms||state.graph.atoms.map(()=>null)));graph.provenance.bonds.push(...copy(state.graph.provenance?.bonds||state.graph.bonds.map(()=>null)));
   lanes.push(...copy(state.assemblyGraph.lanes).map(l=>({...l,id:rename(l.id),parent:l.parent?rename(l.parent):null,atomIndices:l.atomIndices.map(i=>i+offset),routes:(l.routes||[]).map(r=>({...r,atoms:r.atoms.map(i=>i+offset)}))})));
   attachmentSites.push(...copy(state.attachmentSites).map(s=>({...s,id:rename(s.id),path:rename(s.path),nodeInstanceId:rename(s.nodeInstanceId),atom:s.atom==null?s.atom:s.atom+offset})));
   for(const [rows,out]of [[state.assemblyGraph.branchEdges,branchEdges],[state.assemblyGraph.covalentEdges,covalentEdges]])out.push(...copy(rows||[]).map(e=>({...e,id:rename(e.id),parentLane:rename(e.parentLane),childLane:rename(e.childLane),parentSite:rename(e.parentSite),childSite:rename(e.childSite),parentAnchor:e.parentAnchor+offset,childAnchor:e.childAnchor+offset,linkageAtoms:e.linkageAtoms.map(i=>i+offset)})));
   presentationGroups.push(...copy(state.presentationGroups||[]).map(g=>({...g,mapping:g.mapping.map(i=>i==null?null:i+offset)})));
   annotations.push(...copy(state.interactionAnnotations).map(a=>({...a,id:rename(a.id),participants:a.participants.map(p=>({...p,atomIndex:p.atomIndex+offset}))})));
  });
  return finish({id:crypto.randomUUID(),parentStateId:null,operation:{type:'ComponentCollection',inputStateIds:states.map(s=>s.id),inputStates:copy(states)},history:[],graph,assemblyGraph:{schema_version:'hierarchical-assembly-graph/1',lanes,branchEdges,covalentEdges},attachmentSites,presentationGroups,interactionAnnotations:annotations,materialization:{status:'provenance-only',graphRevision:0},optical:{supported:false,status:'UNSUPPORTED',reason:'Multi-component optical model not validated'}});
 }
 function connect(state,{source,target,linkage='PO'}){
  const find=ref=>state.attachmentSites.find(s=>s.nodeInstanceId===ref.nodeInstanceId&&s.siteId===ref.siteId&&s.status==='available');
  const a=find(source),b=find(target),link=Lite.core.requireLinkage(Lite.linkageDefinitions,linkage);
  if(!a||!b||a.atom===b.atom)fail('invalid covalent endpoints');
  Lite.core.validateSite(state.graph,a,link,'internal','source');
  Lite.core.validateSite(state.graph,b,link,'internal','target');
  const next=copy(state),g=next.graph,offset=g.atoms.length,id=crypto.randomUUID();g.atoms.push(...copy(link.graph.atoms));g.bonds.push(...link.graph.bonds.map(b=>({...b,a:b.a+offset,b:b.b+offset})),{a:a.atom,b:offset+link.center,o:1,s:0},{a:offset+link.center,b:b.atom,o:1,s:0});g.atoms[a.atom].h--;g.atoms[b.atom].h--;delete g.sites;delete g.layout;delete g.routes;delete g.depiction_overpasses;
  g.provenance=g.provenance||{atoms:state.graph.atoms.map(()=>null),bonds:state.graph.bonds.map(()=>null)};g.provenance.atoms.push(...link.graph.atoms.map((_,i)=>({kind:'covalent-linkage',operation:id,local_atom:i})));g.provenance.bonds.push(...Array(link.graph.bonds.length+2).fill(null));
  for(const site of next.attachmentSites)if(site.id===a.id||site.id===b.id)site.status='occupied';
  next.assemblyGraph.covalentEdges.push({id,source:copy(source),target:copy(target),parentLane:a.path,childLane:b.path,parentSite:a.id,childSite:b.id,parentAnchor:a.atom,childAnchor:b.atom,linkage,linkageAtoms:link.graph.atoms.map((_,i)=>offset+i)});
  next.id=crypto.randomUUID();next.parentStateId=state.id;next.operation={id,type:'AssemblyOperation',kind:'ConnectExistingSites',source:copy(source),target:copy(target),linkage};next.history.push(next.operation);next.graphRevision++;next.materialization={status:'provenance-only',graphRevision:next.graphRevision,reason:'Explicit current graph; closure is not a lane assembly'};next.optical={supported:false,status:'UNSUPPORTED',reason:'Closure/crosslink optical model not validated'};return finish(next);
 }
 function exportJSON(state){return JSON.stringify(state,null,2);}
 function restore(raw){const s=copy(typeof raw==='string'?JSON.parse(raw):raw);if(s.schema!=='oligo-molecule-state'||s.schemaVersion!==1||!s.assemblyGraph?.lanes||!Array.isArray(s.attachmentSites))fail('unsupported state');const expected=Lite.graphProperties(s.graph);if(s.formula!==expected.formula||s.exact_mass!==expected.exact_mass||s.average_mw!==expected.average_mw)fail('checkpoint graph / properties mismatch');return finish(s);}
 return {start,fromGraph,branch,react,available,exportJSON,restore,combine,connect,annotate};
})();

