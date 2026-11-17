'use strict';
// C: rectangular lanes; all atom indices/bonds are supplied by A and preserved.
const BranchLayout=(()=>{
 const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
 const side=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
 function crossings(a,b,bonds,points,anchor){
  let count=0;
  for(const {a:u,b:v} of bonds){
   if(u===anchor||v===anchor)continue;
   const p=points.get(u),q=points.get(v);
   if(side(a,b,p)*side(a,b,q)<0&&side(p,q,a)*side(p,q,b)<0)count++;
  }
  return count;
 }
 function straightBranch(g,owned,lane,points,edge,parent,endpoint){
  const fixed=new Map([...owned].map(i=>[i,g.atoms[i]]));
  const moving=new Map(lane.atomIndices.map((id,i)=>[id,points[i]]));
  const existing=g.bonds.filter(b=>fixed.has(b.a)&&fixed.has(b.b));
  const child=g.bonds.filter(b=>moving.has(b.a)&&moving.has(b.b));
  const fixedX=[...fixed.values()].map(p=>p.x),movingX=points.map(p=>p.x);
  let best;
  for(const dx of [Math.min(...fixedX)-Math.max(...movingX)-8,Math.max(...fixedX)-Math.min(...movingX)+8]){
   for(const offset of [0,7,-7,14,-14,24,-24]){
    const dy=parent.y-endpoint.y+offset;
    const tip={x:endpoint.x+dx,y:endpoint.y+dy};
    const oldParent={x:parent.x-dx,y:parent.y-dy};
    for(const fraction of [.12,.3,.5,.7,.88])for(const shift of [0,-4,4,-8,8]){
     const center={x:parent.x+(tip.x-parent.x)*fraction,y:parent.y+offset*fraction+shift};
     const oldCenter={x:center.x-dx,y:center.y-dy};
     const cuts=crossings(parent,center,existing,fixed,edge.parentAnchor)+crossings(tip,center,existing,fixed)+
      crossings(endpoint,oldCenter,child,moving,edge.childAnchor)+crossings(oldParent,oldCenter,child,moving);
     const score=cuts*1000+distance(parent,center)+distance(center,tip)+Math.abs(shift)*.1;
     if(!best||score<best.score)best={dx,dy,center,score};
    }
   }
  }
  return best;
 }

 function coordinates(state,{rows=PresentationOptions.rows,straight=false}={}){
  let g=JSON.parse(JSON.stringify(state.graph)),owned=new Set(),ag=state.assemblyGraph,placements=new Map();let bottom=-Infinity;
  g.routes=[];
  for(const lane of ag.lanes){
   if(!lane.atomIndices.length)continue;
   let points=lane.points,routes=lane.routes;
   if(lane.assembly){
    const expanded=Lite.expandAssemblyGraph(lane.assembly,{rows,straight});
    const drawing=!straight&&expanded.layout.adaptive?FragmentComposition.assemble(expanded,rows).graph:expanded;
    const source=lane.sourceAtomIndices||(points.length===drawing.atoms.length?points.map((_,i)=>i):null);
    if(source){
     points=source.map(i=>drawing.atoms[i]);
     const ids=new Map(source.map((i,k)=>[i,lane.atomIndices[k]]));
     routes=drawing.routes.map(r=>({...r,atoms:r.atoms.map(i=>ids.get(i))})).filter(r=>r.atoms.every(Number.isInteger));
    }
   }
   const edge=ag.branchEdges.find(e=>e.childLane===lane.id),parent=edge&&g.atoms[edge.parentAnchor],localStart=edge?points[lane.atomIndices.indexOf(edge.childAnchor)]:null;
   const minY=Math.min(...points.map(p=>p.y));
   const placement=straight&&parent&&localStart?straightBranch(g,owned,lane,points,edge,parent,localStart):null;
   const dx=placement?.dx??(parent&&localStart?parent.x-localStart.x:0);
   const dy=placement?.dy??(edge?bottom+18-minY:0);
   lane.atomIndices.forEach((id,k)=>{g.atoms[id].x=points[k].x+dx;g.atoms[id].y=points[k].y+dy;owned.add(id);});
   bottom=Math.max(bottom,...lane.atomIndices.map(i=>g.atoms[i].y));placements.set(lane.id,{dx,dy,routes,center:placement?.center});
  }
  // Restore each lane's existing wrapping routes using its original assembly engine.
  for(const lane of ag.lanes){const t=placements.get(lane.id);if(!t)continue;
   for(const r of t.routes||[]){const [a,z]=r.atoms,bond=g.bonds.findIndex(b=>(b.a===a&&b.b===z)||(b.a===z&&b.b===a));if(bond>=0)g.routes.push({...r,bond,points:r.points.map(([x,y])=>[x+t.dx,y+t.dy])});}
  }
  for(const edge of ag.branchEdges){
   const a=g.atoms[edge.parentAnchor],z=g.atoms[edge.childAnchor];if(!a||!z)continue;
   const center=edge.linkageAtoms.find(i=>g.atoms[i].e==='P');if(center===undefined)continue;
   const old={...g.atoms[center]},target=placements.get(edge.childLane)?.center||{x:z.x-4,y:z.y-5};
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
