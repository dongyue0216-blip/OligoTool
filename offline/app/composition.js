'use strict';
// C-only composition sidecar. Parent geometry and atom indices come from actual A checkpoints.
// All transforms are proper rotations/translations. No annotation is stored in a chemical graph.
const FragmentComposition=(()=>{
 const recipes=new Map(),cache=new Map(),clone=g=>Sandbox.clone(g),key=g=>Sandbox.identity(g),dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
 function remember(w){for(const step of w.steps)recipes.set(key(step.output),step);cache.clear();}
 function local(g){return typeof SmallFragmentDepictor==='undefined'?{graph:g,status:'local source geometry'}:SmallFragmentDepictor.coordinates({graph:g});}
 function assemble(g){
  if(!g.layout?.adaptive||!g.sites?.length)return {graph:g,status:'semantic bamboo retained'};
  const out=clone(g),origins=g.provenance.atoms,groups=new Map();origins.forEach((a,i)=>{if(a.kind==='building-block'){if(!groups.has(a.position))groups.set(a.position,[]);groups.get(a.position).push(i);}});
  const blocks=[...groups].sort((a,b)=>a[0]-b[0]).map(([position,ids])=>{const source=origins[ids[0]],tpl=Lite.getBuildingBlock(source.block);if(!tpl)throw Error('MISSING_FRAGMENT_TEMPLATE');let t=tpl;
   if(!tpl.direct_formula_parts)t=local(tpl).graph;
   const up=tpl.attachments?.upstream?.atom,down=tpl.attachments?.downstream?.atom;
   const points=t.atoms.map(a=>({x:a.x,y:a.y}));
   if(!tpl.direct_formula_parts&&Number.isInteger(up)&&Number.isInteger(down)){const a={...points[up]},b=points[down],angle=Math.PI/2-Math.atan2(b.y-a.y,b.x-a.x),c=Math.cos(angle),s=Math.sin(angle);for(const p of points){const x=p.x-a.x,y=p.y-a.y;p.x=c*x-s*y;p.y=s*x+c*y;}}
   return {position,ids,points,up,down,minY:Math.min(...points.map(p=>p.y)),maxY:Math.max(...points.map(p=>p.y))};
  });
  const width=Math.max(30,...blocks.map(b=>Math.max(...b.points.map(p=>p.x))-Math.min(...b.points.map(p=>p.x))+20));let y=0;
  for(let n=0;n<blocks.length;n++){const b=blocks[n],prev=blocks[n-1];if(n%10===0)y=0;else y+=Math.max(11,prev.maxY-b.minY+4.5);b.dx=Math.floor(n/10)*width;b.dy=y;for(const i of b.ids){const p=b.points[origins[i].local_atom];out.atoms[i].x=p.x+b.dx;out.atoms[i].y=p.y+b.dy;}}
  const adjacency=g.atoms.map(()=>[]);g.bonds.forEach((b,i)=>{adjacency[b.a].push({atom:b.b,bond:i});adjacency[b.b].push({atom:b.a,bond:i});});
  // Move each phosphorus group using its real neighboring building-block anchors.
  const extras=new Map();origins.forEach((p,i)=>{if(p.kind!=='building-block'){const k=p.kind+':'+(p.edge||p.termination||'')+':'+(p.step||'');if(!extras.has(k))extras.set(k,[]);extras.get(k).push(i);}});
  out.routes=[];
  for(const ids of extras.values()){const set=new Set(ids),anchors=[...new Set(ids.flatMap(i=>adjacency[i].filter(n=>!set.has(n.atom)).map(n=>n.atom)))],old=anchors.map(i=>g.atoms[i]),now=anchors.map(i=>out.atoms[i]);if(!anchors.length)continue;
   const dx=now.reduce((s,a,i)=>s+a.x-old[i].x,0)/anchors.length,dy=now.reduce((s,a,i)=>s+a.y-old[i].y,0)/anchors.length;ids.forEach(i=>{out.atoms[i].x+=dx;out.atoms[i].y+=dy;});
   if(anchors.length===2){const phosphorus=ids.find(i=>g.atoms[i].e==='P');if(phosphorus!==undefined){const boundary=Math.abs(now[0].x-now[1].x)>width*.6,target=boundary?{x:now[0].x,y:now[0].y+2}:{x:(now[0].x+now[1].x)/2,y:(now[0].y+now[1].y)/2},shift={x:target.x-out.atoms[phosphorus].x,y:target.y-out.atoms[phosphorus].y};ids.forEach(i=>{out.atoms[i].x+=shift.x;out.atoms[i].y+=shift.y;});}}
  }
  for(let i=0;i<out.bonds.length;i++){const b=out.bonds[i],a=out.atoms[b.a],z=out.atoms[b.b];if(dist(a,z)>6){const boundary=Math.abs(a.x-z.x)>width*.6;out.routes.push({bond:i,kind:boundary?'column-boundary':'fragment-connector',atoms:[b.a,b.b],points:boundary?[[a.x,a.y],[a.x,a.y+3],[z.x-8,a.y+3],[z.x-8,z.y-4],[z.x,z.y-4],[z.x,z.y]]:[[a.x,a.y],[Math.min(a.x,z.x)-3,a.y],[Math.min(a.x,z.x)-3,z.y],[z.x,z.y]]});}}
  return {graph:out,status:'semantic 10-unit bamboo + local RDKit fragments + anchor-relative linkages'};
 }
 function coordinates(r,depth=0){
  const g=r.graph;if(depth>30)throw Error('PRESENTATION_ANCESTRY_LIMIT');
  if(r.workflow)remember(r.workflow);
  const stamp=key(g),cached=cache.get(stamp);if(cached)return cached;
  let result,step=recipes.get(stamp);
  if(step){
   const parent=coordinates({graph:step.inputs[0]},depth+1),secondary=step.inputs.length>1?local(step.inputs[1]):null,out=clone(g),maps=g.provenance.input_atom_maps;
   for(const [k,source]of (secondary?[parent.graph,secondary.graph]:[parent.graph]).entries())source.atoms.forEach((a,i)=>{const to=maps[k][i];if(to!==null&&to!==undefined){out.atoms[to].x=a.x;out.atoms[to].y=a.y;}});
   // A intentionally stores chemical connectivity; restore C's display paths by endpoint mapping.
   out.routes=[];for(const route of parent.graph.routes||[]){const b=parent.graph.bonds[route.bond],a=maps[0][b.a],z=maps[0][b.b];if(a==null||z==null)continue;const bond=out.bonds.findIndex(b=>(b.a===a&&b.b===z)||(b.a===z&&b.b===a));if(bond>=0)out.routes.push({...clone(route),bond,atoms:[a,z]});}
   const atoms=(maps[1]||[]).filter(i=>i!==null),moving=new Set(atoms),joins=out.bonds.flatMap((b,i)=>moving.has(b.a)!==moving.has(b.b)?[i]:[]);
   if(joins.length){const layout=Presentation.layout({graph:out,semantics:{routes:out.routes,groups:[{id:'step-secondary',atoms}],placements:[{group:'step-secondary',bonds:joins}]}});result={graph:Presentation.materialize(out,layout),composed:true,status:'recursive parent bamboo / paths retained · '+secondary.status,transforms:layout.metadata.transforms,warnings:layout.metadata.warnings};}
   else result={graph:out,composed:true,status:'mapped parent / reagent geometry'};
  }else if(g.layout?.adaptive)result={...assemble(g),composed:true};
  else if(g.sites||r.assemblyGraph||g.photometry||g.atoms.length>250)result={graph:g,composed:true,status:'semantic bamboo retained'};
  else result=local(g);
  if(cache.size>100)cache.clear();cache.set(stamp,result);return result;
 }
 return {remember,coordinates};
})();
