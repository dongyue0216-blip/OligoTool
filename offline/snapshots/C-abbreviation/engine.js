'use strict';
// Pure view sidecar. A template is a complete pendant component plus one port.
const AbbreviationPresentation=(()=>{
 const signature=g=>JSON.stringify(g);
 function match(graph,templates,{protectedAtomIds=[]}={}){
  const adj=graph.atoms.map(()=>[]),blocked=new Set(protectedAtomIds);
  graph.bonds.forEach((b,i)=>{adj[b.a].push({j:b.b,o:b.o,i});adj[b.b].push({j:b.a,o:b.o,i});});
  const candidates=[];
  for(const t of templates){
   const ta=t.graph.atoms,tb=t.graph.bonds,tn=ta.map(()=>[]);
   tb.forEach(b=>{tn[b.a].push({j:b.b,o:b.o});tn[b.b].push({j:b.a,o:b.o});});
   const same=(a,b)=>['e','h','charge','isotope','aromatic'].every(k=>a[k]===b[k])&&!a.stereo;
   for(let root=0;root<graph.atoms.length;root++){
    if(!same(graph.atoms[root],ta[t.root]))continue;
    const mapping=new Map([[t.root,root]]),used=new Set([root]);
    function search(){
     if(mapping.size===ta.length)return new Map(mapping);
     let next=-1,edge;
     for(const [ti,gi] of mapping)for(const b of tn[ti])if(!mapping.has(b.j)){next=b.j;edge={ti,gi,o:b.o};break;}
     if(next<0)return null;
     for(const b of adj[edge.gi]){
      if(used.has(b.j)||b.o!==edge.o||!same(graph.atoms[b.j],ta[next]))continue;
      if(adj[b.j].length!==tn[next].length+(next===t.root?1:0))continue;
      if([...mapping].some(([ti,gi])=>{const x=tn[next].find(z=>z.j===ti),y=adj[b.j].find(z=>z.j===gi);return !!x!==!!y||(x&&x.o!==y.o);}))continue;
      mapping.set(next,b.j);used.add(b.j);const r=search();if(r)return r;mapping.delete(next);used.delete(b.j);
     }return null;
    }
    if(adj[root].length!==tn[t.root].length+1)continue;
    const m=search();if(!m)continue;
    const atoms=[...m.values()].sort((a,b)=>a-b),inside=new Set(atoms),cross=graph.bonds.map((b,i)=>({b,i})).filter(({b})=>inside.has(b.a)!==inside.has(b.b));
    if(cross.length!==1||cross[0].b.o!==1||atoms.some(i=>blocked.has(graph.atoms[i].id)))continue;
    const b=cross[0].b,external=inside.has(b.a)?b.b:b.a;
    if(!t.context.includes(graph.atoms[external].e)||graph.atoms[external].charge!==0)continue;
    candidates.push({id:t.label+':'+atoms.map(i=>graph.atoms[i].id).join(','),label:t.label,atomIndices:atoms,atomIds:atoms.map(i=>graph.atoms[i].id),root,external,crossingBondId:graph.bonds[cross[0].i].id,bondIds:graph.bonds.filter(b=>inside.has(b.a)&&inside.has(b.b)).map(b=>b.id)});
   }
  }
  candidates.sort((a,b)=>b.atomIndices.length-a.atomIndices.length||a.id.localeCompare(b.id));
  const taken=new Set(),groups=[];
  for(const g of candidates)if(!g.atomIndices.some(i=>taken.has(i))){groups.push(g);g.atomIndices.forEach(i=>taken.add(i));}
  return groups;
 }
 function create(graph,templates,options={}){
  if(new Set(graph.atoms.map(a=>a.id)).size!==graph.atoms.length||graph.atoms.some(a=>!a.id))throw Error('STABLE_ATOM_IDS_REQUIRED');
  const identity=signature(graph),groups=match(graph,templates,options),expanded=new Set();let on=options.on!==false;
  function view(){if(signature(graph)!==identity)throw Error('STALE_GRAPH');const active=on?groups.filter(g=>!expanded.has(g.id)):[],owners={};graph.atoms.forEach(a=>owners[a.id]=a.id);active.forEach(g=>g.atomIds.forEach(id=>owners[id]=g.id));return {schema:'abbreviation-view/1',graphRevision:options.graphRevision||identity,groups:active,atomToDisplay:owners,displayToAtoms:Object.fromEntries([...new Set(Object.values(owners))].map(id=>[id,Object.keys(owners).filter(k=>owners[k]===id)]))};}
  return {groups,view,setEnabled(v){on=!!v;return view();},expandOne(id){if(!groups.some(g=>g.id===id))throw Error('UNKNOWN_GROUP');expanded.add(id);return view();},expandAll(){groups.forEach(g=>expanded.add(g.id));return view();},collapseAll(){on=true;expanded.clear();return view();}};
 }
 return {match,create};
})();
if(typeof module!=='undefined')module.exports=AbbreviationPresentation;
