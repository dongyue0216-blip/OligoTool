'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ctx=vm.createContext({crypto:require('node:crypto').webcrypto});
const root=path.join(__dirname,'../app');
for(const f of ['reference-data','coverage-data','core','chemistry','reaction-reagents','reactions'])
 vm.runInContext(fs.readFileSync(path.join(root,'snapshots/A/app',f+'.js'),'utf8'),ctx);
for(const f of ['branch-builtins','chemistry-library','molecule-builder','structure-presentation'])
 vm.runInContext(fs.readFileSync(path.join(root,f+'.js'),'utf8'),ctx);
const get=code=>vm.runInContext(code,ctx),L=get('Lite'),R=get('Reactions'),V=R.v2,M=get('MoleculeBuilder');
const P=get('StructurePresentation');
const refs=get('REACTION_REAGENTS'),entry=id=>refs['builtin:linker1:'+id].graph;
const load=name=>V.parseReagent(fs.readFileSync(path.join(__dirname,'fixtures/iedda-'+name+'.mol'),'utf8'),'IEDDA');
const t=load('tetrazine'),n=load('norbornene'),tco=entry('tco'),azide=refs.azide.graph;
const serialize=x=>JSON.stringify(x);
const signature=g=>serialize([g.atoms.map(a=>[a.e,a.h,a.q||0]),g.bonds.map(b=>[b.a,b.b,b.o,b.s||0])]);
const exportsToCheck=[];
function checkProduct(result,ring,elements,orders,nitrogenLoss){
 const g=result.product_graph;
 assert(g,result.detail||result.reason);
 assert(L.connected(g));
 R.validate(g);
 assert.equal(ring.map(i=>g.atoms[i].e).join(''),elements);
 assert.equal(ring.map((a,i)=>{
  const z=ring[(i+1)%ring.length];
  return g.bonds.find(b=>b.a===a&&b.b===z||b.a===z&&b.b===a)?.o;
 }).join(''),orders);
 assert(ring.every(i=>!g.atoms[i].q));
 const inputProps=result.step.inputs.map(L.graphProperties),sum=k=>inputProps.reduce((s,p)=>s+p[k],0);
 const formula={};
 for(const p of inputProps)for(const [e,count]of Object.entries(p.formula_dict))formula[e]=(formula[e]||0)+count;
 formula.N-=nitrogenLoss;
 if(!formula.N)delete formula.N;
 assert.equal(serialize(result.properties),serialize(L.graphProperties(g)));
 assert.deepEqual({...result.properties.formula_dict},formula);
 assert.equal(result.properties.formal_charge,sum('formal_charge'));
 assert(Math.abs(result.properties.average_mw-(sum('average_mw')-nitrogenLoss*14.007))<0.003);
 assert(Math.abs(result.properties.exact_mass-(sum('exact_mass')-nitrogenLoss*14.00307400443))<0.000003);
 assert.equal(result.mapping.flat().length,result.step.inputs.reduce((count,input)=>count+input.atoms.length,0));
 const mapped=result.mapping.flat().filter(a=>a.status==='retained');
 assert.equal(new Set(mapped.map(a=>a.product_index)).size,g.atoms.length);
 assert.equal(result.mapping.flat().filter(a=>a.product_index===null).length,nitrogenLoss);
 const mol=L.mol(g),cdxml=L.cdxml(g);
 for(const text of [mol,mol+'\n$$$$\n'])assert.equal(signature(V.parseReagent(text,'IEDDA')),signature(g));
 assert.equal([...cdxml.matchAll(/<n id=/g)].length,g.atoms.length);
 const xmlBonds=[...cdxml.matchAll(/<b id="\d+" B="(\d+)" E="(\d+)" Order="(\d+)"/g)]
  .map(([,a,b,order])=>[Number(a)-10,Number(b)-10,Number(order)]);
 assert.deepEqual(xmlBonds,Array.from(g.bonds,b=>[b.a,b.b,b.o]));
 assert.equal(signature(JSON.parse(serialize(g))),signature(g));
 exportsToCheck.push({mol,cdxml,formula:result.properties.formula});
}
function checkPresentation(graph,ring,kind){
 const before=serialize(graph),record={graph};
 const products=P.reactionProducts(record);
 assert.equal(products.length,1);
 const [product]=products;
 assert.equal(product.kind,kind);
 assert.equal(serialize(product.ring),serialize(ring));
 const expected=Array.from(graph.bonds).flatMap(({a,b},bond)=>
  ring.includes(a)===ring.includes(b)?[]:[ring.includes(a)?[a,b,bond]:[b,a,bond]]);
 assert(new Set(product.attachments.map(a=>a.group.id)).size>=2);
 for(const view of [P.schematic(record),P.reactionDiagram(record,products,true)]){
  assert(view.supported);
  assert.match(view.svg,new RegExp('data-reaction-ring="'+kind+'"'));
  assert.deepEqual([...view.svg.matchAll(/data-product-atom="(\d+)"/g)].map(m=>Number(m[1])),Array.from(ring));
  const references=[...view.svg.matchAll(/data-attachment-atom="(\d+)" data-external-atom="(\d+)" data-attachment-bond="(\d+)"/g)]
   .map(m=>m.slice(1).map(Number));
  assert.deepEqual(references.sort(),expected.sort());
  assert.deepEqual([...view.svg.matchAll(/data-product-bond="(\d+)" data-order="(\d+)"/g)]
   .map(([,b,o])=>[Number(b),Number(o)]),Array.from(product.bonds,b=>[b,graph.bonds[b].o]));
 }
 assert.equal(serialize(graph),before);
 assert.equal(P.reactionProducts({graph:{...graph,provenance:null}}).length,0);
 const cut=JSON.parse(before),edge=product.bonds[0];
 cut.bonds.splice(edge,1);cut.provenance.bonds.splice(edge,1);
 assert.equal(P.reactionProducts({graph:cut}).length,0);
}
function perform(family,inputs,orientation='a'){
 const before=serialize(inputs);
 const selected=V.candidates(family,inputs).candidates.find(c=>c.orientation===orientation);
 assert(selected,family);
 const result=V.transform(family,inputs,selected.candidate_id);
 assert.equal(serialize(inputs),before);
 assert(result.product_graph,result.detail||result.reason);
 return result;
}
for(const [id,motif]of [['coct','cOct'],['bcn','BCN'],['dbco','DBCO']]){
 const partner=entry(id),input=[azide,partner];
 assert.equal(V.candidates('Click',input).candidates.length,2);
 const matches=V.findCompatibleReactionPlans(...input);
 assert.equal(matches.plans.length,2);
 assert.equal(new Set(matches.plans.map(p=>p.site_pair_id)).size,1);
 assert(matches.plans.every(p=>p.definition_id==='spaac/2'&&p.definition_version===2&&p.materialization_eligible));
 assert.equal(serialize(matches),serialize(V.findCompatibleReactionPlans(...input)));
 for(const orientation of ['a','b']){
  const r=perform('Click',input,orientation),[az,alkyne]=r.candidate.sites;
  assert.equal(alkyne.motif_type,motif);
  const [azMap,alkMap]=r.product_graph.provenance.input_atom_maps;
  const {proximal,middle,distal}=az.atoms,{terminal,internal}=alkyne.atoms;
  const ring=[azMap[proximal],azMap[middle],azMap[distal],alkMap[orientation==='a'?internal:terminal],alkMap[orientation==='a'?terminal:internal]];
  checkProduct(r,ring,'NNNCC','12121',0);
  checkPresentation(r.product_graph,ring,'triazole');
  if(id==='coct')assert.equal(serialize(r.product_graph.provenance.reaction_products[0].ring),serialize(ring));
 }
}
assert(V.candidates('Click',[azide,L.parseSmiles('CC#C').graph]).candidates.every(c=>c.transformation_id==='cuaac-1,4/2'));
for(const [partner,motif]of [[tco,'TCO'],[n,'norbornene']])for(const inputs of [[t,partner],[partner,t]]){
 const r=perform('IEDDA',inputs),g=r.product_graph,p=g.provenance;
 assert(r.motif_types.includes(motif));
 checkProduct(r,p.reaction_products[0].ring,'CNNCCC','212111',2);
 checkPresentation(g,p.reaction_products[0].ring,'tetrazine_ligation');
 assert.equal(p.removed_atoms.length,2);
 assert.equal(p.removed_bonds.length,3);
 assert.equal(p.bonds.filter(b=>b.kind==='reaction').length,2);
 const k=r.candidate.roles.indexOf('tetrazine'),{lost1,lost2}=r.candidate.sites[k].atoms;
 assert.equal(p.input_atom_maps[k][lost1],null);
 assert.equal(p.input_atom_maps[k][lost2],null);
 assert.equal(p.reaction_products[0].byproduct,'N2');
 assert.equal(serialize(V.reload(V.append(V.workflow(inputs[0]),'IEDDA',inputs[1])).current),serialize(g));
}
for(const [a,b]of [[t,L.parseSmiles('CC=CC').graph],[t,load('cis-cyclooctene')],[load('pyridazine'),tco],[azide,tco],[t,entry('coct')],[t,t],[n,tco]]){
 assert.equal(V.candidates('IEDDA',[a,b]).status,'UNSUPPORTED');
 assert.equal(V.transform('IEDDA',[a,b]).product_graph,null);
}
const store=get('ChemistryLibrary').create({getItem:()=>null,setItem:()=>{}});
store.load();
const tOH=t.atoms.findIndex(a=>a.e==='O'&&a.h===1);
store.add('TetProbe',L.selectAttachments({graph:t},tOH,null));
assert(store.reagents('user','IEDDA',tco).some(r=>r.name==='TetProbe'));
assert(store.reagents('builtin','IEDDA',t).some(r=>r.name==='TCO'));
assert(!store.reagents('builtin','IEDDA',t).some(r=>r.name==='cOct'));
const state=M.start('rA[TetProbe]'),product=M.react(state,{family:'IEDDA',secondary:tco});
assert.equal(product.operation.graphEdits.removedAtoms.length,2);
assert(state.attachmentSites.length);
for(const site of product.operation.siteRemapping){
 assert.equal(site.afterAtom,product.operation.inputAtomMaps[0][site.beforeAtom]);
 assert.equal(product.graph.atoms[site.afterAtom].e,state.graph.atoms[site.beforeAtom].e);
}
assert.equal(product.operation.graphEdits.newBonds.length,2);
assert.equal(product.operation.graphEdits.newAtoms.length,0);
const spaac=M.react(M.fromGraph(azide),{family:'Click',secondary:entry('bcn'),
 candidateId:V.candidates('Click',[azide,entry('bcn')]).candidates[0].candidate_id});
