'use strict';
// B-only viewport state. The supplied C SVG and A record are never mutated.
const LocalViewers=(()=>{
 const instances=new WeakMap();
 const en=()=>document.getElementById('language').value==='en';
 function mount(host,record,{title='',onAtom,candidates=[],selectedSite=null,abbreviated=false}={}){
  if(typeof host==='string')host=document.getElementById(host);
  host.replaceChildren();host.classList.add('local-viewer');
  const head=document.createElement('div');head.className='viewer-tools';
  const label=document.createElement('strong');label.textContent=title;head.append(label);
  const stage=document.createElement('div');stage.className='structure-stage';stage.tabIndex=0;stage.setAttribute('aria-label',title+' structure; drag to pan; Ctrl/Cmd + wheel to zoom');
  let scale=1,x=0,y=0,drag=null;const canvas=document.createElement('div');canvas.className='structure-canvas';stage.append(canvas);
  const update=()=>{canvas.style.transform=`translate(${x}px,${y}px) scale(${scale})`;pct.textContent=Math.round(scale*100)+'%';};
  const button=(zh,english,fn)=>{const b=document.createElement('button');b.type='button';b.textContent=en()?english:zh;b.onclick=fn;head.append(b);return b;};
  button('−','−',()=>{scale=Math.max(.1,scale/1.3);update();});
  button('+','+',()=>{scale=Math.min(16,scale*1.3);update();});
  const pct=document.createElement('span');head.append(pct);
  button('适应','Fit',()=>{scale=1;x=y=0;update();});
  button('展开','Expand',()=>{host.classList.toggle('expanded-viewer');});
  button('全屏','Fullscreen',async()=>{if(document.fullscreenElement)await document.exitFullscreen();else await host.requestFullscreen();});
  stage.onwheel=e=>{if(!e.ctrlKey&&!e.metaKey)return;e.preventDefault();const old=scale;scale=Math.max(.1,Math.min(16,scale*(e.deltaY<0?1.15:1/1.15)));const r=stage.getBoundingClientRect(),px=e.clientX-r.left-r.width/2,py=e.clientY-r.top-r.height/2;x=px-(px-x)*scale/old;y=py-(py-y)*scale/old;update();};
  stage.onpointerdown=e=>{if(e.target.closest('[data-atom]'))return;drag={px:e.clientX,py:e.clientY,x,y};stage.setPointerCapture(e.pointerId);};
  stage.onpointermove=e=>{if(drag){x=drag.x+e.clientX-drag.px;y=drag.y+e.clientY-drag.py;update();}};stage.onpointerup=()=>drag=null;stage.onpointercancel=()=>drag=null;
  stage.onkeydown=e=>{if(e.key==='Home'){x=y=0;scale=1;}else if(e.key==='+')scale=Math.min(16,scale*1.3);else if(e.key==='-')scale=Math.max(.1,scale/1.3);else if(e.key.startsWith('Arrow')){e.preventDefault();x+=e.key==='ArrowLeft'?25:e.key==='ArrowRight'?-25:0;y+=e.key==='ArrowUp'?25:e.key==='ArrowDown'?-25:0;}update();};
  const meta=document.createElement('div');meta.className='local-metrics';
  if(record){const p=Sandbox.C.present(record,abbreviated);canvas.innerHTML=p.svg;
   if(selectedSite&&Object.keys(selectedSite.atoms).length){const svg=canvas.querySelector('svg'),ns='http://www.w3.org/2000/svg',group=document.createElementNS(ns,'g');group.setAttribute('class','reaction-site-overlay');group.setAttribute('pointer-events','none');const indices=new Set(Object.values(selectedSite.atoms));
    for(const b of p.drawing.bonds)if(indices.has(b.a)&&indices.has(b.b)){const line=document.createElementNS(ns,'line');for(const [k,v]of Object.entries({x1:p.drawing.atoms[b.a].x,y1:p.drawing.atoms[b.a].y,x2:p.drawing.atoms[b.b].x,y2:p.drawing.atoms[b.b].y,stroke:'#e59000','stroke-width':.18}))line.setAttribute(k,v);group.append(line);}
    let n=0;for(const [role,i]of Object.entries(selectedSite.atoms)){const a=p.drawing.atoms[i];if(!a)throw Error('SITE_ATOM_MAPPING_MISSING');const ring=document.createElementNS(ns,'circle');for(const [k,v]of Object.entries({cx:a.x,cy:a.y,r:.52,fill:'#ffcc5544',stroke:'#b56b00','stroke-width':.09}))ring.setAttribute(k,v);ring.dataset.siteAtom=i;const label=document.createElementNS(ns,'text');for(const [k,v]of Object.entries({x:a.x+.6,y:a.y-.65-(n++%2)*.55,'font-size':.55,fill:'#8b4300',stroke:'white','stroke-width':.18,'paint-order':'stroke','font-family':'Arial','font-weight':'bold'}))label.setAttribute(k,v);label.textContent=role+' '+(i+1);label.dataset.siteLabel=i;group.append(ring,label);}svg.append(group);
    const vb=svg.viewBox.baseVal,pad=Math.max(vb.width,vb.height)*.055;svg.setAttribute('viewBox',[vb.x-pad,vb.y-pad,vb.width+2*pad,vb.height+2*pad].join(' '));const full=svg.getAttribute('viewBox');button('定位位点','Locate site',()=>{const points=Object.values(selectedSite.atoms).map(i=>p.drawing.atoms[i]),xs=points.map(a=>a.x),ys=points.map(a=>a.y);svg.setAttribute('viewBox',[Math.min(...xs)-4,Math.min(...ys)-4,Math.max(...xs)-Math.min(...xs)+8,Math.max(...ys)-Math.min(...ys)+8].join(' '));scale=1;x=y=0;update();});const fit=head.querySelectorAll('button')[2];fit.addEventListener('click',()=>svg.setAttribute('viewBox',full));
    const sizeLabels=()=>{const v=svg.viewBox.baseVal,ratio=Math.max(v.width/(stage.clientWidth||400),v.height/(stage.clientHeight||400));let k=0;group.querySelectorAll('[data-site-label]').forEach(label=>{const a=p.drawing.atoms[Number(label.dataset.siteLabel)];label.setAttribute('font-size',Math.max(.5,ratio*12));label.setAttribute('stroke-width',Math.max(.12,ratio*3));const row=k++%2,font=Math.max(.5,ratio*12);label.setAttribute('x',Math.max(v.x+ratio*4,Math.min(a.x+ratio*9,v.x+v.width-label.textContent.length*font*.62-ratio*4)));label.setAttribute('y',Math.max(v.y+font*(1.2+row*1.5),a.y-ratio*(12+row*16)));});group.querySelectorAll('circle').forEach(c=>c.setAttribute('r',Math.max(.5,ratio*7)));};new ResizeObserver(sizeLabels).observe(stage);new MutationObserver(sizeLabels).observe(svg,{attributes:true,attributeFilter:['viewBox']});sizeLabels();
   }
   if(onAtom){const svg=canvas.querySelector('svg');for(const i of candidates){const a=p.drawing.atoms[i],ns='http://www.w3.org/2000/svg',g=document.createElementNS(ns,'g');g.dataset.atom=i;g.setAttribute('class','atom-target');g.setAttribute('tabindex','0');g.setAttribute('role','button');g.setAttribute('aria-label','OH atom '+(i+1));const c=document.createElementNS(ns,'circle');c.setAttribute('cx',a.x);c.setAttribute('cy',a.y);c.setAttribute('r','.48');const t=document.createElementNS(ns,'text');t.setAttribute('x',a.x);t.setAttribute('y',a.y-.6);t.setAttribute('font-size','.42');t.textContent=selectedSite&&Object.values(selectedSite.atoms).includes(i)?'':String(i+1);g.append(c,t);g.onclick=()=>onAtom(i);g.onkeydown=e=>{if(e.key==='Enter')onAtom(i);};svg.append(g);}}
   const m=record.metrics,o=record.optical||record.graph.photometry;meta.textContent=`${m.formula} · MW ${Number(m.average_mw).toFixed(3)} · Exact ${Number(m.exact_mass).toFixed(5)} · OD ${o?.status||'NEEDS_PARAMETER'}`;
  }else{canvas.textContent=en()?'Preview to generate product':'点击预览生成产物';}
  const hint=document.createElement('small');hint.className='viewer-hint';hint.textContent=en()?'Drag to pan · Ctrl/Cmd + wheel to zoom · Wheel scrolls page':'拖动平移 · Ctrl/Cmd + 滚轮缩放 · 普通滚轮滚动页面';host.append(head,stage,hint,meta);update();instances.set(host,{record,get transform(){return {scale,x,y};}});return host;
 }
 return {mount,instances};
})();
