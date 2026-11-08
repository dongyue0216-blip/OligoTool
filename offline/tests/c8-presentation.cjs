const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert');
const ctx=vm.createContext({console,crypto:require('crypto').webcrypto}),root=path.join(__dirname,'..');
require('./load-registry.js')(ctx);
for(const f of ['core','chemistry','reactions'])vm.runInContext(fs.readFileSync(path.join(root,'app/snapshots/A/app',f+'.js'),'utf8'),ctx);
for(const f of ['molecule-builder','structure-presentation'])vm.runInContext(fs.readFileSync(path.join(root,'app',f+'.js'),'utf8'),ctx);
const M=vm.runInContext('MoleculeBuilder',ctx),L=vm.runInContext('Lite',ctx),C=vm.runInContext('StructurePresentation',ctx),R=vm.runInContext('Reactions',ctx),rows=[];
const record=s=>({graph:s.graph,moleculeState:s}),test=(name,fn)=>{fn();rows.push({name,status:'PASS'});};
test('linear assembly view preserves graph and uses explicit identities',()=>{const s=M.start('rArCrG'),before=JSON.stringify(s),p=C.schematic(record(s));assert(p.supported);assert(p.svg.includes('5′ → 3′'));assert(p.svg.includes('rA'));assert.equal(JSON.stringify(s),before);});
test('six real branch linkage classes retained without chemistry rewrite',()=>{for(const linkage of ['PO','PS','PS2','Me-P','PN(dmi)','MsPA']){const s=M.start('[GlycerolBranch]rA'),b=M.branch(s,{siteId:M.available(s)[0].id,sequence:'rCrG',linkage}),before=JSON.stringify(b),p=C.schematic(record(b));assert(p.supported);assert(p.svg.includes(linkage));assert.equal(JSON.stringify(b),before);}});
test('no provenance and imported unknown graph fail gracefully',()=>{assert(!C.schematic({graph:L.parseSmiles('CCO').graph}).supported);assert(!C.schematic(record(M.fromGraph(L.parseSmiles('CCO').graph))).supported);});
test('reaction product provenance cannot draw stale pre-reaction schematic',()=>{const s=M.start('[C6N]rA'),ester=vm.runInContext('REACTION_REAGENTS.ester.graph||REACTION_REAGENTS.ester',ctx),c=R.v2.candidates('Condensation',[s.graph,ester]),product=M.react(s,{family:'Condensation',secondary:ester,candidateId:c.candidates[0].candidate_id});assert(!C.schematic(record(product)).supported);});
test('multi-component and interaction annotations fail conservative, no fake bonds',()=>{const s=M.combine([M.start('rA'),M.start('rU')]),a=M.annotate(s,[{id:'pair',kind:'basePair',participants:[{atomIndex:0},{atomIndex:s.components[1].atomIndices[0]}]}]),before=JSON.stringify(a);assert(!C.schematic(record(a)).supported);assert.equal(JSON.stringify(a),before);});
test('unmapped branch endpoints cannot invent a connector',()=>{const s=M.start('[GlycerolBranch]rA'),b=JSON.parse(JSON.stringify(M.branch(s,{siteId:M.available(s)[0].id,sequence:'rC'})));b.assemblyGraph.branchEdges[0].parentSite='missing';assert(!C.schematic(record(b)).supported);});
const badges=svg=>Array.from(svg.matchAll(/data-linkage="([^"]+)" data-linkage-edge="([^"]+)"><rect[^>]*height="([^"]+)"[^>]*fill="([^"]+)" stroke="([^"]+)"/g),
 ([,id,edge,height,fill,stroke])=>({id,edge,height,fill,stroke}));
const symbol=id=>Object.keys(L.linkageSymbols).find(k=>L.linkageSymbols[k]===id);
test('every all-PO edge has a low-emphasis badge, including row wraps',()=>{
 for(const n of [10,20,24])for(const density of ['compact','annotated']){
  const s=M.start('rA'.repeat(n)),p=C.schematic(record(s),{density}),units=badges(p.svg);
  assert.equal(units.length,n-1);
  assert(units.every(u=>u.id==='PO'&&u.height==='11'));
  assert.equal(new Set(units.map(u=>u.edge)).size,n-1);
  assert(p.svg.includes('viewBox="0 0 684 '));
 }
});
test('all formal linkage tokens and all built-in base tokens have distinct colors',()=>{
 const ids=Object.keys(L.linkageDefinitions).filter(id=>id!=='PMO');
 const s=M.start(['rA','rC','rG','rU','dT','ENA-CMe','ENA-I'].map((b,i)=>b+(i<ids.length?symbol(ids[i]):'')).join(''));
 const before=[L.mol(s.graph),L.cdxml(s.graph),M.exportJSON(s)];
 const p=C.schematic(record(s),{density:'compact'});
 const units=badges(p.svg).concat(badges(C.schematic(record(M.start('pApA'))).svg));
 assert.deepEqual(units.map(u=>u.id),[...ids,'PMO']);
 assert.equal(new Set(units.map(u=>u.fill)).size,units.length);
 const colors=Array.from(p.svg.matchAll(/data-base="([^"]+)"[^>]*fill="([^"]+)"/g),m=>[m[1],m[2]]);
 colors.push(...Array.from(C.schematic(record(M.start('Z'))).svg.matchAll(/data-base="([^"]+)"[^>]*fill="([^"]+)"/g),m=>[m[1],m[2]]));
 assert.deepEqual(colors.map(([id])=>id),['A','C','G','U','T','CMe','I','Z']);
 assert.equal(new Set(colors.map(([,fill])=>fill)).size,8);
 assert.deepEqual([L.mol(s.graph),L.cdxml(s.graph),M.exportJSON(s)],before);
});
test('same PS token on mixed TNA/GNA main chain, branch junction and child lane',()=>{
 const s=M.start('[GlycerolBranch]AtA*Ugn'),b=M.branch(s,{siteId:M.available(s)[0].id,sequence:'rC*rG',linkage:'PS'});
 const p=C.schematic(record(b)),ps=badges(p.svg).filter(u=>u.id==='PS');
 assert.equal(ps.length,3);
 assert(ps.some(u=>u.edge===b.assemblyGraph.branchEdges[0].id));
 assert.equal(new Set(ps.map(u=>u.fill+' '+u.stroke)).size,1);
 assert(p.svg.includes('TNA')&&p.svg.includes('GNA'));
});
test('two branches on the same node get separate linkage label positions',()=>{
 const imported=L.selectAttachments(L.parseSmiles('OCC(O)C(O)CO'),0,7);
 imported.branchSites=[3,5];
 L.registerCustom('DoubleBranch',imported);
 try{
  const s=M.start('[DoubleBranch]rA');
  const first=M.branch(s,{siteId:M.available(s)[0].id,sequence:'rC',linkage:'PS'});
  const both=M.branch(first,{siteId:M.available(first)[0].id,sequence:'rG',linkage:'PS'});
  const svg=C.schematic(record(both)).svg;
  const y=Array.from(svg.matchAll(/data-linkage="PS" data-linkage-edge="[^"]+"><rect x="[^"]+" y="([^"]+)"/g),m=>m[1]);
  assert.equal(y.length,2);
  assert.equal(new Set(y).size,2);
 }finally{delete L.customLibrary['{doublebranch}'];}
});
fs.writeFileSync(path.join(__dirname,'c8-presentation-results.json'),JSON.stringify(rows,null,2));console.log(rows.length+'/'+rows.length);
