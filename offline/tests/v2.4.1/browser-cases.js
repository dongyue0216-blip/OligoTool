async function (fixtures) {
 const $=id=>document.getElementById(id);
 const copy=x=>JSON.parse(JSON.stringify(x));
 const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 const click=id=>{const el=$(id);if(!el||el.disabled||!el.getClientRects().length)throw Error(id+' unavailable');el.click();};
 const set=(id,value,event='change')=>{const el=$(id);el.value=value;el.dispatchEvent(new Event(event,{bubbles:true}));};
 const V=Reactions.v2, refs=REACTION_REAGENTS, lib=id=>'builtin:linker1:'+id;
 const mol=(g,ext)=>Lite.mol(g)+(ext==='sdf'?'\n$$$$\n':'');
 const g=id=>refs[id]?.graph||Lite.parseSmiles(id).graph;
 const pick=s=>Object.fromEntries(Object.entries(s.reactiveSites).filter(([,v])=>Array.isArray(v)&&v.length).map(([k,v])=>[k,v.map(a=>({id:a.site_id,motif:a.motif_type,atoms:a.atoms,atomIds:a.selected_atom_ids}))]));
 const options=id=>Array.from($(id).options).filter(o=>o.value).map(o=>({id:o.value,label:o.textContent}));
 const state=s=>({id:s.id,parent:s.parentStateId,revision:s.graphRevision,formula:s.formula,mw:s.average_mw,exact:s.exact_mass,sites:pick(s),attachments:s.attachmentSites,lanes:s.assemblyGraph.lanes.map(l=>({id:l.id,atomIndices:l.atomIndices})),graph:s.graph});
 const results=[];
 await SmallFragmentDepictor.ready;
 const probe={};
 const initialFamily=$('builderFamily').value;
 const capture=fn=>{try{return fn();}catch(e){return {error:e.message};}};
 const raw=fixtures['JQ1.mol'];
 const parsed=capture(()=>V.parseReagent(raw,'Click'));
 probe.parsed=parsed.error?parsed:{count:[parsed.atoms.length,parsed.bonds.length],atoms:parsed.atoms.slice(33),bonds:parsed.bonds.slice(0,3),group:parsed.ctfile?.groups,properties:Lite.graphProperties(parsed),azide:V.detect([parsed]).candidate_sites[0].azide};
 const listed=Product.store.reagents('builtin',null,{});
 const definition={amine:'acyl-substitution/2',thiol:'thiol-maleimide/2',cap:'cap-im-m7gdp/2',cu:'cuaac-1,4/2',spa:'spaac/2',iedda:'iedda/2',red:'disulfide-reduction/2',branch:'BranchElongation'};
 const loss={NHS:{C:4,H:5,N:1,O:3},pNP:{C:6,H:5,N:1,O:3},acid:{H:2,O:1},CAP:{C:3,H:4,N:2},IEDDA:{N:2},sulfo:{C:4,H:5,N:1,O:6,S:1},PFP:{C:6,H:1,F:5,O:1},TFP:{C:6,H:2,F:4,O:1}};
 const counters=(graph)=>{const r={};for(const a of graph.atoms){r[a.e]=(r[a.e]||0)+1;if(a.h)r.H=(r.H||0)+a.h;}return r;};
 const formulaDelta=(before,reagent,after,expected)=>{
  const a=counters(before),b=reagent?counters(reagent):{},p=counters(after);
  const keys=new Set([...Object.keys(a),...Object.keys(b),...Object.keys(p),...Object.keys(expected)]);
  const actual=Object.fromEntries([...keys].map(e=>[e,(a[e]||0)+(b[e]||0)-(p[e]||0)]).filter(([,n])=>n));
  return {actual,expected,ok:[...keys].every(e=>(actual[e]||0)===(expected[e]||0))};
 };
 const status=()=>({info:$('builderCandidateInfo').textContent,status:$('builderStatus').textContent,previewDisabled:$('builderPreview').disabled,applyDisabled:$('builderApply').disabled});
 async function upload(text,extension){
  set('builderReagentSource','upload');
  const dt=new DataTransfer();dt.items.add(new File([text],text===raw?'JQ1.mol':'unnamed-audit.'+extension));
  $('builderReagentFile').files=dt.files;
  $('builderReagentFile').dispatchEvent(new Event('change',{bubbles:true}));
  for(let i=0;i<100&&!$('builderReagent').value;i++)await new Promise(r=>setTimeout(r,10));
  if(!$('builderReagent').value)throw Error('file text did not load');
 }
 async function run(id,start,steps){
  const row={id,start,steps:[]};results.push(row);
  let previous=null;
  for(const spec of steps){
   const [key,source,reagent,expectedLoss,created,preserved,manual,choice]=spec;
   const r={definition:definition[key],source,reagent,manual:!!manual,status:'FAIL',stage:'starting molecule'};
   row.steps.push(r);
   try{
    if(!previous){
     set('kind',start.kind);set('input',start.input,'input');click('builderStart');
     previous=MoleculeBuilderUI.states[0];
    }
    r.before=state(previous);
    r.stage='open draft';click('builderAdd');set('builderOperation',key==='branch'?'branch':'reaction');
    r.stage='second reactant';
    if(manual){
     click('builderManual');
     if(manual!=='auto')set('builderFamily',key==='red'?'DisulfideReduction':key==='cap'?'CAP':'Click');
    }
    let second=null;
    if(key==='branch'){set('builderSequence',reagent,'input');set('builderChildEnd','end');}
    else if(source==='builtin'){
     r.library=options('builderReagentLibraryEntry').map(o=>o.id);
     if(!r.library.includes(reagent))throw Error('reagent absent from Built-in selector');
     set('builderReagentLibraryEntry',reagent);second=refs[reagent].graph;
    }else if(source==='mol'||source==='sdf'){
     const asset=fixtures[reagent]||(typeof refs[reagent]==='string'?refs[reagent]:null);
     const text=asset?asset+(source==='sdf'?'\n$$$$\n':''):mol(g(reagent),source);
     r.upload=text;
     await upload(text,source);
     try{second=V.parseReagent(text);}catch(e){
      r.parseError=e.message;
      const localized=SmallFragmentDepictor.localizeAromaticBonds(text);
      if(localized)second=V.parseReagent(localized);
     }
    }
    if(manual)click('builderDetect');
    r.discovery=status();r.choices=options('builderCandidate');r.initialSelection=$('builderCandidate').value;
    r.motifs=second?V.detect([second]).candidate_sites[0]:null;
    r.stage='auto-discovery';
    if(key!=='branch'){
     const matching=r.choices.filter(o=>o.id.startsWith(definition[key]+':'));
     if(choice==='reject'){
      if(r.choices.length||!r.discovery.previewDisabled||!r.discovery.applyDisabled)throw Error('negative control became actionable');
      r.status='EXPECTED REJECTION';r.stage='done';break;
     }
     if(!matching.length)throw Error(r.discovery.status||r.discovery.info||'no candidate for '+definition[key]);
     r.stage='select candidate';
     if(choice==='unique'&&(matching.length!==1||$('builderCandidateLabel').getClientRects().length))
      throw Error('equivalent products require an extra click');
     if(choice==='b'&&!matching.some(o=>o.id.endsWith(':b')))throw Error('distinct regioisomer was hidden');
     if(choice==='b'||!matching.some(o=>o.id===$('builderCandidate').value)){
      if(!$('builderCandidate').getClientRects().length||$('builderCandidate').disabled)throw Error('candidate selector unavailable');
      set('builderCandidate',(choice==='b'?matching.at(-1):matching[0]).id,'input');
     }
     r.selected=$('builderCandidate').value;
    }
    r.stage='preview';r.beforePreview=status();
    if(!r.beforePreview.applyDisabled)throw Error('Apply is enabled before Preview');
    click('builderPreview');
    const product=MoleculeBuilderUI.preview;
    r.previewUI=status();if(!product)throw Error(r.previewUI.status||'no preview state');
    r.stage='apply';click('builderApply');
    const next=MoleculeBuilderUI.states.at(-1);
    r.after=state(next);r.applyUI=status();r.stage='product verification';
    const op=next.operation, maps=op.inputAtomMaps, productSites=pick(next);
    const roles=Object.fromEntries((op.candidate?.roles||[]).map((role,k)=>[role,Object.fromEntries(Object.entries(op.candidate.sites[k].atoms).map(([a,i])=>[a,maps[k][i]]))]));
    const bond=(a,b,order)=>Number.isInteger(a)&&Number.isInteger(b)&&next.graph.bonds.some(x=>x.o===order&&((x.a===a&&x.b===b)||(x.b===a&&x.a===b)));
    let reactionBonds=true;
    if(key==='spa'||key==='cu'){
     const az=roles.azide,alk=roles.alkyne||roles.strainedAlkyne;
     const [first,last]=r.selected.endsWith(':b')?[alk.internal,alk.terminal]:[alk.terminal,alk.internal];
     reactionBonds=bond(az.proximal,first,1)&&bond(az.distal,last,1)&&bond(first,last,2)&&bond(az.middle,az.distal,2)&&bond(az.proximal,az.middle,1);
    }else if(key==='iedda'){
     const annotation=next.graph.provenance.reaction_products.at(-1);
     const ring=annotation.ring;
     reactionBonds=ring.map(i=>next.graph.atoms[i].e).join('')==='CNNCCC'&&[2,1,2,1,1,1].every((order,i)=>bond(ring[i],ring[(i+1)%ring.length],order));
    }else if(key==='amine'){
     reactionBonds=bond(roles.amine.n,roles.acylDonor.carbonyl,1)&&roles.acylDonor.leavingO===null;
    }else if(key==='thiol'){
     reactionBonds=bond(roles.thiol.s,roles.maleimide.alpha,1)&&bond(roles.maleimide.alpha,roles.maleimide.beta,1);
    }else if(key==='red'){
     const {s1,s2}=roles.disulfide;
     reactionBonds=!bond(s1,s2,1)&&[s1,s2].filter(Number.isInteger).every(i=>next.graph.atoms[i].h===1);
    }else if(key==='cap'){
     reactionBonds=bond(roles.terminalPhosphateNucleophile.o,roles.m7GDPImidazolide.p,1)&&roles.m7GDPImidazolide.leavingN===null;
    }
    const mapOK=maps?.every((map,k)=>map.length===(k?second:previous.graph).atoms.length&&map.every((i,j)=>i===null||next.graph.atoms[i]?.e===(k?second:previous.graph).atoms[j].e));
    const retained=maps?.flat().filter(i=>i!==null);
    const preservedBondCheck=maps?.every((map,k)=>(k?second:previous.graph).bonds.every(b=>{
     if(map[b.a]==null||map[b.b]==null)return true;
     const selected=Object.values(op.candidate.sites[k].atoms);
     return selected.includes(b.a)||selected.includes(b.b)||next.graph.bonds.some(x=>x.o===b.o&&((x.a===map[b.a]&&x.b===map[b.b])||(x.b===map[b.a]&&x.a===map[b.b])));
    }));
    const consumed=op.candidate?.sites.map((site,k)=>{
     const mapped=Object.values(site.atoms).map(i=>maps[k][i]);
     return {role:site.type,mapped,closed:!(productSites[op.candidate.roles[k]]||[]).some(p=>Object.values(p.atoms).length===mapped.length&&Object.values(p.atoms).every(i=>mapped.includes(i)))};
    });
    const preservedOK=!preserved||!!pick(previous)[preserved]?.some(p=>productSites[preserved]?.some(n=>equal(Object.values(p.atoms).map(i=>maps[0][i]),Object.values(n.atoms))));
    const createdOK=!created||!!productSites[created]?.some(p=>Object.values(p.atoms).some(i=>!maps?.[0].includes(i)))||key==='red'&&!!productSites[created]?.length;
    const delta=expectedLoss?formulaDelta(previous.graph,second,next.graph,loss[expectedLoss]||{}):null;
    const properties=Lite.graphProperties(next.graph);
    const massDelta=delta&&['average_mw','exact_mass'].map((k,j)=>{
     const weights=j?REFERENCE.exact:REFERENCE.average;
     const expected=Object.entries(delta.expected).reduce((v,[e,n])=>v+weights[e]*n,0);
     const actual=previous[k]+(second?Lite.graphProperties(second)[k]:0)-next[k];
     return {k,actual,expected,ok:Math.abs(actual-expected)<0.003};
    });
    r.product={selectedSites:op.candidate?.sites,maps,siteRemapping:op.siteRemapping,graphEdits:op.graphEdits?.edits,consumed,created,preserved,delta,massDelta,checks:{
     appliedPreview:next===product&&$('builderDraft').hidden,
     connected:Lite.connected(next.graph),
     formulaMW:next.formula===properties.formula&&next.average_mw===properties.average_mw&&next.exact_mass===properties.exact_mass&&(!delta||delta.ok&&massDelta.every(m=>m.ok)),
     lineage:next.parentStateId===previous.id&&next.graphRevision===previous.graphRevision+1&&next.history.length===previous.history.length+1,
     provenance:key==='branch'||mapOK&&retained.length===next.graph.atoms.length&&new Set(retained).size===retained.length&&equal(maps,next.graph.provenance.input_atom_maps)&&op.inputStateIds[0]===previous.id,
     preservedBonds:key==='branch'||preservedBondCheck,
     reactionBonds,
     attachmentRemap:key==='branch'||next.attachmentSites.every((a,i)=>a.id===previous.attachmentSites[i].id&&(a.atom??null)===(maps[0][previous.attachmentSites[i].atom]??null)),
     consumed:key==='branch'||consumed.every(c=>c.closed),created:createdOK,preserved:preservedOK
    }};
    const failures=Object.entries(r.product.checks).filter(([,v])=>!v).map(([k])=>k);
    if(failures.length){r.failure=failures.join(', ');r.status='FAIL';}
    else{r.stage='done';r.status=manual?'MANUAL PASS':'PASS';}
    previous=next;
   }catch(e){r.failure=e.message;r.ui=status();break;}
  }
  for(let i=row.steps.length;i<steps.length;i++)row.steps.push({definition:definition[steps[i][0]],status:'BLOCKED',stage:'prior step failed'});
 }
 const seq=input=>({kind:'sequence',input}), sm=input=>({kind:'smiles',input}), startMol=id=>({kind:'mol',input:fixtures[id]||mol(g(id),'mol')});
 const am=(r='ester',src='builtin',create=null,keep=null,by='NHS')=>['amine',src,r,by,create,keep];
 const thiol=(r='maleimide',src='builtin')=>['thiol',src,r,'none'];
 const clickStep=(key,r,src='builtin')=>[key,src,r,'none'];
 const iedda=(r,src)=>['iedda',src,r,'IEDDA'];
 const s=seq('[C6N]rArC');
 await run('A01 NHS acetate',s,[am()]);
 await run('A02 pNP carbonate',s,[am('pnp-carbonate','builtin',null,null,'pNP')]);
 await run('A03 carboxylic acid (formal)',s,[am('acid.mol','mol',null,null,'acid')]);
 await run('A04 alternate primary amine',sm('CCCN'),[am('ester','sdf')]);
 for(const [id,smiles,by] of [['A05 sulfo-NHS','sulfo-nhs.mol','sulfo'],['A06 PFP','pfp.mol','PFP'],['A07 TFP','tfp.mol','TFP']]){
  await run(id,s,[am(smiles,'mol',null,null,by)]);
 }
 await run('C01 CAP activated built-in',seq('[p]rA'),[['cap','builtin','cap-imidazolide','CAP']]);
 await run('C02 CAP activated SDF',seq('[p]rA'),[['cap','sdf','cap-imidazolide','CAP']]);
 await run('C independent m7GDP-imidazolide MOL',seq('[p]rA'),[['cap','mol','m7gdp-imidazolide.mol','CAP']]);
 await run('C03 unactivated GDP control',seq('[p]rA'),[['cap','mol','cap','CAP',null,null,false,'reject']]);
 await run('K01 CuAAC built-in azide',sm('CCCC#C'),[clickStep('cu','azide')]);
 await run('K02 CuAAC built-in alkyne',startMol('azide'),[clickStep('cu','alkyne')]);
 await run('K03 CuAAC uploaded azide variant',sm('CC#C'),[clickStep('cu','propyl-azide.mol','mol')]);
 for(const name of ['dbco','bcn','coct']){
  for(const source of ['builtin','mol','sdf'])await run('S '+name+' '+source,startMol('azide'),[clickStep('spa',lib(name),source)]);
  await run('S '+name+' reverse',startMol(lib(name)),[clickStep('spa','azide')]);
  await run('S '+name+' product choice',startMol('azide'),[['spa','builtin',lib(name),'none',null,null,false,name==='bcn'?'unique':'b']]);
  await run('W '+name+' install -> SPAAC',s,[am(lib(name),'builtin','strainedAlkyne',null,name==='bcn'?'pNP':'NHS'),clickStep('spa','azide')]);
 }
 await run('S free DBCO amine SDF',startMol('azide'),[clickStep('spa','dbco-amine','sdf')]);
 await run('S free BCN alcohol MOL',startMol('azide'),[clickStep('spa','bcn-oh','mol')]);
 await run('S free DBCO amine built-in',startMol('azide'),[clickStep('spa','dbco-amine')]);
 await run('S free BCN alcohol built-in',startMol('azide'),[clickStep('spa','bcn-oh')]);
 await run('S independent cyclooctyne SDF',startMol('azide'),[clickStep('spa','cyclooctyne.mol','sdf')]);
 await run('S synthetic JQ1-DIBAC MOL',startMol('azide'),[clickStep('spa','jq1-dibac-synthetic.mol','mol')]);
 await run('S synthetic JQ1-DIBAC aromatic-bond MOL',startMol('azide'),[clickStep('spa','jq1-dibac-aromatic.mol','mol')]);
 await run('S synthetic JQ1-DIBAC SDF, alternate azide encoding',startMol('azide-triple.mol'),[clickStep('spa','jq1-dibac-synthetic.mol','sdf')]);
 await run('S synthetic JQ1-DIBAC as starting molecule',startMol('jq1-dibac-synthetic.mol'),[clickStep('spa','azide-triple.mol','mol')]);
 await run('S JQ1 acid without click handle control',startMol('azide'),[['spa','mol','jq1-acid-no-click-handle.mol',null,null,null,false,'reject']]);
 await run('K independent terminal alkyne SDF',startMol('propyl-azide.mol'),[clickStep('cu','terminal-alkyne.mol','sdf')]);
 await run('A free DBCO amine reverse coupling',startMol('ester'),[am('dbco-amine')]);
 await run('I01 TCO built-in',startMol('iedda-tetrazine.mol'),[iedda(lib('tco'),'builtin')]);
 await run('I02 norbornene MOL',startMol('iedda-tetrazine.mol'),[iedda('iedda-norbornene.mol','mol')]);
 await run('I03 TCO reverse tetrazine SDF',startMol(lib('tco')),[iedda('iedda-tetrazine.mol','sdf')]);
 await run('I04 cis-cyclooctene control',startMol('iedda-tetrazine.mol'),[['iedda','mol','iedda-cis-cyclooctene.mol','IEDDA',null,null,false,'reject']]);
 await run('T01 thiol + maleimide',sm('CCS'),[thiol()]);
 await run('T02 maleimide + alternate thiol',startMol('maleimide'),[thiol('CCCS','sdf')]);
 for(const name of ['smcc','mc','mcvcpabc','spdp'])await run('A '+name+' direct install',s,[am(lib(name),'builtin',null,null,name==='mcvcpabc'?'pNP':'NHS')]);
 for(const name of ['smcc','mc','mcvcpabc'])await run('T '+name+' maleimide end',sm('CCS'),[thiol(lib(name))]);
 await run('T independent maleimide SDF',sm('CCS'),[thiol('maleimide.mol','sdf')]);
 await run('T independent thiol MOL',startMol('maleimide'),[thiol('thiol.mol','mol')]);
 await run('W SMCC -> thiol',s,[am(lib('smcc'),'builtin','maleimide'),thiol('CCS','mol')]);
 await run('W SMCC -> thiol -> repeat rejection',s,[am(lib('smcc'),'builtin','maleimide'),thiol('CCS','mol'),['thiol','mol','CCS','none',null,null,false,'reject']]);
 await run('Q multiple definitions: amine + thiol vs SMCC',sm('NCCCS'),[am(lib('smcc'),'builtin')]);
 await run('W SMCC uploaded -> thiol',s,[am(lib('smcc'),'sdf','maleimide'),thiol('CCCS','sdf')]);
 await run('W oligo three steps: SMCC -> azidothiol -> CuAAC',s,[am(lib('smcc'),'builtin','maleimide'),['thiol','mol','azidothiol.mol','none','azide'],clickStep('cu','alkyne')]);
 await run('W azido-NHS -> CuAAC',s,[am('azido-nhs.mol','mol','azide'),clickStep('cu','alkyne')]);
 await run('W TCO -> IEDDA',s,[am(lib('tco'),'builtin','strainedAlkene',null,'pNP'),iedda('iedda-tetrazine.mol','sdf')]);
 await run('W tetrazine installation -> IEDDA',s,[am('tetrazine-nhs.mol','mol','tetrazine'),iedda(lib('tco'),'builtin')]);
 await run('W preserve thiol -> maleimide',sm('NCCCS'),[am('ester','builtin',null,'thiol'),thiol()]);
 await run('W two thiols consumed in separate steps',sm('SCCCS'),[['thiol','builtin','maleimide','none',null,'thiol'],thiol()]);
 await run('W three steps: azide/thiol -> CuAAC -> maleimide',sm('NCC(CS)C'),[am('azido-nhs.mol','mol','azide','thiol'),clickStep('cu','alkyne'),thiol()]);
 await run('W branch side-chain amine -> SMCC -> thiol',seq('[GlycerolBranch]rArA'),[['branch','sequence','[C6N]rA'],am(lib('smcc'),'builtin','maleimide'),thiol('CCS','mol')]);
 await run('R01 quick unary no reagent',sm('CCSSCCC'),[['red','none',null,null,'thiol']]);
 await run('R equivalent disulfide fragments',sm('CCSSCC'),[['red','none',null,null,'thiol',null,false,'unique']]);
 await run('R uploaded independent disulfide starting graph',startMol('disulfide.mol'),[['red','none',null,null,'thiol']]);
 await run('R02 manual reduction -> quick maleimide',sm('CCSSCCC'),[['red','none',null,null,'thiol',null,true],thiol()]);
 await run('W SPDP -> quick reduction -> thiol',s,[am(lib('spdp'),'builtin','disulfide'),['red','none',null,null,'thiol'],thiol()]);
 await run('W SPDP -> manual reduction -> thiol',s,[am(lib('spdp'),'builtin','disulfide'),['red','none',null,null,'thiol',null,true],thiol()]);
 await run('W exact JQ1 uploaded after DBCO',seq('rArC[C6N]'),[am(lib('dbco'),'builtin','strainedAlkyne'),clickStep('spa','JQ1.mol','mol')]);
 const exact=results.at(-1);
 if(exact.steps[0].status==='PASS'){
  const installed=MoleculeBuilderUI.states[1];
  set('kind','sequence');set('input','rArC[C6N]','input');click('builderStart');click('builderAdd');set('builderOperation','reaction');
  set('builderReagentLibraryEntry',lib('dbco'));click('builderPreview');click('builderApply');click('builderAdd');
  await upload(raw,'mol');
  probe.quick={...status(),options:options('builderCandidate'),family:$('builderFamily').value,manual:$('builderManual').getAttribute('aria-expanded'),starting:pick(installed)};
  click('builderManual');set('builderFamily',initialFamily);click('builderDetect');
  probe.detect={...status(),options:options('builderCandidate'),family:$('builderFamily').value};
  set('builderFamily','CAP');click('builderDetect');
  probe.explicitCap={...status(),options:options('builderCandidate'),family:$('builderFamily').value};
  click('builderManual');
  probe.returnQuick={...status(),options:options('builderCandidate'),manual:$('builderManual').getAttribute('aria-expanded')};
  click('builderAdd');click('builderManual');
  probe.nextDraftFamily=$('builderFamily').value;
 }
 await run('W exact JQ1 via advanced auto detect, alternate connectivity',seq('rArC[C6N]'),[
  am(lib('dbco'),'builtin','strainedAlkyne'),['spa','mol','JQ1.mol','none',null,null,'auto','b']]);
 await run('C04 explicit manual CAP still applies',seq('[p]rA'),[['cap','builtin','cap-imidazolide','CAP',null,null,true]]);
 const reject=(reagent,source='mol')=>['spa',source,reagent,'none',null,null,false,'reject'];
 const jqSequence=seq('rArC[C6N]');
 const installDbco=am(lib('dbco'),'builtin','strainedAlkyne');
 await run('N ordinary contiguous N3 is not azide',jqSequence,[installDbco,reject('CNNN')]);
 await run('N consumed DBCO cannot click fresh JQ1',jqSequence,[installDbco,clickStep('spa','JQ1.mol','mol'),reject('JQ1.mol')]);
 await run('N consumed JQ1 cannot click fresh DBCO',jqSequence,[installDbco,clickStep('spa','JQ1.mol','mol'),reject('dbco-amine')]);
 await run('N incompatible graphs do not fall back to CAP',seq('rArCrUrA'),[reject('CCO')]);
 if(initialFamily===''){
  const assert=(condition,label)=>{if(!condition)throw Error(label);};
  assert(probe.parsed.count.join() === '36,39' && probe.parsed.azide.length===1 &&
   probe.parsed.atoms.map(a=>a.q).join()==='0,1,-1' && probe.parsed.properties.formula_dict.Cl===1,'Original JQ1 graph/charge/Cl');
  assert(probe.quick.options.length===2 && equal(probe.detect.options,probe.quick.options) &&
   probe.detect.family==='' && probe.detect.info.includes('SPAAC'),'Advanced Auto-detect must preserve SPAAC options');
  assert(probe.explicitCap.options.length===0 && probe.explicitCap.previewDisabled &&
   !probe.explicitCap.info.includes('nonterminal_or_ambiguous_phosphorus'),'Explicit CAP rejection must be aggregated');
  assert(equal(probe.quick.options,probe.returnQuick.options) && probe.nextDraftFamily==='','Mode and draft reset');
  const triazane=results.find(c=>c.id.startsWith('N ordinary')).steps.at(-1);
  assert(triazane.motifs?.azide?.length===0,'Ordinary N3 must not be classified as an azide');
 }
 const legacyFixtures={};
 for(const id of ['amide','cuaac','workflow']){
  $('fixture').closest('details').open=true;
  set('fixture',id);
  const workflow=UI.workflow;
  legacyFixtures[id]={hiddenNotebook:document.querySelector('.workflow').getClientRects().length===0,
   checkpoints:workflow?.steps.map(s=>({definition:s.definition.id,formula:s.properties.formula})),
   error:$('error').textContent};
 }
 const builtins=listed.map(({id,name,graph})=>{
  const sites=V.detect([graph]).candidate_sites[0];
  return {id,name,applicable:Object.entries(V.registry).filter(([,d])=>
   d.input_count!==1&&d.roles.some(role=>sites[role]?.length)).map(([key])=>key)};
 });
 const references=Object.values(refs).filter(r=>r?.referenceOnly).map(({id,name})=>({id,name}));
 return {inventory:V.registry, families:V.families, builtins, references, legacy:Reactions.definitions, legacyFixtures, probe, cases:results};
}
