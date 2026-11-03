'use strict';
// Local, explicit boundaries. Snapshots remain byte-for-byte copies.
const Sandbox=(()=>{
 const clone=x=>JSON.parse(JSON.stringify(x));
 const identity=g=>JSON.stringify({atoms:g.atoms.map(({x,y,z,...a})=>a),bonds:g.bonds});
 const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
 function record(graph,extra={}){
  const g=freeze(clone(graph));
  return freeze({schema:'sandbox-record/1',graph:g,normalizedMolecularGraph:Lite.presentationInput(g),metrics:Lite.graphProperties(g),provenance:g.provenance||g.normalization||null,source:'A · actual local snapshot v0.11.1 + normalization artifact',mock:false,...extra});
 }
 const A={
  sequence:s=>{const r=Lite.calculate(s);r.graph.photometry=r.optical;return record(r.graph,{assemblyGraph:Lite.toAssemblyGraph(s),optical:r.optical,input:s});},
  mol:s=>record(Lite.parseMol(s).graph,{input:s}),
  smiles:s=>record(Lite.parseSmiles(s).graph,{input:s}),
  start:r=>Reactions.workflow(r.graph),
  preview(w,id,reagent,selected){const next=Reactions.append(w,id,reagent,selected);if(typeof FragmentComposition!=='undefined')FragmentComposition.remember(next);return next;},
  checkpoint:(w,n)=>record(w.steps[n-1].output,{checkpoint:n,workflow:w.steps.some(s=>s.reaction_v2)?ReactionFamilyAPI.checkpointWorkflow(w,n):Reactions.revert(w,n)}),
  sites:(g,role)=>Reactions.sites(g,role)
 };
 function semantics(g){
  const p=g.provenance,m=p?.input_atom_maps;
  if(!m)return {groups:[],routes:clone(g.routes||[])};
  // Current-step ownership only; recursive ancestry remains in A provenance.
  const joins=(p.bonds||[]).flatMap((b,i)=>b.kind==='reaction'?[i]:[]);
  const atoms=m[1]?.filter(i=>i!==null)||[];
  return {groups:atoms.length?[{id:'secondary',atoms}]:[],routes:clone(g.routes||[]),placements:atoms.length&&joins.length?[{group:'secondary',bonds:joins}]:[]};
 }
 function abbreviationGraph(g){return {atoms:g.atoms.map((a,i)=>({id:'a'+i,e:a.e,h:a.h||0,charge:a.q||0,isotope:a.iso||0,aromatic:!!a.aromatic,stereo:a.s||0,x:a.x,y:a.y})),bonds:g.bonds.map((b,i)=>({...b,id:'b'+i}))};}
 function renderView(g,groups){
  if(!groups.length)return Lite.svg(g);
  // Display-only SVG adapter: retain all full-graph coordinates, hide pendant atoms.
  // It deliberately does not create a condensed chemical graph or feed UI state to A.
  const hidden=new Set(groups.flatMap(v=>v.atomIndices)),roots=new Map(groups.map(v=>[v.root,v]));
  const xs=g.atoms.map(a=>a.x),ys=g.atoms.map(a=>a.y),minX=Math.min(...xs)-2,minY=Math.min(...ys)-2,w=Math.max(...xs)-minX+2,h=Math.max(...ys)-minY+2;
  let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${w} ${h}" role="img" aria-label="Abbreviated structure"><g fill="none" stroke="#243e46" stroke-width=".055">`;
  for(const b of g.bonds){if((hidden.has(b.a)&&!roots.has(b.a))||(hidden.has(b.b)&&!roots.has(b.b)))continue;const a=g.atoms[b.a],z=g.atoms[b.b];s+=`<path d="M${a.x} ${a.y}L${z.x} ${z.y}"/>`;if(b.o>1)s+=`<path d="M${a.x+.12} ${a.y+.12}L${z.x+.12} ${z.y+.12}"/>`;}
  s+='</g><g font-family="Arial" font-size=".48" text-anchor="middle" dominant-baseline="central">';
  g.atoms.forEach((a,i)=>{if(hidden.has(i)&&!roots.has(i))return;const label=roots.get(i)?.label||(a.e==='C'?'':a.e+(a.h?'H'+(a.h>1?a.h:''):'')+(a.q>0?'+':a.q<0?'−':''));if(label)s+=`<text x="${a.x}" y="${a.y}" fill="#126b66" stroke="white" stroke-width=".12" paint-order="stroke">${label}</text>`;});
  return s+'</g></svg>';
 }
 function ringCoordinates(graph){
  // C-side coordinate-only adapter for an already existing A triazole cycle.
  // Never creates a ring or edits bond orders. General ring depiction is out of scope.
  const ring=typeof SandboxValidation!=='undefined'?SandboxValidation.ring(graph):null;
  if(!ring)return graph;
  const cuaac=graph.bonds.flatMap((b,i)=>graph.provenance?.bonds?.[i]?.kind==='reaction'&&/^cuaac(?:$|-)/.test(graph.provenance.bonds[i].definition)?[b]:[]);
  if(cuaac.length===2){
   // Locate this step's real N3C2 center from A provenance, not a generic ring.
   const cs=cuaac.map(b=>[b.a,b.b].find(i=>graph.atoms[i].e==='C'));
   const ns=cuaac.map(b=>[b.a,b.b].find(i=>graph.atoms[i].e==='N'));
   const neighbors=i=>graph.bonds.filter(b=>b.a===i||b.b===i).map(b=>b.a===i?b.b:b.a);
   const middle=neighbors(ns[0]).find(i=>graph.atoms[i].e==='N'&&neighbors(i).includes(ns[1]));
   if(middle===undefined||!neighbors(cs[0]).includes(cs[1]))return graph;
   const proximal=ns.find(i=>neighbors(i).some(j=>!ns.includes(j)&&j!==middle&&!cs.includes(j))),pi=ns.indexOf(proximal);
   if(pi<0)return graph;
   const terminal=cs[pi],internal=cs[1-pi],distal=ns[1-pi],cycle=[internal,terminal,proximal,middle,distal],inside=new Set(cycle);
   // Keep the substituted alkyne carbon fixed; retain its original bond direction.
   const a=graph.atoms[internal],z=graph.atoms[terminal],angle=Math.atan2(z.y-a.y,z.x-a.x),c=Math.cos(angle),s=Math.sin(angle),L=1.5;
   const component=[],seen=new Set(cycle),queue=neighbors(proximal).filter(i=>!inside.has(i));
   while(queue.length){const i=queue.pop();if(seen.has(i))continue;seen.add(i);component.push(i);queue.push(...neighbors(i).filter(j=>!seen.has(j)));}
   // An externally bridged center is outside this local template's remit.
   if(component.some(i=>neighbors(i).some(j=>inside.has(j)&&j!==proximal)))return graph;
   let best=null;
   for(const side of [-1,1]){
    const g=clone(graph),points=[{x:0,y:0},{x:L,y:0}];let heading=0;
    for(let k=2;k<5;k++){heading+=side*2*Math.PI/5;points.push({x:points[k-1].x+L*Math.cos(heading),y:points[k-1].y+L*Math.sin(heading)});}
    const center={x:points.reduce((v,p)=>v+p.x,0)/5,y:points.reduce((v,p)=>v+p.y,0)/5};
    cycle.forEach((id,k)=>{g.atoms[id].x=a.x+c*points[k].x-s*points[k].y;g.atoms[id].y=a.y+s*points[k].x+c*points[k].y;});
    const root=graph.atoms[proximal],target=g.atoms[proximal],first=neighbors(proximal).find(i=>!inside.has(i));
    const radial=angle+Math.atan2(points[2].y-center.y,points[2].x-center.x),old=first===undefined?radial:Math.atan2(graph.atoms[first].y-root.y,graph.atoms[first].x-root.x),turn=radial-old,rc=Math.cos(turn),rs=Math.sin(turn);
    for(const i of component){const p=graph.atoms[i],x=p.x-root.x,y=p.y-root.y;g.atoms[i].x=target.x+rc*x-rs*y;g.atoms[i].y=target.y+rs*x+rc*y;}
    const moving=new Set([...cycle,...component]);let score=0;
    for(const i of moving)for(let j=0;j<g.atoms.length;j++)if(!moving.has(j)&&!neighbors(i).includes(j)){const d=Math.hypot(g.atoms[i].x-g.atoms[j].x,g.atoms[i].y-g.atoms[j].y);score+=Math.max(0,1.2-d)**2*100;}
    // Favor the substituent anchor direction when both sides have room.
    score+=Math.abs(Math.atan2(Math.sin(turn),Math.cos(turn)))*.01;
    for(const route of g.routes||[])if(route.atoms?.every(i=>component.includes(i)))route.points=route.points.map(([x,y])=>[target.x+rc*(x-root.x)-rs*(y-root.y),target.y+rs*(x-root.x)+rc*(y-root.y)]);
    if(!best||score<best.score)best={g,score};
   }
   return best.g;
  }
  const g=clone(graph),inside=new Set(ring),adj=g.atoms.map(()=>[]);g.bonds.forEach(b=>{adj[b.a].push(b.b);adj[b.b].push(b.a);});
  const radius=1.5/(2*Math.sin(Math.PI/5)),anchor=g.atoms[ring[0]],origin={x:anchor.x,y:anchor.y};
  ring.forEach((id,k)=>{const x=origin.x+radius*(Math.cos(Math.PI+k*2*Math.PI/5)+1),y=origin.y+radius*Math.sin(Math.PI+k*2*Math.PI/5),dx=x-g.atoms[id].x,dy=y-g.atoms[id].y;
   const seen=new Set(ring),queue=[...adj[id].filter(i=>!inside.has(i))];while(queue.length){const j=queue.shift();if(seen.has(j))continue;seen.add(j);g.atoms[j].x+=dx;g.atoms[j].y+=dy;queue.push(...adj[j].filter(i=>!seen.has(i)));}
   g.atoms[id].x=x;g.atoms[id].y=y;
  });
  for(const route of g.routes||[]){const b=g.bonds[route.bond],dx=g.atoms[b.a].x-graph.atoms[b.a].x,dy=g.atoms[b.a].y-graph.atoms[b.a].y;if(Math.abs(g.atoms[b.b].x-graph.atoms[b.b].x-dx)<1e-6&&Math.abs(g.atoms[b.b].y-graph.atoms[b.b].y-dy)<1e-6)route.points=route.points.map(([x,y])=>[x+dx,y+dy]);}
  return g;
 }
 const C={
  present(r,on=true){
   const before=identity(r.graph),provider=typeof FragmentComposition!=='undefined'?FragmentComposition.coordinates(r):typeof SmallFragmentDepictor!=='undefined'?SmallFragmentDepictor.coordinates(r):{graph:r.graph,status:'not loaded'},layout=Presentation.layout({graph:provider.graph,semantics:provider.composed?{routes:provider.graph.routes||[]}:semantics(r.graph)}),drawing=ringCoordinates(Presentation.materialize(r.graph,layout));
   layout.metadata.smallFragmentProvider=provider.status;if(provider.transforms)layout.metadata.compositionTransforms=provider.transforms;if(provider.warnings)layout.metadata.warnings.push(...provider.warnings);layout.coordinates=drawing.atoms.map(a=>({x:a.x,y:a.y}));
   if(typeof SandboxValidation!=='undefined'&&SandboxValidation.ring(drawing)){const xs=drawing.atoms.map(a=>a.x),ys=drawing.atoms.map(a=>a.y);layout.bounds={minX:Math.min(...xs),minY:Math.min(...ys),maxX:Math.max(...xs),maxY:Math.max(...ys)};layout.metadata.sandboxAdapter='existing A triazole → regular pentagon coordinates only';}
   const ag=abbreviationGraph(drawing),protectedAtomIds=r.assemblyGraph||drawing.atoms.some(a=>a.s)||drawing.bonds.some(b=>b.s)?ag.atoms.map(a=>a.id):[];
   const session=AbbreviationPresentation.create(ag,SNAPSHOT_DATA.templates,{protectedAtomIds,on}),view=session.view();
   if(identity(r.graph)!==before||identity(drawing)!==before)throw Error('C_IDENTITY_CHANGED');
   const after=Lite.graphProperties(drawing);if(JSON.stringify(after)!==JSON.stringify(r.metrics))throw Error('C_METRICS_CHANGED');
   return {drawing,layout,view,svg:renderView(drawing,view.groups),quality:Lite.quality(drawing),invariant:true,mock:false,engine:layout.metadata.engine+' + C pendant matcher; integrated SVG / existing-triazole coordinate adapters',status:layout.metadata.warnings.length?'REVIEW':'PASS'};
  }
 };
 function aliasMol(){const g=clone(Lite.parseSmiles('CCO').graph);g.atoms.push({e:'*',h:0,q:0,x:4.5,y:0});g.bonds.push({a:2,b:3,o:1,s:0});return Lite.mol(g).replace('M  END','A    4\nAc\nM  END');}
 const fixtures=[
  {id:'20mer',name:'20-mer · 5′ → 3′ bamboo',kind:'sequence',input:'rArCrGrU'.repeat(5)},
  {id:'full',name:'Custom · fully expanded acetate',kind:'mol',input:()=>Lite.mol(Lite.parseSmiles('CCOC(=O)C').graph)},
  {id:'abbreviation',name:'Custom · O–Ac alias → full graph',kind:'mol',input:aliasMol},
  {id:'five',name:'5′ C6N',kind:'sequence',input:'[C6N]rArCrGrU'},
  {id:'three',name:'3′ C6N',kind:'sequence',input:'rArCrGrU[C6N]'},
  {id:'galnac',name:'5′ GalNAc · NAG37',kind:'sequence',input:'[NAG37]rArCrGrU'},
  {id:'biotin',name:'Biotin · capability probe',kind:'sequence',input:'rArC[Biotin]'},
  {id:'amide',name:'Step 1 · amine + SMCC NHS ester',kind:'reaction',steps:1},
  {id:'cuaac',name:'CuAAC · actual N₃C₂ five-membered ring',kind:'click'},
  {id:'workflow',name:'3-step · SMCC → thiol → CuAAC',kind:'reaction',steps:3}
 ];
 function reagent(n){if(typeof document!=='undefined'&&document.getElementById('reagentInput')?.value.trim())return Lite.parseMol(document.getElementById('reagentInput').value,{manualMarkers:true}).graph;if(n==='cap-imidazolide')return clone(REACTION_REAGENTS['cap-imidazolide'].graph);if(n==='cap')return clone(REACTION_REAGENTS.cap.graph);return n==='alkyne'?clone(REACTION_REAGENTS.alkyne.graph):Lite.parseMol(SNAPSHOT_DATA.reagents[n],{manualMarkers:true}).graph;}
 function selection(w,id,g){return Reactions.definitions[id].roles.map((role,i)=>{const x=i?g:w.current,ss=A.sites(x,role);if(role==='amine')return ss.find(s=>x.bonds.some(b=>b.a===s.atoms.n&&x.atoms[b.b].h===2||b.b===s.atoms.n&&x.atoms[b.a].h===2))||ss[0];return ss[0];});}
 function loadFixture(f){
  if(f.kind==='sequence')return {record:A.sequence(f.input)};
  if(f.kind==='mol')return {record:A.mol(typeof f.input==='function'?f.input():f.input)};
  if(f.kind==='click'){const base=record(REACTION_REAGENTS.azide.graph),w=A.start(base),g=reagent('alkyne');const next=A.preview(w,'cuaac',g,selection(w,'cuaac',g));return {record:A.checkpoint(next,1),workflow:next};}
  let w=A.start(A.sequence('[C6N]rA'));
  for(let i=0;i<f.steps;i++){const [id,n]=[['amide','smcc'],['maleimide-reverse','azidothiol'],['cuaac','alkyne']][i],g=reagent(n);w=A.preview(w,id,g,selection(w,id,g));}
  return {record:A.checkpoint(w,w.steps.length),workflow:w};
 }
 return {A,C,record,identity,clone,fixtures,loadFixture,reagent,selection,aliasMol};
})();
