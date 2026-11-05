'use strict';
// C only. Read A's explicit assembly provenance; never parse input or build chemistry.
const StructurePresentation=(()=>{
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
 const bases=Object.fromEntries(['r','d','m','f','l'].flatMap(p=>['A','C','G','T','U'].map(b=>[p+b,b])));
 function defaultMode(){if(document.body.dataset.defaultPresentation)return document.body.dataset.defaultPresentation;try{const p=JSON.parse(localStorage.getItem('oligo.workspace.c8.v1'));if(p?.version===1&&['schematic','detailed','chemical'].includes(p.mode))return p.mode;}catch{}return 'schematic';}
 function schematic(record){
  const state=record.moleculeState,ag=state?.assemblyGraph||record.assemblyGraph;
  const fail=reason=>({supported:false,reason});
  if(!ag)return fail('No reliable assembly provenance / 缺少可靠单元来源');
  if(state&&(state.materialization?.status==='provenance-only'||state.assemblyGraph.covalentEdges?.length||state.interactionAnnotations?.length))return fail('Current graph includes reaction, crosslink or interaction detail outside this schematic grammar / 当前结构超出示意语法');
  const lanes=ag.lanes||[{id:'main',assembly:ag}],positions=new Map();let height=30,shapes=[],lines=[];
  if(lanes.some(l=>!l.assembly?.nodes?.length))return fail('An imported component has no residue mapping / 导入组件缺少单元映射');
  if(lanes.reduce((n,l)=>n+l.assembly.nodes.length,0)>500)return fail('Over 500 units; use Detailed / 超过 500 单元');
  for(const [li,lane] of lanes.entries()){
   const a=lane.assembly,nodes=a.nodes,ids=new Set(nodes.map(n=>n.id));
   if(a.edges.some(e=>!ids.has(e.source.node)||!ids.has(e.target.node)))return fail('Incomplete edge provenance / 连接来源不完整');
   // v1 only depicts the established forward linear lane, plus explicit branch edges.
   if(a.edges.length!==nodes.length-1||nodes.some(n=>n.orientation!=='forward')||a.edges.some((e,i)=>e.source.node!==nodes[i].id||e.target.node!==nodes[i+1].id||e.source.site!=='downstream'||e.target.site!=='upstream'))return fail('Nonlinear or reversed lane requires Chemical inspection / 非线性或反向单元需化学视图');
   const top=height+50;
   shapes.push(`<text x="28" y="${top-36}" fill="#536d64" font-size="12">${li===0?'Main / 主链':'Branch / 分支 '+li} · upstream → downstream${nodes.some(n=>bases[n.block.id])?' · 5′ → 3′':''}</text>`);
   for(const [i,n] of nodes.entries()){
    const x=78+(i%8)*98,y=top+Math.floor(i/8)*100;positions.set(lane.id+'/'+n.id,{x,y});
    const id=n.block.id,base=bases[id],fill={A:'#dcefe7',C:'#dceaf6',G:'#f6eacb',T:'#eedff4',U:'#eedff4'}[base]||'#e9eeec';
    shapes.push(`<g data-residue="${esc(lane.id+'/'+n.id)}"><title>${esc(id)} · ${esc(n.id)}</title><rect x="${x-32}" y="${y-20}" width="64" height="40" rx="${base?12:3}" fill="${fill}" stroke="#73958a"/><text x="${x}" y="${y+5}" text-anchor="middle" font-size="${base?20:10}" fill="#183f34">${esc(base||id.slice(0,10))}</text><text x="${x}" y="${y+37}" text-anchor="middle" font-size="11" fill="#536d64">${esc(id.length>14?id.slice(0,13)+'…':id)}</text></g>`);
   }
   for(const e of a.edges){const p=positions.get(lane.id+'/'+e.source.node),q=positions.get(lane.id+'/'+e.target.node),wrap=q.y!==p.y;lines.push(`<path d="${wrap?`M ${p.x+32} ${p.y} H ${p.x+48} V ${p.y+52} H 30 V ${q.y} H ${q.x-32}`:`M ${p.x+32} ${p.y} H ${q.x-32}`}" fill="none" stroke="${e.linkage==='PO'?'#73958a':'#aa6c20'}" stroke-width="2"/><text x="${wrap?410:(p.x+q.x)/2}" y="${wrap?p.y+66:p.y-7}" text-anchor="middle" font-size="10" fill="#805e28">${esc(e.linkage)}</text>`);}
   for(const term of a.terminations||[]){if(term.kind==='linkage'){const p=positions.get(lane.id+'/'+term.at.node);if(!p)return fail('Unknown terminal mapping');shapes.push(`<text x="${p.x}" y="${p.y-28}" text-anchor="middle" font-size="10" fill="#aa6c20">${esc(term.at.site)}: ${esc(term.linkage||term.state||'terminal linkage')}</text>`);}}
   height=top+Math.ceil(nodes.length/8)*100;
  }
  for(const e of ag.branchEdges||[]){const parent=state.attachmentSites.find(s=>s.id===e.parentSite),child=state.attachmentSites.find(s=>s.id===e.childSite),p=parent&&positions.get(parent.path+'/'+parent.node),q=child&&positions.get(child.path+'/'+child.node);if(!p||!q)return fail('Branch mapping unavailable / 分支映射不可用');lines.push(`<path d="M ${p.x} ${p.y+20} V ${p.y+58} H 12 V ${q.y} H ${q.x-32}" fill="none" stroke="#236750" stroke-width="2" stroke-dasharray="6 3"/><text x="${p.x+8}" y="${p.y+56}" font-size="10" fill="#236750">${esc(e.linkage)} · branch</text>`);}
  return {supported:true,svg:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Math.min(8,Math.max(...lanes.map(l=>l.assembly.nodes.length)))*98+66} ${height}" role="img" aria-label="Assembly-derived oligo schematic"><rect width="100%" height="${height}" fill="white"/>${lines.join('')}${shapes.join('')}</svg>`,reason:'Assembly units + explicit linkages; labels preserve block identity. Not an atomistic drawing. / 单元与真实连接；标签保留修饰身份。'};
 }
 return {schematic,defaultMode};
})();
