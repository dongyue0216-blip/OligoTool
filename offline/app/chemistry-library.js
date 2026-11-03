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
  const g=r.runtime,attachments={5:g.attachments?.upstream?.atom,3:g.attachments?.downstream?.atom};
  if(g.id!=='{'+r.symbol+'}'||r.block.id!==g.id)fail('symbol / block ID mismatch');
  // Validate with the existing chemistry contract in an isolated registry.
  Lite.core.molecularGraph(g);
  const n=normalize(r.symbol,{graph:g,attachments,optical:g.optical,extinction:g.extinction},r);
  const b=Lite.core.buildingBlock(g);if(canonical(b)!==canonical(r.block)||identity(b)!==r.graphIdentity||identity(n.block)!==identity(b))fail('graph / AttachmentSites mismatch');
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
   unified(){const builtins=Object.entries(REFERENCE.templates).map(([symbol,g])=>({schemaVersion:1,id:'builtin:'+symbol,source:'builtin',symbol,name:g.name||symbol,block:Lite.core.buildingBlock(g),runtime:copy(g),provenance:{reference:REFERENCE.source}}));return copy([...builtins,...state.records]);}
  };
 }
 return {KEY,LEGACY,create,decode,normalize,validate,merge,identity};
})();
