'use strict';
// Controlled topology rules share one transactional graph-edit executor.
const Reactions = (() => {
 const copy=x=>JSON.parse(JSON.stringify(x));
 const fail=(x,code='CHEMISTRY_UNSUPPORTED')=>{const e=Error(code+': INVALID_REACTION_SITE: '+x);e.code=code;throw e;};
 const adj=(g,i)=>g.bonds.filter(b=>b.a===i||b.b===i).map(b=>({i:b.a===i?b.b:b.a,o:b.o}));
 const bond=(g,a,b)=>g.bonds.find(x=>x.a===a&&x.b===b||x.a===b&&x.b===a);
 function validate(value){
  const g=Lite.core.molecularGraph(value),pairs=new Set();
  for(const b of g.bonds){const k=[b.a,b.b].sort((a,b)=>a-b).join(':');if(pairs.has(k))fail('duplicate bond');pairs.add(k);}
  g.atoms.forEach((a,i)=>{if(a.iso)fail('isotope graphs are not supported');const v=adj(g,i).reduce((s,b)=>s+b.o,0),t=Lite.valenceTarget(a,v);if((a.e==='H'&&a.h)||(a.e==='P'&&v!==5)||(a.e==='S'&&![0,1,2,4,6].includes(v)))fail('unsupported valence state');if(t===undefined||v+(a.e==='H'?0:a.h||0)!==t)fail('unsupported valence at atom '+(i+1));});
  if(!Lite.connected(g))fail('disconnected graph');return g;
 }
 // Explicit neutral Kekule N-phosphorylimidazole: P-N1-C=N-C=C1.
 // Reject substituted/charged leaving rings in v1; no name or atom-number inference.
 function imidazolide(g,p,n){
  const a=g.atoms[n],ns=adj(g,n);if(a.e!=='N'||a.q||a.h||ns.length!==3||bond(g,p,n)?.o!==1)return false;
  const arms=ns.filter(x=>x.i!==p);if(arms.length!==2||arms.some(x=>x.o!==1||g.atoms[x.i].e!=='C'))return false;
  for(const first of arms){const path=[n,first.i];
   function walk(){const at=path.at(-1);if(path.length===5){
    if(bond(g,at,n)?.o!==1)return false;
    const es=path.map(i=>g.atoms[i].e).join('');
    const orders=path.slice(1).map((i,k)=>bond(g,path[k],i).o).join('');
    return es==='NCNCC'&&orders==='1212'&&path.slice(1).every(i=>!g.atoms[i].q&&adj(g,i).length===2);
   }for(const x of adj(g,at))if(!path.includes(x.i)&&x.i!==p){path.push(x.i);if(walk())return true;path.pop();}return false;}
   if(walk())return true;
  }return false;
 }
 function activatedDiphosphate(g){const out=[];
  if(g.atoms.filter(a=>a.e==='P').length!==2)return out;
  g.atoms.forEach((a,p)=>{if(a.e!=='P'||a.q)return;const ns=adj(g,p);
   if(ns.length!==4||ns.filter(x=>x.o===2&&g.atoms[x.i].e==='O').length!==1)return;
   const bridge=ns.find(x=>x.o===1&&g.atoms[x.i].e==='O'&&adj(g,x.i).length===2&&adj(g,x.i).some(y=>y.i!==p&&g.atoms[y.i].e==='P'));
   const oh=ns.find(x=>x.o===1&&g.atoms[x.i].e==='O'&&adj(g,x.i).length===1&&(g.atoms[x.i].h===1&&!g.atoms[x.i].q||g.atoms[x.i].h===0&&g.atoms[x.i].q===-1));
   if(!bridge||!oh)return;const proximal=adj(g,bridge.i).find(x=>x.i!==p).i;
   const pn=adj(g,proximal);if(pn.length!==4||!pn.some(x=>x.o===2&&g.atoms[x.i].e==='O')||pn.some(x=>!['O'].includes(g.atoms[x.i].e)))return;
   if(pn.filter(x=>x.o===1&&g.atoms[x.i].e==='O'&&adj(g,x.i).some(y=>y.i!==proximal&&g.atoms[y.i].e==='C'&&g.atoms[y.i].h===2)).length!==1)return;
   for(const n of ns)if(imidazolide(g,p,n.i))out.push({type:'diphosphateImidazolide',atoms:{p,leavingN:n.i},label:'Activated diphosphate P '+(p+1)+' / imidazolide N '+(n.i+1)});
  });return out;
 }
 function sites(g,type){
  if(type==='diphosphateImidazolide')return activatedDiphosphate(g);
  if(type==='terminalPhosphateNucleophile')return sites(g,'terminalPhosphate').concat(sites({...g,atoms:g.atoms.map(a=>a.e==='O'&&a.q===-1&&a.h===0?{...a,q:0,h:1}:a)},'terminalPhosphate')).filter((v,i,ss)=>ss.findIndex(x=>x.atoms.o===v.atoms.o)===i).map(v=>({...v,type}));
  if(type==='terminalPhosphate'||type==='diphosphateOH')return sites(g,'phosphateOH').filter(s=>{const pn=adj(g,s.atoms.p);return type==='terminalPhosphate'?pn.filter(n=>g.atoms[n.i].e==='O'&&adj(g,n.i).some(c=>c.i!==s.atoms.p&&g.atoms[c.i].e==='C')).length===1&&pn.some(n=>g.atoms[n.i].e==='O'&&adj(g,n.i).some(c=>c.i!==s.atoms.p&&g.atoms[c.i].e==='C'&&g.atoms[c.i].h===2))&&!pn.some(n=>g.atoms[n.i].e==='O'&&adj(g,n.i).some(c=>c.i!==s.atoms.p&&g.atoms[c.i].e==='P')):pn.some(n=>g.atoms[n.i].e==='O'&&adj(g,n.i).some(c=>c.i!==s.atoms.p&&g.atoms[c.i].e==='P'))&&!pn.some(n=>g.atoms[n.i].e==='O'&&adj(g,n.i).some(c=>g.atoms[c.i].e==='C'));});
  const out=[];const put=atoms=>out.push({type,atoms,label:type+' · '+Object.entries(atoms).map(([k,v])=>k+' '+(v+1)).join(', ')});
  g.atoms.forEach((a,i)=>{
   const ns=adj(g,i),q=a.q||0;
   if(type==='amine'&&a.e==='N'&&!q&&a.h>=1&&ns.every(n=>n.o===1&&g.atoms[n.i].e==='C')&&!ns.some(n=>adj(g,n.i).some(v=>v.o===2&&g.atoms[v.i].e==='O')))put({n:i});
   if(type==='thiol'&&a.e==='S'&&!q&&a.h===1&&ns.length===1&&ns[0].o===1&&g.atoms[ns[0].i].e==='C')put({s:i});
   if(type==='alkyne'&&a.e==='C'&&!q&&a.h===1){const c=ns.find(n=>n.o===3&&g.atoms[n.i].e==='C');if(c&&ns.length===1&&g.atoms[c.i].h===0&&adj(g,c.i).length===2&&adj(g,c.i).some(x=>x.i!==i&&x.o===1&&g.atoms[x.i].e==='C'))put({terminal:i,internal:c.i});}
   if(type==='azide'&&a.e==='N'&&!q&&a.h===0){for(const m of ns.filter(n=>n.o===2&&g.atoms[n.i].e==='N'&&g.atoms[n.i].q===1)){const end=adj(g,m.i).find(n=>n.i!==i&&n.o===2&&g.atoms[n.i].e==='N'&&g.atoms[n.i].q===-1);if(end&&ns.length===2&&adj(g,m.i).length===2&&adj(g,end.i).length===1&&ns.some(n=>n.o===1&&g.atoms[n.i].e==='C'))put({proximal:i,middle:m.i,distal:end.i});}}
   if(type==='phosphateOH'&&a.e==='O'&&!q&&a.h===1&&ns.length===1&&g.atoms[ns[0].i].e==='P'&&ns[0].o===1)put({o:i,p:ns[0].i});
   if(type==='activatedEster'&&a.e==='C'&&!q){const ox=ns.find(n=>n.o===2&&g.atoms[n.i].e==='O');for(const ester of ns.filter(n=>n.o===1&&g.atoms[n.i].e==='O')){const n=adj(g,ester.i).find(v=>v.i!==i&&g.atoms[v.i].e==='N');if(ox&&n){const arms=adj(g,n.i).filter(v=>v.i!==ester.i);if(arms.length===2&&arms.every(v=>g.atoms[v.i].e==='C'&&adj(g,v.i).some(x=>x.o===2&&g.atoms[x.i].e==='O'))){const [a,b]=arms.map(v=>v.i);const ca=adj(g,a).filter(x=>x.o===1&&g.atoms[x.i].e==='C');const cb=adj(g,b).filter(x=>x.o===1&&g.atoms[x.i].e==='C');if(ca.some(x=>cb.some(y=>bond(g,x.i,y.i)?.o===1)))put({carbonyl:i,leavingO:ester.i});}}}}
   if(type==='maleimide'&&a.e==='C'&&a.h===1&&!q){for(const c of ns.filter(n=>n.o===2&&n.i>i&&g.atoms[n.i].e==='C'&&g.atoms[n.i].h===1&&!g.atoms[n.i].q)){const ca=ns.find(n=>n.o===1&&g.atoms[n.i].e==='C'&&adj(g,n.i).some(v=>v.o===2&&g.atoms[v.i].e==='O'));const cb=adj(g,c.i).find(n=>n.o===1&&g.atoms[n.i].e==='C'&&adj(g,n.i).some(v=>v.o===2&&g.atoms[v.i].e==='O'));if(ca&&cb){const n=adj(g,ca.i).find(v=>v.o===1&&g.atoms[v.i].e==='N'&&bond(g,v.i,cb.i)?.o===1);if(n)put({alpha:i,beta:c.i});}}}
  });return out;
 }
 const definitions={
  'maleimide-reverse':{schema_version:'reaction-definition/1',id:'maleimide-reverse',name:'Maleimide-bearing starting molecule + thiol reagent',roles:['maleimide','thiol'],rule:'thio-michael-reverse/1'},
  'capping-imidazolide':{schema_version:'reaction-definition/1',id:'capping-imidazolide',name:'Chemical capping · real GDP imidazolide (recommended)',roles:['terminalPhosphateNucleophile','diphosphateImidazolide'],rule:'diphosphate-imidazolide/1'},
  capping:{schema_version:'reaction-definition/1',id:'capping',name:'Chemical capping · phosphate + diphosphate',roles:['terminalPhosphate','diphosphateOH'],rule:'phosphate-condensation/1'},
  cuaac:{schema_version:'reaction-definition/1',id:'cuaac',name:'CuAAC · azide + terminal alkyne',roles:['azide','alkyne'],rule:'cuaac-1,4/1'},
  amide:{schema_version:'reaction-definition/1',id:'amide',name:'Amine + NHS activated ester',roles:['amine','activatedEster'],rule:'nhs-amide/1'},
  maleimide:{schema_version:'reaction-definition/1',id:'maleimide',name:'Thiol + maleimide',roles:['thiol','maleimide'],rule:'thio-michael/1'}
 };
 const rules={
  'thio-michael-reverse/1':(g,a,b,e)=>rules['thio-michael/1'](g,b,a,e),
  'diphosphate-imidazolide/1':(g,a,b,e)=>{if(g.atoms[a.o].q===-1)e.charge(a.o,0);else e.h(a.o,-1);e.removeComponent(b.leavingN,b.p);e.add(a.o,b.p);},
  'phosphate-condensation/1':(g,a,b,edit)=>{if(g.atoms.filter(x=>x.e==='P').length<3)fail('requires phosphate plus diphosphate');edit.h(a.o,-1);edit.removeComponent(b.o,b.p);edit.add(a.o,b.p);},
  'cuaac-1,4/1':(g,a,b,e)=>{e.order(a.proximal,a.middle,1);e.order(a.middle,a.distal,2);e.order(b.terminal,b.internal,2);e.charge(a.middle,0);e.charge(a.distal,0);e.add(a.proximal,b.terminal);e.add(a.distal,b.internal);},
  'nhs-amide/1':(g,a,b,e)=>{e.h(a.n,-1);e.removeComponent(b.leavingO,b.carbonyl);e.add(a.n,b.carbonyl);},
  'thio-michael/1':(g,a,b,e)=>{e.h(a.s,-1);e.order(b.alpha,b.beta,1);e.add(a.s,b.alpha);e.h(b.beta,1);}
 };
 function diagnose(g,role,reactant){const candidates=sites(g,role);return {reactant,expected:role,compatible:candidates,actual:g.atoms.map((a,i)=>a.e+(i+1)+'[q='+(a.q||0)+',H='+a.h+']: '+adj(g,i).map(x=>g.atoms[x.i].e+(x.i+1)+'/'+x.o).join(',')).join('; ')};}
 function resolveSites(id,gs,selected){const d=definitions[id];if(!d)fail('Unknown ReactionDefinition '+id);return gs.map((g,i)=>{const ss=sites(g,d.roles[i]);if(selected?.[i])return selected[i];const info=diagnose(g,d.roles[i],i?'Second reagent':'Starting molecule');if(!ss.length)fail(info.reactant+' expected '+info.expected+'; actual '+info.actual,'NO_COMPATIBLE_SITE');if(ss.length>1)fail(info.reactant+' expected explicit selection among '+ss.map(s=>s.label).join(' / '),'SITE_SELECTION_REQUIRED');return ss[0];});}
 function apply(id,inputs,selected){
  const d=definitions[id];if(!d||!Array.isArray(inputs)||inputs.length!==2)fail('definition/two inputs required');
  const gs=inputs.map(validate);
  selected=resolveSites(id,gs,selected);
  selected.forEach((s,i)=>{const valid=sites(gs[i],d.roles[i]);if(!valid.some(v=>Object.keys(v.atoms).length===Object.keys(s?.atoms||{}).length&&Object.entries(v.atoms).every(([k,n])=>s?.atoms?.[k]===n))){
   const actual=Object.entries(s?.atoms||{}).map(([k,n])=>k+' '+(n+1)+' '+(gs[i].atoms[n]?.e||'missing')+' neighbors '+adj(gs[i],n).map(x=>gs[i].atoms[x.i].e+(x.i+1)+'(bond '+x.o+')').join(',')).join('; ');
   fail((i?'Second reagent':'Starting molecule')+' site '+(s?.label||'not selected')+': expected '+d.roles[i]+(i===1&&id==='capping'?' = terminal non-ester phosphate O on R–O–P–O–P':'')+'; actual '+(actual||'no matching site')+'; valid sites: '+(valid.map(v=>v.label).join(' / ')||'none'));
  }});
  if(id==='capping'){
   if(gs[1].atoms.filter(a=>a.e==='P').length!==2)fail('v1 capping requires terminal phosphate substrate and diphosphate reagent');
  }
  const g={atoms:[],bonds:[]},originA=[],originB=[],offsets=[];
  gs.forEach((v,k)=>{const off=g.atoms.length,shift=k?gs[0].atoms.reduce((m,a)=>Math.max(m,a.x||0),-Infinity)-v.atoms.reduce((m,a)=>Math.min(m,a.x||0),Infinity)+4:0,shiftY=k?gs[0].atoms.reduce((m,a)=>Math.max(m,a.y||0),-Infinity)-v.atoms.reduce((m,a)=>Math.min(m,a.y||0),Infinity)+4:0;offsets.push(off);v.atoms.forEach((a,i)=>{const atom=copy(a);atom.x=(atom.x||0)+shift;atom.y=(atom.y||0)+shiftY;g.atoms.push(atom);originA.push({input:k,atom:i,previous:copy(inputs[k].provenance?.atoms?.[i]||null)});});v.bonds.forEach((b,i)=>{g.bonds.push({...copy(b),a:b.a+off,b:b.b+off});originB.push({input:k,bond:i,previous:copy(inputs[k].provenance?.bonds?.[i]||null)});});});
  const ss=selected.map((s,k)=>Object.fromEntries(Object.entries(s.atoms).map(([key,i])=>[key,i+offsets[k]]))),edits=[],removed=new Set();
  const edit={h:(i,n)=>{g.atoms[i].h+=n;edits.push({op:'hydrogen',atom:i,delta:n});},charge:(i,q)=>{g.atoms[i].q=q;edits.push({op:'charge',atom:i,value:q});},order:(a,b,o)=>{const x=bond(g,a,b);if(!x)fail('missing bond');if(x.s)fail('stereochemical reaction-center bond changes unsupported');x.o=o;edits.push({op:'order',a,b,order:o});},add:(a,b)=>{if(bond(g,a,b))fail('duplicate new bond');g.bonds.push({a,b,o:1});originB.push({kind:'reaction',definition:id});edits.push({op:'add-bond',a,b,order:1});},removeComponent:(start,keep)=>{
   const pending=[start];while(pending.length){const i=pending.pop();if(i===keep)fail('leaving group reconnects to retained graph');if(removed.has(i))continue;removed.add(i);for(const n of adj(g,i))if(!(i===start&&n.i===keep))pending.push(n.i);}edits.push({op:'remove-atoms',atoms:[...removed]});
  }};
  rules[d.rule](g,ss[0],ss[1],edit);
  const map={},atoms=[],bonds=[],pa=[],pb=[];g.atoms.forEach((a,i)=>{if(!removed.has(i)){map[i]=atoms.length;atoms.push(a);pa.push(originA[i]);}});g.bonds.forEach((b,i)=>{if(!removed.has(b.a)&&!removed.has(b.b)){bonds.push({...b,a:map[b.a],b:map[b.b]});pb.push({...originB[i],edited:edits.some(e=>(e.a===b.a&&e.b===b.b)||(e.a===b.b&&e.b===b.a))});}});
  const output=validate({atoms,bonds});output.provenance={schema_version:'reaction-provenance/1',atoms:pa,bonds:pb,removed_atoms:[...removed].map(i=>originA[i]),removed_bonds:g.bonds.flatMap((b,i)=>removed.has(b.a)||removed.has(b.b)?[{...originB[i],endpoints:[originA[b.a],originA[b.b]]}]:[]),input_atom_maps:gs.map((v,k)=>v.atoms.map((a,i)=>map[offsets[k]+i]??null)),edits};Lite.normalizeCoordinates(output);
  if(inputs.some(g=>g.photometry||g.optical))output.photometry=productOptical(inputs,output);
  return {schema_version:'reaction-step/1',validation:{status:'VALIDATED',rule:d.rule},definition:copy(d),reactants:inputs.map(g=>copy(g.source||{kind:'molecular-graph'})),inputs:copy(inputs),sites:copy(selected),output,properties:{...Lite.graphProperties(output),...(output.photometry?{optical:copy(output.photometry)}:{})}};
 }
 function productOptical(inputs,g){
  const base=inputs[0].photometry, modifier=inputs[1].photometry, meta=inputs[1].optical;
  const incomplete=o=>o?.partial||['PARTIAL','NEEDS_PARAMETER'].includes(o?.status);
  let correction=null,source='Modifier optical contribution unknown';
  if(modifier?.supported){correction=modifier.epsilon260;source='Second oligo inherited chromophores';}
  else if(meta?.mode==='zero'){correction=0;source=meta.source||'User declared negligible at 260 nm';}
  else if(meta?.mode==='explicit'&&Number.isFinite(meta.epsilon)&&meta.epsilon>=0){correction=meta.epsilon;source=meta.source||'Custom correction';}
  const provenance={parent:copy(base||null),modifier:{correction,source},note:'Reaction may change chromophore environment; additive approximation, not exact NN for product'};
  if(!base?.supported||!Number.isFinite(base.epsilon260)||base.epsilon260<=0)return {supported:false,status:'NEEDS_PARAMETER',reason:'Starting molecule has no optical provenance',provenance};
  const eps=base.epsilon260+(correction??0),mw=Lite.graphProperties(g).average_mw;
  return {supported:true,estimated:true,status:correction===null||incomplete(base)||incomplete(modifier)?'NEEDS_PARAMETER':'ESTIMATED',partial:correction===null||!!incomplete(base)||!!incomplete(modifier),epsilon_unit:'L mol^-1 cm^-1',epsilon260:eps,nmol_per_od:1e6/eps,ug_per_od:1000*mw/eps,method:base.method+' + '+source+(correction===null?' (oligo-only estimate)':''),provenance};
 }
 function freeze(x){if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;}
 function workflow(graph){validate(graph);return {schema_version:'reaction-workflow/1',initial:copy(graph),steps:[],current:copy(graph)};}
 function append(w,id,reagent,selected){const step=apply(id,[w.current,reagent],selected);const next=copy(w);step.step_index=next.steps.length+1;step.status="APPLIED";next.steps.push(step);next.current=copy(step.output);next.steps.forEach(freeze);return next;}
 function revert(w,count){if(!Number.isInteger(count)||count<0||count>w.steps.length)fail('Invalid revert step');const next=reload(w);next.steps=next.steps.slice(0,count);next.current=copy(count?next.steps[count-1].output:next.initial);return next;}
 function reload(raw){const w=typeof raw==='string'?JSON.parse(raw):copy(raw);if(w.schema_version!=='reaction-workflow/1')fail('workflow schema');let replay=workflow(w.initial);for(const s of w.steps){const def=definitions[s.definition?.id];if(!def||Object.keys(s.definition).some(k=>!(k in def))||Object.keys(def).some(k=>JSON.stringify(def[k])!==JSON.stringify(s.definition[k])))fail('workflow definition mismatch');if(JSON.stringify(s.inputs[0])!==JSON.stringify(replay.current))fail('workflow input chain mismatch');const n=append(replay,s.definition.id,s.inputs[1],s.sites);if(JSON.stringify(n.current)!==JSON.stringify(s.output))fail('workflow product mismatch');replay=n;}if(JSON.stringify(replay.current)!==JSON.stringify(w.current))fail('workflow final graph mismatch');return replay;}
 return {definitions:copy(definitions),sites,diagnose,resolveSites,validate,apply,workflow,append,reload,revert};
})();
