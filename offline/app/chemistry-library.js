'use strict';
// Local library boundary. No network, chemistry transformations or built-in writes.
const ChemistryLibrary=(()=>{
 const KEY='oligo-user-chemistry-library-baseline-v1',LEGACY=[];
 const copy=x=>JSON.parse(JSON.stringify(x)),fail=s=>{throw Error('LIBRARY: '+s);};
 const uuid=()=>globalThis.crypto.randomUUID();
 function canonical(x){if(Array.isArray(x))return '['+x.map(canonical).join(',')+']';if(x&&typeof x==='object')return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';return JSON.stringify(x);}
 // Exact indexed graph identity, not an isomorphism/canonical-SMILES claim.
 const identity=b=>canonical({atoms:b.graph.atoms.map(({x,y,z,...a})=>a),bonds:b.graph.bonds,sites:b.sites});
 const content=r=>canonical({block:r.block,runtime:r.runtime,name:r.name,symbol:r.symbol});
 // Derived snapshots may carry additive metadata that the core does not emit.
 function includesSnapshot(actual,expected){
  if(Array.isArray(expected))return Array.isArray(actual)&&actual.length===expected.length&&expected.every((v,i)=>includesSnapshot(actual[i],v));
  if(expected&&typeof expected==='object')return actual&&typeof actual==='object'&&Object.keys(expected).every(k=>Object.hasOwn(actual,k)&&includesSnapshot(actual[k],expected[k]));
  return actual===expected;
 }
 function normalize(name,input,previous={}){
  const target=Object.create(null),runtime=Lite.registerCustom(name,copy(input),target);
  if(input.graph?.metadata)runtime.metadata=copy(input.graph.metadata);
  // Registration validates attachment chemistry but also lays out the graph. Library migration preserves source coordinates.
  for(let i=0;i<runtime.atoms.length;i++)for(const k of ['x','y','z']){delete runtime.atoms[i][k];if(input.graph.atoms[i][k]!==undefined)runtime.atoms[i][k]=input.graph.atoms[i][k];}
  const block=Lite.core.buildingBlock(runtime);
  const r={schemaVersion:1,id:previous.id||uuid(),source:'user',name:previous.name||input.graph?.metadata?.displayName||name,symbol:name,block,runtime,
   provenance:previous.provenance||{createdAt:new Date().toISOString(),originalSource:input.source||input.graph?.source||input.graph?.normalization||input.graph?.provenance||null,originalSchemaVersion:input.schema_version||input.graph?.schema_version||null}};
  const properties=Lite.graphProperties(runtime);for(const k of ['formula','average_mw','exact_mass'])r[k]=properties[k];r.assembly_supported=true;
  r.graphIdentity=identity(block);return r;
 }
 function validate(r){
  if(!r||r.schemaVersion!==1||r.source!=='user'||typeof r.id!=='string'||!r.id||r.id.length>160||typeof r.name!=='string'||!r.name||r.name.length>500||!r.provenance||typeof r.provenance!=='object')fail('invalid user record/version/source');
  if(!r.block||!r.runtime||r.block.schema_version!=='building-block/3')fail('missing BuildingBlock/runtime');
  r=copy(r);
  if(!Lite.validCustomSymbol(r.symbol))fail('invalid stored symbol');
  const g=r.runtime,attachments={5:g.attachments?.upstream?.atom,3:g.attachments?.downstream?.atom};
  for(const version of [g.schema_version,r.block.graph?.schema_version])if(version!==undefined&&version!=='molecular-graph/1')fail('unsupported MolecularGraph version');
  if(g.id!=='{'+r.symbol+'}'||r.block.id!==g.id)fail('symbol / block ID mismatch');
  // Validate with the existing chemistry contract in an isolated registry.
  Lite.core.molecularGraph(g);
  // Restoring a previously valid symbol must not apply today's new-entry name
  // policy (new built-ins can acquire the same name). Validate chemistry using
  // an isolated, non-catalog symbol; never install or rename that temporary block.
  const reserved=new Set(Lite.builtinAudit().filter(row=>row.assembly_ready).flatMap(row=>row.names.map(n=>n.toLowerCase())));
  let validationName='LibraryCheck0',suffix=0;while(reserved.has(validationName.toLowerCase()))validationName='LibraryCheck'+(++suffix);
  const n=normalize(validationName,{graph:g,attachments,optical:g.optical,extinction:g.extinction});
  const b=Lite.core.buildingBlock(g);
  if(identity(r.block)!==r.graphIdentity)fail('graph / AttachmentSites mismatch');
  // Add only deterministic derived fields within the supported v2.00+ schema.
  // Authenticate the old identity before filling defaults; never rewrite source
  // graphs, coordinates, user labels, existing site IDs or extension metadata.
  for(const [id,s] of Object.entries(r.block.sites||{}))for(const k of ['id','direction','role','unconnected'])if(s[k]===undefined&&b.sites[id]?.[k]!==undefined)s[k]=copy(b.sites[id][k]);
  if(r.block.attachmentSites===undefined&&b.attachmentSites)r.block.attachmentSites=copy(Object.values(r.block.sites));
  if(canonical(Object.keys(r.block.sites||{}).sort())!==canonical(Object.keys(b.sites).sort())||!includesSnapshot(r.block,b))fail('graph / AttachmentSites mismatch');
  r.graphIdentity=identity(r.block);
  // Compare chemistry contracts, not role labels, site IDs or unknown metadata.
  // Those values belong to the saved record and must survive upgrades verbatim.
  const fields=['atom','direction','element','connection_class','compatibility_domain','unconnected','local_bonds','allowed_linkage_classes','internal_phosphorus','terminal_phosphorus'];
  const contract=s=>Object.fromEntries(fields.map(k=>[k,s[k]]));
  const sites=Object.values(b.sites),expected=Object.values(n.block.sites);
  if(sites.length!==expected.length||sites.some(s=>!expected.some(t=>includesSnapshot(contract(s),contract(t)))))fail('invalid stored attachment chemistry');
  const edges=new Set();for(const bond of g.bonds){const edge=[bond.a,bond.b].sort((a,b)=>a-b).join(':');if(edges.has(edge))fail('duplicate bond');edges.add(edge);}
  if(!Lite.connected(g))fail('disconnected assembly block');const properties=Lite.graphProperties(g);
  // Optional additive fields keep existing schema-v1 records readable.
  for(const k of ['formula','average_mw','exact_mass'])if(r[k]!==undefined&&r[k]!==properties[k])fail('stored '+k+' differs from graph');
  if(r.assembly_supported!==undefined&&r.assembly_supported!==true)fail('invalid assembly support flag');return copy(r);
 }
 function envelope(records=[],id=uuid()){return {schema:'oligo-user-chemistry-library',schemaVersion:1,libraryId:id,records};}
 function decode(data,origin='JSON'){
  if(data?.schema==='oligo-user-chemistry-library'){
   if(data.schemaVersion!==1||typeof data.libraryId!=='string'||!data.libraryId||!Array.isArray(data.records))fail('unsupported envelope/version');
   const e=copy(data);e.records=e.records.map(validate);check(e.records);return e;
  }
  fail('unsupported User Library schema/version; compatibility starts with Oligo Toolkit 2.0.0');
 }
 function check(rows){const ids=new Set(),names=new Set();for(const r of rows){const s=r.symbol.toLowerCase();if(ids.has(r.id)||names.has(s))fail('duplicate ID or symbol within library');ids.add(r.id);names.add(s);}}
 function merge(current,incoming){
  const next=copy(current),conflicts=[],duplicates=[];
  for(const r of incoming.records){const old=next.records.find(e=>e.id===r.id||e.symbol.toLowerCase()===r.symbol.toLowerCase());
   if(old){if(content(old)===content(r))duplicates.push(r.symbol);else conflicts.push({id:r.id,symbol:r.symbol,existingId:old.id,reason:old.graphIdentity===r.graphIdentity?'metadata/content differs':'graph or attachment structure differs'});}
   else next.records.push(copy(r));
  }
  return {next,conflicts,duplicates};
 }
 const amidites={
  'cEt-A':'S-cEt adenosine 3′-O-phosphoramidite',
  'cEt-G':'S-cEt guanosine 3′-O-phosphoramidite',
  'cEt-T':'S-cEt thymidine 3′-O-phosphoramidite',
  'cEt-CMe':'S-cEt 5-methylcytidine 3′-O-phosphoramidite'
 };
 function metadata(symbol,g,row){
  const type=g?.base?(g.family==='PMO'?'Morpholino monomer':'Nucleoside building block'):
   row?.terminal_syntax?'Terminal syntax':row?.not_building_block?'Notation control':g?'Building block':row?.reference_only?'Reference only':'Catalog entry';
  return {symbol,type,name:g?.name??null,family:g?.family??null,base:g?.base??null,sugar:g?.sugar??null,
   aliases:row?.names.filter(name=>name!==symbol)||[],
   structureStatus:g?'available':row?.terminal_syntax||row?.not_building_block?'not-applicable':'unresolved',
   assemblyStatus:row?.status??'available',
   amidite:g?.amidite?copy(g.amidite):amidites[symbol]?{identity:amidites[symbol],status:'literature-verified',source:'https://doi.org/10.1021/jo902560f'}:
    {identity:null,status:row?.not_building_block||row?.terminal_syntax||g?.family==='PMO'?'not-applicable':'unresolved'}};
 }
 function builtinReagents(){
  return Object.values(REACTION_REAGENTS).map(r=>{
   const sites=Reactions.v2.detect([r.graph]).candidate_sites[0];
   const compatibleFamilies=r.compatibleFamilies?[
    ...new Set([...r.compatibleFamilies,...(sites.strainedAlkyne.length?['Click']:[]),
     ...(sites.tetrazine.length||sites.strainedAlkene.length?['IEDDA']:[])])
   ]:null;
   return {...r,source:'builtin',symbol:r.name,compatibleFamilies,
   metadata:{symbol:r.name,name:r.displayName??r.name,type:'Post-modification reagent',roles:['ReactionReagent'],structureStatus:'available',
    reactionStatus:r.referenceOnly?'reference-only':r.reactionStatus??null,compatibleFamilies,
    aliases:r.aliases??[],provenance:r.provenance??r.source,
    assemblyStatus:'not-applicable',amidite:{identity:null,status:'not-applicable'}}};
  });
 }
 function builtinCatalog(){
  return Lite.builtinAudit().map(row=>{
   const g=row.assembly_ready&&!row.terminal_syntax?REFERENCE.templates[row.template_key]:null;
   const entry=COVERAGE.entries.find(e=>e.notation===row.notation);
   const fields=metadata(row.notation,g,row);
   return {...fields,family:fields.family??entry?.family??null,assemblyReady:row.assembly_ready,
    ...(row.reference_only&&entry?.schematic_reference?{schematicReference:entry.schematic_reference}:{}),
    provenance:g?.chemistry_source||row.evidence||entry?.evidence||null};
  }).concat(builtinReagents().map(r=>r.metadata));
 }
 // The reference is a projection of the same built-in catalog used by the library.
 function referenceRows(){
  const links=Lite.linkageSymbols;
  return builtinCatalog().filter(row=>row.assemblyReady||row.roles?.includes('ReactionReagent')||
   Object.hasOwn(links,row.symbol==='(none)'?'':row.symbol)).map(row=>{
    const {symbol,family,base}=row, marker=symbol==='(none)'?'':symbol;
    if(Object.hasOwn(links,marker))return {symbol,name:links[marker],type:'Backbone linkage'};
    const notation=symbol.replace(/^\{(.*)\}$/, '[$1]');
    const name=row.name||(base&&family?family+'-'+base:notation.replace(/^\[(.*)\]$/, '$1'));
    const label=family==='DNA'&&/^d[ACGT]$/.test(symbol)?symbol.slice(1)+' / '+symbol:notation;
    const type=row.type==='Building block'&&family&&family!=='Custom'?row.type+' · '+family:row.type;
    return {symbol:label,name,type};
   });
 }
 function create(storage){
  let state=envelope(),stamp=null,blocked=false,status='';
  const registry=rows=>{const t=Object.create(null);for(const r of rows){validate(r);t[r.runtime.id]=copy(r.runtime);}return t;};
  function install(rows){const t=registry(rows);for(const k of Object.keys(Lite.customLibrary))delete Lite.customLibrary[k];Object.assign(Lite.customLibrary,t);}
  function commit(next){if(blocked)fail('current library is unreadable; original storage preserved');check(next.records);registry(next.records);if(storage.getItem(KEY)!==stamp)fail('library changed in another window; reload before editing');const raw=JSON.stringify(next);
   // Snapshot the exact previous bytes before any successful replacement. Quota failure aborts the commit.
   if(stamp!==null){storage.setItem(KEY+'-backup',stamp);if(storage.getItem(KEY+'-backup')!==stamp)fail('backup verification failed');}
   storage.setItem(KEY,raw);stamp=raw;install(next.records);state=copy(next);}
  function load(){try{stamp=storage.getItem(KEY);if(stamp!==null){state=decode(JSON.parse(stamp));install(state.records);status='Restored local User Chemistry Library';}else{install([]);status='';}}catch(e){blocked=true;status='User Library unavailable: '+e.message;}}
  function ingest(data,mode='merge'){const incoming=decode(data),plan=merge(state,incoming);if(mode==='import'&&state.records.length)fail('Import requires an empty user library; use Merge');if(plan.conflicts.length)return {applied:false,conflicts:plan.conflicts,duplicates:plan.duplicates};commit(mode==='import'?incoming:plan.next);return {applied:true,conflicts:[],duplicates:plan.duplicates};}
  return {load,ingest,get blocked(){return blocked;},get status(){return status;},get state(){return copy(state);},exportJSON:()=>JSON.stringify({...copy(state),exportedAt:new Date().toISOString()},null,2),
   add(name,input){const r=normalize(name,input),result=merge(state,envelope([r]));if(result.conflicts.length)fail('symbol already exists with different content; choose a new symbol');commit(result.next);},
   remove(id){commit({...state,records:state.records.filter(r=>r.id!==id)});},
   builtinCatalog,
   reagents(source,family,starting){
    const rows=source==='builtin'?builtinReagents().filter(r=>!r.referenceOnly):
     state.records.map(r=>({id:r.id,name:r.symbol,source:'user',graph:r.runtime}));
    if(family==null)return copy(rows);
    if(family==='DisulfideReduction')return [];
    return copy(rows.filter(row=>
     (family==='Click'||family==='IEDDA'||row.compatibleFamilies==null||row.compatibleFamilies.includes(family))&&
     Reactions.v2.candidates(family,[starting,row.graph]).candidates.length));
   },
   unified(){const builtins=Object.entries(REFERENCE.templates).map(([symbol,g])=>({schemaVersion:1,id:'builtin:'+symbol,source:'builtin',symbol,name:g.name||symbol,block:Lite.core.buildingBlock(g),runtime:copy(g),provenance:{reference:g.chemistry_source||REFERENCE.source},metadata:metadata(symbol,g)}));return copy([...builtins,...builtinReagents(),...state.records]);}
  };
 }
 return {KEY,LEGACY,create,decode,normalize,validate,merge,identity,builtinCatalog,referenceRows};
})();
