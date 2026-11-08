'use strict';
const Optical = (() => {
 const {nucleosideSource,modifiedMonomers}=BuiltinChemistry.opticalBases;
 const {negligible:negligibleIds,pack}=BuiltinChemistry.opticalCorrections;
 const negligible=new Set(negligibleIds);
 const attachmentParameters=BuiltinChemistry.opticalAttachments;
 const tiers=['validated','literature_approx','heuristic','unsupported'];
 const chemicalIdentity = graph => JSON.stringify([
  graph.atoms.map(({x,y,z,...atom})=>atom), graph.bonds
 ]);
 const graphDigest = graph => {
  let hash=2166136261;
  for(const character of chemicalIdentity(graph))hash=Math.imul(hash^character.charCodeAt(0),16777619);
  return (hash>>>0).toString(16).padStart(8,'0');
 };
 function builtin(block){
  const raw=REFERENCE.templates[block.id];
  if(!raw)return false;
  const expected=ChemistryCore.buildingBlock({...raw,id:block.id});
  return ["family","base","topology"].every(key=>expected.metadata[key]===block.metadata[key])&&
   JSON.stringify(expected.sites)===JSON.stringify(block.sites)&&
   chemicalIdentity(expected.graph)===chemicalIdentity(block.graph);
 }
 function endPS(edgeIndex,edgeCount){
  return edgeCount>=16 && (edgeIndex<2 || edgeIndex>=edgeCount-2);
 }
 function assembly(snapshot){
  const graph=snapshot.graph, ag=snapshot.assemblyGraph||snapshot.assembly_graph;
  if(!graph || !ag || snapshot.materialization?.status==='provenance-only')return null;
  if(!ag.lanes){
   try{if(chemicalIdentity(Lite.expandAssemblyGraph(ag))!==chemicalIdentity(graph))return null;}catch{return null;}
   return {graph,assembly:ag,laneId:'main'};
  }
  if(ag.lanes.length!==1||ag.branchEdges?.length||ag.covalentEdges?.length||snapshot.components?.length>1)return null;
  const lane=ag.lanes[0];
  if(!lane.assembly||lane.atomIndices.length!==graph.atoms.length||lane.atomIndices.some((id,i)=>id!==i))return null;
  try{if(chemicalIdentity(Lite.expandAssemblyGraph(lane.assembly))!==chemicalIdentity(graph))return null;}catch{return null;}
  return {graph,assembly:lane.assembly,laneId:lane.id};
 }
 function analyze(snapshot, parameters=pack, overrides=[]){
  const lane=assembly(snapshot), graph=snapshot.graph;
  const graphKey=graph?chemicalIdentity(graph):null;
  const reference={stateId:snapshot.id??null,graphRevision:snapshot.graphRevision??null,
   graphDigest:graph?graphDigest(graph):null,laneId:lane?.laneId??null};
  const properties=graph?Lite.graphProperties(graph):{};
  const mw=properties.average_mw??null;
  const ledger=[], missing=[], assumptions=[], diagnostics=new Set();
  let tier=0, method='Single-strand nearest neighbor', basis='model', sourceRefs=[pack.source];
  const add=(kind,ref,value,source=pack.id,conditions=pack.conditions)=>ledger.push({kind,ref,value,unit:'M⁻¹ cm⁻¹',source,conditions});
  function exclude(ref,code,detail){missing.push({ref,code,detail});add('excluded',ref,null);}
  function assume(ref,code,detail){
   assumptions.push({ref,code,detail});diagnostics.add(code);tier=Math.max(tier,2);
  }
  function result(){
   const modeled=ledger.reduce((sum,term)=>sum+(term.value??0),0);
   if(!Number.isFinite(mw)||mw<=0)exclude(reference,'INVALID_GRAPH_MW','The current molecular graph has no positive average molecular weight');
   if(!missing.length&&(!Number.isFinite(modeled)||modeled<=0))
    exclude(reference,'NO_POSITIVE_EPSILON260','No positive modeled 260 nm absorption for this molecule');
   const epsilon=missing.length?null:modeled;
   const mass=epsilon===null?null:1000*mw/epsilon;
   const evidence={tier:epsilon===null?'unsupported':tiers[tier],basis:epsilon===null?'none':basis,
    modelId:'single-strand-optical',modelVersion:'3',parameterSetId:pack.id,parameterSetHash:pack.hash,
    sourceRefs:[...new Set(sourceRefs)],conditions:pack.conditions,
    assumptions:['Separated single strand; no folding or dye coupling model',...new Set(assumptions.map(x=>x.detail))],
    coverage:{terms:ledger.length,unresolved:missing.length,approximations:assumptions.length},
    limitations:[pack.rightsStatus],reasonCodes:[...new Set([...missing.map(x=>x.code),...diagnostics])]};
   return {schema:'OpticalResult/2',snapshot:reference,molecularForm:properties.formal_charge?'Explicit graph charge; no counterions':'Graph free acid; no counterions',
    averageMW_g_mol:mw,epsilon260_M_inv_cm_inv:epsilon,nmolPerOD260:epsilon?1e6/epsilon:null,
    ugPerOD260:mass,completeness:missing.length?'partial':'complete',
    contributionLedger:ledger,assumptionLedger:assumptions,massBasis:{kind:'wholeGraphAverageMW',value:mw,unit:'g/mol'},missing,evidence,
    supported:epsilon!==null,status:epsilon===null?'NEEDS_PARAMETER':tiers[tier],estimated:tier>0,
    epsilon260:epsilon,nmol_per_od:epsilon?1e6/epsilon:null,ug_per_od:mass,
    partialEpsilon:missing.length&&modeled>0?modeled:null,method,reason:missing.length?missing.map(m=>m.detail).join('; '):null};
  }
  const supplied=Array.isArray(overrides)?overrides:[overrides];
  const normalized=supplied.map(item=>{
   const {kind,value,unit,source,conditions,wavelength,identity,nodeId,measured}=item||{};
   const factor={'M^-1 cm^-1':1,'mM^-1 cm^-1':1000}[unit];
   return ['wholeMolecule','fullUnit','deltaToParent'].includes(kind)&&graphKey!==null&&identity===graphKey&&
    wavelength===260&&factor&&Number.isFinite(value*factor)&&Number.isFinite(value)&&(kind==='deltaToParent'||value>=0)&&
    typeof source==='string'&&source.trim()&&typeof conditions==='string'&&conditions.trim()?
    {kind,value:value*factor,source,conditions,nodeId,measured:measured===true}:null;
  });
  if(normalized.includes(null)){
   exclude(reference,'INVALID_OPTICAL_OVERRIDE','Override requires exact graph identity, 260 nm, units, source and conditions');return result();
  }
  const whole=normalized.find(x=>x.kind==='wholeMolecule');
  if(whole){
   if(normalized.length!==1){exclude(reference,'AMBIGUOUS_OPTICAL_OVERRIDE','Whole-molecule override conflicts with another contribution');return result();}
   tier=whole.measured?0:2; basis=whole.measured?'measured':'user_input'; method='Whole molecule';
   sourceRefs=[whole.source];add('wholeMolecule',reference,whole.value,whole.source,whole.conditions);return result();
  }
  if(parameters?.id!==pack.id||parameters?.hash!==pack.hash){
   exclude(reference,'UNKNOWN_PARAMETER_SET','The selected 260 nm parameter set is unavailable');return result();
  }
  if(!lane){
   exclude(reference,'UNMAPPED_PRODUCT_REGION','No verified optical unit mapping for the current molecular graph');return result();
  }
  const {nodes,edges,terminations}=lane.assembly;
  const ids=new Set(nodes.map(n=>n.id));
  const local=new Map();
  for(const item of normalized){
   if(!ids.has(item.nodeId)||local.has(item.nodeId)){exclude(reference,'AMBIGUOUS_OPTICAL_OVERRIDE','Unresolved or conflicting node override');return result();}
   local.set(item.nodeId,item);sourceRefs.push(item.source);tier=2;
  }
  method='Monomer contributions with local nearest-neighbor corrections';
  const profile=nodes.map(({id,block},index)=>{
   const ref={...reference,nodeId:id,index5p:index+1,blockId:block.id};
   const override=local.get(id);
   if(override?.kind==='fullUnit'){
    assume(ref,'USER_UNIT_OVERRIDE',block.id+' uses a supplied full-unit ε260; adjacent stacking is omitted');
    add('fullUnit',ref,override.value,override.source,override.conditions);
    return null;
   }
   const {base,family}=block.metadata;
   const frozen=builtin(block);
   const metadata=frozen?REFERENCE.templates[block.id].optical:null;
   const parameter=frozen?attachmentParameters[block.id]:null;
   const start=ledger.length;
   let entry=null;
   if(parameter){
    sourceRefs.push(parameter.source);
    assume(ref,'ADDITIVE_CHROMOPHORE',block.id+' uses a published dye ε260; dye–strand coupling is omitted');
    add('chromophore',ref,parameter.value,parameter.source,'Vendor additive 260 nm coefficient');
   }else if(frozen&&(metadata?.mode==='zero'||negligible.has(block.id))){
    assume(ref,'REVIEWED_NEGLIGIBLE',block.id+' has negligible modeled 260 nm absorption, with MW included');
    add('mwOnly',ref,0,metadata?.source||'local-structure-audit');
   }else if(frozen&&Object.hasOwn(modifiedMonomers,base)&&!(family==='DNA'&&base==='T')){
    sourceRefs.push(nucleosideSource);
    assume(ref,'MODIFIED_BASE_MONOMER',block.id+' uses the published RNA nucleoside ε260; its adjacent stacking is omitted');
    add('modifiedMonomer',ref,modifiedMonomers[base],nucleosideSource,'RNA nucleoside measurement at pH 3.5');
   }else{
    const material=family==='DNA'||base==='T'?'dna':'rna';
    const mono=REFERENCE[material+'Mono'];
    if(frozen&&Object.hasOwn(mono,base)){
     const inherited=family!=='DNA'&&family!=='RNA';
     if(inherited)assume(ref,'PARENT_CHROMOPHORE_INHERITANCE',family+' uses parent '+material.toUpperCase()+' monomer and available stacking parameters');
     add(inherited?'parentMonomer':'monomer',ref,mono[base]);
     entry={ref,base,material,mono:mono[base]};
    }else{
     assume(ref,base?'UNKNOWN_BASE_ZERO':'UNKNOWN_MODIFIER_ZERO',block.id+' ε260 unavailable; optical contribution treated as 0, with MW included');
     add('mwOnly',ref,0,'unparameterized fallback');
    }
   }
   if(override){
    if(ledger[start].kind==='mwOnly'){
     exclude(ref,'MISSING_OVERRIDE_PARENT','A delta override requires a modeled parent contribution for '+block.id);
    }else add('delta',ref,override.value,override.source,override.conditions);
   }
   return entry;
  });
  const profiles=new Map(profile.filter(Boolean).map(p=>[p.ref.nodeId,p]));
  function linkage(ref,name){
   if(name==='PO')return;
   assume(ref,'PO_LINKAGE_INHERITANCE',name+' optical correction unavailable; treated as PO');
   add('poInheritance',ref,0,'PO fallback');
  }
  for(const [i,edge] of edges.entries()){
   const ref={...reference,edgeId:edge.id,index5p:i+1};
   linkage(ref,edge.linkage);
   const a=profiles.get(edge.source.node),b=profiles.get(edge.target.node);
   if(!a||!b)continue;
   const forward=edge.source.site==='downstream'&&edge.target.site==='upstream';
   const dimer=forward&&a.material===b.material?REFERENCE[a.material+'NN'][a.base+b.base]:null;
   if(!Number.isFinite(dimer)){
    assume(ref,'STACK_OMITTED',forward?'Mixed DNA/RNA parent junction has no matching stacking parameters; stacking omitted':'Nonstandard junction direction; stacking omitted');
    add('unmodeledStack',ref,0,'no matching NN parameter');
    continue;
   }
   add('stack',ref,dimer-a.mono-b.mono);
  }
  for(const termination of terminations||[]){
   if(termination.kind!=='linkage')continue;
   for(const name of termination.linkages)linkage({...reference,terminationId:termination.id},name);
  }
  if(tier>0)basis=normalized.length?'user_input':'estimated';
  return result();
 }
 function convert({absorbance,pathLengthCm,dilutionFactor=1,volumeMl=1,epsilon,averageMW}){
  if(![absorbance,pathLengthCm,dilutionFactor,volumeMl,epsilon].every(Number.isFinite)||
   absorbance<0||pathLengthCm<=0||dilutionFactor<1||volumeMl<0||epsilon<=0||
   (averageMW!=null&&(!Number.isFinite(averageMW)||averageMW<=0)))throw Error('Invalid photometry inputs');
  const concentrationUM=1e6*absorbance*dilutionFactor/(epsilon*pathLengthCm);
  const concentrationUgMl=averageMW==null?null:concentrationUM*averageMW/1000;
  return {concentrationUM,concentrationUgMl,totalNmol:concentrationUM*volumeMl,
   totalUg:concentrationUgMl===null?null:concentrationUgMl*volumeMl,totalOD260:absorbance*dilutionFactor*volumeMl/pathLengthCm};
 }
 return {analyze,convert,pack,chemicalIdentity,graphDigest,builtin,assembly,endPS,reviewedNegligible:block=>builtin(block)&&negligible.has(block.id)};
})();




