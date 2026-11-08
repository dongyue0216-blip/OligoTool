'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ctx=vm.createContext({crypto:require('node:crypto').webcrypto}),root=path.join(__dirname,'../app');
require('./load-registry.js')(ctx);
for(const f of ['core','chemistry','reactions'])
 vm.runInContext(fs.readFileSync(path.join(root,'snapshots/A/app',f+'.js'),'utf8'),ctx);
for(const f of ['chemistry-library','molecule-builder','structure-presentation'])
 vm.runInContext(fs.readFileSync(path.join(root,f+'.js'),'utf8'),ctx);
const get=code=>vm.runInContext(code,ctx),L=get('Lite'),M=get('MoleculeBuilder'),C=get('StructurePresentation');
const cases=[
 ['tAtA','C18H21N10O8P',536.128144],
 ['AtA','C19H23N10O8P',550.143794],['tAA','C19H23N10O8P',550.143794],
 ['rAtA','C19H23N10O9P',566.138709],['tArA','C19H23N10O9P',566.138709],
 ['AtAA','C29H35N15O13P2',863.201399],['rAtArA','C29H35N15O15P2',895.191228]
];
for(const [sequence,formula,exact] of cases){
 const {graph,chemistry}=L.calculate(sequence),assemblyGraph=L.toAssemblyGraph(sequence);
 assert(L.connected(graph),sequence);
 assert.equal(chemistry.formula,formula);
 assert(Math.abs(chemistry.exact_mass-exact)<0.000002,`${sequence} ${chemistry.exact_mass}`);
 assert(Math.abs(L.graphProperties(graph).average_mw-chemistry.average_mw)<1e-9);
 for(const e of assemblyGraph.edges){
  const ends=[e.source,e.target].map(ref=>{
   const block=assemblyGraph.nodes.find(n=>n.id===ref.node).block,site=block.sites[ref.site];
   if(block.metadata.family==='TNA')assert.equal(site.atom_role,site.direction==='upstream'?'O3':'O2');
   return graph.provenance.atoms.findIndex(a=>a.node===ref.node&&a.local_atom===site.atom);
  });
  const center=graph.provenance.atoms.findIndex((a,i)=>a.edge===e.id&&graph.atoms[i].e==='P');
  assert(center>=0);
  for(const atom of ends){
   assert(atom>=0);
   assert.equal(graph.atoms[atom].h,0);
   assert(graph.bonds.some(b=>b.o===1&&[b.a,b.b].includes(atom)&&[b.a,b.b].includes(center)));
  }
 }
 assert.equal(assemblyGraph.terminations.length,2);
 const exported=L.parseMol(L.mol(graph),{manualMarkers:true}).graph;
 assert(L.connected(exported));
 assert.equal(L.graphProperties(exported).formula,formula);
 assert(L.cdxml(graph).includes('<CDXML'));
 const state=M.start(sequence),restored=M.restore(M.exportJSON(state));
 assert.equal(restored.formula,formula);
 assert(C.schematic({moleculeState:restored}).supported);
}
assert(L.connected(L.calculate('A*tA').graph));
for(const seq of ['ArArC','eArA','+ArA','cEt-ArA','AgnAgn','pApA','eAtAeA','+AtA+G','cEt-AtAcEt-G'])assert(L.connected(L.calculate(seq).graph),seq);
const rows=get('ChemistryLibrary.referenceRows()');
assert(rows.some(row=>row.symbol==='#'&&row.name==='MsPA'&&row.type==='Backbone linkage'));
assert(rows.some(row=>row.symbol==='rA'&&row.name==='RNA-A'));
assert(rows.some(row=>row.symbol==='DBCO'&&row.type==='Post-modification reagent'));
assert(!rows.some(row=>row.symbol==='&'));
const expected=get('ChemistryLibrary.builtinCatalog()').filter(r=>r.assemblyReady||r.roles?.includes('ReactionReagent')||r.family==='backbone');
assert.equal(rows.length,expected.length);
const state=M.start('AfUmUeU+UcEt-AFANA-UnUUNA-UAdarAAtArAtAAeArA+AcEt-A');
const view=C.schematic({moleculeState:state},{density:'compact'});
assert(view.supported);
for(const component of ['base','sugar','bridge'])assert(view.svg.includes('data-component="'+component+'"'));
assert(view.svg.includes('MOE'));
assert(!view.svg.includes('5′ → 3′'));
assert(C.schematic({moleculeState:M.start('AgnAgn')}).svg.includes('GNA'));
const vp=C.schematic({moleculeState:M.start('VpmArA')});
assert(vp.svg.includes('data-linkage="VP"'));
const mixed='[InvAb]ENA-A*rAUgnENA-C#rCENA-GrAENA-UrUENA-TrAENA-IrCENA-CMerArUrArCrA[InvAb]';
const before=L.calculate(mixed);
const mixedState=M.start(mixed);
for(const density of ['compact','annotated']){
 const view=C.schematic({moleculeState:mixedState},{density});
 assert(view.supported);
 assert.equal([...view.svg.matchAll(/data-bridge="ethylene"/g)].length,7);
 assert.equal([...view.svg.matchAll(/data-sugar-shape="invertedSugar"/g)].length,2);
 assert.equal([...view.svg.matchAll(/data-component="base"/g)].length,mixedState.assemblyGraph.lanes[0].assembly.nodes.length-2);
 assert.match(view.svg,/<g data-linkage="PS"[^>]*><rect[^>]+rx="3"/);
 assert.match(view.svg,/<g data-linkage="MsPA"[^>]*><rect[^>]+rx="3"/);
 assert(view.svg.includes('upstream → downstream'));
 assert.equal(view.svg.includes('3′ → 5′'),density==='annotated');
}
assert.equal(M.restore(M.exportJSON(mixedState)).formula,before.chemistry.formula);
assert.deepEqual(JSON.parse(JSON.stringify(L.calculate(mixed).graph)),JSON.parse(JSON.stringify(before.graph)));
const absic=get('ChemistryLibrary.builtinCatalog().find(row=>row.symbol==="{absic}")');
assert.equal(absic.assemblyReady,true);
assert(rows.some(row=>row.symbol==='[absic]'&&row.name.includes('dSpacer')));
const spacer=M.start('[absic]'),internal=M.start('rA*[absic]#rA');
assert.equal(spacer.formula,'C5H10O3');
assert.equal(spacer.average_mw.toFixed(3),'118.132');
assert.equal(spacer.exact_mass.toFixed(5),'118.06299');
assert.equal(L.calculate('[ABSIC]').canonical_sequence,'[absic]');
assert.equal(L.calculateSafe('[abasic]').errors[0].reasonCode,'UNAVAILABLE_BUILDING_BLOCK');
assert.deepEqual(Array.from(spacer.attachmentSites,s=>s.atom_role),["O5'","O3'"]);
assert.deepEqual(Array.from(internal.attachmentSites.filter(s=>s.block==='{absic}'),s=>s.status),['occupied','occupied']);
const reference=C.schematic({moleculeState:spacer}).svg;
assert(reference.includes('data-sugar-shape="sugar"')&&!reference.includes('data-component="base"'));
assert.equal(M.restore(M.exportJSON(internal)).formula,internal.formula);
assert.equal(C.referenceGlyph({topology:'unknown',label:'absic'}),null);
console.log(cases.length+' TNA assemblies, legacy families, '+rows.length+' reference rows, and schematic checks passed');



