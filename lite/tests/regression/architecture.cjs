const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const root=path.resolve(__dirname,'../..'),ctx=vm.createContext({console});
for(const f of ['reference-data.js','coverage-data.js','core.js','chemistry.js'])vm.runInContext(fs.readFileSync(root+'/app/'+f,'utf8'),ctx);
const L=vm.runInContext('Lite',ctx),R=vm.runInContext('REFERENCE',ctx),copy=x=>JSON.parse(JSON.stringify(x));let cases=0;
const snapshot=JSON.parse(fs.readFileSync(root+'/app/master-library.v2.json','utf8'));
for(const [id,t]of Object.entries(R.templates))assert.deepEqual(copy(L.core.buildingBlock({...t,id})),snapshot.blocks[id]);
assert.deepEqual(copy(L.linkageDefinitions),snapshot.linkages);
function check(seq){const r=L.calculate(seq),ag=copy(r.assembly_graph),g=L.expandAssemblyGraph(ag);assert.equal(L.formula(L.graphFormula(g)),r.chemistry.formula);assert.equal(g.provenance.atoms.length,g.atoms.length);assert.equal(g.provenance.bonds.length,g.bonds.length);for(const [i,b]of g.bonds.entries()){const p=g.provenance.bonds[i];assert(p.kind);if(p.kind==='building-block')assert.equal(g.provenance.atoms[b.a].node,p.node);else assert(p.edge||p.termination);}assert.deepEqual(copy(ag),copy(r.assembly_graph));cases++;return r;}
for(const id of Object.keys(R.templates))check(id.startsWith('{')?'['+id.slice(1,-1)+']':id);
for(const op of ['','*','**','^','!','#'])for(const id of ['eA','eCMe','eG','eT','eI'])for(const seq of ['(p)'+op+id,id+op+'(p)',id+op+id])check(seq);
for(const seq of ['(ppp)rArC(pp)','[C6N]rArC','rArC[C6N]','VpeArArC','[FAM]rArC','pApCpG','tAtG','AgnTgn','rA'.repeat(200)])check(seq);
for(const seq of ['(p)**rA','rA**(p)']){const r=check(seq),t=r.assembly_graph.terminations.find(t=>t.kind==='linkage');assert.equal(t.linkages[0],'PS2');assert(r.graph.provenance.atoms.some(p=>p.termination===t.id));}
const base=L.toAssemblyGraph('rArC'),reject=fn=>{const a=copy(base);fn(a);assert.throws(()=>L.expandAssemblyGraph(a),/CHEMISTRY_UNSUPPORTED/);};
reject(a=>a.edges[0].target.site='downstream');reject(a=>a.edges[0].linkage='PMO');reject(a=>a.terminations=[]);reject(a=>a.nodes[0].block.graph.atoms[a.nodes[0].block.sites.downstream.atom].h=0);reject(a=>a.nodes[1].block.sites.upstream.compatibility_domain='new-undefined');reject(a=>a.nodes[0].position=2);reject(a=>a.edges[0].id=a.nodes[0].id);reject(a=>a.terminations[0].state='unknown-cap');
// Saved semantic graph is sufficient without the live library or parser.
const saved=L.toAssemblyGraph('eA#eCMe');R.templates.eA.atoms[0].e='X';const restored=L.expandAssemblyGraph(copy(saved));assert(L.connected(restored));assert(!restored.atoms.some(a=>a.e==='X'));R.templates.eA.atoms[0].e=saved.nodes[0].block.graph.atoms[0].e;
// Orientation is semantic and governs the exact endpoints, independent of metadata.
const reverse=copy(base);reverse.nodes.forEach(n=>{n.orientation='reverse';n.block.metadata={family:'Unlisted',base:'Unknown'};});reverse.edges[0].source.site='upstream';reverse.edges[0].target.site='downstream';reverse.terminations[0].at.site='downstream';reverse.terminations[1].at.site='upstream';assert.equal(L.formula(L.graphFormula(L.expandAssemblyGraph(reverse))),L.calculate('rArC').chemistry.formula);
// JSON serialization preserves atom/bond stereo, charge and supplied coordinates.
const one=L.toAssemblyGraph('rA');one.nodes[0].block.graph.atoms[0].q=1;const stereo=one.nodes[0].block.graph.bonds.find(b=>b.s);assert(stereo);const full=L.expandAssemblyGraph(copy(one));assert.equal(full.atoms[0].q,1);assert(full.bonds.some(b=>b.s===stereo.s));
for(const id of ['{C3N}','{C6N}','{FAM}','{NAG37}'])assert.equal(Object.keys(L.core.buildingBlock(R.templates[id]).sites).length,1);
for(const id of ['VpmA','VpeA'])assert.equal(Object.keys(L.core.buildingBlock(R.templates[id]).sites).length,1);
assert.equal(L.calculate('rArA').chemistry.formula,'C20H25N10O10P');assert(Math.abs(L.calculate('rArA').chemistry.exact_mass-596.149274)<1e-6);
fs.mkdirSync(root+'/tests/output',{recursive:true});fs.writeFileSync(root+'/tests/output/architecture-result.json',JSON.stringify(L.calculate('(p)**eA#rC')));
const report={version:'0.8.0',registryGraphs:Object.keys(R.templates).length,cases,semanticRoundTrip:true,provenance:true,orientation:true,invalidContractsRejected:true};fs.writeFileSync(root+'/tests/evidence/ARCHITECTURE_v080.json',JSON.stringify(report,null,2));console.log(report);
