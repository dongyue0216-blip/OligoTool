'use strict';
// B-only viewport state. The supplied C SVG and A record are never mutated.
const LocalViewers=(()=>{
 const instances=new WeakMap();
 const en=()=>document.getElementById('language').value==='en';
 function download(name,data,type){
  const link=document.createElement('a');
  const url=URL.createObjectURL(new Blob([data],{type}));
  link.href=url;link.download=name;link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 function serializeChemDraw(graph){return Lite.cdxml(graph);}
 function exportChemDraw(name,record){download(name+'.cdxml',serializeStructure(record,'cdxml'),'application/xml');}
 function chemicalDrawing(record,rows=PresentationOptions.rows){return Sandbox.C.drawing(record,{rows});}
 function serializeStructure(record,format,{name='',language=document.documentElement.lang,schematic,drawing,rows=PresentationOptions.rows}={}){
  if(format==='svg')return Sandbox.C.svg(record,{rows});
  if(format==='schematic.svg'){
   const scene=schematic||StructurePresentation.schematic(record,{language,basesPerColumn:rows});
   if(!scene.supported)throw Error(scene.reason);
   return exportSvg(scene);
  }
  if(format==='cdxml')return serializeChemDraw(drawing||chemicalDrawing(record,rows));
  if(format==='mol'||format==='sdf')return Lite.mol(drawing||chemicalDrawing(record,rows),name)+(format==='sdf'?'\n$$$$\n':'');
  throw Error('Unsupported structure format: '+format);
 }
 function exportSvg(scene){
  // Use the renderer's original scene before the viewer applies pan and zoom.
  const measure=document.createElement('div');
  measure.style.cssText='position:fixed;left:-10000px;top:0;visibility:hidden;pointer-events:none';
  measure.innerHTML=scene.svg;
  const svg=measure.firstElementChild;
  svg.querySelector('[data-scene-background]')?.remove();
  svg.setAttribute('font-family','system-ui, Arial, sans-serif');
  document.body.append(measure);
  try{
   const [x,y,w,h]=svg.getAttribute('viewBox').split(/\s+/).map(Number);
   const ink=svg.getBBox(),pad=4;
   const left=Math.floor(Math.min(x,ink.x-pad)),top=Math.floor(Math.min(y,ink.y-pad));
   const width=Math.ceil(Math.max(x+w,ink.x+ink.width+pad))-left;
   const height=Math.ceil(Math.max(y+h,ink.y+ink.height+pad))-top;
   svg.setAttribute('viewBox',[left,top,width,height].join(' '));
   svg.setAttribute('width',width);
   svg.setAttribute('height',height);
   return new XMLSerializer().serializeToString(svg);
  }finally{measure.remove();}
 }
 function mountExports(host,record,schematic,{name,row,drawing}){
  const toolbar=row||document.createElement('div');
  toolbar.classList.add('row','exports');
  const chem=document.createElement('button'),diagram=document.createElement('button');
  chem.type=diagram.type='button';
  chem.textContent=UILanguage.text("export.chemdraw.cdxml");
  chem.title=UILanguage.text("full.atom.level.structure");
  chem.onclick=()=>{
   const customDrawing=record.assemblyGraph||record.moleculeState||record.workflow?undefined:drawing?.();
   download(name+'.cdxml',serializeStructure(record,'cdxml',{drawing:customDrawing}),'application/xml');
  };
  diagram.textContent=UILanguage.text("export.schematic.svg");
  diagram.disabled=!schematic?.supported;
  const reason=schematic?.reason?.split(' / ');
  diagram.title=diagram.disabled?(reason?.[en()?0:1]||reason?.[0]||''):(UILanguage.text("presentation.c.vector.diagram"));
  diagram.onclick=()=>download(name+'-schematic.svg',serializeStructure(record,'schematic.svg',{schematic}),'image/svg+xml');
  toolbar.replaceChildren(chem,diagram);
  if(!row)host.append(toolbar);
 }
 function mount(host,record,{title='',onAtom,candidates=[],selectedSite=null,abbreviated=false,mode=null,schematicDensity=null,exports=null}={}){
  if(typeof host==='string')host=document.getElementById(host);
  instances.get(host)?.dispose();const cleanups=[];
  host.replaceChildren();host.classList.add('local-viewer');
  const head=document.createElement('div');head.className='viewer-tools';
  const label=document.createElement('strong');label.textContent=title;head.append(label);
  const stage=document.createElement('div');stage.className='structure-stage';stage.tabIndex=0;stage.setAttribute('aria-label',title+' structure; drag to pan; Ctrl/Cmd + wheel to zoom');
  let scale=1,x=0,y=0,drag=null;const canvas=document.createElement('div');canvas.className='structure-canvas';stage.append(canvas);
  // Keep the SVG at the physical viewport size. Native viewBox zoom forces
  // vector text to be painted at the current scale, rather than magnifying a
  // cached CSS-transformed surface whose tiny text may have been culled.
  let baseBox=null;
  const update=()=>{const svg=canvas.querySelector('svg');if(svg&&baseBox){
   const r=stage.getBoundingClientRect(),[bx,by,bw,bh]=baseBox;
   const units=Math.max(bw/(r.width||1),bh/(r.height||1))/scale;
   const w=(r.width||1)*units,h=(r.height||1)*units;
   svg.setAttribute('viewBox',[bx+bw/2-w/2-x*units,by+bh/2-h/2-y*units,w,h].join(' '));
  }pct.textContent=Math.round(scale*100)+'%';};
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
  const density=schematicDensity||host.dataset.schematicDensity||'annotated';
  host.dataset.schematicDensity=density;
  const requested=mode||StructurePresentation.defaultMode();
  const products=record?StructurePresentation.reactionProducts(record):[];
  const detailed=record&&!onAtom&&!selectedSite&&requested==='detailed'?
   StructurePresentation.reactionDiagram(record,products,true):null;
  const schematic=record&&!onAtom&&(requested==='schematic'||exports)?StructurePresentation.schematic(record,{density,selectedSite,language:document.documentElement.lang}):null;
  const effective=onAtom||(requested==='schematic'&&!schematic?.supported)||(selectedSite&&requested==='detailed')?'chemical':requested;
  const modes=document.createElement('select');modes.className='viewer-mode';modes.setAttribute('aria-label',UILanguage.text("structure.presentation"));
  for(const [value,zh,eng]of [['schematic','示意','Schematic'],['detailed','详细','Detailed'],['chemical','化学','Chemical']]){const o=document.createElement('option');o.value=value;o.textContent=en()?eng:zh;modes.append(o);}modes.value=effective;modes.disabled=!!onAtom||!record;
  modes.onchange=()=>mount(host,record,{title,onAtom,candidates,selectedSite,abbreviated,mode:modes.value,exports});head.append(modes);host.dataset.presentation=effective;
  if(effective==='schematic'){
   const detail=document.createElement('select');detail.className='schematic-density';detail.setAttribute('aria-label',UILanguage.text("schematic.density"));
   detail.append(new Option(UILanguage.text("annotated"),'annotated'),new Option(UILanguage.text("compact"),'compact'));detail.value=density;
   detail.onchange=()=>mount(host,record,{title,onAtom,candidates,selectedSite,abbreviated,mode:effective,schematicDensity:detail.value,exports});
   head.append(detail);
  }
  const note=document.createElement('div');note.className='presentation-note';note.textContent=onAtom||(selectedSite&&effective==='chemical')?(UILanguage.text("chemical.view.for.atom.site.selection")):requested==='schematic'?(schematic?.reason?.split(' / ')[en()?0:1]||schematic?.reason||''):effective==='detailed'?(UILanguage.text("existing.semantic.bamboo.renderer.standard.abbreviations")):(UILanguage.text("full.atomistic.graph.zoom.or.fullscreen.to.inspect"));

  if(detailed)note.textContent=detailed.reason.split(' / ')[en()?0:1];
  const productNote=document.createElement('div');
  productNote.className='presentation-note reaction-product-annotations';
  for(const product of products){
   const annotation=document.createElement('p');
   annotation.dataset.reactionProduct=product.kind;
   const label=en()?product.label:product.kind==='triazole'?'稠合 1,2,3-三唑':'四嗪偶联产物';
   const state=en()?product.state:product.kind==='triazole'?'按所选连接方向生成，未预测区域选择性':'脱去 N₂ 后的 4,5-二氢哒嗪，互变和氧化前，新立体化学未指定';
   annotation.textContent=label+' · '+state;
   productNote.append(annotation);
  }

  if(record){const p=effective==='schematic'?schematic:detailed||Sandbox.C.present(record,effective==='detailed'&&(host.id==='viewer'?abbreviated:true));canvas.innerHTML=p.svg;
   // Avoid fractional source-font quantization in Chromium's SVG text painter.
   // Enlarge text-local units, then invert with a vector transform. Positions,
   // advances and stroke halos remain exactly the same in molecular space.
   for(const text of effective==='schematic'||detailed?[]:canvas.querySelectorAll('text')){
    const k=32;
    text.setAttribute('text-rendering','geometricPrecision');
    text.setAttribute('font-size',Number.parseFloat(text.getAttribute('font-size')||text.parentElement.getAttribute('font-size')||'.52')*k);
    text.setAttribute('transform',`scale(${1/k})`);
    for(const node of [text,...text.querySelectorAll('tspan')])for(const name of ['x','y','dx','dy','stroke-width',...(node===text?[]:['font-size'])]){
     if(node.hasAttribute(name))node.setAttribute(name,node.getAttribute(name).split(/\s+/).map(v=>Number(v)*k).join(' '));
    }
   }
   if(effective==='chemical'&&selectedSite&&Object.keys(selectedSite.atoms).length){const svg=canvas.querySelector('svg'),ns='http://www.w3.org/2000/svg',group=document.createElementNS(ns,'g');group.setAttribute('class','reaction-site-overlay');group.setAttribute('pointer-events','none');const indices=new Set(Object.values(selectedSite.atoms));
    for(const b of p.drawing.bonds)if(indices.has(b.a)&&indices.has(b.b)){const line=document.createElementNS(ns,'line');for(const [k,v]of Object.entries({x1:p.drawing.atoms[b.a].x,y1:p.drawing.atoms[b.a].y,x2:p.drawing.atoms[b.b].x,y2:p.drawing.atoms[b.b].y,stroke:'#e59000','stroke-width':.18}))line.setAttribute(k,v);group.append(line);}
    let n=0;for(const [role,i]of Object.entries(selectedSite.atoms)){const a=p.drawing.atoms[i];if(!a)throw Error('SITE_ATOM_MAPPING_MISSING');const ring=document.createElementNS(ns,'circle');for(const [k,v]of Object.entries({cx:a.x,cy:a.y,r:.52,fill:'#ffcc5544',stroke:'#b56b00','stroke-width':.09}))ring.setAttribute(k,v);ring.dataset.siteAtom=i;if(selectedSite.atomIds?.[role])ring.dataset.reactionAtomId=selectedSite.atomIds[role];const label=document.createElementNS(ns,'text');for(const [k,v]of Object.entries({x:a.x+.6,y:a.y-.65-(n++%2)*.55,'font-size':.55,fill:'#8b4300',stroke:'white','stroke-width':.18,'paint-order':'stroke','font-family':'Arial','font-weight':'bold'}))label.setAttribute(k,v);label.textContent=selectedSite.labels?.[role]??(role+' '+(i+1));label.dataset.siteLabel=i;group.append(ring,label);}svg.append(group);
    const vb=svg.viewBox.baseVal,pad=Math.max(vb.width,vb.height)*.055;svg.setAttribute('viewBox',[vb.x-pad,vb.y-pad,vb.width+2*pad,vb.height+2*pad].join(' '));const full=svg.getAttribute('viewBox');button('定位位点','Locate site',()=>{const points=Object.values(selectedSite.atoms).map(i=>p.drawing.atoms[i]),xs=points.map(a=>a.x),ys=points.map(a=>a.y);baseBox=[Math.min(...xs)-4,Math.min(...ys)-4,Math.max(...xs)-Math.min(...xs)+8,Math.max(...ys)-Math.min(...ys)+8];scale=1;x=y=0;update();});const fit=head.querySelectorAll('button')[2];fit.addEventListener('click',()=>{baseBox=full.split(/\s+/).map(Number);update();});
    const sizeLabels=()=>{const v=svg.viewBox.baseVal,ratio=Math.max(v.width/(stage.clientWidth||400),v.height/(stage.clientHeight||400));let k=0;group.querySelectorAll('[data-site-label]').forEach(label=>{const a=p.drawing.atoms[Number(label.dataset.siteLabel)];label.setAttribute('font-size',Math.max(.5,ratio*12));label.setAttribute('stroke-width',Math.max(.12,ratio*3));const row=k++%2,font=Math.max(.5,ratio*12);label.setAttribute('x',Math.max(v.x+ratio*4,Math.min(a.x+ratio*9,v.x+v.width-label.textContent.length*font*.62-ratio*4)));label.setAttribute('y',Math.max(v.y+font*(1.2+row*1.5),a.y-ratio*(12+row*16)));});group.querySelectorAll('circle').forEach(c=>c.setAttribute('r',Math.max(.5,ratio*7)));};const resizeLabels=new ResizeObserver(sizeLabels),observeBox=new MutationObserver(sizeLabels);resizeLabels.observe(stage);observeBox.observe(svg,{attributes:true,attributeFilter:['viewBox']});cleanups.push(()=>{resizeLabels.disconnect();observeBox.disconnect();});sizeLabels();
   }
   if(onAtom){const svg=canvas.querySelector('svg');for(const i of candidates){const a=p.drawing.atoms[i],ns='http://www.w3.org/2000/svg',g=document.createElementNS(ns,'g');g.dataset.atom=i;g.setAttribute('class','atom-target');g.setAttribute('tabindex','0');g.setAttribute('role','button');g.setAttribute('aria-label',UILanguage.text("oh.oxygen.atom")+(i+1));const c=document.createElementNS(ns,'circle');c.setAttribute('cx',a.x);c.setAttribute('cy',a.y);c.setAttribute('r','.48');const t=document.createElementNS(ns,'text');t.setAttribute('x',a.x);t.setAttribute('y',a.y-.6);t.setAttribute('font-size','.42');t.textContent=selectedSite&&Object.values(selectedSite.atoms).includes(i)?'':String(i+1);g.append(c,t);g.onclick=()=>onAtom(i);g.onkeydown=e=>{if(e.key==='Enter')onAtom(i);};svg.append(g);}}
   const m=record.metrics,o=record.optical||record.graph.photometry;meta.textContent=`${m.formula} · MW ${Number(m.average_mw).toFixed(3)} · ${UILanguage.text("exact.mass")} ${Number(m.exact_mass).toFixed(5)} · OD ${UILanguage.status(o?.status||'NEEDS_PARAMETER')}`;
   if(o?.supported&&record.moleculeState){
    const mark=o.estimated?'≈ ':'';
    const values=document.createElement('div');
    values.textContent=mark+o.epsilon260.toPrecision(5)+' ε₂₆₀ (L·mol⁻¹·cm⁻¹) · '+mark+
     o.nmol_per_od.toFixed(3)+' nmol/OD₂₆₀ · '+mark+o.ug_per_od.toFixed(3)+' µg/OD₂₆₀';
    meta.append(values);
    if(o.estimated){
     const note=document.createElement('div');
     note.textContent='≈ '+UILanguage.text('optical.estimated')+' · '+[...new Set(o.assumptionLedger?.map(a=>a.detail)||[])].join(' · ');
     meta.append(note);
    }
   }
  }else{canvas.textContent=UILanguage.text("preview.to.generate.product");}
  const svg=canvas.querySelector('svg');if(svg)baseBox=svg.getAttribute('viewBox').split(/\s+/).map(Number);
  const hint=document.createElement('small');hint.className='viewer-hint';hint.textContent=UILanguage.text("drag.to.pan.ctrl.cmd.wheel.to.zoom.wheel.scrolls.page");host.append(head,stage,note);if(products.length)host.append(productNote);host.append(hint,meta);if(exports&&record)mountExports(host,record,schematic,exports);update();const observer=new ResizeObserver(update);observer.observe(stage);instances.set(host,{record,dispose:()=>{observer.disconnect();cleanups.forEach(fn=>fn());},setViewport(v){if(v.scale!==undefined)scale=Math.max(.1,Math.min(16,v.scale));if(v.x!==undefined)x=v.x;if(v.y!==undefined)y=v.y;update();},get transform(){return {scale,x,y};}});return host;
 }
 return {mount,instances,exportChemDraw,serializeStructure,chemicalDrawing};
})();
