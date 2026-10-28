const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const root=path.resolve(__dirname,'../..'),c=vm.createContext({console,setTimeout,performance,Blob,TextEncoder,TextDecoder});
for(const f of ['app/reference-data.js','app/coverage-data.js','app/core.js','app/chemistry.js','vendor/jszip.min.js','vendor/xlsx.full.min.js','batch/batch.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),c);
const L=vm.runInContext('Lite',c),R=vm.runInContext('REFERENCE',c),B=vm.runInContext('Batch',c),cases=[],ops=['','*','**','^','!','#'];let assertions=0;
const eq=(a,b,m)=>{assert.equal(a,b,m);assertions++;};
function verify(seq){try{return verifyGraph(seq);}catch(e){throw Error(seq+': '+e.message);}}
function verifyGraph(seq){const r=L.calculate(seq);eq(r.formula_validation.equal,true,seq);if(r.graph.atoms.every(a=>!a.q)){eq(L.parseMol(L.mol(r.graph)).formula,r.chemistry.formula,seq+' MOL');eq(L.parseMol(L.mol(r.graph)+'\n$$$$\n').formula,r.chemistry.formula,seq+' SDF');}else{assert.throws(()=>L.parseMol(L.mol(r.graph)),/CHNOPS/);}assert(L.svg(r.graph).endsWith('</svg>'));const cd=L.cdxml(r.graph),nodes=[...cd.matchAll(/<n\b[^>]+\/>/g)],bonds=[...cd.matchAll(/<b\b[^>]+\/>/g)],nums={H:1,C:6,N:7,O:8,F:9,P:15,S:16};eq(nodes.length,r.graph.atoms.length);eq(bonds.length,r.graph.bonds.length);nodes.forEach(([line],i)=>{const a=Object.fromEntries([...line.matchAll(/(\w+)="([^"]*)"/g)].map(x=>[x[1],x[2]]));eq(Number(a.Element),nums[r.graph.atoms[i].e]);eq(Number(a.NumHydrogens),r.graph.atoms[i].h||0);eq(Number(a.Charge||0),r.graph.atoms[i].q||0);});bonds.forEach(([line],i)=>{const a=Object.fromEntries([...line.matchAll(/(\w+)="([^"]*)"/g)].map(x=>[x[1],x[2]])),b=r.graph.bonds[i];eq(Number(a.B)-10,b.a);eq(Number(a.E)-10,b.b);eq(Number(a.Order),b.o);});cases.push({seq,formula:r.chemistry.formula,atoms:r.graph.atoms.length,exact:r.chemistry.exact_mass});return r;}
function ohs(g){return g.atoms.map((a,i)=>a.e==='O'&&a.h===1?i:null).filter(i=>i!==null);}
function bad(seq,reason){const r=L.calculateSafe(seq);eq(r.status,'error',seq);eq(r.errors[0].code,'CHEMISTRY_UNSUPPORTED',seq+' '+reason);eq(r.graph,null);eq(r.chemistry,null);}
(async()=>{
 const standard=Object.entries(R.templates).filter(([,t])=>t.assembly_class==='o-phosphorus');
 for(const [id,t]of standard){
  for(const [direction,site]of Object.entries(t.attachments)){eq(site.direction,direction);eq(t.atoms[site.atom].e,site.element);eq(site.connection_class,'alcohol');eq(site.allowed_linkage_classes.length,6);}
  for(const op of ops)for(const seq of ['(p)'+op+id,id+op+'(p)',id+op+id])verify(seq);
 }
 for(const id of ['eA','eCMe','eG','eT','eI'])assert(standard.some(([key])=>key===id));
 // New graph/contract, arbitrary identity metadata: no family or sugar dispatch required.
 const future=JSON.parse(JSON.stringify(R.templates.eA));future.id='Future';future.family='Novel';future.base='Unknown';future.sugar='Unlisted';delete future.o5;delete future.o3;delete future.phosphorus_topology;delete future['5_prime_attachment'];delete future['3_prime_attachment'];R.templates.Future=future;
 for(const op of ops)for(const seq of ['(p)'+op+'Future','Future'+op+'(p)','Future'+op+'Future'])verify(seq);

 for(const [name,smiles]of [['PrimarySecondary','OCC(O)C'],['SecondaryPrimary','CC(O)CO'],['SecondarySecondary','CC(O)C(O)C']]){
  const imported=L.parseSmiles(smiles),sites=ohs(imported.graph);eq(sites.length,2);const block=L.registerCustom(name,L.selectAttachments(imported,...sites));eq(Object.keys(block.attachments).length,2);
  for(const op of ops)for(const seq of ['(p)'+op+'['+name+']','['+name+']'+op+'(p)','rA'+op+'['+name+']'+op+'eA'])verify(seq);
 }
 for(const side of ['upstream','downstream']){
  const name=side==='upstream'?'UpOnly':'DownOnly',i=L.parseSmiles('CC(O)C'),o=ohs(i.graph)[0],block=L.registerCustom(name,L.selectAttachments(i,side==='upstream'?o:null,side==='downstream'?o:null));
  eq(Object.keys(block.attachments).length,1);eq(block.attachments[side].atom,o);assert(!block.attachments[side==='upstream'?'downstream':'upstream']);
  for(const op of ops){verify(side==='upstream'?'rA'+op+'['+name+']':'['+name+']'+op+'rA');verify(side==='upstream'?'(p)'+op+'['+name+']':'['+name+']'+op+'(p)');}
  bad('rA['+name+']rA','one-site cannot be internal');bad(side==='upstream'?'[UpOnly]rA':'rA[DownOnly]','wrong end');bad(side==='upstream'?'[UpOnly](p)':'(p)[DownOnly]','missing endpoint');
  const restored=L.parseMol(L.mol(block));L.registerCustom(name+'Restore',L.selectAttachments(restored,block.o5,block.o3));verify(side==='upstream'?'rA['+name+'Restore]':'['+name+'Restore]rA');
 }
 // Existing isotope/R-group marker fixture, aliases, direct-O maps, SDF metadata and fallback.
 const marker=fs.readFileSync(path.join(root,'custom_chemistry/attachment-demo.mol'),'utf8');eq(Object.keys(L.parseMol(marker).attachments).length,2);
 const markerResult=L.parseMol(marker);let lines=L.mol(markerResult.graph).split('\n'),os=ohs(markerResult.graph);
 for(const [n,index]of os.entries()){let row=lines[4+index];lines[4+index]=row.slice(0,60)+String(n===0?5:3).padStart(3)+row.slice(63);}
 eq(Object.keys(L.parseMol(lines.join('\n')).attachments).length,2);
 const plain=L.mol(markerResult.graph),alias=plain.replace('M  END',`A  ${String(os[0]+1).padStart(3)}\n5′\nA  ${String(os[1]+1).padStart(3)}\n3′\nM  END`);
 eq(Object.keys(L.parseMol(alias).attachments).length,2);
 const oneAlias=plain.replace('M  END',`A  ${String(os[0]+1).padStart(3)}\n5\nM  END`);const oneMarked=L.parseMol(oneAlias);eq(Object.keys(oneMarked.attachments).length,1);eq(oneMarked.assembly_supported,true);L.registerCustom('AutoSingle',oneMarked);verify('rA[AutoSingle]');
 const sdf=plain+`\n>  <UPSTREAM_ATTACHMENT>\n${os[0]+1}\n\n>  <DOWNSTREAM_ATTACHMENT>\n${os[1]+1}\n\n$$$$\n`;
 eq(Object.keys(L.parseMol(sdf).attachments).length,2);eq(Object.keys(L.parseMol(sdf,{manualMarkers:true}).attachments).length,0);
 eq(Object.keys(L.parseMol(plain).attachments).length,0);L.selectAttachments(L.parseMol(plain),...os);
 assert.throws(()=>L.parseMol(sdf+sdf),/one MOL\/SDF molecule/);
 // V3000 logical lines, sparse IDs and directional O atom maps.
 const sparse=['Sparse','test','','  0  0  0     0  0            999 V3000','M  V30 BEGIN CTAB','M  V30 COUNTS 4 3 0 0 0','M  V30 BEGIN ATOM','M  V30 10 O 0 0 0 -','M  V30 5','M  V30 20 C 1.5 0 0 0','M  V30 30 C 3 0 0 0','M  V30 40 O 4.5 0 0 3','M  V30 END ATOM','M  V30 BEGIN BOND','M  V30 7 1 10 20','M  V30 8 1 20 30','M  V30 9 1 30 40','M  V30 END BOND','M  V30 END CTAB','M  END',''].join('\n');
 const sparseImported=L.parseMol(sparse);eq(sparseImported.formula,'C2H6O2');eq(sparseImported.attachments[5],0);eq(sparseImported.attachments[3],3);assert.throws(()=>L.parseMol(sparse.replace('40 O 4.5 0 0 3','40 O 4.5 0 0 3 MASS=bad')),/Invalid V3000/);
 for(const size of [1200,12000]){
  const g={atoms:Array.from({length:size},(_,i)=>({e:i===0||i===size-1?'O':'C',h:i===0||i===size-1?1:2,x:1e8+i*10000,y:1e8+(i%2)*5000,q:0})),bonds:Array.from({length:size-1},(_,i)=>({a:i,b:i+1,o:1,s:i===10?1:0}))};
  const mol=L.mol(g);assert(mol.includes('V3000'));const imported=L.parseMol(mol);eq(imported.graph.atoms.length,size);eq(imported.graph.bonds[10].s,1);eq(imported.formula,L.formula(L.graphFormula(g)));assert(!/NaN|Infinity/.test(L.svg(imported.graph)));
  const block=L.registerCustom('Large'+size,L.selectAttachments(imported,0,size-1));eq(block.atoms.length,size);verify('[Large'+size+']');
 }
 // Bounding box and origin affect display only, not graph identity or admission.
 const stretched=L.parseSmiles('OCCO');for(const a of stretched.graph.atoms){a.x=a.x*1e7+1e10;a.y=a.y*1e7-1e10;}L.registerCustom('Wide',L.selectAttachments(stretched,0,3));verify('rA[Wide]eA');
 const mass=verify('rArA');eq(mass.chemistry.formula,'C20H25N10O10P');assert(Math.abs(mass.chemistry.exact_mass-596.149274)<1e-6);
 for(const seq of ['pApCpGpT','tAtCMetGtT','AgnCgnGgnTgn'])verify(seq);
 for(const seq of ['pA*pC','(p)pA','pA(p)','pArA','rAtA','rAAgn','(p)tA','Agn(p)','cEt-A']){
  if(seq==='cEt-A'){eq(L.calculateSafe(seq).status,'error');continue;}bad(seq,'alternative topology');
 }
 // Changing descriptive family metadata cannot change topology restrictions or graph.
 for(const key of ['pA','pC','tA','Agn']){const family=R.templates[key].family;R.templates[key].family='Relabeled';verify(key);bad('(p)'+key,'topology retained');R.templates[key].family=family;}
 for(const n of [60,200,300]){const r=verify('rA'.repeat(n));eq(r.graph.sites.length,n);}
 const input=cases.filter(x=>x.atoms<1000).map((x,i)=>({ID:String(i),Sequence:x.seq})),batch=await B.run(input,{formats:[]});eq(batch.rows.length,input.length);
 for(let i=0;i<input.length;i++)eq(batch.rows[i].Formula,L.calculate(input[i].Sequence).chemistry.formula);
 const exports=await B.run([{ID:'new-custom',Sequence:'rA[SecondarySecondary]eA'},{ID:'one-site',Sequence:'[DownOnly]rA'}],{formats:['mol','sdf','svg','cdxml']});eq(Object.keys(exports.zip.files).length,8);
 fs.writeFileSync(path.join(root,'tests/evidence/BUILDING_BLOCKS_v070.json'),JSON.stringify({version:'0.7.0',standardBlocks:standard.length,caseCount:cases.length,assertions,batchRows:batch.rows.length,largeAtoms:[1200,12000],cases},null,2));console.log(JSON.stringify({standardBlocks:standard.length,caseCount:cases.length,assertions,batchRows:batch.rows.length,largeAtoms:[1200,12000]}));
})().catch(e=>{console.error(e);process.exitCode=1;});
