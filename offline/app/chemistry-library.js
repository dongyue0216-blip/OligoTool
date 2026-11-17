'use strict';
// Local library boundary. No network, chemistry transformations or built-in writes.
const ChemistryLibrary=(()=>{
 const REAGENT_KEY='oligo-disabled-builtin-reagents-v1';
 const TOOLKIT_VERSION='2.4.3-rc3-cl2';
 const KEY='oligo-user-chemistry-library-baseline-v1',LEGACY=[];
 const copy=x=>JSON.parse(JSON.stringify(x)),fail=s=>{throw Error('LIBRARY: '+s);};
 const uuid=()=>globalThis.crypto.randomUUID();
 function canonical(x){if(Array.isArray(x))return '['+x.map(canonical).join(',')+']';if(x&&typeof x==='object')return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';return JSON.stringify(x);}
 // Exact indexed graph identity, not an isomorphism/canonical-SMILES claim.
 const identity=b=>canonical({atoms:b.graph.atoms.map(({x,y,z,...a})=>a),bonds:b.graph.bonds,sites:b.sites});
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
   provenance:previous.provenance||{createdAt:new Date().toISOString(),createdWithToolkitVersion:TOOLKIT_VERSION,originalSource:input.source||input.graph?.source||input.graph?.normalization||input.graph?.provenance||null,originalSchemaVersion:input.schema_version||input.graph?.schema_version||null}};
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
  const fields=['atom','direction','element','connection_class','compatibility_domain','unconnected','local_bonds'];
  const permissions=['allowed_linkage_classes','internal_phosphorus','terminal_phosphorus'];
  const contract=s=>Object.fromEntries(fields.map(k=>[k,s[k]]));
  const sites=Object.values(b.sites),expected=Object.values(n.block.sites);
  if(sites.length!==expected.length||sites.some(s=>!expected.some(t=>includesSnapshot(contract(s),contract(t))&&permissions.every(key=>
   s[key]==null||(Array.isArray(s[key])&&s[key].every(linkage=>t[key]?.includes(linkage)))))))fail('invalid stored attachment chemistry');
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
   const e=copy(data);e.records=e.records.map(validate);if(e.team!==undefined){
    if(!e.team||!Array.isArray(e.team.records))fail('invalid Team Library');
    e.records.push(...e.team.records.map(validate));
    if(e.team.metadata)e.metadata={...e.team.metadata,...e.metadata};
    delete e.team;
   }
   check(allRows(e));return e;
  }
  fail('unsupported User Library schema/version; compatibility starts with Oligo Toolkit 2.0.0');
 }
 function check(rows){const ids=new Set(),names=new Set();for(const r of rows){const s=r.symbol.toLowerCase();if(ids.has(r.id)||names.has(s))fail('duplicate ID or symbol within library');ids.add(r.id);names.add(s);}}
 function merge(current,incoming){
  const result=plan(current,allRows(incoming),'custom');
  const conflicts=result.preview.filter(row=>row.pending).map(({entry,matches,kind})=>({
   id:entry.id,symbol:entry.symbol,existingId:matches[0]?.old.id,reason:kind
  }));
  const duplicates=result.preview.filter(row=>row.kind==='duplicate').map(row=>row.entry.symbol);
  return {next:result.next,conflicts,duplicates};
 }
 const PACKAGE='oligo-chemistry-transfer';
 const allRows=e=>e.records;
 const reserved=s=>Lite.builtinAudit().some(r=>r.assembly_ready&&r.names.some(n=>n.toLowerCase()===s.toLowerCase()));
 const order=values=>values.map(canonical).sort();
 // Preserve supported wedge direction; atom IDs, map labels and coordinates
 // are presentation/provenance. Unknown atom/bond descriptors compare strictly.
 function graphDescriptor(r){
  const {atoms,bonds}=r.runtime;
  const labels=atoms.map(({x,y,z,id,map,h,q,iso,...atom})=>canonical({...atom,h:h??0,q:q??0,iso:iso??0}));
  const neighbors=labels.map(()=>new Map());
  for(const {a,b,s,...bond} of bonds){
   neighbors[a].set(b,canonical([bond,s??0,Boolean(s)]));
   neighbors[b].set(a,canonical([bond,s??0,false]));
  }
  const signatures=labels.map((label,i)=>canonical([label,order([...neighbors[i]].map(([j,edge])=>[labels[j],edge]))]));
  return {neighbors,signatures,key:order(signatures).join('\u001f')};
 }
 function definitionKey(r,map){
  const g=r.runtime;
  const sites=Object.entries(r.block.sites).map(([key,s])=>{
   const {atom,local_bonds,allowed_linkage_classes,internal_phosphorus,terminal_phosphorus,...fields}=s;
   const local=local_bonds?.map(b=>({...b,atom:map[b.atom]}));
   return [key,map[atom],fields,...[local,allowed_linkage_classes,internal_phosphorus,terminal_phosphorus].map(v=>v==null?null:order(v))];
  });
  return canonical({sites:order(sites),category:r.category??g.category??null,entryType:r.entryType??null,
   family:g.family??null,base:g.base??null,sugar:g.sugar??null,topology:g.topology??null,
   assemblyClass:g.assembly_class??null,phosphorusTopology:g.phosphorus_topology??null,
   optical:g.optical??null,extinction:g.extinction??null});
 }
 function compareGraph(old,incoming,left,right){
  if(left.key!==right.key)return 'different';
  const direct=left.signatures.map((_,i)=>i);
  const target=definitionKey(incoming,direct);
  const indexed=direct.every(i=>left.signatures[i]===right.signatures[i]&&
   [...left.neighbors[i]].every(([j,edge])=>right.neighbors[i].get(j)===edge));
  if(indexed&&definitionKey(old,direct)===target)return 'equal';
  if(direct.length>400)return 'uncertain';
  const bySignature=new Map();
  for(const [i,sig] of right.signatures.entries()){
   if(!bySignature.has(sig))bySignature.set(sig,[]);
   bySignature.get(sig).push(i);
  }
  const candidates=left.signatures.map(sig=>bySignature.get(sig));
  const indices=direct.slice().sort((a,b)=>candidates[a].length-candidates[b].length||left.neighbors[b].size-left.neighbors[a].size);
  const used=new Set(),map=[],assigned=[];
  let sameGraph=indexed,budget=20000;
  function match(depth){
   if(depth===indices.length){
    sameGraph=true;
    return definitionKey(old,map)===target;
   }
   const i=indices[depth];
   for(const j of candidates[i]){
    if(--budget<0)return false;
    if(used.has(j)||assigned.some(k=>left.neighbors[i].get(k)!==right.neighbors[j].get(map[k])))continue;
    map[i]=j;used.add(j);assigned.push(i);
    if(match(depth+1))return true;
    assigned.pop();used.delete(j);
   }
   return false;
  }
  if(match(0))return 'equal';
  return budget<0?'uncertain':sameGraph?'definition':'different';
 }
 function classify(existing,incoming){
  const right=graphDescriptor(incoming);
  const names=[incoming.name,incoming.symbol].map(n=>n.toLowerCase());
  return existing.flatMap(old=>{
   const collision=[old.name,old.symbol].some(n=>names.includes(n.toLowerCase()));
   const result=compareGraph(old,incoming,graphDescriptor(old),right);
   if(result==='different')return collision?[{kind:'chemical',old}]:[];
   if(result!=='equal')return [{kind:result,old}];
   return [{kind:old.name===incoming.name&&old.symbol===incoming.symbol?'duplicate':'naming',old}];
  });
 }
 function transfer(records,kind,metadata={}){
  return {schema:PACKAGE,schemaVersion:1,kind,metadata:copy(metadata),records:records.map(validate)};
 }
 function readTransfer(data){
  if(data?.schema==='oligo-user-chemistry-library'){
   const {records,metadata}=decode(data);
   return transfer(records,'library',metadata);
  }
  if(data?.schema!==PACKAGE||data.schemaVersion!==1)fail('unsupported Chemistry Library package schema/version');
  if(!['entry','library'].includes(data.kind)||!Array.isArray(data.records)||(data.kind==='entry'&&data.records.length!==1)
    ||!data.metadata||typeof data.metadata!=='object'||Array.isArray(data.metadata))fail('invalid Chemistry Library package');
  const result=copy(data);result.records=result.records.map(validate);return result;
 }
 function rename(r,label,symbol){
  if(!label.trim()||label.length>500||!Lite.validCustomSymbol(symbol))fail('invalid standard name or symbol');
  const row=copy(r);row.name=label.trim();row.symbol=symbol;row.block.id=row.runtime.id='{'+symbol+'}';
  for(const metadata of [row.runtime.metadata,row.block.metadata]){
   if(metadata?.displayName===r.name)metadata.displayName=row.name;
   if(metadata?.name===r.name)metadata.name=row.name;
  }
  if(row.runtime.name===r.name)row.runtime.name=row.name;
  return row;
 }
 function plan(current,incoming,destination,choices=[],retainedSymbol){
  if(destination!=='custom')fail('invalid library destination');
  const next=copy(current),preview=[];
  for(const [index,source] of incoming.entries()){
   const choice=choices[index];
   const entry=choice?.name!==undefined?rename(source,choice.name,choice.symbol):copy(source);
   const rows=allRows(next), matches=classify(rows,entry).map(match=>({
    ...match,scope:'custom'
   }));
   const unique=matches.length===1&&matches[0].kind==='duplicate';
   const builtin=!unique&&entry.symbol!==retainedSymbol&&reserved(entry.symbol);
   const kind=builtin?'reserved':matches.length?(unique?'duplicate':(matches.find(m=>m.kind!=='duplicate')||matches[0]).kind):'new';
   const keep=choice?.action==='keep';
   const replace=choice?.action==='replace'&&!builtin&&!unique&&matches.length===1&&
    (choice.existingId===undefined||choice.existingId===matches[0].old.id);
   const pending=!keep&&!replace&&!unique&&(builtin||matches.length>0);
   preview.push({entry,kind,pending,matches,canReplace:!builtin&&!unique&&matches.length===1,action:keep||unique?'skip':replace?'replace':pending?'review':'add'});
   if(pending||keep||unique)continue;
   if(replace){
    const old=matches[0].old;
    next.records=next.records.filter(r=>r!==old);
   }
   // Internal identifiers travel with the entry unless another row owns one.
   if(allRows(next).some(r=>r.id===entry.id)){
    const id=entry.id;let n=2;
    do{entry.id=id.slice(0,150)+'-'+n++;}while(allRows(next).some(r=>r.id===entry.id));
   }
   next.records.push(entry);
  }
  return {next,preview,pending:preview.some(row=>row.pending)};
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
   metadata:{reagentId:r.id,selectable:!r.referenceOnly,symbol:r.name,name:r.displayName??r.name,type:'Post-modification reagent',roles:['ReactionReagent'],structureStatus:'available',
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
   return {...fields,family:fields.family??entry?.family??null,assemblyReady:row.assembly_ready,templateKey:g?row.template_key:null,
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
  function commit(next){if(blocked)fail('current library is unreadable; original storage preserved');check(allRows(next));const rows=allRows(next),registered=registry(rows);if(storage.getItem(KEY)!==stamp)fail('library changed in another window; reload before editing');const raw=JSON.stringify(next);
   // Snapshot the exact previous bytes before any successful replacement. Quota failure aborts the commit.
   if(stamp!==null){storage.setItem(KEY+'-backup',stamp);if(storage.getItem(KEY+'-backup')!==stamp)fail('backup verification failed');}
   storage.setItem(KEY,raw);stamp=raw;for(const k of Object.keys(Lite.customLibrary))delete Lite.customLibrary[k];Object.assign(Lite.customLibrary,registered);state=copy(next);}
  function load(){try{stamp=storage.getItem(KEY);if(stamp!==null){state=decode(JSON.parse(stamp));install(allRows(state));status='Restored local User Chemistry Library';}else{install([]);status='';}}catch(e){blocked=true;status='User Library unavailable: '+e.message;}}
  function restoreLegacy(data){
   if(allRows(state).length)fail('legacy restore requires empty editable libraries');
   commit(decode(data));
  }
  function ingest(data,mode='merge'){
   if(mode==='import'){
    restoreLegacy(data);
    return {applied:true,conflicts:[],duplicates:[]};
   }
   const result=merge(state,decode(data));
   if(!result.conflicts.length)commit(result.next);
   return {applied:!result.conflicts.length,conflicts:result.conflicts,duplicates:result.duplicates};
  }
  function disabledReagents(){
   const ids=JSON.parse(storage.getItem(REAGENT_KEY)??'[]');
   if(!Array.isArray(ids)||ids.some(id=>typeof id!=='string'))fail('invalid reagent preferences');
   return new Set(ids);
  }
  function setReagentEnabled(id,enabled){
   if(!Object.values(REACTION_REAGENTS).some(r=>r.id===id&&!r.referenceOnly))fail('unknown or reference-only built-in reagent');
   const ids=disabledReagents();
   if(enabled)ids.delete(id);else ids.add(id);
   storage.setItem(REAGENT_KEY,JSON.stringify([...ids]));
  }
  return {load,ingest,get blocked(){return blocked;},get status(){return status;},get state(){return copy(state);},exportJSON:()=>JSON.stringify({...copy(state),exportedAt:new Date().toISOString()},null,2),
   add(name,input){const r=normalize(name,input),result=plan(state,[r],'custom');
    if(result.pending)fail('Merge review required: '+result.preview[0].kind);if(result.preview[0].action==='add')commit(result.next);
    return result.preview[0].action==='add'?r:result.preview[0].matches[0].old;
   },
   update(id,name,symbol,input,preserveGraph=false){
    const old=state.records.find(r=>r.id===id);
    if(!old)fail('entry no longer exists');
    let row=rename(old,name,symbol);
    if(input){
     const runtimeInput={...input,optical:old.runtime.optical,extinction:old.runtime.extinction};
     const updated=normalize('LibraryEdit'+uuid().replaceAll('-','').slice(0,12),runtimeInput,row);
     updated.runtime.id=row.runtime.id;
     if(preserveGraph){
      const sites=Object.create(null),used=new Set();
      for(const [key,site] of Object.entries(updated.runtime.attachments)){
       const match=Object.entries(row.runtime.attachments).find(([k,v])=>!used.has(k)&&v.direction===site.direction&&v.atom===site.atom);
       if(match){sites[match[0]]=match[1];used.add(match[0]);continue;}
       let id=key, suffix=2;
       while(site.direction==='branch'&&(Object.hasOwn(row.runtime.attachments,id)||Object.hasOwn(sites,id)))id=key+'_'+suffix++;
       sites[id]=site;
      }
      row.runtime.attachments=sites;
      row.runtime.o5=updated.runtime.o5;
      row.runtime.o3=updated.runtime.o3;
     }else{
      row.runtime=updated.runtime;
      for(const key of ['formula','average_mw','exact_mass'])row[key]=updated[key];
     }
     const block=Lite.core.buildingBlock(row.runtime);
     if(preserveGraph){
      for(const [key,site] of Object.entries(block.sites)){
       const previous=row.block.sites[key];
       if(previous?.atom===site.atom)block.sites[key]={...previous,...site};
      }
      if(block.attachmentSites)block.attachmentSites=Object.values(block.sites);
      row.block={...row.block,...block,graph:{...row.block.graph,...block.graph}};
      if(!block.attachmentSites)delete row.block.attachmentSites;
     }else row.block=block;
     row.graphIdentity=identity(row.block);
    }
    row=validate(row);
    const without={...state,records:state.records.filter(r=>r.id!==id)};
    const result=plan(without,[row],'custom',[],old.symbol);
    if(result.preview[0].kind!=='new')fail('Merge review required: '+result.preview[0].kind);
    commit({...state,records:state.records.map(r=>r.id===id?row:r)});
    return row;
   },
   restoreLegacy,
   preview:(records,destination,choices)=>plan(state,records,destination,choices).preview,
   apply(records,destination,choices,metadata){
    const result=plan(state,records.map(validate),destination,choices);
    if(result.pending)fail('unresolved merge conflicts');
    if(metadata!==undefined)result.next.metadata={...result.next.metadata,...copy(metadata)};
    commit(result.next);return result.preview;
   },
   remove(id){commit({...state,records:state.records.filter(r=>r.id!==id)});},
   builtinCatalog,disabledReagents,setReagentEnabled,
   reagents(source,family,starting){
    const disabled=source==='builtin'?disabledReagents():null;
    const rows=source==='builtin'?builtinReagents().filter(r=>!r.referenceOnly&&!disabled.has(r.id)):
     allRows(state).map(r=>({id:r.id,name:r.symbol,source:'user',graph:r.runtime}));
    if(family==null)return copy(rows);
    if(family==='DisulfideReduction')return [];
    return copy(rows.filter(row=>
     (family==='Click'||family==='IEDDA'||row.compatibleFamilies==null||row.compatibleFamilies.includes(family))&&
     Reactions.v2.candidates(family,[starting,row.graph]).candidates.length));
   },
   unified(){const builtins=Object.entries(REFERENCE.templates).map(([symbol,g])=>({schemaVersion:1,id:'builtin:'+symbol,source:'builtin',symbol,name:g.name||symbol,block:Lite.core.buildingBlock(g),runtime:copy(g),provenance:{reference:g.chemistry_source||REFERENCE.source},metadata:metadata(symbol,g)}));return copy([...builtins,...builtinReagents(),...allRows(state)]);}
  };
 }
 return {transfer,readTransfer,KEY,REAGENT_KEY,LEGACY,create,decode,normalize,validate,merge,identity,builtinCatalog,referenceRows};
})();
