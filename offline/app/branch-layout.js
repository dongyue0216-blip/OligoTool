'use strict';
// C: rectangular lanes; all atom indices/bonds are supplied by A and preserved.
const BranchLayout=(()=>{
 function coordinates(state){
  let g=JSON.parse(JSON.stringify(state.graph)),owned=new Set(),ag=state.assemblyGraph,placements=new Map();let bottom=-Infinity;
  g.routes=[];
  for(const lane of ag.lanes){
   if(!lane.atomIndices.length)continue;
   const edge=ag.branchEdges.find(e=>e.childLane===lane.id),parent=edge&&g.atoms[edge.parentAnchor],localStart=edge?lane.points[lane.atomIndices.indexOf(edge.childAnchor)]:null;
   const minY=Math.min(...lane.points.map(p=>p.y)),dx=parent&&localStart?parent.x-localStart.x:0,dy=edge?bottom+18-minY:0;
   lane.atomIndices.forEach((id,k)=>{g.atoms[id].x=lane.points[k].x+dx;g.atoms[id].y=lane.points[k].y+dy;owned.add(id);});
   bottom=Math.max(bottom,...lane.atomIndices.map(i=>g.atoms[i].y));placements.set(lane.id,{dx,dy});
  }
  // Restore each lane's existing wrapping routes using its original assembly engine.
  for(const lane of ag.lanes){const t=placements.get(lane.id);if(!t)continue;
   for(const r of lane.routes||[]){const [a,z]=r.atoms,bond=g.bonds.findIndex(b=>(b.a===a&&b.b===z)||(b.a===z&&b.b===a));if(bond>=0)g.routes.push({...r,bond,points:r.points.map(([x,y])=>[x+t.dx,y+t.dy])});}
  }
  for(const edge of ag.branchEdges){
   const a=g.atoms[edge.parentAnchor],z=g.atoms[edge.childAnchor];if(!a||!z)continue;
   const center=edge.linkageAtoms.find(i=>g.atoms[i].e==='P');if(center===undefined)continue;
   const old={...g.atoms[center]},target={x:z.x-4,y:z.y-5};
   for(const i of edge.linkageAtoms){g.atoms[i].x+=target.x-old.x;g.atoms[i].y+=target.y-old.y;owned.add(i);}
   for(const [u,v]of [[edge.parentAnchor,center],[center,edge.childAnchor]]){const bond=g.bonds.findIndex(b=>(b.a===u&&b.b===v)||(b.a===v&&b.b===u));if(bond<0)continue;const p=g.atoms[u],q=g.atoms[v],gutter=Math.min(p.x,q.x)-7;g.routes.push({bond,atoms:[u,v],kind:'branch-connector',points:[[p.x,p.y],[gutter,p.y+3],[gutter,q.y-3],[q.x,q.y-3],[q.x,q.y]]});}
  }
  // Map reaction-added fragments to the real parent anchor by translation only.
  const pending=new Set(g.atoms.map((_,i)=>i).filter(i=>!owned.has(i)));
  while(pending.size){const seed=pending.values().next().value,component=[],queue=[seed];pending.delete(seed);while(queue.length){const i=queue.pop();component.push(i);for(const b of g.bonds){const j=b.a===i?b.b:b.b===i?b.a:null;if(j!==null&&pending.delete(j))queue.push(j);}}
   const set=new Set(component),join=g.bonds.find(b=>set.has(b.a)&&owned.has(b.b)||set.has(b.b)&&owned.has(b.a));if(join){const anchor=owned.has(join.a)?join.a:join.b,dx=g.atoms[anchor].x-state.graph.atoms[anchor].x,dy=g.atoms[anchor].y-state.graph.atoms[anchor].y;for(const i of component){g.atoms[i].x+=dx;g.atoms[i].y+=dy;}}
  }
  if(typeof Presentation!=='undefined')for(const group of state.presentationGroups||[]){
   const source=typeof SmallFragmentDepictor!=='undefined'?SmallFragmentDepictor.coordinates({graph:group.graph}).graph:group.graph,atoms=group.mapping.filter(i=>i!==null&&i!==undefined),moving=new Set(atoms),joins=g.bonds.flatMap((b,i)=>moving.has(b.a)!==moving.has(b.b)?[i]:[]);
   source.atoms.forEach((a,i)=>{const to=group.mapping[i];if(to!==null&&to!==undefined){g.atoms[to].x=a.x;g.atoms[to].y=a.y;}});
   if(joins.length){const layout=Presentation.layout({graph:g,semantics:{routes:g.routes||[],groups:[{id:'operation-secondary',atoms}],placements:[{group:'operation-secondary',bonds:joins}]}});g=Presentation.materialize(g,layout);}
  }
  return {graph:g,composed:true,status:'hierarchical sequence lanes / real branch anchors / coordinate-only routing'};
 }
 return {coordinates};
})();
