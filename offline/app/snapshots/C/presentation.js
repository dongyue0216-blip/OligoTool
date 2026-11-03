'use strict';
// DOM-free coordinate sidecar. No atom creation, chemistry inference, or reflections.
const Presentation = (() => {
 const clone=x=>JSON.parse(JSON.stringify(x));
 const identity=g=>JSON.stringify({atoms:g.atoms.map(({x,y,z,...a})=>a),bonds:g.bonds});
 const box=ps=>({minX:Math.min(...ps.map(p=>p.x)),minY:Math.min(...ps.map(p=>p.y)),maxX:Math.max(...ps.map(p=>p.x)),maxY:Math.max(...ps.map(p=>p.y))});
 const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
 function layout({graph,semantics={},policy={}}){
  const before=identity(graph),coords=graph.atoms.map(a=>({x:a.x,y:a.y}));
  if(!coords.length||coords.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))throw Error('COORDINATES_REQUIRED');
  const routes=clone(semantics.routes||[]),transforms=[],warnings=[];
  const bonded=new Set(graph.bonds.flatMap(b=>[b.a+':'+b.b,b.b+':'+b.a]));
  const groups=semantics.groups||[],owned=new Set();
  for(const g of groups)for(const i of g.atoms){if(!coords[i]||owned.has(i))throw Error('INVALID_GROUP_PARTITION');owned.add(i);}
  for(const placement of semantics.placements||[]){
   const group=groups.find(g=>g.id===placement.group);if(!group)throw Error('MISSING_GROUP');
   const moving=new Set(group.atoms),joins=placement.bonds.map(i=>graph.bonds[i]);
   if(!joins.length||joins.some(b=>!b||moving.has(b.a)===moving.has(b.b)))throw Error('INVALID_JOIN');
   const b=joins[0],mi=moving.has(b.a)?b.a:b.b,fi=moving.has(b.a)?b.b:b.a;
   const origin=coords[mi],fixed=coords[fi],length=policy.bondLength||1.5;
   const routed=new Set(routes.map(r=>r.bond)),fixedBonds=graph.bonds.filter((b,i)=>!routed.has(i)&&!moving.has(b.a)&&!moving.has(b.b)),activeBonds=graph.bonds.filter((b,i)=>!routed.has(i)&&(moving.has(b.a)||moving.has(b.b)));
   const orient=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
   let best=null;
   // A finite deterministic search of rigid transforms; internal bond geometry stays fixed.
   for(let d=0;d<24;d++)for(let r=0;r<24;r++){
    const direction=d*Math.PI/12,angle=r*Math.PI/12,c=Math.cos(angle),s=Math.sin(angle);
    const target={x:fixed.x+length*Math.cos(direction),y:fixed.y+length*Math.sin(direction)};
    const points=new Map(group.atoms.map(i=>{const x=coords[i].x-origin.x,y=coords[i].y-origin.y;return [i,{x:target.x+c*x-s*y,y:target.y+s*x+c*y}];}));
    let collisions=0,score=0;
    for(const [i,p]of points)for(let j=0;j<coords.length;j++)if(!moving.has(j)&&!bonded.has(i+':'+j)){
     const dist=distance(p,coords[j]);if(dist<.8){collisions++;score+=(.8-dist)*1000;}
    }
    for(const jb of joins){const ai=moving.has(jb.a)?jb.a:jb.b,bi=moving.has(jb.a)?jb.b:jb.a;score+=100*Math.pow(distance(points.get(ai),coords[bi])-length,2);}
    for(const ab of activeBonds)for(const fb of fixedBonds)if(ab.a!==fb.a&&ab.a!==fb.b&&ab.b!==fb.a&&ab.b!==fb.b){const a=points.get(ab.a)||coords[ab.a],b=points.get(ab.b)||coords[ab.b],c=coords[fb.a],d=coords[fb.b];if(orient(a,b,c)*orient(a,b,d)<-1e-10&&orient(c,d,a)*orient(c,d,b)<-1e-10)score+=100000;}
    for(const constraint of placement.angles||[]){const [a,b,c]=constraint.atoms.map(i=>points.get(i)||coords[i]),u={x:a.x-b.x,y:a.y-b.y},v={x:c.x-b.x,y:c.y-b.y};const angle=Math.acos(Math.max(-1,Math.min(1,(u.x*v.x+u.y*v.y)/(Math.hypot(u.x,u.y)*Math.hypot(v.x,v.y)))))*180/Math.PI;score+=Math.pow(angle-constraint.degrees,2)*10;}
    score+=collisions*1000+distance(target,{x:fixed.x,y:fixed.y-1.5})*.001;
    if(!best||score<best.score)best={score,collisions,angle,target,points};
   }
   for(const [i,p]of best.points)coords[i]=p;
   // A route must move with its owning fragment. Mixed ownership is invalidated.
   for(let k=routes.length-1;k>=0;k--){const route=routes[k],rb=graph.bonds[route.bond];if(moving.has(rb.a)&&moving.has(rb.b)){
    route.points=route.points.map(([x,y])=>{const dx=x-origin.x,dy=y-origin.y;return [best.target.x+Math.cos(best.angle)*dx-Math.sin(best.angle)*dy,best.target.y+Math.sin(best.angle)*dx+Math.cos(best.angle)*dy];});
   }else if(moving.has(rb.a)||moving.has(rb.b))routes.splice(k,1);}
   transforms.push({group:group.id,rotation:best.angle,determinant:1,collisions:best.collisions});
   if(best.collisions)warnings.push('Unresolved close atom pairs in '+group.id);
   if(joins.some(j=>Math.abs(distance(coords[j.a],coords[j.b])-length)>.25))warnings.push('Multi-anchor constraint needs a local coordinate template: '+group.id);
  }
  if(identity(graph)!==before)throw Error('CHEMISTRY_MUTATED');
  const closePairs=[];for(let i=0;i<coords.length;i++)for(let j=i+1;j<coords.length;j++)if(distance(coords[i],coords[j])<.6&&!bonded.has(i+':'+j))closePairs.push([i,j]);
  return {schemaVersion:'presentation/0.1',identity:before,coordinates:coords,visualBonds:routes,bounds:box([...coords,...routes.flatMap(r=>r.points.map(([x,y])=>({x,y})))]),groupBounds:groups.map(g=>({id:g.id,...box(g.atoms.map(i=>coords[i]))})),metadata:{engine:'semantic-rigid/0.1',policy,transforms,closePairs,warnings}};
 }
 function materialize(graph,result){if(identity(graph)!==result.identity)throw Error('STALE_LAYOUT');if(result.coordinates.length!==graph.atoms.length)throw Error('ATOM_COUNT_MISMATCH');const g=clone(graph);g.atoms.forEach((a,i)=>Object.assign(a,result.coordinates[i]));g.routes=clone(result.visualBonds);return g;}
 return {layout,materialize,identity};
})();
if(typeof module!=='undefined')module.exports=Presentation;
