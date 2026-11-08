const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const ctx=vm.createContext({crypto:require('node:crypto').webcrypto});
const root=path.join(__dirname,'../app');
require('./load-registry.js')(ctx);
for(const f of ['core','chemistry','reactions'])
 vm.runInContext(fs.readFileSync(path.join(root,'snapshots/A/app',f+'.js'),'utf8'),ctx);
for(const f of ['chemistry-library'])
 vm.runInContext(fs.readFileSync(path.join(root,f+'.js'),'utf8'),ctx);
const legacy=fs.readFileSync(path.join(__dirname,'BASELINE_USER_LIBRARY_V200_SINGLE.json'),'utf8');
const run=code=>vm.runInContext(code,ctx);
ctx.assert=assert;
ctx.legacy=legacy;
run(`
const storageData=new Map([[ChemistryLibrary.KEY,legacy]]);
const storage={getItem:key=>storageData.get(key)??null,setItem:(key,value)=>storageData.set(key,value)};
const store=ChemistryLibrary.create(storage);
store.load();
assert.equal(JSON.stringify(store.state),JSON.stringify(JSON.parse(legacy)));
const imported=store.unified().filter(r=>r.id.startsWith('builtin:linker1:'));
assert.equal(imported.length,8);
for(const r of imported){
 assert.equal(r.sequence_assembly,false);
 assert(!Lite.builtinAudit().some(row=>row.names.includes(r.name)));
 assert.throws(()=>Lite.calculate('['+r.name+']rA'));
 assert.equal(r.metadata.roles[0],'ReactionReagent');
}
const names=(family,substrate,source='builtin')=>store.reagents(source,family,substrate)
 .filter(r=>source==='user'||r.id.startsWith('builtin:linker1:')).map(r=>r.name).join(',');
const amine=Lite.calculate('[C6N]rA').graph;
assert.equal(names('Condensation',amine),'BCN,cOct,DBCO,MC,MCVCPABC,SMCC,SPDP,TCO');
assert.equal(names('ThiolMaleimide',Lite.parseSmiles('CCS').graph),'MC,MCVCPABC,SMCC');
assert.equal(names('Click',REACTION_REAGENTS.azide.graph),'BCN,cOct,DBCO');
const smcc=imported.find(r=>r.name==='SMCC');
for(const text of [Lite.mol(smcc.graph),Lite.mol(smcc.graph)+'\\n$$$$\\n']){
 const uploaded=Reactions.v2.parseReagent(text,'Condensation');
 const product=Reactions.v2.transform('Condensation',[amine,uploaded]);
 assert(product.product_graph);
}
const custom=Lite.selectAttachments(Lite.parseSmiles('OCCCN'),0,null);
assert(!store.reagents('builtin',null,amine).some(r=>r.id==='cap'));
assert(store.unified().some(r=>r.id==='cap'&&r.metadata.reactionStatus==='reference-only'));
store.add('SMCC',custom);
const reloaded=ChemistryLibrary.create(storage);
reloaded.load();
assert.equal(JSON.stringify(reloaded.state.records[0]),JSON.stringify(JSON.parse(legacy).records[0]));
assert.equal(storageData.get(ChemistryLibrary.KEY+'-backup'),legacy);
assert.equal(reloaded.unified().filter(r=>r.symbol==='SMCC').length,2);
assert(names('Condensation',smcc.graph,'user').split(',').includes('SMCC'));
assert(Lite.calculate('[SMCC]rA').graph);
const probeData=new Map();
const probe=ChemistryLibrary.create({getItem:k=>probeData.get(k)??null,setItem:(k,v)=>probeData.set(k,v)});
for(const row of Lite.builtinAudit().filter(r=>r.reference_only)){
 for(const name of new Set(row.names.map(n=>n.toLowerCase()))){
  assert(Lite.validCustomSymbol(name),name);
  probe.add(name,custom);
  assert(Lite.connected(Lite.calculate('['+name+']rA').graph),name);
 }
}
probe.load();
assert(!probe.blocked);
assert(Lite.connected(Lite.calculate('[CY5.5]rA').graph));
assert.throws(()=>probe.add('Ugn',custom),/Reserved built-in/);
`);
console.log('PASS: graph and sequence isolation, family filters, MOL/SDF transform, same-name save, v2.00 restore and backup');