assert.equal(spaac.operation.graphEdits.newBonds.length,2);
assert.equal(spaac.operation.graphEdits.removedAtoms.length,0);
assert.equal(spaac.operation.graphEdits.newAtoms.length,0);
assert.equal(signature(M.restore(M.exportJSON(product)).graph),signature(product.graph));
const cOct=entry('coct'),click=V.candidates('Click',[azide,cOct]).candidates[0];
const chain=V.append(V.workflow(azide),'Click',cOct,click.candidate_id);
const next=V.append(chain,'Condensation',L.parseSmiles('CCN').graph);
assert.equal(next.steps.length,2);
assert.equal(serialize(next.steps[1].result.step.inputs[0]),serialize(chain.current));
assert.equal(next.current.provenance.reaction_products[0].kind,'triazole');
checkPresentation(next.current,next.current.provenance.reaction_products[0].ring,'triazole');
assert.equal(V.candidates('Click',[next.current,azide]).status,'UNSUPPORTED');
const ieddaChain=V.append(V.workflow(t),'IEDDA',tco);
const ieddaNext=V.append(ieddaChain,'Condensation',L.parseSmiles('CCN').graph);
assert.equal(ieddaNext.steps.length,2);
assert.equal(serialize(ieddaNext.steps[1].result.step.inputs[0]),serialize(ieddaChain.current));
assert.equal(ieddaNext.current.provenance.reaction_products[0].kind,'tetrazine_ligation');
checkPresentation(ieddaNext.current,ieddaNext.current.provenance.reaction_products[0].ring,'tetrazine_ligation');
assert.equal(V.candidates('IEDDA',[ieddaNext.current,t]).status,'UNSUPPORTED');

if(process.env.REACTION_EXPORT_CHECK)fs.writeFileSync(process.env.REACTION_EXPORT_CHECK,serialize(exportsToCheck));
console.log('PASS: SPAAC x6, IEDDA x4, negative controls, atom and bond provenance, formula and masses, export round trips, selector and multistep');

