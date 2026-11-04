'use strict';
// Controlled topology rules share one transactional graph-edit executor.
const Reactions = (() => {
 const copy=x=>JSON.parse(JSON.stringify(x));
 const fail=(x,code='CHEMISTRY_UNSUPPORTED')=>{const e=Error(code+': INVALID_REACTION_SITE: '+x);e.code=code;throw e;};
 const adj=(g,i)=>g.bonds.filter(b=>b.a===i||b.b===i).map(b=>({i:b.a===i?b.b:b.a,o:b.o}));
 const bond=(g,a,b)=>g.bonds.find(x=>x.a===a&&x.b===b||x.a===b&&x.b===a);
 // Free primary/secondary aliphatic amines, including user-supplied graphs.
 // Saturated carbon neighbors exclude Kekule nucleobases as well as aromatic flags.
 function reactiveAmine(g,i){
  const a=g.atoms[i],ns=adj(g,i);
  if(a.e!=='N'||a.q||a.aromatic||![1,2].includes(a.h)||ns.length!==3-a.h)return false;
  const origin=g.provenance?.atoms?.[i];
  if(origin?.role==='nucleobase'||origin?.region==='nucleobase')return false;
  return ns.every(n=>n.o===1&&g.atoms[n.i].e==='C'&&!g.atoms[n.i].aromatic&&adj(g,n.i).every(v=>v.o===1));
 }
 function validate(value){
  const g=Lite.core.molecularGraph(value),pairs=new Set();
  for(const b of g.bonds){const k=[b.a,b.b].sort((a,b)=>a-b).join(':');if(pairs.has(k))fail('duplicate bond');pairs.add(k);}
  g.atoms.forEach((a,i)=>{if(a.iso)fail('isotope graphs are not supported');const v=adj(g,i).reduce((s,b)=>s+b.o,0),t=Lite.valenceTarget(a,v);if((a.e==='H'&&a.h)||(a.e==='P'&&v!==5)||(a.e==='S'&&![0,1,2,4,6].includes(v)))fail('unsupported valence state');if(t===undefined||v+(a.e==='H'?0:a.h||0)!==t)fail('unsupported valence at atom '+(i+1));});
  if(!Lite.connected(g))fail('disconnected graph');return g;
 }
 // Explicit neutral Kekule N-phosphorylimidazole: P-N1-C=N-C=C1.
 // Distal imidazole N protonation is allowed; no name or atom-number inference.
 function imidazolide(g,p,n){
  const a=g.atoms[n],ns=adj(g,n);if(a.e!=='N'||![0,1].includes(a.q||0)||a.h||ns.length!==3||bond(g,p,n)?.o!==1)return false;
  const arms=ns.filter(x=>x.i!==p);if(arms.length!==2||arms.some(x=>g.atoms[x.i].e!=='C')||arms.map(x=>x.o).sort().join('')!==(a.q===1?'12':'11'))return false;
  for(const first of arms){const path=[n,first.i];
   function walk(){const at=path.at(-1);if(path.length===5){
    if(bond(g,at,n)?.o!==1)return false;
    const es=path.map(i=>g.atoms[i].e).join('');
    const orders=path.slice(1).map((i,k)=>bond(g,path[k],i).o).join('');
    return es==='NCNCC'&&orders===(a.q===1?'2112':'1212')&&path.slice(1).every(i=>(!g.atoms[i].q||(g.atoms[i].e==='N'&&g.atoms[i].q===1&&g.atoms[i].h===1))&&adj(g,i).length===2);
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
   if(type==='amine'&&reactiveAmine(g,i))put({n:i});
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
 function apply(id,inputs,selected,plan){
  const d=plan?.definition||definitions[id];if(!d||!Array.isArray(inputs)||inputs.length!==2)fail('definition/two inputs required');
  const gs=inputs.map(validate);
  selected=plan?selected:resolveSites(id,gs,selected);
  selected.forEach((s,i)=>{const valid=plan?v2Sites(gs[i],d.roles[i]):sites(gs[i],d.roles[i]);if(!valid.some(v=>Object.keys(v.atoms).length===Object.keys(s?.atoms||{}).length&&Object.entries(v.atoms).every(([k,n])=>s?.atoms?.[k]===n))){
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
  (plan?.execute||rules[d.rule])(g,ss[0],ss[1],edit);
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
  // v2 is opt-in: legacy workflow replay remains byte-compatible.
 const capReference={"atoms":[{"e":"C","h":1,"q":0},{"e":"N","h":0,"q":1},{"e":"C","h":0,"q":0},{"e":"C","h":0,"q":0},{"e":"O","h":0,"q":0},{"e":"N","h":1,"q":0},{"e":"C","h":0,"q":0},{"e":"N","h":0,"q":0},{"e":"C","h":0,"q":0},{"e":"N","h":0,"q":0},{"e":"C","h":1,"q":0},{"e":"C","h":1,"q":0},{"e":"C","h":1,"q":0},{"e":"C","h":1,"q":0},{"e":"O","h":0,"q":0},{"e":"C","h":2,"q":0},{"e":"O","h":0,"q":0},{"e":"O","h":1,"q":0},{"e":"O","h":1,"q":0},{"e":"N","h":2,"q":0},{"e":"P","h":0,"q":0},{"e":"O","h":0,"q":0},{"e":"O","h":1,"q":0},{"e":"O","h":0,"q":0},{"e":"P","h":0,"q":0},{"e":"O","h":0,"q":0},{"e":"N","h":0,"q":0},{"e":"O","h":1,"q":0},{"e":"C","h":3,"q":0},{"e":"C","h":1,"q":0},{"e":"N","h":0,"q":0},{"e":"C","h":1,"q":0},{"e":"C","h":1,"q":0}],"bonds":[{"a":0,"b":1,"o":2},{"a":1,"b":2,"o":1},{"a":2,"b":3,"o":1},{"a":3,"b":4,"o":2},{"a":3,"b":5,"o":1},{"a":5,"b":6,"o":1},{"a":6,"b":7,"o":2},{"a":7,"b":8,"o":1},{"a":8,"b":9,"o":1},{"a":10,"b":9,"o":1},{"a":10,"b":11,"o":1},{"a":11,"b":12,"o":1},{"a":12,"b":13,"o":1},{"a":13,"b":14,"o":1},{"a":13,"b":15,"o":1},{"a":15,"b":16,"o":1},{"a":12,"b":17,"o":1},{"a":11,"b":18,"o":1},{"a":6,"b":19,"o":1},{"a":9,"b":0,"o":1},{"a":8,"b":2,"o":2},{"a":14,"b":10,"o":1},{"a":20,"b":21,"o":2},{"a":20,"b":22,"o":1},{"a":16,"b":20,"o":1},{"a":20,"b":23,"o":1},{"a":24,"b":25,"o":2},{"a":24,"b":26,"o":1},{"a":23,"b":24,"o":1},{"a":24,"b":27,"o":1},{"a":1,"b":28,"o":1},{"a":26,"b":29,"o":1},{"a":29,"b":30,"o":2},{"a":30,"b":31,"o":1},{"a":31,"b":32,"o":2},{"a":32,"b":26,"o":1}]};
 function subgraph(g,t,exact=false){
  if(exact&&(g.atoms.length!==t.atoms.length||g.bonds.length!==t.bonds.length))return false;
  const mapped={},used=new Set(),order=t.atoms.map((_,i)=>i).sort((a,b)=>adj(t,b).length-adj(t,a).length);
  const same=(a,b)=>a.e===b.e&&(a.q||0)===(b.q||0)&&a.h===b.h;
  function walk(k){if(k===order.length)return true;const i=order[k];for(let j=0;j<g.atoms.length;j++){
   if(used.has(j)||!same(t.atoms[i],g.atoms[j])||adj(t,i).length!==adj(g,j).length)continue;
   if(Object.entries(mapped).some(([n,m])=>(bond(t,i,+n)?.o||0)!==(bond(g,j,m)?.o||0)))continue;
   mapped[i]=j;used.add(j);if(walk(k+1))return true;delete mapped[i];used.delete(j);
  }return false;}return walk(0);
 }
 function paths(g,start,end,length,blocked=[]){const found=[],path=[start],ban=new Set(blocked);
  function walk(){const i=path.at(-1);if(path.length===length){if(i===end)found.push([...path]);return;}
   for(const n of adj(g,i))if(!ban.has(n.i)&&!path.includes(n.i)&&!(path.length===1&&n.i===end)&&!(n.i===end&&path.length!==length-1)){path.push(n.i);walk();path.pop();}}
  walk();return found;
 }
 // Enumerate a simple ring through a specified atom; closing edge is explicit.
 function rings(g,start,size){const out=[],p=[start];function walk(){if(p.length===size){if(bond(g,p.at(-1),start))out.push([...p]);return;}
  for(const n of adj(g,p.at(-1)))if(!p.includes(n.i)){p.push(n.i);walk();p.pop();}}walk();return out.filter((r,i)=>out.findIndex(x=>[...x].sort((a,b)=>a-b).join(',')===[...r].sort((a,b)=>a-b).join(','))===i);}
 function arylLeaving(g,o,c){
  if(g.atoms[o].q||g.atoms[o].h||adj(g,o).length!==2)return null;
  const ipso=adj(g,o).find(x=>x.i!==c&&x.o===1&&g.atoms[x.i].e==='C');if(!ipso)return null;
  for(const ring of rings(g,ipso.i,6)){
   if(ring.some((i,k)=>g.atoms[i].e!=='C'||g.atoms[i].q||bond(g,i,ring[(k+1)%6]).o!==(k%2?1:2))&&ring.some((i,k)=>g.atoms[i].e!=='C'||g.atoms[i].q||bond(g,i,ring[(k+1)%6]).o!==(k%2?2:1)))continue;
   const branches=ring.map(i=>adj(g,i).filter(x=>!ring.includes(x.i)&&x.i!==o));
   const fs=branches.map((ns,k)=>ns.length===1&&ns[0].o===1&&g.atoms[ns[0].i].e==='F'&&adj(g,ns[0].i).length===1?k:-1).filter(k=>k>=0);
   if(branches.every((ns,k)=>k===0?ns.length===0:fs.includes(k)||!ns.length)){
    if(fs.length===5)return 'PFP';
    if(fs.join(',')==='1,2,4,5')return 'TFP';
   }
   const para=branches[3];if(branches.every((ns,k)=>k===3?ns.length===1:ns.length===0)&&para[0]?.o===1){
    const n=para[0].i,ns=adj(g,n).filter(x=>x.i!==ring[3]);
    if(g.atoms[n].e==='N'&&g.atoms[n].q===1&&ns.length===2&&ns.every(x=>g.atoms[x.i].e==='O'&&adj(g,x.i).length===1)&&ns.some(x=>x.o===2&&!g.atoms[x.i].q)&&ns.some(x=>x.o===1&&g.atoms[x.i].q===-1))return 'pNP';
   }
  }return null;
 }
 function succinimide(g,o,c){
  if(g.atoms[o].q||g.atoms[o].h||adj(g,o).length!==2)return null;
  const n=adj(g,o).find(x=>x.i!==c&&x.o===1&&g.atoms[x.i].e==='N'&&!g.atoms[x.i].q);if(!n)return null;
  for(const r of rings(g,n.i,5)){
   if(r.slice(1).some(i=>g.atoms[i].e!=='C')||r.some((i,k)=>bond(g,i,r[(k+1)%5]).o!==1))continue;
   if(![r[1],r[4]].every(i=>adj(g,i).some(x=>x.o===2&&g.atoms[x.i].e==='O'&&adj(g,x.i).length===1)))continue;
   if(adj(g,n.i).length!==3)continue;
   const side=[r[2],r[3]].flatMap(i=>adj(g,i).filter(x=>!r.includes(x.i)));
   if(!side.length)return 'NHS';
   if(side.length===1&&side[0].o===1){const s=side[0].i,ns=adj(g,s).filter(x=>!r.includes(x.i));
    if(g.atoms[s].e==='S'&&!g.atoms[s].q&&ns.length===3&&ns.filter(x=>x.o===2&&g.atoms[x.i].e==='O').length===2&&ns.some(x=>x.o===1&&g.atoms[x.i].e==='O'&&adj(g,x.i).length===1&&(g.atoms[x.i].h===1||g.atoms[x.i].q===-1)))return 'sulfo-NHS';
   }
  }return null;
 }
 function acylSites(g){const out=[];
  g.atoms.forEach((a,c)=>{if(a.e!=='C'||a.q||a.h)return;const ns=adj(g,c);
   if(ns.length!==3||ns.filter(x=>x.o===2&&g.atoms[x.i].e==='O'&&adj(g,x.i).length===1&&!g.atoms[x.i].q).length!==1)return;
   for(const x of ns.filter(x=>x.o===1&&g.atoms[x.i].e==='O')){
    const rest=ns.find(y=>y.i!==x.i&&y.o===1);if(!rest)continue;
    const carbonate=g.atoms[rest.i].e==='O'&&!g.atoms[rest.i].q&&!g.atoms[rest.i].h&&adj(g,rest.i).length===2&&adj(g,rest.i).some(y=>y.i!==c&&y.o===1&&g.atoms[y.i].e==='C');
    if(!carbonate&&g.atoms[rest.i].e!=='C')continue;
    let motif=succinimide(g,x.i,c)||arylLeaving(g,x.i,c);
    if(!carbonate&&adj(g,x.i).length===1&&!g.atoms[x.i].q&&g.atoms[x.i].h===1)motif='carboxylic_acid';
    if(motif)out.push({type:'acylDonor',motif_type:motif,product_class:carbonate?'carbamate':'amide',atoms:{carbonyl:c,leavingO:x.i},label:motif+' '+(carbonate?'carbonate':'acyl')+' C '+c});
   }
  });return out;
 }
 function strainedSites(g){const out=[];
  for(const b of g.bonds){if(b.o!==3||[b.a,b.b].some(i=>g.atoms[i].e!=='C'||g.atoms[i].q||g.atoms[i].h||adj(g,i).length!==2))continue;
   const ps=paths(g,b.a,b.b,8);if(ps.length!==1)continue;const r=ps[0];let motif=null;
   // BCN: C8 ring with C3 fused across the opposite bond, saturated elsewhere.
   if(r.every(i=>g.atoms[i].e==='C')&&r.slice(0,-1).every((i,k)=>bond(g,i,r[k+1]).o===1)){
    const tips=adj(g,r[3]).filter(x=>!r.includes(x.i)&&x.o===1&&g.atoms[x.i].e==='C'&&bond(g,x.i,r[4])?.o===1);
    if(tips.length===1&&r.every((i,k)=>[3,4].includes(k)?adj(g,i).length===3:[0,7].includes(k)?adj(g,i).length===2:adj(g,i).length===2))motif='BCN';
   }
   // DBCO/DIBAC: dibenzo-fused azacyclooctyne, two benzene edges adjacent to C#C.
   if(!motif){const benz=(a,b)=>rings(g,a,6).some(r=>r.includes(b)&&[0,1].some(phase=>r.every((i,k)=>g.atoms[i].e==='C'&&!g.atoms[i].q&&bond(g,i,r[(k+1)%6]).o===((k+phase)%2?1:2))));
    if(benz(r[1],r[2])&&benz(r[5],r[6])&&[r[3],r[4]].map(i=>g.atoms[i].e).sort().join('')==='CN'&&[2,3,4].every(k=>bond(g,r[k],r[k+1]).o===1)&&r.every(i=>!g.atoms[i].q))motif='DBCO';
   }
   if(motif)out.push({type:'strainedAlkyne',motif_type:motif,atoms:{terminal:b.a,internal:b.b},label:motif+' C '+b.a+' / '+b.b});
  }return out;
 }
 // CAP starting chemistry is local topology, never a modification-name lookup.
 function capTerminalSites(g){const found=[],diagnostics=[];
  g.atoms.forEach((a,p)=>{if(a.e!=='P')return;const ns=adj(g,p);
   const reject=reason=>diagnostics.push({p,reason});
   if(a.q||a.h||ns.length!==4||ns.reduce((n,x)=>n+x.o,0)!==5||ns.filter(x=>x.o===2).length!==1||ns.some(x=>x.o===2&&!['O','S','N'].includes(g.atoms[x.i].e))||ns.some(x=>!['O','S','N','C'].includes(g.atoms[x.i].e)))return reject('unsupported_terminal_P_valence_or_substituents');
   const esters=ns.filter(x=>x.o===1&&g.atoms[x.i].e==='O'&&adj(g,x.i).some(y=>y.i!==p&&g.atoms[y.i].e==='C'));
   if(esters.length!==1||ns.some(x=>g.atoms[x.i].e==='O'&&adj(g,x.i).some(y=>y.i!==p&&g.atoms[y.i].e==='P')))return reject('nonterminal_or_ambiguous_phosphorus');
   const anchor=esters[0].i,c=adj(g,anchor).find(x=>x.i!==p)?.i;
   // Native AssemblyGraph ancestry or an explicit nucleoside ring establishes the oligo anchor.
   const origin=g.provenance?.atoms?.[c];
   const nucleoside=c!==undefined&&adj(g,c).some(x=>rings(g,x.i,5).concat(rings(g,c,5)).some(r=>r.filter(i=>g.atoms[i].e==='O').length===1&&r.filter(i=>g.atoms[i].e==='C').length===4&&r.every((i,k)=>bond(g,i,r[(k+1)%5]).o===1)&&r.some(i=>adj(g,i).some(y=>!r.includes(y.i)&&g.atoms[y.i].e==='N'))));
   if(!oligoOrigin(origin)&&!nucleoside)return reject('terminal_oligo_anchor_not_established');
   const oxygens=ns.filter(x=>x.o===1&&g.atoms[x.i].e==='O'&&adj(g,x.i).length===1&&((g.atoms[x.i].h===1&&!g.atoms[x.i].q)||(g.atoms[x.i].h===0&&g.atoms[x.i].q===-1)));
   if(!oxygens.length)return reject('no_available_terminal_nucleophilic_O');
   for(const o of oxygens)found.push({type:'terminalPhosphateNucleophile',motif_type:'terminal_phosphorus_nucleophile',atoms:{p,o:o.i},label:'Terminal P '+(p+1)+' / nucleophilic O '+(o.i+1),structural_compatibility:'COMPATIBLE',process_validation:'NOT_ESTABLISHED'});
  });return {sites:found,diagnostics};
 }
 function v2Sites(g,type){
  if(type==='disulfide')return disulfideSites(g);
  if(type==='thiol')return sites(g,type).filter(s=>{const c=adj(g,s.atoms.s)[0].i;return !adj(g,c).some(n=>n.o===2&&['O','S'].includes(g.atoms[n.i].e));});
  if(type==='maleimide')return sites(g,type).filter(s=>[s.atoms.alpha,s.atoms.beta].every(i=>adj(g,i).length===2)&&rings(g,s.atoms.alpha,5).some(r=>r.includes(s.atoms.beta)&&r.filter(i=>g.atoms[i].e==='N').length===1&&r.filter(i=>g.atoms[i].e==='C').length===4&&r.filter(i=>adj(g,i).some(x=>x.o===2&&g.atoms[x.i].e==='O')).length===2));
  if(type==='terminalPhosphateNucleophile')return capTerminalSites(g).sites;
  if(type==='acylDonor')return acylSites(g);
  if(type==='strainedAlkyne')return strainedSites(g);
  if(type==='m7GDPImidazolide'){
   return activatedDiphosphate(g).map(s=>({...s,type,motif_type:'phosphoroimidazolide'}));
  }
  return sites(g,type).map(s=>({...s,motif_type:type==='amine'?(g.atoms[s.atoms.n].h===2?'primary_amine':'secondary_amine'):type}));
 }
 const families=freeze({CAP:{id:'CAP',name:'CAP'},Condensation:{id:'Condensation',name:'Amine Coupling'},Click:{id:'Click',name:'Click'},DisulfideReduction:{id:'DisulfideReduction',name:'Disulfide Reduction',input_count:1},ThiolMaleimide:{id:'ThiolMaleimide',name:'Thiol–Maleimide'}});
 const registry=freeze({
  'disulfide-reduction/2':{family:'DisulfideReduction',roles:['disulfide'],rule:'disulfide-reduction/1',input_count:1},
  'thiol-maleimide/2':{family:'ThiolMaleimide',roles:['thiol','maleimide'],rule:'thio-michael/1',product_class:'succinimide_thioether'},
  'cap-im-m7gdp/2':{family:'CAP',roles:['terminalPhosphateNucleophile','m7GDPImidazolide'],motifs:['terminal_phosphorus_nucleophile','phosphoroimidazolide'],rule:'diphosphate-imidazolide/1',product_class:'triphosphate_cap'},
  'acyl-substitution/2':{family:'Condensation',roles:['amine','acylDonor'],motifs:['NHS','sulfo-NHS','PFP','TFP','pNP','carboxylic_acid'],product_classes:['amide','carbamate'],rule:'nhs-amide/1'},
  'cuaac-1,4/2':{family:'Click',roles:['azide','alkyne'],rule:'cuaac-1,4/1',product_class:'1,4_disubstituted_triazole'},
  'spaac/2':{family:'Click',roles:['azide','strainedAlkyne'],motifs:['DBCO','BCN'],rule:'cuaac-1,4/1',product_class:'fused_triazole'}
 });
 function identify(inputs){if(!Array.isArray(inputs)||![1,2].includes(inputs.length))fail('one or two graphs required');
  const seen=new Set();for(const input of inputs)for(const a of (input.graph||input).atoms||[])if(a.reaction_atom_id!==undefined){const id=a.reaction_atom_id;if(typeof id!=='string'||!id||seen.has(id))fail('atom IDs must be nonempty and unique across both inputs','INVALID_ATOM_IDS');seen.add(id);}
  return inputs.map((input,k)=>{const g=copy(input.graph||input);validate(g);g.atoms.forEach((a,i)=>{
   if(a.reaction_atom_id!==undefined)return;
   let id='input-'+k+':atom-'+i;while(seen.has(id))id+=':new';seen.add(id);a.reaction_atom_id=id;
  });return g;});
 }
 function detect(inputs){const gs=identify(inputs);return {schema_version:'reaction-sites/2',inputs:gs,candidate_sites:gs.map((g,k)=>Object.fromEntries(['amine','acylDonor','azide','alkyne','strainedAlkyne','terminalPhosphateNucleophile','m7GDPImidazolide','thiol','maleimide','disulfide'].map(type=>[type,v2Sites(g,type).map(s=>decorate(s,g,k))])))};}
 function decorate(s,g,input){const selected_atom_ids=Object.fromEntries(Object.entries(s.atoms).map(([k,i])=>[k,g.atoms[i].reaction_atom_id]));
  return {...copy(s),input,selected_atom_ids,site_id:input+':'+s.type+':'+Object.values(selected_atom_ids).join('|')};
 }
 function candidates(family,inputs){if(family==='DisulfideReduction')return reductionCandidates(inputs);if(!families[family])fail('unknown family','UNKNOWN_FAMILY');if(family==='CAP')inputs=inputs.map(value=>normalizeCapGraph(copy(value.graph||value)));const detected=detect(inputs),gs=detected.inputs,out=[];if(gs.length!==2)fail('two graphs required');
  for(const [id,t]of Object.entries(registry)){if(t.family!==family)continue;
   for(const swap of [false,true]){const roles=swap?[...t.roles].reverse():t.roles,ss=roles.map((r,k)=>detected.candidate_sites[k][r]);
    for(const a of ss[0])for(const b of ss[1]){
     const donor=roles[0]==='acylDonor'?a:b,spa=id==='spaac/2',formal=id==='acyl-substitution/2'&&donor.motif_type==='carboxylic_acid';
     for(const orientation of spa?['a','b']:['a']){
      const candidate={candidate_id:id+':'+a.site_id+':'+b.site_id+':'+orientation,family,transformation_id:id,roles,sites:[a,b],role_assignment:{input_0:roles[0],input_1:roles[1]},compatibility:'COMPATIBLE',status:formal?'FORMAL':'VALIDATED',reason:formal?'activation_required/formal_condensation':spa?'explicit_regioisomer_selection_required':'validated_topology',semantics:formal?['activation_required','formal_condensation']:[],product_class:donor.product_class||t.product_class,orientation,regioselectivity:spa?'not_predicted':'1,4'};
      if(family==='CAP'){candidate.status='STRUCTURALLY_COMPATIBLE';candidate.reason='structural_compatibility_only; experimental_process_validation_not_established';candidate.structural_compatibility='COMPATIBLE';candidate.process_validation='NOT_ESTABLISHED';candidate.semantics.push('structural_compatibility_only','experimental_process_validation_not_established');}
      out.push(candidate);
     }
    }
   }
  }
  return {schema_version:'reaction-candidates/2',family,inputs:gs,candidate_sites:detected.candidate_sites,candidates:out,status:out.length?'COMPATIBLE':'UNSUPPORTED',reason:out.length?null:(family==='CAP'?'NO_COMPATIBLE_CAP_PAIR: '+gs.map(g=>capTerminalSites(g).diagnostics.map(d=>d.reason).join(', ')).filter(Boolean).join('; '):'NO_VALIDATED_MOTIF_PAIR'),...(family==='CAP'?{terminal_p_diagnostics:gs.map(g=>capTerminalSites(g).diagnostics)}:{})};
 }
 function transform(family,inputs,selection){
  try{if(family==='DisulfideReduction')return reduceDisulfide(inputs,selection);const result=candidates(family,inputs),cs=result.candidates;const c=selection?cs.find(x=>x.candidate_id===(typeof selection==='string'?selection:selection.candidate_id)):cs.length===1?cs[0]:null;
   if(!c)return {...result,status:selection?'INVALID_SELECTION':cs.length?'SITE_SELECTION_REQUIRED':'UNSUPPORTED',reason:selection?'candidate must match current graphs':cs.length?'Select a candidate site pair and regioisomer':result.reason,product_graph:null};
   const t=registry[c.transformation_id],swap=c.roles[0]!==t.roles[0],ordered=swap?[1,0]:[0,1];
   // Execute in original input order so provenance indices never change with roles.
   const chosen=c.sites.map(s=>copy(s));
   const d={schema_version:'reaction-definition/2',id:c.transformation_id,name:c.transformation_id,roles:c.roles,rule:t.rule};
   // Role/order adapters do not mutate the registry or any legacy definition.
   const execute=(g,a,b,e)=>{let pair=[a,b];if(c.orientation==='b'){const j=c.roles.indexOf('strainedAlkyne');pair[j]={...pair[j],terminal:pair[j].internal,internal:pair[j].terminal};}rules[t.rule](g,pair[ordered[0]],pair[ordered[1]],e);};
   const step=apply(d.id,result.inputs,chosen,{definition:d,execute});step.validation={status:c.status,rule:c.transformation_id,semantics:c.semantics};
   if(!result.inputs[0].photometry&&result.inputs[1].photometry){step.output.photometry=productOptical([result.inputs[1],result.inputs[0]],step.output);step.properties.optical=copy(step.output.photometry);}
   const product=step.output,mapping=result.inputs.map((g,k)=>g.atoms.map((a,i)=>({input:k,input_index:i,atom_id:a.reaction_atom_id,product_index:product.provenance.input_atom_maps[k][i],status:product.provenance.input_atom_maps[k][i]===null?'removed':'retained'})));
   return {schema_version:'reaction-result/2',family,status:c.status,reason:c.reason,semantics:c.semantics,compatibility:c.compatibility,motif_types:c.sites.map(s=>s.motif_type),candidate_sites:result.candidate_sites,candidate:copy(c),role_assignment:c.role_assignment,selected_atom_ids:c.sites.map(s=>s.selected_atom_ids),mapping,product_graph:product,properties:step.properties,step};
  }catch(e){return {schema_version:'reaction-result/2',family,status:'UNSUPPORTED',reason:e.code||e.message,detail:e.message,product_graph:null};}
 }
 function workflow2(graph){validate(graph);return {schema_version:'reaction-workflow/2',initial:copy(graph),current:copy(graph),steps:[]};}
 function append2(w,family,reagent,selection){if(w.schema_version!=='reaction-workflow/2')fail('v2 workflow required');const r=transform(family,family==='DisulfideReduction'?[w.current]:[w.current,reagent],selection);if(!r.product_graph)return r;
  const next=copy(w);next.steps.push({family,reagent:reagent==null?null:copy(reagent),candidate_id:r.candidate.candidate_id,result:r});next.current=copy(r.product_graph);return freeze(next);}
 function reload2(raw){const w=typeof raw==='string'?JSON.parse(raw):copy(raw);if(w.schema_version!=='reaction-workflow/2')fail('v2 workflow required');let next=workflow2(w.initial);
  for(const s of w.steps){next=append2(next,s.family,s.reagent,s.candidate_id);if(!next.steps||JSON.stringify(next.steps.at(-1))!==JSON.stringify(s))fail('v2 workflow step mismatch');}
  if(JSON.stringify(next)!==JSON.stringify(w))fail('v2 workflow mismatch');return next;
 }
 // Generic neutral divalent R-S-S-R only: no oxidized sulfur or polysulfides.
 function disulfideSites(g){return g.bonds.flatMap(b=>b.o===1&&[b.a,b.b].every((i,k)=>{
  const a=g.atoms[i],ns=adj(g,i),other=k?b.a:b.b;
  return a.e==='S'&&!a.q&&!a.h&&ns.length===2&&ns.every(x=>x.o===1)&&ns.some(x=>x.i!==other&&g.atoms[x.i].e==='C');
 })?[{type:'disulfide',motif_type:'disulfide',atoms:{s1:b.a,s2:b.b},label:'S–S '+(b.a+1)+' / '+(b.b+1)}]:[]);}
 function cleavage(g,s){
  const cut=copy(g);cut.bonds=cut.bonds.filter(b=>!((b.a===s.atoms.s1&&b.b===s.atoms.s2)||(b.b===s.atoms.s1&&b.a===s.atoms.s2)));
  cut.atoms[s.atoms.s1].h++;cut.atoms[s.atoms.s2].h++;
  const seen=new Set(),components=[];
  for(let i=0;i<cut.atoms.length;i++)if(!seen.has(i)){const found=[],pending=[i];while(pending.length){const n=pending.pop();if(seen.has(n))continue;seen.add(n);found.push(n);adj(cut,n).forEach(x=>pending.push(x.i));}components.push(found.sort((a,b)=>a-b));}
  return {cut,components};
 }
 // Only verified native AssemblyGraph residue provenance can select automatically.
 function oligoOrigin(p){if(!p)return false;if(p.previous)return oligoOrigin(p.previous);
  if(p.kind!=='building-block')return false;
  const b=REFERENCE.templates[p.block];return !!(b?.base&&b?.attachments&&p.node&&Number.isInteger(p.position));
 }
 function reductionCandidates(inputs){
  if(inputs.length!==1)fail('Disulfide Reduction requires one input');
  const gs=identify(inputs),g=gs[0],ss=v2Sites(g,'disulfide').map(s=>decorate(s,g,0)),out=[];
  for(const site of ss){const {components}=cleavage(g,site),owners=components.map((c,i)=>c.some(n=>oligoOrigin(g.provenance?.atoms?.[n]))?i:-1).filter(i=>i>=0);
   const retained=components.length===1?[0]:owners.length===1?owners:components.map((_,i)=>i);
   for(const keep of retained){const fragment=components[keep];out.push({candidate_id:'disulfide-reduction/2:'+site.site_id+':keep:'+fragment.map(i=>g.atoms[i].reaction_atom_id).join('|'),family:'DisulfideReduction',transformation_id:'disulfide-reduction/2',roles:['disulfide'],sites:[site],semantics:[],status:'VALIDATED',orientation:'a',compatibility:'COMPATIBLE',retained_component:keep,retention:components.length===1?'single_component':owners.length===1?'oligo_provenance':'explicit_selection_required',fragments:components.map((c,i)=>({index:i,atom_indices:c,atom_ids:c.map(n=>g.atoms[n].reaction_atom_id),atom_count:c.length,contains_oligo:owners.includes(i)}))});}
  }
  return {schema_version:'reaction-candidates/2',family:'DisulfideReduction',inputs:gs,candidate_sites:[{disulfide:ss}],candidates:out,status:out.length?'COMPATIBLE':'UNSUPPORTED',reason:out.length?null:'NO_DISULFIDE_MOTIF'};
 }
 function reduceDisulfide(inputs,selection){
  const result=reductionCandidates(inputs),cs=result.candidates,id=typeof selection==='string'?selection:selection?.candidate_id,c=id?cs.find(c=>c.candidate_id===id):cs.length===1?cs[0]:null;
  if(!c)return {...result,status:id?'INVALID_SELECTION':cs.length?'SITE_SELECTION_REQUIRED':'UNSUPPORTED',reason:cs.length?'Select S–S site and retained fragment':'NO_DISULFIDE_MOTIF',product_graph:null};
  const g=result.inputs[0],{cut,components}=cleavage(g,c.sites[0]),keep=new Set(components[c.retained_component]);
  function fragment(indices){const index=new Map(indices.map((n,i)=>[n,i])),bs=cut.bonds.map((b,i)=>({b,i})).filter(({b})=>index.has(b.a)&&index.has(b.b));
   const output=validate({atoms:indices.map(i=>copy(cut.atoms[i])),bonds:bs.map(({b})=>({...b,a:index.get(b.a),b:index.get(b.b)}))});
   output.provenance={schema_version:'reaction-provenance/1',atoms:indices.map(i=>({input:0,atom:i,previous:copy(g.provenance?.atoms?.[i]||null)})),bonds:bs.map(({b})=>{const index=g.bonds.findIndex(x=>x.a===b.a&&x.b===b.b);return {input:0,bond:index,previous:copy(g.provenance?.bonds?.[index]||null)};}),input_atom_maps:[g.atoms.map((_,i)=>index.get(i)??null)]};return output;
  }
  const product=fragment([...keep]),removed=components.filter((_,i)=>i!==c.retained_component).map(fragment);
  product.provenance.removed_fragments=removed;
  product.provenance.removed_atoms=g.atoms.flatMap((_,i)=>keep.has(i)?[]:[{input:0,atom:i,previous:copy(g.provenance?.atoms?.[i]||null)}]);
  product.provenance.removed_bonds=g.bonds.flatMap((b,i)=>!keep.has(b.a)||!keep.has(b.b)||!bond(cut,b.a,b.b)?[{input:0,bond:i,endpoints:[b.a,b.b],previous:copy(g.provenance?.bonds?.[i]||null)}]:[]);
  product.provenance.edits=[{op:'remove-bond',...c.sites[0].atoms},...[c.sites[0].atoms.s1,c.sites[0].atoms.s2].map(atom=>({op:'hydrogen',atom,delta:1}))];
  const mapping=[g.atoms.map((a,i)=>({input:0,input_index:i,atom_id:a.reaction_atom_id,product_index:product.provenance.input_atom_maps[0][i],status:keep.has(i)?'retained':'removed'}))];
  const definition={schema_version:'reaction-definition/2',id:c.transformation_id,name:'Disulfide Reduction',roles:['disulfide'],rule:'disulfide-reduction/1',input_count:1};
  const properties=Lite.graphProperties(product),step={schema_version:'reaction-step/1',definition,validation:{status:'VALIDATED',rule:definition.rule},reactants:[copy(g.source||{kind:'molecular-graph'})],inputs:copy(inputs),sites:copy(c.sites),output:product,properties};
  return {schema_version:'reaction-result/2',family:'DisulfideReduction',status:'VALIDATED',semantics:[],candidate:c,selected_atom_ids:c.sites.map(s=>s.selected_atom_ids),mapping,product_graph:product,removed_fragments:removed,properties,step};
 }
 // Reaction-only CTfile normalization. Other imports retain their original contract.
 function normalizeCapGraph(g){
  g.atoms.forEach((a,p)=>{if(a.e!=='P'||a.q!==1)return;const ns=adj(g,p);if(ns.length!==4||ns.some(x=>x.o!==1||!['O','N','S'].includes(g.atoms[x.i].e)))return;
   const o=ns.find(x=>g.atoms[x.i].e==='O'&&g.atoms[x.i].q===-1&&!g.atoms[x.i].h&&adj(g,x.i).length===1);if(!o)return;
   a.q=0;g.atoms[o.i].q=0;bond(g,p,o.i).o=2;
  });return g;
 }
 function parseReagent(text,family='CAP'){
  if(!['cap','CAP'].includes(family))return Lite.parseMol(text,{manualMarkers:true}).graph;
  const lines=text.replace(/\r/g,'').split('\n'),v3=lines.some(l=>l.includes('V3000'));
  // Replace only a complete aromatic P-N imidazole ring with its unique Kekule form.
  const atoms=[],edges=[];
  if(v3){let mode='';for(let k=0;k<lines.length;k++){const l=lines[k];if(l==='M  V30 BEGIN ATOM')mode='atom';else if(l==='M  V30 BEGIN BOND')mode='bond';else if(l.startsWith('M  V30 END '))mode='';else if(l.startsWith('M  V30 ')&&mode){const t=l.slice(7).trim().split(/\s+/);if(mode==='atom')atoms[+t[0]-1]={e:t[1]};else edges.push({a:+t[2]-1,b:+t[3]-1,o:+t[1],line:k,t});}}}
  else{const n=+lines[3]?.slice(0,3),m=+lines[3]?.slice(3,6);for(let i=0;i<n;i++)atoms.push({e:lines[4+i]?.slice(31,34).trim()});for(let i=0;i<m;i++){const k=4+n+i,l=lines[k];edges.push({a:+l.slice(0,3)-1,b:+l.slice(3,6)-1,o:+l.slice(6,9),line:k});}}
  const atomLines=new Map();
  if(v3){let inAtoms=false;lines.forEach((l,k)=>{if(l==='M  V30 BEGIN ATOM')inAtoms=true;else if(l==='M  V30 END ATOM')inAtoms=false;else if(inAtoms){const t=l.slice(7).trim().split(/\s+/),i=+t[0]-1;atoms[i].q=+(t.find(v=>v.startsWith('CHG='))?.slice(4)||0);atomLines.set(i,k);}});}
  else{atoms.forEach((a,i)=>{a.q=({1:3,2:2,3:1,5:-1,6:-2,7:-3})[+lines[4+i].slice(36,39)]||0;atomLines.set(i,4+i);});for(const l of lines.filter(l=>l.startsWith('M  CHG'))){const t=l.trim().split(/\s+/);for(let j=0;j<+t[2];j++)if(atoms[+t[3+2*j]-1])atoms[+t[3+2*j]-1].q=+t[4+2*j];}}
  const raw={atoms,bonds:edges},converted=new Set(),oldCharges=atoms.map(a=>a.q),oldOrders=edges.map(e=>e.o);
  normalizeCapGraph(raw);
  edges.forEach((e,i)=>{if(e.o!==oldOrders[i])converted.add(e);});
  const changed=new Set(atoms.flatMap((a,i)=>a.q!==oldCharges[i]?[i]:[]));
  for(const i of changed){const k=atomLines.get(i);lines[k]=v3?lines[k].replace(/ CHG=[+-]?\d+/, ' CHG=0'):lines[k].slice(0,36)+'  0'+lines[k].slice(39);}
  if(!v3)lines.forEach((l,k)=>{if(l.startsWith('M  CHG')){const t=l.trim().split(/\s+/);for(let j=0;j<+t[2];j++)if(changed.has(+t[3+2*j]-1))t[4+2*j]='0';lines[k]='M  CHG'+String(+t[2]).padStart(3)+Array.from({length:+t[2]},(_,j)=>String(+t[3+2*j]).padStart(4)+String(+t[4+2*j]).padStart(4)).join('');}});
  for(const e of edges.filter(e=>e.o===1))for(const [p,n]of [[e.a,e.b],[e.b,e.a]])if(atoms[p]?.e==='P'&&atoms[n]?.e==='N')for(const found of rings(raw,n,5)){
   const ring=[found,[found[0],...found.slice(1).reverse()]].find(r=>r.map(i=>atoms[i].e).join('')==='NCNCC');
   if(!ring||!ring.every((i,k)=>bond(raw,i,ring[(k+1)%5]).o===4))continue;
   ring.forEach((i,k)=>{const b=bond(raw,i,ring[(k+1)%5]);b.o=(atoms[ring[0]].q===1&&!atoms[ring[2]].q?[2,1,1,2,1]:[1,2,1,2,1])[k];converted.add(b);});
  }
  for(const e of converted){if(v3){e.t[1]=String(e.o);lines[e.line]='M  V30 '+e.t.join(' ');}else lines[e.line]=lines[e.line].slice(0,6)+String(e.o).padStart(3)+lines[e.line].slice(9);}
  const parsed=Lite.parseMol(lines.join('\n'),{manualMarkers:true}).graph;
  if(converted.size||changed.size)parsed.normalization={...parsed.normalization,cap_representation:{source_ctfile:text,bond_lines:[...converted].map(e=>e.line+1),charge_atoms:[...changed].map(i=>i+1),reason:'equivalent localized phosphoroimidazolide / phosphoryl representation'}};
  return parsed;
 }

 const v2=freeze({schema_version:'reaction-engine/2',families,registry,parseReagent,detect,candidates,transform,workflow:workflow2,append:append2,reload:reload2});

 return {definitions:copy(definitions),sites,diagnose,resolveSites,validate,apply,workflow,append,reload,revert,v2};
})();
