'use strict';
function runLiteRegression(){
 const checks=[],assert=(v,m='assertion failed')=>{if(!v)throw Error(m);},eq=(a,b)=>assert(a===b,JSON.stringify(a)+' != '+JSON.stringify(b)),test=(name,fn)=>{try{fn();checks.push({name,status:'PASS'});}catch(e){checks.push({name,status:'FAIL',error:e.message});}};
 const L=Lite;
 for(const t of REFERENCE.golden)test('golden '+t.sequence,()=>{const r=L.calculate(t.sequence);eq(r.chemistry.formula,t.formula);assert(Math.abs(r.chemistry.exact_mass-t.exact_mass)<1e-8);eq(r.graph.atoms.length,t.atoms);eq(r.graph.bonds.length,t.bonds);if(t.od)eq(r.optical.epsilon260,t.od.epsilon260);});
 test('historical rArA',()=>{const r=L.calculate('rArA');eq(r.chemistry.formula,'C20H25N10O10P');assert(Math.abs(r.chemistry.exact_mass-596.149274)<1e-6);});
 for(const side of ['five','three'])for(const n of [1,2,3])test(side+' phosphate '+n,()=>{
 const token='('+'P'.repeat(n)+')',r=L.calculate((side==='five'?token:'')+'rArA'+(side==='three'?token:'')),g=r.graph;
 eq(r.chemistry.formula,'C20H'+(25+n)+'N10O'+(10+3*n)+'P'+(1+n));assert(L.connected(g));assert(!r.canonical_sequence.includes('P'));
 for(const [i,a]of g.atoms.entries()){const v=g.bonds.filter(b=>b.a===i||b.b===i).reduce((s,b)=>s+b.o,0)+(a.h||0);if(a.e==='P')eq(v,5);if(a.e==='O')eq(v,2);}
 // Independent topology: each new P has one P=O and three P-O;
 // exactly n-1 oxygen bridges connect successive terminal P atoms.
 const added=g.atoms.map((a,i)=>i).filter(i=>i>=L.calculate('rArA').graph.atoms.length),newP=added.filter(i=>g.atoms[i].e==='P');eq(newP.length,n);
 for(const i of newP){const bonds=g.bonds.filter(b=>b.a===i||b.b===i);eq(bonds.length,4);eq(bonds.filter(b=>b.o===2).length,1);assert(bonds.every(b=>g.atoms[b.a===i?b.b:b.a].e==='O'));}
 eq(added.filter(i=>g.atoms[i].e==='O'&&g.bonds.filter(b=>(b.a===i&&newP.includes(b.b))||(b.b===i&&newP.includes(b.a))).length===2).length,n-1);
 const original=L.calculate('rArA').graph.sites,anchor=side==='five'?original[0].o5:original[1].o3;assert(g.bonds.some(b=>b.a===anchor&&newP.includes(b.b)));eq(g.atoms[anchor].h,0);
 eq(L.parseMol(L.mol(g)).formula,r.chemistry.formula);
 });
 const fixture="\r\n     RDKit          2D\r\n\r\n  6  5  0  0  0  0  0  0  0  0999 V2000\r\n   -3.2624   -0.2097    0.0000 R   0  0  0  0  0  1  0  0  0  0  0  0\r\n   -1.9270    0.4734    0.0000 O   0  0  0  0  0  0  0  0  0  0  0  0\r\n   -0.6677   -0.3416    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0\r\n    0.6677    0.3416    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0\r\n    1.9270   -0.4734    0.0000 O   0  0  0  0  0  0  0  0  0  0  0  0\r\n    3.2624    0.2097    0.0000 R   0  0  0  0  0  1  0  0  0  0  0  0\r\n  1  2  1  0\r\n  2  3  1  0\r\n  3  4  1  0\r\n  4  5  1  0\r\n  5  6  1  0\r\nM  ISO  2   1   5   6   3\r\nM  END\r\n";
 let imported;
 test('ChemDraw marker import',()=>{imported=L.parseMol(fixture);assert(imported.assembly_supported);assert(imported.graph.atoms.every(a=>!['*','5','3','R#'].includes(a.e)));for(const i of Object.values(imported.attachments)){eq(imported.graph.atoms[i].e,'O');eq(imported.graph.atoms[i].h,1);}});
 const name='RegressionFixture',key='{'+name+'}',prior=L.customLibrary[key];
 try{
 L.registerCustom(name,imported);
 for(const seq of ['[RegressionFixture]rA','rA[RegressionFixture]','rA[RegressionFixture]rC','[RegressionFixture][RegressionFixture]','(pp)[RegressionFixture]rA(ppp)','rA{RegressionFixture}*eC'])test('assemble '+seq,()=>{const r=L.calculate(seq);assert(L.connected(r.graph));assert(r.canonical_sequence.includes('[RegressionFixture]'));eq(L.parseMol(L.mol(r.graph)).formula,r.chemistry.formula);for(const format of ['mol','svg','cdxml'])assert(L[format](r.graph).length>100);});
 test('library serialization and restore',()=>{const g=JSON.parse(JSON.stringify(L.customLibrary[key]));delete L.customLibrary[key];L.registerCustom(name,L.selectAttachments(L.parseMol(L.mol(g)),g.o5,g.o3));assert(L.calculate('[RegressionFixture]').chemistry.formula);});
 }finally{if(prior)L.customLibrary[key]=prior;else delete L.customLibrary[key];}
 test('unknown ID',()=>{const r=L.calculateSafe('rA[PEG44]');eq(r.status,'error');eq(r.errors[0].message,'[PEG44] not found in Custom Chemistry Library');});
 for(const seq of ['rA(p)rA','(pppp)rA','rA*','(p)','[bad-id]'])test('reject '+seq,()=>eq(L.calculateSafe(seq).status,'error'));
 test('manual fallback',()=>{const r=L.parseSmiles('OCCO');assert(!r.assembly_supported);assert(L.selectAttachments(r,0,3).assembly_supported);let rejected=false;try{L.selectAttachments(r,1,3);}catch(e){rejected=true;}assert(rejected);});
 test('ambiguous marker fallback',()=>{const f=fixture.replace(/^M  ISO.*$/m,'');let rejected=false;try{L.parseMol(f);}catch(e){rejected=true;}assert(rejected);const r=L.parseMol(f,{manualMarkers:true});assert(!r.assembly_supported);assert(L.selectAttachments(r,imported.attachments[5],imported.attachments[3]).assembly_supported);});
 test('bamboo layout',()=>{const r=L.calculate('ACGTACGTACGTACGTACGTACGT');eq(r.graph.layout.rows,10);eq(r.graph.routes.length,2);eq(L.quality(r.graph).column_top_errors.length,0);});

 test('SDF first molecule',()=>{const r=L.parseMol(fixture+'\n$$\n'+fixture+'\n$$\n');eq(r.formula,imported.formula);assert(r.assembly_supported);});
 test('ChemDraw numeric aliases',()=>{const f=fixture.replace(/^M  ISO.*$/m,'').replace('M  END','A    1\n5\nA    6\n3\nM  END');assert(L.parseMol(f).assembly_supported);});
 test('incomplete markers require manual fallback',()=>{const f=fixture.replace('M  ISO  2   1   5   6   3','M  ISO  1   1   5');let failed=false;try{L.parseMol(f);}catch(e){failed=true;}assert(failed);assert(!L.parseMol(f,{manualMarkers:true}).assembly_supported);});
 test('SMILES unsupported syntax fails closed',()=>{for(const seq of ['c1ccccc1','C1CC1','[Na+]','C.O','C@C']){let failed=false;try{L.parseSmiles(seq);}catch(e){failed=true;}assert(failed);}});
 test('all export graph counts and identifiers',()=>{const g=L.buildStructure('(ppp)rA*rC**fG&mU(pp)'),xml=L.cdxml(g),svg=L.svg(g);eq((xml.match(/<n /g)||[]).length,g.atoms.length);eq((xml.match(/<b /g)||[]).length,g.bonds.length);assert(svg.startsWith('<svg'));assert(svg.endsWith('</svg>'));eq(L.parseMol(L.mol(g)+'\n$$\n').formula,L.formula(L.graphFormula(g)));});
 return {version:'0.2.1',total:checks.length,passed:checks.filter(t=>t.status==='PASS').length,checks};
}
