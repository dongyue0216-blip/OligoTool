const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert'),crypto=require('crypto');
const root=path.join(__dirname,'..'),ctx=vm.createContext({console,crypto:crypto.webcrypto});
require('./load-registry.js')(ctx);
for(const f of ['core','chemistry','reactions'])vm.runInContext(fs.readFileSync(path.join(root,'app/snapshots/A/app',f+'.js'),'utf8'),ctx);
vm.runInContext(fs.readFileSync(path.join(root,'app/chemistry-library.js'),'utf8'),ctx);
const L=vm.runInContext('Lite',ctx),R=vm.runInContext('Reactions',ctx),V=R.v2,refs=vm.runInContext('REACTION_REAGENTS',ctx),CL=vm.runInContext('ChemistryLibrary',ctx),ref=vm.runInContext('REFERENCE',ctx),copy=x=>JSON.parse(JSON.stringify(x));
const checks=[];function test(name,fn){try{fn();checks.push({name,status:'PASS'});}catch(e){checks.push({name,status:'FAIL',error:e.stack});console.error(name,e.message);}}
const smiles=s=>L.parseSmiles(s).graph;
const load=n=>L.parseMol(fs.readFileSync(path.join(__dirname,'fixtures',n+'.mol'),'utf8'),{manualMarkers:true}).graph;
function product(f,inputs,predicate=()=>true){const before=JSON.stringify(inputs),cs=V.candidates(f,inputs),c=cs.candidates.find(predicate);assert(c,cs.reason);const r=V.transform(f,inputs,c.candidate_id);assert(r.product_graph,r.detail||r.reason);R.validate(r.product_graph);assert.equal(JSON.stringify(inputs),before);assert.equal(r.mapping.flat().length,inputs.reduce((n,g)=>n+g.atoms.length,0));return r;}
test('rArA exact formula and mass',()=>{const x=L.calculate('rArA');assert.equal(x.chemistry.formula,'C20H25N10O10P');assert(Math.abs(x.chemistry.exact_mass-596.149274)<0.000001);});
const baseline=JSON.stringify(ref),audit=L.builtinAudit();fs.writeFileSync(path.join(__dirname,'ghost-audit.json'),JSON.stringify(audit,null,2));
console.log('Audit',audit.length,'unavailable sequence entries',audit.filter(r=>!r.assembly_ready&&!r.not_building_block).length);
for(const row of audit.filter(r=>!r.assembly_ready))for(const name of row.names.filter(n=>/^[A-Za-z0-9_]{1,24}$/.test(n))){
 test('catalog custom save/use '+name,()=>{const backing=new Map(),store=CL.create({getItem:k=>backing.get(k)??null,setItem:(k,v)=>backing.set(k,v)});store.load();store.add(name,L.selectAttachments(L.parseSmiles('OCCO'),0,3));assert.equal(store.state.records[0].symbol,name);assert(L.calculate('['+name+']rA').graph.atoms.length>0);const exported=store.exportJSON();const next=CL.create({getItem:k=>backing.get(k)??null,setItem:(k,v)=>backing.set(k,v)});next.load();assert.equal(next.state.records.length,1);assert.equal(CL.decode(JSON.parse(exported)).records.length,1);store.remove(store.state.records[0].id);});
}
test('valid built-in name blocked',()=>assert.throws(()=>CL.normalize('rA',L.selectAttachments(L.parseSmiles('OCCO'),0,3)),/Reserved/));
test('built-in unchanged',()=>assert.equal(JSON.stringify(ref),baseline));
test('validated InvAb available with user spelling',()=>{assert.equal(L.calculate('[invAb]rA').chemistry.formula,L.calculate('[InvAb]rA').chemistry.formula);assert(audit.find(r=>r.notation==='{InvAb}').assembly_ready);assert.throws(()=>CL.normalize('invAb',L.selectAttachments(L.parseSmiles('OCCO'),0,3)),/Reserved/);});
test('every valid built-in symbol conflict',()=>{for(const r of audit.filter(r=>r.assembly_ready))for(const n of r.names.filter(n=>/^[A-Za-z0-9_]{1,24}$/.test(n)))assert.throws(()=>CL.normalize(n,L.selectAttachments(L.parseSmiles('OCCO'),0,3)),/Reserved/);});
test('historical user absic override survives the built-in addition',()=>{
 const record=CL.normalize('HistoricalSpacer',L.selectAttachments(L.parseSmiles('OCCO'),0,3));
 record.symbol='absic';
 record.runtime.id=record.block.id='{absic}';
 const data={schema:'oligo-user-chemistry-library',schemaVersion:1,libraryId:'historical',records:[record]};
 const storage=new Map([[CL.KEY,JSON.stringify(data)]]);
 const store=CL.create({getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)});
 store.load();
 assert(!store.blocked);
 try{
  assert.equal(L.calculate('[absic]').chemistry.formula,'C2H6O2');
  assert.equal(CL.builtinCatalog().find(row=>row.symbol==='{absic}').name,'absic · dSpacer (1′,2′-dideoxyribose)');
 }finally{store.remove(record.id);}
 assert.equal(L.calculate('[absic]').chemistry.formula,'C5H10O3');
});
test('baseline user library schema read',()=>assert(CL.decode(JSON.parse(fs.readFileSync(path.join(root,'tests/BASELINE_USER_LIBRARY_V1.json')))).records.length));
function join(a,b,ai,bi){const g={atoms:[...copy(a.atoms),...copy(b.atoms)],bonds:[...copy(a.bonds),...b.bonds.map(x=>({...x,a:x.a+a.atoms.length,b:x.b+a.atoms.length})),{a:ai,b:bi+a.atoms.length,o:1}],provenance:{atoms:[...a.atoms.map((_,i)=>copy(a.provenance?.atoms?.[i]||null)),...b.atoms.map((_,i)=>copy(b.provenance?.atoms?.[i]||null))]}};g.atoms[ai].h--;g.atoms[bi+a.atoms.length].h--;return g;}
const oligoSS=()=>{const a=L.calculate('[C6N]rArA').graph,b=smiles('CCSSCC');return join(a,b,a.atoms.findIndex(a=>a.e==='N'&&a.h===2),0);};
test('provenance auto retention plus chained thiol/maleimide',()=>{const g=oligoSS(),cs=V.candidates('DisulfideReduction',[g]);assert.equal(cs.candidates.length,1);assert.equal(cs.candidates[0].retention,'oligo_provenance');const r=product('DisulfideReduction',[g]);assert(r.product_graph.atoms.some(a=>a.e==='P'));const w=V.append(V.workflow(g),'DisulfideReduction',null);assert.deepEqual(copy(V.reload(w)),copy(w));});
test('two large fragments require explicit selection',()=>{const g=smiles('C'.repeat(24)+'SS'+'C'.repeat(24));assert.equal(V.candidates('DisulfideReduction',[g]).candidates.length,2);assert.equal(V.transform('DisulfideReduction',[g]).status,'SITE_SELECTION_REQUIRED');});
test('two oligo fragments require explicit selection',()=>{const g=oligoSS(),other=L.calculate('rArA').graph,j=g.atoms.length-1;const both=join(g,other,j,other.atoms.findIndex(a=>a.e==='O'&&a.h===1));assert.equal(V.candidates('DisulfideReduction',[both]).candidates.length,2);});
test('pyridyl disulfide',()=>{const g=smiles('CCSS');g.atoms[3].h=0;const off=g.atoms.length;g.atoms.push(...[{e:'C',h:0,q:0},{e:'N',h:0,q:0},...Array.from({length:4},()=>({e:'C',h:1,q:0}))]);g.bonds.push({a:3,b:off,o:1},...Array.from({length:6},(_,i)=>({a:off+i,b:off+(i+1)%6,o:i%2?1:2})));assert.equal(V.candidates('DisulfideReduction',[g]).candidates.length,2);product('DisulfideReduction',[g]);});
for(const name of ['C6','C7','asymmetric'])test('reduction '+name,()=>{
 const g=smiles(name==='C6'?'OCCCSSCCCO':name==='C7'?'OCCCCSSCCCO':'OCCSSCCCCCCO');
 const pending=V.transform('DisulfideReduction',[g]);assert.equal(pending.status,'SITE_SELECTION_REQUIRED');
 const r=product('DisulfideReduction',[g]);assert.equal(r.removed_fragments.length,1);assert.equal(r.product_graph.atoms.filter(a=>a.e==='S'&&a.h===1).length,1);
 const w=V.append(V.workflow(g),'DisulfideReduction',null,r.candidate.candidate_id);assert.deepEqual(copy(V.reload(w)),copy(w));
});
test('multiple disulfides',()=>{const g=smiles('CCSSCCSSCC');assert.equal(V.candidates('DisulfideReduction',[g]).candidate_sites[0].disulfide.length,2);const r=product('DisulfideReduction',[g]);assert.equal(r.product_graph.provenance.edits.filter(x=>x.op==='remove-bond').length,1);});
test('oxidized sulfur and polysulfide rejected',()=>{for(const s of ['CSSSC','CSCC'])assert.equal(V.candidates('DisulfideReduction',[smiles(s)]).candidates.length,0);const g=smiles('CSSC');g.atoms.push({e:'O',h:0,q:0});g.bonds.push({a:1,b:4,o:2});assert.equal(V.candidates('DisulfideReduction',[g]).candidates.length,0);});
const male={atoms:[{e:'N',h:1,q:0},{e:'C',h:0,q:0},{e:'O',h:0,q:0},{e:'C',h:1,q:0},{e:'C',h:1,q:0},{e:'C',h:0,q:0},{e:'O',h:0,q:0}],bonds:[{a:0,b:1,o:1},{a:1,b:2,o:2},{a:1,b:3,o:1},{a:3,b:4,o:2},{a:4,b:5,o:1},{a:5,b:6,o:2},{a:5,b:0,o:1}]};
for(const reverse of [false,true])test('maleimide roles '+reverse,()=>{const a=smiles('CCS'),r=product('ThiolMaleimide',reverse?[male,a]:[a,male]);assert.equal(r.product_graph.atoms.filter(a=>a.e==='S'&&a.h===0).length,1);assert.equal(r.properties.formula,'C6H9NO2S');});
test('maleimide multi thiol',()=>{assert.equal(V.candidates('ThiolMaleimide',[smiles('SCCS'),male]).candidates.length,2);});
test('maleimide multi maleimide',()=>{const g=join(male,male,0,0);assert.equal(V.candidates('ThiolMaleimide',[smiles('CCS'),g]).candidates.length,2);});
test('oligo thiol/maleimide both role directions and workflow',()=>{const a=product('DisulfideReduction',[oligoSS()]).product_graph;for(const inputs of [[a,male],[male,a]]){const r=product('ThiolMaleimide',inputs);const w=V.append(V.workflow(inputs[0]),'ThiolMaleimide',inputs[1],r.candidate.candidate_id);assert.deepEqual(copy(V.reload(w)),copy(w));}});
test('maleimide false positive controls',()=>{for(const s of ['CSC','CSSC','CC(=O)S'])assert.equal(V.candidates('ThiolMaleimide',[smiles(s),male]).candidates.length,0);assert.equal(V.candidates('ThiolMaleimide',[smiles('CCS'),smiles('CC=CC')]).candidates.length,0);});
// CAP existing reagent from validated assets, renamed and atom-permuted variants.
console.log('reagents keys',Object.keys(refs));
const cap=copy(refs['Im-m7GDP']?.graph||refs['Im-m7GDP']||{});
if(!cap.atoms){const source=fs.readFileSync(path.join(root,'app/snapshots/A/app/reactions.js'),'utf8');Object.assign(cap,JSON.parse(source.match(/const capReference=(.*);/)[1]));}
for(const [name,variant]of [['reference',g=>g],['GDP demethylated',g=>{g.atoms[1].q=0;g.atoms.splice(28,1);g.bonds=g.bonds.filter(b=>b.a!==28&&b.b!==28).map(b=>({...b,a:b.a>28?b.a-1:b.a,b:b.b>28?b.b-1:b.b}));return g;}],['distal imidazolium',g=>{g.atoms[30].q=1;g.atoms[30].h=1;return g;}],['phosphate anions',g=>{g.atoms.filter(a=>a.e==='O'&&a.h===1).slice(-2).forEach(a=>{a.q=-1;a.h=0;});return g;}]])test('CAP '+name,()=>{const g=variant(copy(cap));const r=product('CAP',[L.calculate('[p]rA').graph,g]);assert.equal(r.product_graph.atoms.filter(a=>a.e==='P').length,3);const pp=r.product_graph.bonds.filter(b=>r.product_graph.atoms[b.a].e==='P'||r.product_graph.atoms[b.b].e==='P');assert.equal(pp.length,12);});
test('CAP terminal PS',()=>{const g=L.calculate('[p]rA').graph,p=g.atoms.findIndex(a=>a.e==='P'),b=g.bonds.find(b=>(b.a===p||b.b===p)&&b.o===2);g.atoms[b.a===p?b.b:b.a].e='S';const r=product('CAP',[g,cap]);assert.equal(r.product_graph.atoms.filter(a=>a.e==='P').length,3);});
test('CAP charge separated phosphoryl',()=>{const g=copy(cap);for(const b of g.bonds.filter(b=>b.o===2&&(g.atoms[b.a].e==='P'||g.atoms[b.b].e==='P'))){const p=g.atoms[b.a].e==='P'?b.a:b.b,o=p===b.a?b.b:b.a;g.atoms[p].q=1;g.atoms[o].q=-1;b.o=1;}product('CAP',[L.calculate('[p]rA').graph,g]);});
test('Quick CAP agrees with manual CAP for a charge-separated reagent',()=>{
 const g=copy(cap),b=g.bonds.find(b=>b.a===24&&b.o===2);
 g.atoms[24].q=1;g.atoms[b.b].q=-1;b.o=1;
 const substrate=L.calculate('[p]rA').graph,before=JSON.stringify([substrate,g]);
 const plans=V.findCompatibleReactionPlans(substrate,g).plans.filter(p=>p.family==='CAP');
 assert(plans.length);
 assert.deepEqual(plans.map(p=>p.candidate_id),V.candidates('CAP',[substrate,g]).candidates.map(p=>p.candidate_id));
 for(const plan of plans){
  assert.equal(plan.status,'STRUCTURALLY_COMPATIBLE');
  assert(V.transform(plan.family,[substrate,g],plan.candidate_id).product_graph);
 }
 assert.equal(JSON.stringify([substrate,g]),before);
});
function aromaticMol(g){g=copy(g);g.atoms.forEach((a,i)=>{a.x=i*1.5;a.y=0;});L.normalizeCoordinates(g);let mol=L.mol(g),lines=mol.split('\n'),n=g.atoms.length;g.bonds.forEach((b,i)=>{if([26,29,30,31,32].includes(b.a)&&[26,29,30,31,32].includes(b.b))lines[4+n+i]=lines[4+n+i].slice(0,6)+'  4'+lines[4+n+i].slice(9);});return lines.join('\n');}
test('CAP aromatic MOL and SDF local normalization',()=>{for(const text of [aromaticMol(cap),aromaticMol(cap)+'\n$$$$\n']){const g=V.parseReagent(text);assert(g.normalization.cap_representation);product('CAP',[L.calculate('[p]rA').graph,g]);}assert.throws(()=>L.parseMol(aromaticMol(cap),{manualMarkers:true}));});
test('CAP permuted atom mapping',()=>{const g=copy(cap),n=g.atoms.length;g.atoms.reverse();g.bonds=g.bonds.reverse().map(b=>({...b,a:n-1-b.a,b:n-1-b.b}));product('CAP',[L.calculate('[p]rA').graph,g]);});
test('CAP unactivated GDP rejected',()=>{const g=copy(cap);g.atoms=g.atoms.slice(0,29);g.bonds=g.bonds.filter(b=>b.a<29&&b.b<29&&b.a!==26&&b.b!==26);g.atoms[26]={e:'O',h:1,q:0};g.bonds.push({a:24,b:26,o:1});assert.equal(V.candidates('CAP',[L.calculate('[p]rA').graph,g]).candidates.length,0);});
test('CAP disconnected/unrelated imidazole rejected',()=>{const g=copy(cap);g.bonds=g.bonds.filter(b=>!(b.a===24&&b.b===26));g.bonds.push({a:28,b:26,o:1});g.atoms[28].h=2;g.atoms.push({e:'O',h:1,q:0});g.bonds.push({a:24,b:g.atoms.length-1,o:1});R.validate(g);assert.equal(V.transform('CAP',[L.calculate('[p]rA').graph,g]).product_graph,null);});
for(const s of ['CCN','CCNC'])test('amine accepted '+s,()=>product('Condensation',[smiles(s),load('acid')]));
for(const s of ['CC(=O)N','CN(C)C','NC(=O)N'])test('amine excluded '+s,()=>assert.equal(V.candidates('Condensation',[smiles(s),load('acid')]).candidates.length,0));
test('nucleobase amine excluded',()=>assert.equal(V.candidates('Condensation',[L.calculate('rArA').graph,load('acid')]).candidates.length,0));
test('CAP aromatic V3000 sparse IDs',()=>{const id=i=>2*i+1,lines=['CAP','','','  0  0  0     0  0            999 V3000','M  V30 BEGIN CTAB',`M  V30 COUNTS ${cap.atoms.length} ${cap.bonds.length} 0 0 0`,'M  V30 BEGIN ATOM',...cap.atoms.map((a,i)=>`M  V30 ${id(i)} ${a.e} ${i*1.5} 0 0 0${a.q?' CHG='+a.q:''}`),'M  V30 END ATOM','M  V30 BEGIN BOND',...cap.bonds.map((b,i)=>`M  V30 ${i+1} ${[26,29,30,31,32].includes(b.a)&&[26,29,30,31,32].includes(b.b)?4:b.o} ${id(b.a)} ${id(b.b)}`),'M  V30 END BOND','M  V30 END CTAB','M  END'];product('CAP',[L.calculate('[p]rA').graph,V.parseReagent(lines.join('\n'))]);});
test('CAP P+/O- MOL representation',()=>{const g=copy(cap);g.atoms.forEach((a,i)=>{a.x=i*1.5;a.y=0;});const b=g.bonds.find(b=>b.a===24&&b.o===2);g.atoms[24].q=1;g.atoms[b.b].q=-1;b.o=1;product('CAP',[L.calculate('[p]rA').graph,V.parseReagent(L.mol(g))]);});
for(const row of audit.filter(r=>!r.assembly_ready&&!r.not_building_block))test('every ghost display name '+row.notation,()=>{const display=row.names[0],symbol=display.replace(/[^A-Za-z0-9_]/g,'_'),backing=new Map(),store=CL.create({getItem:k=>backing.get(k)??null,setItem:(k,v)=>backing.set(k,v)});store.load();const imported=L.selectAttachments(L.parseSmiles('OCCO'),0,3);imported.graph.metadata={displayName:display};store.add(symbol,imported);assert.equal(store.state.records[0].name,display);assert(L.calculate('['+symbol+']rA').graph);store.remove(store.state.records[0].id);});

test('CAP imidazolium charge resonance on attached N',()=>{const g=copy(cap);g.atoms[26].q=1;g.atoms[30].h=1;g.bonds.find(b=>b.a===26&&b.b===29).o=2;g.bonds.find(b=>b.a===29&&b.b===30).o=1;R.validate(g);product('CAP',[L.calculate('[p]rA').graph,g]);product('CAP',[L.calculate('[p]rA').graph,V.parseReagent(aromaticMol(g))]);});

fs.writeFileSync(path.join(__dirname,'test-results.json'),JSON.stringify(checks,null,2));console.log(checks.filter(x=>x.status==='PASS').length,'/',checks.length);process.exitCode=checks.some(x=>x.status==='FAIL')?1:0;
