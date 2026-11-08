'use strict';
// C only. Read A's explicit assembly provenance; never parse input or build chemistry.
const StructurePresentation=(()=>{
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
 // Palette keys are A's base identity and LinkageDefinition.id, independent of notation.
 const baseTokens=Object.freeze({
  A:'#bfd9ed', C:'#c7e3d0', G:'#f0d7a6', U:'#efd2e2',
  T:'#e3c1db', I:'#d9d2ee', CMe:'#a7d4bb', Z:'#c6e2e5'
 });
 const neutralBadge={fill:'#f5f6f5',stroke:'#aeb9b4',height:11};
 const otherBadge={fill:'#f8eed9',stroke:'#7e693f',height:14};
 const linkageTokens=Object.freeze({
  PO:neutralBadge,
  PS:{fill:'#d5e6ee',stroke:'#3d6e87',height:14},
  PS2:{fill:'#e7dcf1',stroke:'#755690',height:14},
  MsPA:{fill:'#f2ddd5',stroke:'#985a48',height:14},
  'Me-P':{fill:'#f4e6cb',stroke:'#8b6b32',height:14},
  'PN(dmi)':{fill:'#d7e9e3',stroke:'#437767',height:14},
  PMO:{fill:'#e1e6f4',stroke:'#586b9b',height:14}
 });
 const own=(registry,key)=>Object.hasOwn(registry,key)?registry[key]:undefined;
 // Extend these entries from reviewed design references using A's exact family/topology keys.
 // The primitives and layout are shared across families and remain readable without color.
 const familyGrammar=Object.freeze({
  DNA:{label:'DNA'},RNA:{substituent:'OH'},F:{substituent:'F'},
  OMe:{substituent:'OMe'},MOE:{substituent:'MOE'},
  LNA:{label:'LNA',bridge:'oxygen'},cEt:{label:'cEt',bridge:'ethyl'},
  ENA:{label:'ENA',bridge:'ethylene'},
  'inverted-dSpacer':{label:'invAb',shape:'invertedSugar',baseFree:true,ports:{"O5'":[-14,4],"O3'":[10,-10]}},
  FANA:{label:'FANA',substituent:'F'},NMA:{substituent:'O₂NMe'},
  UNA:{label:'UNA',shape:'open'},C16:{substituent:'OC₁₆'},C22:{substituent:'OC₂₂'},
  Vpm:{label:'Vpm',terminal:'VP'},Vpe:{label:'Vpe',terminal:'VP'}
 });
 const topologyGrammar=Object.freeze({
  'ribose-phosphate':{shape:'sugar'},
  'baseless-sugar':{shape:'sugar',baseFree:true},
  'alpha-L-threose-3-to-2':{shape:'sugar',label:'TNA',ports:{O3:[-10,10],O2:[10,10]}},
  'S-glycerol-phosphate':{shape:'acyclic',label:'GNA',ports:{O3:[-10,9],O2:[10,9]}}
 });
 const sugarPaths={
  sugar:'M -14 -4 L 0 -14 L 14 -4 L 10 10 H -10 Z',
  invertedSugar:'M -14 4 L 0 14 L 14 4 L 10 -10 H -10 Z',
  open:'M -10 10 L -14 -4 L 0 -14 L 14 -4 L 10 10',
  acyclic:'M -10 9 L 0 -10 L 10 9'
 };
 const text=(x,y,value,size=9)=>'<text x="'+x+'" y="'+y+'" font-size="'+size+'" text-anchor="middle" fill="#253b35" stroke="none">'+esc(value)+'</text>';
 const short=(value,max=10)=>value.length>max?value.slice(0,max-1)+'…':value;
 const bridgePaths={
  oxygen:'M -14 -4 L -14 13 L 10 18 V 10',
  ethyl:'M -14 -4 L -14 13 L 10 18 V 10 M -14 13 L -20 17',
  ethylene:'M -14 -4 V 12 L 0 14 L 10 20 V 10'
 };
 const linkageToken=id=>own(linkageTokens,id)||otherBadge;
 const badgeWidth=label=>Math.max(16,label.length*4.4+7);
 function linkageBadge(x,y,label,id=label,edge=null){
  const {fill,stroke,height}=linkageToken(id),width=badgeWidth(label);
  const provenance=edge===null?'':` data-linkage-edge="${esc(edge)}"`;
  return `<g data-linkage="${esc(id)}"${provenance}><rect x="${x-width/2}" y="${y-height/2}" width="${width}" height="${height}" rx="3" fill="${fill}" stroke="${stroke}"/>${text(x,y+2.6,label,7.5)}</g>`;
 }
 function resolveGlyph(block){
  const {family,topology,base:identity}=block.metadata||{};
  const config={...own(topologyGrammar,topology),...own(familyGrammar,family)};
  const baseFill=own(baseTokens,identity),base=baseFill?identity:null;
  return {...config,base,baseFill,family,shape:base?config.shape||'generic':config.baseFree?config.shape:'special'};
 }
 function port(node,siteId,side){
  const site=node.block.sites[siteId],glyph=resolveGlyph(node.block);
  if(site.direction==='branch'){
   const branches=Object.keys(node.block.sites).filter(id=>node.block.sites[id].direction==='branch');
   return [(branches.indexOf(siteId)-(branches.length-1)/2)*Math.min(9,28/branches.length),10];
  }
  return glyph.ports?.[site.atom_role]||[side*(glyph.shape==='special'?23:14),0];
 }
 function drawSugar(shape){
  return `<path data-component="sugar" data-sugar-shape="${shape}" d="${sugarPaths[shape]}" fill="${shape==='sugar'||shape==='invertedSugar'?'#e9f2ee':'none'}"/>`;
 }
 function drawBaseFree(shape,label){
  return drawSugar(shape)+text(0,shape==='invertedSugar'?0:3,short(label,5),7.5);
 }
 // Visual references have no AssemblyGraph or AttachmentSites.
 function referenceGlyph(reference){
  if(!reference||!Object.hasOwn(topologyGrammar,reference.topology))return null;
  const {shape,baseFree}=topologyGrammar[reference.topology];
  if(!baseFree)return null;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="54" height="34" viewBox="-23 -17 46 34" role="img" aria-label="${esc(reference.label)} schematic reference" font-family="system-ui, sans-serif"><g stroke="#536d64" stroke-width="1.15" stroke-linejoin="round">${drawBaseFree(shape,reference.label)}</g></svg>`;
 }
 function drawUnit(node,g,compact){
  const {id,metadata={},sites}=node.block;
  const {base,baseFill,family,shape,label,substituent,bridge,terminal}=g;
  const name=metadata.name||id.replace(/^\{(.*)\}$/, '$1');
  const roles=Object.values(sites).map(s=>s.atom_role||s.role).join(' → ');
  const ports=metadata.incoming_label&&metadata.outgoing_label?
   [metadata.incoming_label,metadata.outgoing_label].map(label=>label.replace(/ side$/, '')).join(' → '):short(roles,16);
  const title=`<title>${esc(id)} · ${esc(node.id)} · ${esc(roles)}</title>`;
  if(!base&&g.baseFree)return title+drawBaseFree(shape,label||id.replace(/^\{(.*)\}$/, '$1'))+(!compact&&ports?text(0,27,ports,8):'');
  if(!base)return title+`<rect data-component="special" x="-23" y="-10" width="46" height="20" rx="3" fill="#edf0ee"/>${text(0,3,short(name,8),8)}`;
  const sugar=sugarPaths[shape];
  const body=sugar?drawSugar(shape):
   '<rect data-component="generic" x="-14" y="-9" width="28" height="18" rx="4" fill="#edf0ee"/>';
  const caption=label||(!substituent||!compact?family:'');
  const bridgePath=bridge?`<path data-component="bridge" data-bridge="${bridge}" d="${bridgePaths[bridge]}" fill="none"/>`:'';
  const annotation=substituent?`<path d="M 8 10 V 15" fill="none"/>${text(0,24,substituent,9)}`:'';
  const vp=terminal&&Object.keys(sites).length===1?`<path d="M -14 -4 L -19 -11 V -20" fill="none"/>${linkageBadge(-19,-20,terminal)}`:'';
  return title+body+`<path d="M 9 -8 V -15" fill="none"/><circle data-component="base" data-base="${esc(base)}" cx="9" cy="-23" r="9" fill="${baseFill}"/>`+
   text(9,-19.6,base==='CMe'?'C':base,10)+(base==='CMe'?text(21,-24,'Me',7):'')+
   (caption?text(0,shape==='acyclic'?6:3,short(caption,5),7.5):'')+bridgePath+annotation+vp+
   (!compact&&ports&&(g.ports||shape==='generic')?text(0,substituent?35:29,ports,8):'');
 }
 function defaultMode(){if(document.body.dataset.defaultPresentation)return document.body.dataset.defaultPresentation;try{const p=JSON.parse(localStorage.getItem('oligo.workspace.c8.v1'));if(p?.version===1&&['schematic','detailed','chemical'].includes(p.mode))return p.mode;}catch{}return 'schematic';}
 // A's reaction-bond provenance also covers checkpoints saved before ring annotations.
 const reactionRingGrammar=Object.freeze({
  'spaac/2':{kind:'triazole',elements:'NNNCC',orders:'12121',start:-252,turn:1,
   label:'Fused 1,2,3-triazole',state:'Selected connectivity; regioselectivity not predicted'},
  'iedda/2':{kind:'tetrazine_ligation',elements:'CNNCCC',orders:'212111',start:-90,turn:-1,
   label:'4,5-Dihydropyridazine',state:'After N₂ extrusion; before tautomerization or oxidation; new stereochemistry unspecified'}
 });
 function reactionProducts(record){
  const g=record.graph,origins=g?.provenance?.bonds;
  if(!origins)return [];
  const adjacency=g.atoms.map(()=>[]),definitions=[];
  g.bonds.forEach(({a,b},i)=>{
   adjacency[a].push({atom:b,bond:i});adjacency[b].push({atom:a,bond:i});
   let origin=origins[i];
   while(origin&&origin.kind!=='reaction')origin=origin.previous;
   definitions[i]=origin?.definition;
  });
  const products=new Map();
  function walk(definition,rule,ring,edges){
   const from=ring.at(-1);
   if(ring.length===rule.elements.length){
    const closing=adjacency[from].find(edge=>edge.atom===ring[0]&&g.bonds[edge.bond].o===Number(rule.orders.at(-1)));
    if(!closing)return;
    const bonds=[...edges,closing.bond];
    if(bonds.filter(i=>definitions[i]===definition).length!==2)return;
    const key=[...bonds].sort((a,b)=>a-b).join(',');
    if(products.has(key))return;
    const inside=new Set(ring),groups=new Map();
    const attachments=ring.flatMap(atom=>adjacency[atom].filter(edge=>!inside.has(edge.atom)).map(edge=>{
     if(!groups.has(edge.atom)){
      const group={id:new Set(groups.values()).size+1,count:0,oligo:false};
      const pending=[edge.atom];
      while(pending.length){
       const i=pending.pop();
       if(inside.has(i)||groups.has(i))continue;
       groups.set(i,group);group.count++;
       let source=g.provenance.atoms?.[i];
       while(source?.previous)source=source.previous;
       group.oligo||=source?.kind==='building-block';
       for(const neighbor of adjacency[i])pending.push(neighbor.atom);
      }
     }
     return {atom,outside:edge.atom,bond:edge.bond,group:groups.get(edge.atom)};
    }));
    products.set(key,{...rule,ring,bonds,attachments});
    return;
   }
   for(const edge of adjacency[from]){
    if(!ring.includes(edge.atom)&&g.atoms[edge.atom].e===rule.elements[ring.length]&&
      g.bonds[edge.bond].o===Number(rule.orders[edges.length]))
     walk(definition,rule,[...ring,edge.atom],[...edges,edge.bond]);
   }
  }
  // Both registered cycloadditions join at least one first-element atom.
  g.bonds.forEach(({a,b},i)=>{
   const definition=definitions[i];
   if(!Object.hasOwn(reactionRingGrammar,definition))return;
   const rule=reactionRingGrammar[definition];
   for(const atom of [a,b])if(g.atoms[atom].e===rule.elements[0])walk(definition,rule,[atom],[]);
  });
  return [...products.values()];
 }
 function reactionDiagram(record,products,detailed){
  if(!products.length)return null;
  const graph=record.graph,width=360,row=206,cx=width/2,cy=94;
  const panels=products.map(({kind,label,ring,bonds,attachments,start,turn},index)=>{
   const angle=i=>(start+turn*360*i/ring.length)*Math.PI/180;
   const point=(theta,r)=>[cx+r*Math.cos(theta),cy+r*Math.sin(theta)];
   const line=(a,b)=>`<path d="M ${a.join(' ')} L ${b.join(' ')}"/>`;
   const vertices=ring.map((_,i)=>point(angle(i),36));
   const edges=bonds.map((bond,i)=>{
    const a=vertices[i],b=vertices[(i+1)%ring.length],order=graph.bonds[bond].o;
    const inset=([x,y])=>[x*.83+cx*.17,y*.83+cy*.17];
    return `<g data-product-bond="${bond}" data-order="${order}">${line(a,b)}${order===2?line(inset(a),inset(b)):''}</g>`;
   }).join('');
   const atoms=ring.map((atom,i)=>{
    const [x,y]=vertices[i],element=graph.atoms[atom].e;
    const caption=detailed?element+(atom+1):element==='C'?'':element;
    return `<g data-product-atom="${atom}"><title>${element} ${atom+1}</title>${caption?`<rect x="${x-(detailed?13:6)}" y="${y-6}" width="${detailed?26:12}" height="12" fill="white" stroke="none"/>`+text(x,y+3,caption,detailed?8:11):''}</g>`;
   }).join('');
   const ports=attachments.map(({atom,outside,bond,group})=>{
    const i=ring.indexOf(atom),peers=attachments.filter(a=>a.atom===atom);
    const heading=angle(i)+(peers.findIndex(a=>a.bond===bond)-(peers.length-1)/2)*.26;
    const end=point(heading,62),[x,y]=point(heading,74);
    const detail=detailed?graph.atoms[outside].e+(outside+1)+' · ':'';
    return `<g data-attachment-atom="${atom}" data-external-atom="${outside}" data-attachment-bond="${bond}" data-fragment="${group.id}">${line(vertices[i],end)}${text(x,y+3,detail+'['+group.id+']',8)}</g>`;
   }).join('');
   const groups=[...new Set(attachments.map(a=>a.group))];
   const legend=groups.map(g=>'['+g.id+'] '+(g.oligo?'Oligo fragment':'Fragment')+(detailed?' · '+g.count+' atoms':'')).join('   ');
   return `<g data-reaction-ring="${kind}" transform="translate(0 ${index*row})">${text(cx,13,label,12)}<g fill="none" stroke="#365d51" stroke-width="1.5" stroke-linecap="round">${edges}${ports}${atoms}</g>${text(cx,190,legend,10)}</g>`;
  });
  return {supported:true,svg:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${row*panels.length}" role="img" font-family="system-ui, sans-serif" aria-label="Reaction product rings"><rect data-scene-background="" width="100%" height="100%" fill="white"/>${panels.join('')}</svg>`,
   reason:'Product rings and mapped attachments. Matching numbers denote the same outside fragment. / 产物环与实际连接位点。相同编号表示同一外接片段。'};
 }
 function schematic(record,{density='annotated',selectedSite=null}={}){
  const compact=density==='compact';
  const state=record.moleculeState,ag=state?.assemblyGraph||record.assemblyGraph;
  const fail=reason=>({supported:false,reason});
  const reaction=selectedSite?null:reactionDiagram(record,reactionProducts(record),false);
  if(reaction)return reaction;
  if(!ag)return fail('No reliable assembly provenance / 缺少可靠单元来源');
  if(state&&(state.materialization?.status==='provenance-only'||state.assemblyGraph.covalentEdges?.length||state.interactionAnnotations?.length))return fail('Current graph includes reaction, crosslink or interaction detail outside this schematic grammar / 当前结构超出示意语法');
  const lanes=ag.lanes||[{id:'main',assembly:ag}],positions=new Map();
  const columns=10,rowHeight=compact?72:88,left=45;
  let height=14,shapes=[],lines=[];
  if(lanes.some(l=>!l.assembly?.nodes?.length))return fail('An imported component has no residue mapping / 导入组件缺少单元映射');
  if(lanes.reduce((n,l)=>n+l.assembly.nodes.length,0)>500)return fail('Over 500 units; use Detailed / 超过 500 单元');
  // Only widen the existing grid when an actual label would exceed its port-to-port gap.
  let pitch=66;
  for(const {assembly} of lanes){
   const byId=new Map(assembly.nodes.map(n=>[n.id,n]));
   for(const e of assembly.edges){
    const from=byId.get(e.source.node),to=byId.get(e.target.node);
    if(!from?.block.sites[e.source.site]||!to?.block.sites[e.target.site])
     return fail('Incomplete edge provenance / 连接来源不完整');
    const [dx]=port(from,e.source.site,1),[tx]=port(to,e.target.site,-1);
    pitch=Math.max(pitch,Math.ceil(badgeWidth(e.linkage)+dx-tx+4));
   }
  }
  const width=(Math.min(columns,Math.max(...lanes.map(l=>l.assembly.nodes.length)))-1)*pitch+90;
  const selectedNodes=new Set();
  if(selectedSite){
   const selectedAtoms=Object.values(selectedSite.atoms||{});
   if(lanes.length!==1||!selectedAtoms.length)return fail('Selected atoms require Chemical inspection / 选定位点需化学视图');
   for(const i of selectedAtoms){
    const atom=record.graph?.provenance?.atoms?.[i];
    if(atom?.kind!=='building-block'||!lanes[0].assembly.nodes.some(n=>n.id===atom.node))
     return fail('Selected atoms require Chemical inspection / 选定位点需化学视图');
    selectedNodes.add(atom.node);
   }
  }
  for(const [li,lane] of lanes.entries()){
   const a=lane.assembly,nodes=a.nodes,ids=new Set(nodes.map(n=>n.id));
   if(a.edges.some(e=>!ids.has(e.source.node)||!ids.has(e.target.node)))return fail('Incomplete edge provenance / 连接来源不完整');
   // A single-site terminal unit may face inward from either sequence end.
   const terminal=(n,i)=>(i===0||i===nodes.length-1)&&Object.keys(n.block.sites).length===1;
   const outgoing=n=>n.orientation==='reverse'?'upstream':'downstream';
   const incoming=n=>n.orientation==='reverse'?'downstream':'upstream';
   if(a.edges.length!==nodes.length-1||nodes.some((n,i)=>n.orientation!=='forward'&&!terminal(n,i))||
    a.edges.some((e,i)=>e.source.node!==nodes[i].id||e.target.node!==nodes[i+1].id||
     e.source.site!==outgoing(nodes[i])||e.target.site!==incoming(nodes[i+1])))
    return fail('Nonlinear or reversed lane requires Chemical inspection / 非线性或反向单元需化学视图');
   const top=height+52;
   const canonicalEnds=nodes.every(n=>n.block.sites.upstream?.atom_role==="O5'"&&n.block.sites.downstream?.atom_role==="O3'"&&
    n.block.metadata?.incoming_label!=='3′'&&n.block.metadata?.outgoing_label!=='5′');
   shapes.push(`<text x="22" y="${top-41}" fill="#536d64" font-size="10">${li===0?'Main / 主链':'Branch / 分支 '+li} · ${canonicalEnds?'5′ → 3′':'upstream → downstream'}</text>`);
   for(const [i,n] of nodes.entries()){
    const x=left+(i%columns)*pitch,y=top+Math.floor(i/columns)*rowHeight;
    positions.set(lane.id+'/'+n.id,{x,y,top,node:n});
    const g=resolveGlyph(n.block),selected=selectedNodes.has(n.id);
    shapes.push(`<g data-selected-site="${selected}" transform="translate(${x} ${y})" data-residue="${esc(lane.id+'/'+n.id)}" data-family="${esc(g.family)}" stroke="${selected?'#a95c00':'#536d64'}" stroke-width="${selected?2.4:1.15}" stroke-linejoin="round">${drawUnit(n,g,compact)}</g>`);
   }
   for(const e of a.edges){
    const p=positions.get(lane.id+'/'+e.source.node),q=positions.get(lane.id+'/'+e.target.node);
    const [dx,dy]=port(p.node,e.source.site,1),[tx,ty]=port(q.node,e.target.site,-1);
    const x=p.x+dx,y=p.y+dy,endX=q.x+tx,endY=q.y+ty,wrap=q.y!==p.y;
    const routeY=p.y+(compact?30:42);
    lines.push(`<path data-assembly-edge="${esc(e.id)}" d="${wrap?`M ${x} ${y} H ${width-8} V ${routeY} H 17 V ${endY} H ${endX}`:`M ${x} ${y} L ${endX} ${endY}`}" fill="none" stroke="#536d64" stroke-width="1.35"/>`);
    shapes.push(linkageBadge(wrap?width/2:(x+endX)/2,wrap?routeY:(y+endY)/2,e.linkage,e.linkage,lane.id+'/'+e.id));
   }
   for(const term of a.terminations||[]){
    if(term.kind!=='linkage')continue;
    const p=positions.get(lane.id+'/'+term.at.node);if(!p)return fail('Unknown terminal mapping');
    const side=term.at.site===incoming(p.node)?-1:1,[dx,dy]=port(p.node,term.at.site,side);
    const x=p.x+side*27,y=p.y+15,labels=term.linkages||[];
    lines.push(`<path d="M ${p.x+dx} ${p.y+dy} L ${x} ${y}" fill="none" stroke="#536d64"/>`);
    shapes.push(linkageBadge(x,y,labels.length>1?'P'+labels.length:labels[0]||'P',labels.length===1?labels[0]:'P'));
   }
   height=top+(Math.ceil(nodes.length/columns)-1)*rowHeight+(compact?38:47);
  }
  for(const e of ag.branchEdges||[]){
   const parent=state.attachmentSites.find(s=>s.id===e.parentSite),child=state.attachmentSites.find(s=>s.id===e.childSite);
   const p=parent&&positions.get(parent.path+'/'+parent.node),q=child&&positions.get(child.path+'/'+child.node);
   if(!p||!q)return fail('Branch mapping unavailable / 分支映射不可用');
   const [dx,dy]=port(p.node,parent.siteId,1);
   const side=child.direction==='downstream'?1:-1,[tx,ty]=port(q.node,child.siteId,side);
   const fromX=p.x+dx,toX=q.x+tx,toY=q.y+ty;
   const gutter=side===1?width-8:8,routeY=p.y+(compact?34:41);
   // Reserve a badge position in the gap above the child lane. Multiple
   // branches from the same residue then retain individually readable labels.
   const inset=badgeWidth(e.linkage)/2+3;
   const center=side===1?width-inset:inset;
   lines.push(`<path data-branch-edge="${esc(e.id)}" d="M ${fromX} ${p.y+dy} V ${routeY} H ${gutter} V ${toY} H ${toX}" fill="none" stroke="#236750" stroke-width="1.4" stroke-dasharray="5 3"/>`);
   shapes.push(linkageBadge(center,q.top-56,e.linkage,e.linkage,e.id));
  }
  return {supported:true,svg:`<svg data-density="${compact?'compact':'annotated'}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" font-family="system-ui, sans-serif" aria-label="Assembly-derived oligo schematic"><rect data-scene-background="" width="100%" height="${height}" fill="white"/>${lines.join('')}${shapes.join('')}</svg>`,reason:'Assembly units + explicit linkages; labels preserve block identity. Not an atomistic drawing. / 单元与真实连接；标签保留修饰身份。'};
 }
 return {schematic,referenceGlyph,defaultMode,reactionProducts,reactionDiagram};
})();
