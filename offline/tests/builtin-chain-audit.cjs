'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict');
const root=path.resolve(process.argv[2]||path.join(__dirname,'..'));
const ctx=vm.createContext({crypto:require('node:crypto').webcrypto,
 ieddaFixture:fs.readFileSync(path.join(root,'tests/fixtures/iedda-tetrazine.mol'),'utf8')});
const html=fs.readFileSync(path.join(root,'Start.html'),'utf8');
const files=[...html.matchAll(/<script src="([^"]+)"/g)].map(m=>m[1]);
const modules=/\/(?:registry\.generated|chemistry-registry|core|chemistry|reactions|presentation|engine|snapshot-data|adapters|validation|molecule-builder|chemistry-library)\.js$/;
for(const file of files.filter(f=>modules.test(f)))vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file});
const result=vm.runInContext('('+function(){
 const L=Lite,M=MoleculeBuilder;
 const require=(ok,message)=>{if(!ok)throw Error(message);};
 const capture=fn=>{try{return {ok:true,result:fn()};}catch(e){return {ok:false,error:e.message};}};
 const notation=s=>s.replace(/^\{(.*)\}$/,'[$1]');
 const signature=g=>JSON.stringify([g.atoms.map(a=>[a.e,a.h||0,a.q||0,a.iso||0]),g.bonds.map(b=>[b.a,b.b,b.o,b.s||0])]);
 const same=(a,b)=>require(signature(a)===signature(b),'atom, bond or stereo round trip differs');
 function checkGraph(g){
  L.core.molecularGraph(g);require(L.connected(g),'disconnected graph');
  const edges=new Set();
  for(const b of g.bonds){const key=[b.a,b.b].sort().join(':');require(!edges.has(key),'duplicate bond');edges.add(key);}
  for(const [i,a] of g.atoms.entries()){
   const v=g.bonds.reduce((sum,b)=>sum+(b.a===i||b.b===i?b.o:0),0);
   require(L.valenceTarget(a,v)===v+(a.h||0),'invalid valence at '+i);
  }
  return {atoms:g.atoms.length,bonds:g.bonds.length};
 }
 function stages(state){
  const g=state.graph,record=capture(()=>Sandbox.record(g,{assemblyGraph:state.assemblyGraph}));
  const depiction=capture(()=>{require(record.ok,record.error);return Sandbox.C.present(record.result,false);});
  const drawing=depiction.ok?depiction.result.drawing:g;
  return {
   graph:capture(()=>checkGraph(g)),
   metrics:capture(()=>{const p=L.graphProperties(g);for(const k of ['exact_mass','average_mw'])require(Number.isFinite(p[k]),k);return p;}),
   viewer:capture(()=>{require(depiction.ok,depiction.error);const p=depiction.result;require(/^<svg\b/.test(p.svg)&&!/\b(?:NaN|Infinity)\b/.test(p.svg),'invalid chemical SVG');same(g,p.drawing);return p.status;}),
   mol:capture(()=>same(g,L.parseMol(L.mol(drawing),{manualMarkers:true}).graph)),
   sdf:capture(()=>same(g,L.parseMol(L.mol(drawing)+'$$$$\n',{manualMarkers:true}).graph)),
   cdxml:capture(()=>{
    const xml=L.cdxml(drawing),atoms=[...xml.matchAll(/<n id="(\d+)" p="[^"]+" Element="(\d+)" NumHydrogens="(\d+)"(?: Charge="(-?\d+)")?\/>/g)];
    const bonds=[...xml.matchAll(/<b id="\d+" B="(\d+)" E="(\d+)" Order="(\d+)"(?: Display="([^"]+)")?\/>/g)];
    const elements={H:1,C:6,N:7,O:8,F:9,P:15,S:16,Cl:17,Br:35,I:53};
    require(atoms.length===g.atoms.length&&bonds.length===g.bonds.length,'CDXML atom/bond count or element mismatch');
    require(atoms.every((a,i)=>+a[1]===i+10&&+a[2]===elements[g.atoms[i].e]&&+a[3]===(g.atoms[i].h||0)&&+(a[4]||0)===(g.atoms[i].q||0)),'CDXML atom data mismatch');
    require(bonds.every((b,i)=>{const e=g.bonds[i];return +b[1]===e.a+10&&+b[2]===e.b+10&&+b[3]===e.o&&b[4]===(e.s===1?'WedgeBegin':e.s===6?'WedgedHashBegin':undefined); }),'CDXML bond data mismatch');
   }),
   json:capture(()=>same(g,M.restore(M.exportJSON(state)).graph))
  };
 }
 const rows=L.builtinAudit().map(row=>{
  const entry=COVERAGE.entries.find(e=>e.notation===notation(row.notation));
  const seq=notation(row.notation);
  const code=Object.keys(REFERENCE.templates).find(k=>notation(k).toLowerCase()===seq.toLowerCase());
  const raw=REFERENCE.templates[code];
  const details={...row,coverage:entry};
  if(row.not_building_block||row.terminal_syntax){details.control=capture(()=>{const s=row.terminal_syntax?seq+'rA':'rA'+(seq==='(none)'?'':seq)+'rA';return stages(M.start(s));});return details;}
  if(raw){
   details.rawGraph=capture(()=>checkGraph(raw));
   details.raw=capture(()=>stages(M.fromGraph(raw)));
   details.attachmentSites=capture(()=>L.core.buildingBlock(raw).sites);
  }
  const single=capture(()=>M.start(seq));
  details.assembly=single.ok?{ok:true}:single;
  if(!single.ok)return details;
  details.single=stages(single.result);
  const sites=single.result.attachmentSites;
  const partner=sites.some(s=>s.allowed_linkage_classes.includes('PMO'))?'pA':'rA';
  const symbol=id=>Object.keys(L.linkageSymbols).find(k=>L.linkageSymbols[k]===id)??'';
  details.roles=sites.flatMap(site=>{
   const id=site.direction;
   if(id==='branch')return site.internal_phosphorus.map(linkage=>({site:site.id,role:id,linkage,...capture(()=>stages(M.branch(single.result,{siteId:site.id,sequence:partner,linkage})))}));
   if(!['upstream','downstream'].includes(id))return [{site:site.id,role:id}];
   const internal=site.internal_phosphorus.map(linkage=>{
    const s=id==='upstream'?partner+symbol(linkage)+seq:seq+symbol(linkage)+partner;
    return {site:site.id,role:id,linkage,sequence:s,...capture(()=>{
     const state=M.start(s),edge=state.assemblyGraph.lanes[0].assembly.edges[0];
     require(edge.linkage===linkage,'wrong linkage '+edge.linkage);
     require(edge[id==='upstream'?'target':'source'].site===site.id.split('/').at(-1),'wrong site');
     return stages(state);
    })};
   });
   const terminal=site.terminal_phosphorus.map(linkage=>{
    const s=id==='upstream'?'(p)'+symbol(linkage)+seq:seq+symbol(linkage)+'(p)';
    return {site:site.id,role:id,position:'terminal',linkage,sequence:s,...capture(()=>{
     const state=M.start(s);
     const cap=state.assemblyGraph.lanes[0].assembly.terminations.find(t=>t.kind==='linkage');
     require(cap?.at.site===site.id.split('/').at(-1)&&cap.linkages[0]===linkage,'wrong terminal site or linkage');
     return stages(state);
    })};
   });
   return [...internal,...terminal];
  });
  return details;
 });
 const fixtures={
  Condensation:[L.calculate('[C6N]rA').graph,REACTION_REAGENTS.ester.graph],
  Click:[REACTION_REAGENTS.azide.graph,REACTION_REAGENTS.alkyne.graph],
  IEDDA:[L.parseMol(ieddaFixture,{manualMarkers:true}).graph],
  ThiolMaleimide:[L.parseSmiles('CCS').graph,REACTION_REAGENTS.maleimide.graph],
  CAP:[L.calculate('(p)rA').graph]
 };
 const reagents=Object.entries(REACTION_REAGENTS).map(([id,r])=>{
  const reactions=[];
  for(const [family,partners] of Object.entries(fixtures))for(const [index,partner] of partners.entries()){
   const inputs=[partner,r.graph],list=Reactions.v2.candidates(family,inputs).candidates;
   if(!list.length)continue;
   reactions.push({family,index,candidates:list.length,...capture(()=>{
    const product=Reactions.v2.transform(family,inputs,list[0].candidate_id);
    require(product.product_graph,product.detail||product.reason||'no reaction product');
    return stages(M.fromGraph(product.product_graph));
   })});
  }
  return {id,name:r.name,declaredFamilies:r.compatibleFamilies??null,status:r.referenceOnly?'reference-only':r.reactionStatus??'reference-graph',
   stages:stages(M.fromGraph(r.graph)),reactions,detected:capture(()=>Object.fromEntries(Object.entries(Reactions.v2.detect([r.graph]).candidate_sites[0]).map(([k,v])=>[k,v.length])))};
 });
 const exact={catalog:ChemistryLibrary.builtinCatalog().filter(r=>r.symbol==='{absic}'),
  sequence:['absic','[absic]','rA[absic]rA','[abasic]'].map(s=>({input:s,errors:L.calculateSafe(s).errors}))};
 return {rows,reagents,exact};
}.toString()+')()',ctx);
assert(result.rows.length>100);
const spacer=result.rows.find(row=>row.template_key==='{absic}');
assert(spacer.assembly_ready&&spacer.rawGraph.ok&&spacer.attachmentSites.ok&&spacer.assembly.ok);
for(const stages of [spacer.raw.result,spacer.single,...spacer.roles.map(role=>role.result)]){
 assert(stages&&Object.values(stages).every(stage=>stage.ok));
}
fs.writeFileSync(process.argv[3]||'builtin-audit.json',JSON.stringify(result,null,2)+'\n');
console.log(result.rows.length+' sequence catalog rows, '+result.reagents.length+' reaction reagent rows');


