const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const root=path.resolve(__dirname,'../..'),c=vm.createContext({console,setTimeout,performance,Blob,TextEncoder,TextDecoder});
for(const f of ['app/reference-data.js','app/coverage-data.js','app/conjugation-pool.js','app/requirement-matrix.js','app/core.js','app/chemistry.js','vendor/jszip.min.js','vendor/xlsx.full.min.js','batch/batch.js','tests/regression/regression-tests.js','tests/regression/phase1-tests.js'])if(fs.existsSync(path.join(root,f)))vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),c);
const L=vm.runInContext('Lite',c),B=vm.runInContext('Batch',c),R=vm.runInContext('REFERENCE',c),evidence={cases:[],invalid:[],baseline:[],legacy:[]};
const deltas={'':{H:1,P:1,O:3},'*':{H:1,P:1,O:2,S:1},'**':{H:1,P:1,O:1,S:2},'^':{C:1,H:3,P:1,O:2},'!':{C:5,H:10,N:3,P:1,O:2},'#':{C:1,H:4,N:1,P:1,O:4,S:1}};
(async()=>{
for(const base of ['dA','rA','mA','fA','rArG','dAdT','mAmG','fAfU'])for(const op of Object.keys(deltas))for(const side of ['five','three','both']){
 const seq=(side!=='three'?'(p)'+op:'')+base+(side!=='five'?op+'(p)':''),r=L.calculate(seq),b=L.calculate(base),n=side==='both'?2:1;
 for(const el of new Set([...Object.keys(r.chemistry.formula_dict),...Object.keys(b.chemistry.formula_dict)]))assert.equal((r.chemistry.formula_dict[el]||0)-(b.chemistry.formula_dict[el]||0),(deltas[op][el]||0)*n,seq+' '+el);
 let exact=0,avg=0;for(const [el,count]of Object.entries(deltas[op])){exact+=R.exact[el]*count*n;avg+=R.average[el]*count*n;}
 assert(Math.abs(r.chemistry.exact_mass-b.chemistry.exact_mass-exact)<1e-8);assert(Math.abs(r.chemistry.average_mw-b.chemistry.average_mw-avg)<1e-8);
 for(const s of ['five','three'])if(r.notation.terminal[s]){const anchor=s==='five'?r.graph.sites[0].o5:r.graph.sites.at(-1).o3;assert(r.graph.bonds.some(v=>(v.a===anchor&&r.graph.atoms[v.b].e==='P')||(v.b===anchor&&r.graph.atoms[v.a].e==='P')));}
 assert.equal(L.parseMol(L.mol(r.graph)).formula,r.chemistry.formula);assert(L.cdxml(r.graph).includes('Element="15"'));assert(L.svg(r.graph).includes('P'));assert(L.quality(r.graph).pass,seq+' layout');
 evidence.cases.push({seq,formula:r.chemistry.formula,exact:r.chemistry.exact_mass,average:r.chemistry.average_mw});
}
for(const seq of ['*rA','rA*','(p)*','*(p)','(p)(p)','rA***(p)','rA*!rG','rA()','()rA','rA(p)rG','(p)*[C6N]','[C3N]*(p)','(p)[spacer3]','[6-FAM](p)','rA*(pp)']){assert.throws(()=>L.calculate(seq));evidence.invalid.push({seq,error:L.calculateSafe(seq).errors});}
for(const seq of ['rA[p]','[p]rA','[PHO]rA','[phosphorylation]rA','[p]*rA','rA**[p]'])assert(L.calculate(seq).canonical_sequence.includes('(p)'));
const baseline=JSON.parse(fs.readFileSync(path.join(root,'tests/evidence/CHEMICAL_BASELINE.json'),'utf8'));const O={calculate:seq=>{if(!baseline[seq])throw Error('Missing independent baseline '+seq);return baseline[seq];}};
for(const seq of ['rA*rG','rA**rG','rA^rG','rA!rG','rA#rG','[NAG37]mAmCmGmU','dCMe*fCMe**+CMe!eCMe#nCMe']){const a=L.calculate(seq),b=O.calculate(seq);assert.equal(JSON.stringify(a.graph.bonds),JSON.stringify(b.graph.bonds));assert.equal(JSON.stringify(a.chemistry),JSON.stringify(b.chemistry));evidence.baseline.push(seq);}
for(const name of ['runLiteRegression','runPhase1Regression'])if(vm.runInContext('typeof '+name,c)==='function'){const r=vm.runInContext(name+'()',c);evidence.legacy.push(r);assert.equal(r.passed,r.total,JSON.stringify(r.checks.filter(x=>x.status==='FAIL')));}
const rows=evidence.cases.map((x,i)=>({ID:''+i,Sequence:x.seq}));rows.splice(3,0,{ID:'bad',Sequence:'rA*'});const batch=await B.run(rows,{formats:['mol','sdf','svg','cdxml']});for(let i=0;i<rows.length;i++)if(rows[i].ID!=='bad')assert.equal(batch.rows[i].Formula,L.calculate(rows[i].Sequence).chemistry.formula);evidence.batch={rows:rows.length,files:Object.keys(batch.zip.files).length,errorRow:batch.rows[3]};
fs.writeFileSync(path.join(root,'tests/evidence/TERMINAL_QA.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify({cases:evidence.cases.length,invalid:evidence.invalid.length,baseline:evidence.baseline.length,legacy:evidence.legacy.map(x=>[x.passed,x.total]),batch:evidence.batch}));
})().catch(e=>{console.error(e);process.exitCode=1;});

