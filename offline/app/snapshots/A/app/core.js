'use strict';
// Semantic chemistry objects. No residue-family dispatch is permitted here.
const ChemistryCore = (() => {
 const copy = x => JSON.parse(JSON.stringify(x));
 const fail = (reason, reasonCode='CHEMISTRY_UNSUPPORTED') => {
  throw Object.assign(Error('CHEMISTRY_UNSUPPORTED: '+reason),{reasonCode});
 };
 function molecularGraph(value) {
  const g=copy(value.graph||value);
  if(!g.atoms?.length||!Array.isArray(g.bonds))fail('empty MolecularGraph');
  for(const [i,a] of g.atoms.entries())if(!a.e||!Number.isInteger(a.h??0)||(a.h??0)<0||!Number.isFinite(a.q??0)||['x','y','z'].some(k=>a[k]!==undefined&&!Number.isFinite(a[k])))fail('invalid atom '+i);
  for(const b of g.bonds)if(!Number.isInteger(b.a)||!Number.isInteger(b.b)||!g.atoms[b.a]||!g.atoms[b.b]||b.a===b.b||![1,2,3].includes(b.o))fail('invalid bond');
  return {schema_version:'molecular-graph/1',atoms:g.atoms,bonds:g.bonds,...(g.ctfile?{ctfile:copy(g.ctfile)}:{}),...(g.normalization?{normalization:copy(g.normalization)}:{})};
 }
 function buildingBlock(value) {
  const graph=molecularGraph(value), sites=copy(value.sites||value.attachments||{});
  for(const [id,s] of Object.entries(sites)){
   s.id=id;s.direction=s.direction||id;s.role=s.role||s.atom_role||'attachment';
   s.unconnected=s.unconnected||{state:s.element==='N'?'NH':'OH',hydrogens:1};
   if(!graph.atoms[s.atom]||graph.atoms[s.atom].e!==s.element)fail(value.id+' invalid attachment atom '+id);
   if(!['upstream','downstream','branch','other'].includes(s.direction)||!s.compatibility_domain)fail(value.id+' incomplete directional compatibility contract');
   if(s.unconnected.state!==(s.element==='N'?'NH':'OH')||s.unconnected.hydrogens!==1)fail(value.id+' unimplemented unconnected state');
  }
  return {schema_version:'building-block/3',id:value.id,graph,sites,
   ...(Object.values(sites).some(s=>s.direction==='branch')?{attachmentSites:copy(Object.values(sites))}:{}),
   // Emit optical only when the block actually declares one; an absent property and
   // an explicit null are not interchangeable for stored snapshots/JSON backups.
   ...(value.optical?{optical:copy(value.optical)}:{}),
   metadata:copy(value.metadata||{family:value.family,base:value.base,sugar:value.sugar,name:value.name,topology:value.topology,incoming_label:value.incoming_label,outgoing_label:value.outgoing_label}),
   layout:copy(value.layout||{expanded:!!value.layout_metadata?.expanded,depiction_overpasses:value.depiction_overpasses||[]})};
 }
 function linkageDefinitions(reference) {
  return Object.fromEntries(Object.entries(reference.links).map(([id,g])=>[id,{
   schema_version:'linkage-definition/1',id,graph:molecularGraph(g),center:g.p,
   source_requirements:id==='PMO'?{element:'N',connection_class:'amine'}:{element:'O',connection_class:'alcohol'},
   target_requirements:{element:'O',connection_class:'alcohol'},directionality:'source-to-target',
   terminal_forms:id==='PMO'?[]:['neutral-acid'],
   edit_rule:{consume_source_h:1,consume_target_h:1,center_bond_order:1,terminal_cap:{e:'O',h:1}},
   layout_template:id,source:reference.source||'versioned reference-data.js'
  }]));
 }
 function requireLinkage(definitions,id) {
  if(!Object.hasOwn(definitions,id))fail('undefined linkage '+id,'UNDEFINED_LINKAGE');
  return definitions[id];
 }
 // Domain and atom-role labels describe provenance and local position.
 // Linkage endpoint requirements and site permissions control the graph edit.
 function validateSite(graph,s,link,position,end,label=s.id) {
  const req=link[end+'_requirements'];
  if(s.element!==req.element||s.connection_class!==req.connection_class)
   fail(label+' fails '+link.id+' '+end+' requirements (requires '+req.element+' '+req.connection_class+')','INCOMPATIBLE_SITE_CHEMISTRY');
  if(!s.allowed_linkage_classes?.includes(link.id)||!s[position+'_phosphorus']?.includes(link.id))
   fail(label+' does not permit '+position+' '+link.id+(position==='terminal'&&s.reason?'; '+s.reason:''),'SITE_LINKAGE_NOT_ALLOWED');
  const a=graph.atoms[s.atom],bs=graph.bonds.filter(b=>b.a===s.atom||b.b===s.atom);
  if(!a||a.e!==s.element||a.h!==1||a.q||!bs.length||bs.some(b=>b.o!==1)||(s.element==='O'&&bs.length!==1))
   fail(label+' is not a free compatible attachment','ATTACHMENT_NOT_FREE');
  return s;
 }
 function site(block,id,link,position,end) {
  const s=block.sites[id];
  if(!s)fail(block.id+' missing site '+id,'MISSING_ATTACHMENT_SITE');
  return validateSite(block.graph,s,link,position,end,block.id+' '+id);
 }
 const direction=(node,end)=>((end==='source')!==(node.orientation==='reverse'))?'downstream':'upstream';
 function validateAssembly(ag,definitions) {
  if(ag.schema_version!=='assembly-graph/1'||!ag.nodes?.length||!Array.isArray(ag.edges))fail('invalid AssemblyGraph');
  const nodes=new Map(),used=new Set(),ids=new Set();
  const unique=id=>{if(typeof id!=='string'||!id||ids.has(id))fail('missing/duplicate object id');ids.add(id);};
  for(const [i,n] of ag.nodes.entries()){
   unique(n.id);if(nodes.has(n.id)||n.position!==i+1||!['forward','reverse'].includes(n.orientation))fail('invalid node order/orientation');
   n.block=buildingBlock(n.block);nodes.set(n.id,n);
  }
  const endpoint=(ref,link,pos,end)=>{
   const n=nodes.get(ref.node);if(!n)fail('unknown endpoint node');
   const s=site(n.block,ref.site,link,pos,end),key=n.id+':'+s.atom;
   if(s.direction!==direction(n,end))fail(n.block.id+' '+ref.site+' has incompatible '+end+' direction','INCOMPATIBLE_SITE_DIRECTION');
   if(used.has(key))fail('attachment atom consumed more than once: '+key,'ATTACHMENT_ALREADY_USED');used.add(key);return s;
  };
  for(const e of ag.edges){
   unique(e.id);
   const l=requireLinkage(definitions,e.linkage);
   endpoint(e.source,l,'internal','source');
   endpoint(e.target,l,'internal','target');
  }
  const terminated=new Set();
  for(const t of ag.terminations||[]){
   unique(t.id);
   const n=nodes.get(t.at.node),s=n?.block.sites[t.at.site];if(!s)fail('termination has no attachment');
   const key=n.id+':'+s.atom;if(used.has(key)||terminated.has(key))fail('occupied termination '+key,'ATTACHMENT_ALREADY_USED');terminated.add(key);
   if(t.kind==='site'){if(t.state!==s.unconnected.state)fail('unimplemented capping state '+t.state);}
   else if(t.kind==='linkage'){
    if(t.cap!=='neutral-acid')fail('undefined terminal cap '+t.cap);
    if(!t.linkages?.length)fail('empty terminal linkage path');
    for(const code of t.linkages){const l=requireLinkage(definitions,code);if(!l.terminal_forms.includes('neutral-acid'))fail('unsupported terminal form '+code+'; no neutral-acid cap defined','UNSUPPORTED_TERMINAL_FORM');site(n.block,t.at.site,l,'terminal','target');}
    if(t.linkages.length>1&&t.linkages.some(c=>c!=='PO'))fail('modified polyphosphate positions undefined','UNDEFINED_MODIFIED_POLYPHOSPHATE');
   }else fail('unknown termination kind');
  }
  for(const n of ag.nodes)for(const s of Object.values(n.block.sites))if(!used.has(n.id+':'+s.atom)&&!terminated.has(n.id+':'+s.atom))fail('missing explicit termination '+n.id+':'+s.id);
  return ag;
 }
 function fromNotation(p,resolve,definitions){
  const nodes=p.residues.map((id,i)=>{
   const raw=resolve(id);if(!raw)fail(id+' has no reliable molecular graph','UNAVAILABLE_BUILDING_BLOCK');if(raw.validation_status)fail(id+' '+raw.validation_status,'UNAVAILABLE_BUILDING_BLOCK');
   const block=buildingBlock({...raw,id});
   const orientation=nodesOrientation(block,i,p.residues.length);
   return {id:'b'+(i+1),position:i+1,orientation,block};
  });
  const edges=p.links.map((linkage,i)=>{
   const source={node:nodes[i].id,site:direction(nodes[i],'source')},target={node:nodes[i+1].id,site:direction(nodes[i+1],'target')};
   // Legacy blank separator resolves a dedicated linkage only when both sites declare it.
   if(linkage==='PO'&&nodes[i].block.sites[source.site]?.allowed_linkage_classes.includes('PMO')&&nodes[i+1].block.sites[target.site]?.allowed_linkage_classes.includes('PMO'))linkage='PMO';
   return {id:'l'+(i+1),source,target,linkage};
  });
  const occupied=new Set(edges.flatMap(e=>[e.source.node+':'+e.source.site,e.target.node+':'+e.target.site])),terminations=[];
  for(const n of nodes)for(const [id,s] of Object.entries(n.block.sites))if(!occupied.has(n.id+':'+id)){
   const side=n.position===1&&id===direction(n,'target')?'five':n.position===nodes.length&&id===direction(n,'source')?'three':null;
   const count=side?p.terminal[side]:0;
   terminations.push({id:'t'+(terminations.length+1),at:{node:n.id,site:id},kind:count?'linkage':'site',...(count?{linkages:Array(count).fill(p.terminalChemistry[side]),cap:'neutral-acid'}:{state:s.unconnected.state})});
  }
  for(const [side,count]of Object.entries(p.terminal))if(count){const n=side==='five'?nodes[0]:nodes[nodes.length-1],id=direction(n,side==='five'?'target':'source');if(!n.block.sites[id])fail(n.block.id+' missing terminal '+id,'MISSING_ATTACHMENT_SITE');if(occupied.has(n.id+':'+id))fail(n.block.id+' terminal '+id+' is occupied','ATTACHMENT_ALREADY_USED');}
  return validateAssembly({schema_version:'assembly-graph/1',nodes,edges,terminations},definitions);
 }
 function nodesOrientation(block,i,length){
  // A one-site modifier can be oriented at either terminus; no special block category.
  const dirs=Object.keys(block.sites);
  return dirs.length===1&&block.sites[dirs[0]].reversible!==false&&((i===0&&length>1&&dirs[0]==='upstream')||(i===length-1&&length>1&&dirs[0]==='downstream'))?'reverse':'forward';
 }
 return {molecularGraph,buildingBlock,linkageDefinitions,requireLinkage,validateSite,validateAssembly,fromNotation};
})();
