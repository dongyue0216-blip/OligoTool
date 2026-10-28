const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const root=path.resolve(__dirname,'../..'),c=vm.createContext({console,setTimeout,performance,Blob,TextEncoder,TextDecoder});
for(const p of ['app/reference-data.js','app/coverage-data.js','app/chemistry.js','vendor/jszip.min.js','vendor/xlsx.full.min.js','batch/batch.js'])vm.runInContext(fs.readFileSync(path.join(root,p),'utf8'),c);
const L=vm.runInContext('Lite',c),R=vm.runInContext('REFERENCE',c),B=vm.runInContext('Batch',c);
const rules={'':{H:1,P:1,O:3},'*':{H:1,P:1,O:2,S:1},'**':{H:1,P:1,O:1,S:2},'^':{C:1,H:3,P:1,O:2},'!':{C:5,H:10,N:3,P:1,O:2},'#':{C:1,H:4,N:1,P:1,O:4,S:1}};
const rows=[],unsupported=[],families={};let assertions=0;
function equal(a,b,msg){assert.equal(a,b,msg);assertions++;}
(async()=>{
for(const [key,t]of Object.entries(R.templates)){
 const res=key.startsWith('{')?'['+key.slice(1,-1)+']':key;
 if(!t['5_prime_attachment'].standard){for(const op of Object.keys(rules))for(const seq of ['(p)'+op+res,res+op+'(p)']){equal(L.calculateSafe(seq).errors[0].code,'CHEMISTRY_UNSUPPORTED',seq);unsupported.push({seq,reason:t['5_prime_attachment'].reason});}continue;}
 const bare=L.calculate(res);(families[t.family]??=[]).push(res);
 for(const [op,delta]of Object.entries(rules))for(const position of ['five','internal','three']){
  const seq=position==='five'?'(p)'+op+res:position==='three'?res+op+'(p)':res+op+res;
  const r=L.calculate(seq),d={...delta};if(position==='internal'){d.H-=2;d.O-=1;}
  const f=r.chemistry.formula_dict,b=bare.chemistry.formula_dict,n=position==='internal'?2:1;
  for(const el of new Set([...Object.keys(f),...Object.keys(b),...Object.keys(d)]))equal((f[el]||0)-n*(b[el]||0),d[el]||0,seq+' '+el);
  for(const [key,table]of [['exact_mass',R.exact],['average_mw',R.average]])assert(Math.abs(r.chemistry[key]-n*bare.chemistry[key]-Object.entries(d).reduce((v,[e,k])=>v+table[e]*k,0))<1e-7,seq+' mass');
  const anchor=position==='three'?r.graph.sites[0].o3:position==='five'?r.graph.sites[0].o5:r.graph.sites[0].o3;
  equal(r.graph.atoms[anchor].e,'O');assert(r.graph.bonds.some(b=>(b.a===anchor&&r.graph.atoms[b.b].e==='P')||(b.b===anchor&&r.graph.atoms[b.a].e==='P')));
  const mol=L.mol(r.graph),lines=mol.split('\n');equal(Number(lines[3].slice(0,3)),r.graph.atoms.length);equal(Number(lines[3].slice(3,6)),r.graph.bonds.length);
  r.graph.atoms.forEach((a,i)=>equal(lines[4+i].slice(31,34).trim(),a.e,seq+' MOL element'));
  // Custom import deliberately rejects charged scaffolds; Z preserves its charges in MOL instead.
  if(!r.graph.atoms.some(a=>a.q||a.iso)){equal(L.parseMol(mol).formula,r.chemistry.formula);equal(L.parseMol(mol+'\n$$$$\n').formula,r.chemistry.formula);}
  assert(L.svg(r.graph).includes('P'));const xml=L.cdxml(r.graph),nodes=[...xml.matchAll(/<n ([^>]+)\/>/g)],bonds=[...xml.matchAll(/<b ([^>]+)\/>/g)],attrs=s=>Object.fromEntries([...s.matchAll(/(\w+)="([^"]*)"/g)].map(m=>[m[1],m[2]])),nums={H:1,C:6,N:7,O:8,F:9,P:15,S:16};
  equal(nodes.length,r.graph.atoms.length);equal(bonds.length,r.graph.bonds.length);
  nodes.forEach((n,i)=>{const a=attrs(n[1]),expected=r.graph.atoms[i];equal(Number(a.Element),nums[expected.e]);equal(Number(a.NumHydrogens),expected.h||0);equal(Number(a.Charge||0),expected.q||0);});
  bonds.forEach((n,i)=>{const a=attrs(n[1]),b=r.graph.bonds[i];equal(Number(a.B)-10,b.a);equal(Number(a.E)-10,b.b);equal(Number(a.Order),b.o);const line=lines[4+r.graph.atoms.length+i];equal(Number(line.slice(0,3))-1,b.a);equal(Number(line.slice(3,6))-1,b.b);equal(Number(line.slice(6,9)),b.o);});
  if(position!=='internal')equal(L.calculate(seq.replace('(p)','[p]')).canonical_sequence,r.canonical_sequence);
  rows.push({residue:res,family:t.family,position,op,sequence:seq,formula:r.chemistry.formula,average_mw:r.chemistry.average_mw,exact_mass:r.chemistry.exact_mass});
 }
}
// Renaming a family and registering a new standard-capability monomer must need no engine change.
R.templates.futureA=JSON.parse(JSON.stringify(R.templates.eA));R.templates.futureA.family='future-family';
for(const op of Object.keys(rules)){equal(L.calculate('(p)'+op+'futureA').chemistry.formula,L.calculate('(p)'+op+'eA').chemistry.formula);equal(L.calculate('futureA'+op+'(p)').chemistry.formula,L.calculate('eA'+op+'(p)').chemistry.formula);}delete R.templates.futureA;
const original=R.templates.eA.attachments.upstream;R.templates.eA.attachments.upstream={...original,atom:0};equal(L.calculateSafe('(p)*eA').errors[0].code,'CHEMISTRY_UNSUPPORTED');R.templates.eA.attachments.upstream=original;
const custom=L.parseMol(fs.readFileSync(path.join(root,'custom_chemistry/custom-MOE-5-3-example.mol'),'utf8'));L.registerCustom('MatrixCustom',custom);
for(const op of Object.keys(rules))for(const seq of ['(p)'+op+'[MatrixCustom]','[MatrixCustom]'+op+'(p)']){const single=L.calculate(seq),batch=await B.run([{ID:'custom',Sequence:seq}],{formats:['mol','sdf','svg','cdxml']});equal(batch.rows[0].Formula,single.chemistry.formula);equal(Object.keys(batch.zip.files).length,4);}
for(const seq of ['rA*','rA(p)rG','(p)*','rA***(p)'])equal(L.calculateSafe(seq).errors[0].code,'SYNTAX_ERROR');
// Every registered member participates in identical position/operator coverage, independent of its base.
for(const [fam,members]of Object.entries(families))for(const res of members)equal(rows.filter(x=>x.residue===res).length,18,fam+' symmetry');
const batchInput=rows.map((r,i)=>({ID:String(i),Sequence:r.sequence}));batchInput.splice(2,0,{ID:'invalid',Sequence:'(p)*pA'});
const batch=await B.run(batchInput,{formats:[]});equal(batch.rows[2]['Chemistry Status'],'CHEMISTRY_UNSUPPORTED');
for(let i=0;i<batchInput.length;i++)if(i!==2){const expected=rows[i<2?i:i-1];equal(batch.rows[i].Formula,expected.formula);assert(Math.abs(Number(batch.rows[i]['Average MW'])-expected.average_mw)<.001);assert(Math.abs(Number(batch.rows[i]['Exact Mass'])-expected.exact_mass)<.001);}
const evidence={version:'0.7.0',standardResidues:Object.values(families).flat().length,families,cases:rows.length,assertions,unsupported,rows,batchRows:batch.rows.length};
fs.writeFileSync(path.join(root,'tests/evidence/ATTACHMENT_MATRIX.json'),JSON.stringify(evidence,null,2));
fs.writeFileSync(path.join(root,'docs/ATTACHMENT_SUPPORT_MATRIX.md'),'# Attachment phosphorus support — v0.7.0\n\nGenerated from declared monomer contracts. Each listed member is tested for PO / PS / PS2 / Me-P / PN(DMI) / MsPA at 5′ terminal, internal and 3′ terminal; formula, atom counts, both masses, export graphs and Single/Batch parity.\n\n|Family|Actual members|5′ / internal / 3′|\n|---|---|---|\n'+Object.entries(families).map(([f,m])=>'|'+f+'|'+m.join(', ')+'|All six chemistries|').join('\n')+'\n\nAlternative topology PMO (OH/NH), TNA and GNA (3′→2′), Vpm/Vpe, and built-in modifiers lack a standard terminal contract and reject terminal phosphorus as CHEMISTRY_UNSUPPORTED. Their existing uncapped/internal behavior is retained. cEt has no implemented graph in this registry, so no support is claimed. Modified polyphosphates require explicit phosphorus-position definitions and remain unsupported. Custom monomers obtain contracts after one or two real neutral alcohol attachment sites pass import validation. A missing side is never fabricated; see BUILDING_BLOCK_ARCHITECTURE.md.\n');
console.log(JSON.stringify({residues:evidence.standardResidues,cases:rows.length,assertions,unsupported:unsupported.length,batchRows:batch.rows.length}));
})().catch(e=>{console.error(e);process.exitCode=1});
