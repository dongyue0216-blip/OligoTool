'use strict';
const Lite = (()=>{
const clone=x=>JSON.parse(JSON.stringify(x));
const extent=(xs,mode)=>xs.reduce((v,x)=>mode==='min'?Math.min(v,x):Math.max(v,x),mode==='min'?Infinity:-Infinity);
const append=(a,b)=>{for(const x of b)a.push(x);};
const customLibrary=Object.create(null);
const template=code=>customLibrary[code]||REFERENCE.templates[code];
function parse(input){
 if(typeof input!=='string')throw Error('Sequence must be a string');
 if(input.includes('&'))throw Error('Obsolete linkage symbol: use # for MsPA');
 let seq=input.trim(),terminal={five:0,three:0},terminalChemistry={five:'PO',three:'PO'};if(!seq)throw Error('请输入 sequence');
 // Terminal units are lexer tokens; aliases resolve to the same AST node.
 const unit='(?:\\(p{1,3}\\)|\\[p{1,3}\\]|\\[(?:PHO|phosphorylation)\\])';
 const op='(\\*\\*|[\\*^!#])?';
 const chemistry={'':'PO','*':'PS','**':'PS2','^':'Me-P','!':'PN(dmi)','#':'MsPA'};
 const readUnit=t=>/^\[PHO\]$|^\[phosphorylation\]$/i.test(t)?1:t.slice(1,-1).length;
 const leading=seq.match(new RegExp('^('+unit+')'+op,'i'));
 if(leading){terminal.five=readUnit(leading[1]);terminalChemistry.five=chemistry[leading[2]||''];seq=seq.slice(leading[0].length);}
 const trailing=seq.match(new RegExp(op+'('+unit+')$','i'));
 if(trailing){terminal.three=readUnit(trailing[2]);terminalChemistry.three=chemistry[trailing[1]||''];seq=seq.slice(0,-trailing[0].length);}
 if(!seq)throw Error('SYNTAX_ERROR: terminal phosphate requires a residue');
 let pos=0,residues=[],links=[];
 while(pos<seq.length){let code;
 if(seq[pos]==='['){let close=seq[pos]==='['?']':'}',end=seq.indexOf(close,pos);if(end<0)throw Error('SYNTAX_ERROR: Missing '+close);let id=seq.slice(pos+1,end);if(typeof CONJUGATION_POOL!=='undefined'&&CONJUGATION_POOL.some(e=>e.id===id))throw Error('CONJUGATION_REAGENT: ['+id+'] belongs to Conjugation Pool; sequence assembly is unavailable');if(!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,47}$/.test(id))throw Error('Invalid custom unit ID: '+id);const alias=COVERAGE.aliases?.['['+id+']'];if(alias)id=alias.slice(1,-1);code='{'+id+'}';if(!template(code)&&!COVERAGE.entries.some(e=>e.notation==='['+id+']'))throw Error('['+id+'] not found in Custom Chemistry Library');pos=end+1;}
 else if('ACGT'.includes(seq[pos])&&!COVERAGE.entries.some(e=>e.notation.length>1&&seq.startsWith(e.notation,pos)))code='d'+seq[pos++];
 else{code=[...new Set([...Object.keys(REFERENCE.templates).filter(c=>c[0]!=='{'),...COVERAGE.entries.filter(e=>!['special','spacer','fluorescent','backbone'].includes(e.family)).map(e=>e.notation)])].sort((a,b)=>b.length-a.length).find(c=>seq.startsWith(c,pos));if(!code)throw Error('SYNTAX_ERROR: Unsupported notation at '+(pos+1)+': '+seq.slice(pos)+'; terminal chemistry supports (p), (pp), (ppp) only at sequence ends');pos+=code.length;}
 residues.push(code);if(pos<seq.length){let link='PO';if(seq.startsWith('**',pos)){link='PS2';pos+=2;}else if(seq[pos]==='*'){link='PS';pos++;}else if(seq[pos]==='#'){link='MsPA';pos++;}else if(seq[pos]==='^'){link='Me-P';pos++;}else if(seq[pos]==='!'){link='PN(dmi)';pos++;}links.push(link);if(pos===seq.length)throw Error('SYNTAX_ERROR: 末尾不能是 linkage');}}

 const symbols={PO:'',PS:'*',PS2:'**',MsPA:'#','Me-P':'^','PN(dmi)':'!'};
 const cap=side=>'('+'p'.repeat(terminal[side])+')',symbol=side=>symbols[terminalChemistry[side]];
 let canonical=(terminal.five?cap('five')+symbol('five'):'')+residues.map((r,i)=>(r[0]==='{'?'['+r.slice(1,-1)+']':r)+(symbols[links[i]]||'')).join('')+(terminal.three?symbol('three')+cap('three'):'');
 return {residues,links,terminal,terminalChemistry,canonical};
}
function formulaObj(s){let f={};for(const m of s.matchAll(/([A-Z][a-z]?)(\d*)/g))f[m[1]]=(f[m[1]]||0)+Number(m[2]||1);return f;}
function add(f,g,k=1){for(const [e,n]of Object.entries(g))f[e]=(f[e]||0)+n*k;return f;}
function formula(f){return ['C','H','N','O','P','S','F',...Object.keys(f).filter(e=>!'CHNOPS'.includes(e)&&e!=='F').sort()].filter(e=>f[e]>0).map(e=>e+(f[e]===1?'':f[e])).join('');}
function masses(f){let exact=0,avg=0;for(const [e,n]of Object.entries(f)){if(!(e in REFERENCE.exact))throw Error('质量表未覆盖元素 '+e);exact+=REFERENCE.exact[e]*n;avg+=REFERENCE.average[e]*n;}return {exact_mass:exact,average_mw:avg};}
function composition(p){let f={};for(const r of p.residues){const t=template(r);add(f,t.formula?formulaObj(t.formula):graphFormula(t));}for(const l of p.links){let r=REFERENCE.linkRules[l];add(f,formulaObj(r.formula_add));add(f,formulaObj(r.formula_remove),-1);}addTerminalFormula(f,p);return f;}
function addTerminalFormula(f,p){for(const [side,n]of Object.entries(p.terminal)){if(!n)continue;const code=p.terminalChemistry[side];if(code==='PO')add(f,{H:n,P:n,O:3*n});else{const rule=REFERENCE.linkRules[code];add(f,formulaObj(rule.formula_add));add(f,formulaObj(rule.formula_remove),-1);add(f,{H:2,O:1});}}}

// The assembler connects attachment sites, not residue identities.
const PHOSPHORUS_CLASSES=['PO','PS','PS2','Me-P','PN(dmi)','MsPA'];
function attachment(t,direction,code,position='internal',res=t?.id||'block'){
 const site=t?.attachments?.[direction];
 if(!site || !site.allowed_linkage_classes?.includes(code) || !site[position+'_phosphorus']?.includes(code))throw Error('CHEMISTRY_UNSUPPORTED: '+res+' '+direction+' / '+code+'; '+(site?.reason||'directional attachment not declared'));
 if(!['alcohol','amine'].includes(site.connection_class))throw Error('CHEMISTRY_UNSUPPORTED: no linkage implementation for '+site.connection_class);
 const a=t.atoms[site.atom],bs=t.bonds.filter(b=>b.a===site.atom||b.b===site.atom);
 if(!Number.isInteger(site.atom)||!a||a.e!==site.element||a.h!==1||a.q||!bs.length||bs.some(b=>b.o!==1))throw Error('CHEMISTRY_UNSUPPORTED: invalid attachment contract '+res+' '+direction);
 if(site.connection_class==='alcohol'&&(a.e!=='O'||bs.length!==1))throw Error('CHEMISTRY_UNSUPPORTED: invalid alcohol site '+res);
 if(site.connection_class==='amine'&&(a.e!=='N'||code!=='PMO'))throw Error('CHEMISTRY_UNSUPPORTED: amine linkage requires a dedicated implementation');
 return site.atom;
}
function terminalAttachment(t,side,code,res,position='terminal'){return attachment(t,side==='five'?'upstream':'downstream',code,position,res);}
function validateChemistry(p){
 for(const [side,n]of Object.entries(p.terminal))if(n){
 const code=p.terminalChemistry[side],res=p.residues[side==='five'?0:p.residues.length-1],t=template(res);
 if(n>1&&code!=='PO')throw Error('CHEMISTRY_UNSUPPORTED: modified polyphosphate requires explicit phosphorus positions');
 terminalAttachment(t,side,code,res);
 }

 const blocks=p.residues.map(template),classes=blocks.map(t=>t?.assembly_class);
 for(const kind of ['tna','gna','pmo'])if(classes.includes(kind)&&classes.some(x=>x!==kind))throw Error('CHEMISTRY_UNSUPPORTED: mixed '+kind+' topology has no validated linkage contract');
 if(classes.every(x=>x==='tna'))p.topology='alpha-L-threose-3-to-2';
 if(classes.every(x=>x==='gna'))p.topology='S-glycerol-3-to-2';
 if(classes.includes('pmo')){
  if(p.links.some(l=>l!=='PO'&&l!=='PMO')||Object.values(p.terminal).some(Boolean))throw Error('CHEMISTRY_UNSUPPORTED: PMO supports uncapped OH/NH chains with dedicated phosphorodiamidate links only');
  p.links=p.links.map(()=> 'PMO');p.topology='morpholine-phosphorodiamidate';
 }
 for(const [i,code] of p.residues.entries()){
 const t=template(code),name=code[0]==='{'?'['+code.slice(1,-1)+']':code;
 if(!t){const entry=COVERAGE.entries.find(e=>e.notation===name);throw Error((entry?.graph==='IMPLEMENTATION_PENDING'?'IMPLEMENTATION_PENDING':name==='[cOct]'?'PENDING_CHEMISTRY':'STRUCTURE_VARIANT_PENDING')+': '+name+'; exact final scaffold / attachment / stereo not available');}
 if(t.terminal_only&&i!==0&&i!==p.residues.length-1)throw Error('INVALID_POSITION: '+name+' requires a sequence terminus');
 if(t.validation_status)throw Error(t.validation_status+': '+name);
 if(t.allowed_positions?.length===1&&t.allowed_positions[0]==='five'&&(i!==0||p.terminal.five))throw Error('INVALID_POSITION: '+name+' requires the 5′ terminus without an additional phosphate');
 if(t.allowed_positions?.length===1&&t.allowed_positions[0]==='three'&&i!==p.residues.length-1)throw Error('INVALID_POSITION: '+name+' requires the 3′ terminus');
 }
 for(const [i,code]of p.links.entries()){
 if(!REFERENCE.links[code])throw Error('STRUCTURE_VARIANT_PENDING: '+code+' exact linkage unavailable');
 for(const [ri,side]of [[i,'three'],[i+1,'five']]){const t=template(p.residues[ri]);terminalAttachment(t,side,code,p.residues[ri],'internal');}
 }
}
function od(p,mw){
 const provenance={parameters:'reference-data.js',source:'https://www.genelink.com/Literature/PS/Oligo_Analysis_Parameters_V3.3.pdf',equation:'sum dinucleotide epsilon - sum internal mononucleotide epsilon',mass_basis:'average_mw',convention:'1 OD260 = A260 1 in 1 mL at 1 cm',limitations:'single-strand reference model; pH, salt, folding and hypochromicity may differ experimentally'};
 const customs=p.residues.filter(r=>customLibrary[r]);
 if(p.topology==='morpholine-phosphorodiamidate')return {supported:false,status:'NEEDS_PARAMETER',reason:'PMO-specific extinction parameters are not available',provenance};
 if(customs.length){const missing=customs.filter(r=>!validExtinction(customLibrary[r].extinction));if(missing.length)return {supported:false,status:'NEEDS_PARAMETER',reason:'Needs parameter: custom unit A260 model/source missing; no zero-absorption assumption',provenance,missing_units:missing};
 // Custom additive contributions are only meaningful with an explicitly supplied full-unit model.
 if(p.residues.some(r=>!customLibrary[r]))return {supported:false,status:'NEEDS_PARAMETER',reason:'Mixed custom/nucleotide nearest-neighbor junction parameters are missing',provenance};
 const eps=customs.reduce((v,r)=>v+customLibrary[r].extinction.contribution+(customLibrary[r].extinction.correction||0),0);
 return opticalResult(eps,mw,true,'User additive full-unit model (junction effects unvalidated)',{...provenance,custom_parameters:customs.map(r=>customLibrary[r].extinction)});
 }
 const bases=p.residues.map(r=>template(r)?.base??null);if(bases.some(b=>!b||b.length!==1||!'ACGTU'.includes(b)))return {supported:false,status:'NEEDS_PARAMETER',reason:'Needs parameter: special unit / modified base / inosine epsilon260 unavailable',provenance};
 const dna=p.residues.every(r=>r[0]==='d'),rna=p.residues.every(r=>r[0]==='r'&&r[1]!=='T');
 if(dna&&bases.includes('U'))return {supported:false,status:'NEEDS_PARAMETER',reason:'DNA nearest-neighbor parameters for deoxyuridine are unavailable',provenance};
 const estimated=!(dna||rna)||p.links.some(l=>l!=='PO')||Object.values(p.terminal).some(Boolean);
 const bs=dna?bases:bases.map(b=>b==='T'?'U':b),mono=dna?REFERENCE.dnaMono:REFERENCE.rnaMono,nn=dna?REFERENCE.dnaNN:REFERENCE.rnaNN;
 const eps=bs.length===1?mono[bs[0]]:bs.slice(1).reduce((v,b,i)=>v+nn[bs[i]+b],0)-bs.slice(1,-1).reduce((v,b)=>v+mono[b],0);
 return opticalResult(eps,mw,estimated,(dna?'DNA':'RNA')+' nearest-neighbor'+(estimated?' (base-preserving estimate; modification/backbone/terminal effects lack validated corrections)':''),provenance);
}
function validExtinction(e){return !!e&&e.model==='additive-full-unit'&&Number.isFinite(e.contribution)&&e.contribution>=0&&(e.correction===undefined||Number.isFinite(e.correction))&&typeof e.source==='string'&&!!e.source.trim();}
function opticalResult(eps,mw,estimated,method,provenance){if(!Number.isFinite(eps)||eps<=0)return {supported:false,status:'UNSUPPORTED',reason:'Nonpositive or invalid epsilon260',provenance};return {supported:true,status:estimated?'ESTIMATED':'SUPPORTED',estimated,epsilon260:eps,epsilon_unit:'L mol^-1 cm^-1',nmol_per_od:1e6/eps,ug_per_od:1000*mw/eps,od_per_umol:eps/1000,method,provenance};}
function graphFormula(g){let f={};for(const a of g.atoms){add(f,{[a.e]:1});if(a.e!=='H')add(f,{H:a.h||0});}return f;}
function directComposition(p){let f={};for(const code of p.residues){const t=template(code),parts=t.direct_formula_parts;if(parts){add(f,formulaObj(parts.sugar));add(f,formulaObj(parts.base));add(f,{H:2,O:1},-1);}else add(f,t.formula?formulaObj(t.formula):graphFormula(t));}for(const code of p.links){const rule=REFERENCE.linkRules[code];add(f,formulaObj(rule.formula_add));add(f,formulaObj(rule.formula_remove),-1);}addTerminalFormula(f,p);return f;}
function connected(g){if(!g.atoms.length)return false;const adj=g.atoms.map(()=>[]);for(const b of g.bonds){adj[b.a].push(b.b);adj[b.b].push(b.a);}const seen=new Set([0]),stack=[0];while(stack.length){for(const n of adj[stack.pop()])if(!seen.has(n)){seen.add(n);stack.push(n);}}return seen.size===g.atoms.length;}
// Display-only orthogonal path search. Chemical atom/bond arrays are never modified.
function routeAvoid(g,bi,pi){
 const bond=g.bonds[bi],P=g.atoms[pi],other=pi===bond.a?bond.b:bond.a,T=g.atoms[other],sign=T.y<P.y?-1:1,start=[P.x,P.y+sign*1.2],end=[T.x,T.y];
 const atomPoints=g.atoms.map((a,i)=>({i,x:a.x,y:a.y,r:a.e==='C'?.50:.68}));
 const near=atomPoints.filter(a=>a.y>Math.min(P.y,T.y)-60&&a.y<Math.max(P.y,T.y)+60&&a.x>Math.min(P.x,T.x)-60&&a.x<Math.max(P.x,T.x)+60);
 let minx=Math.min(start[0],end[0],...near.map(a=>a.x))-3,maxx=Math.max(start[0],end[0],...near.map(a=>a.x))+3,miny=Math.min(start[1],end[1],...near.map(a=>a.y))-3,maxy=Math.max(start[1],end[1],...near.map(a=>a.y))+3;
 const xs=[...new Set([start[0],end[0],...Array.from({length:Math.ceil((maxx-minx)/.65)+1},(_,i)=>minx+i*.65)])].sort((a,b)=>a-b),ys=[...new Set([start[1],end[1],...Array.from({length:Math.ceil((maxy-miny)/.65)+1},(_,i)=>miny+i*.65)])].sort((a,b)=>a-b);
 const nx=xs.length,id=(x,y)=>y*nx+x,sx=xs.indexOf(start[0]),sy=ys.indexOf(start[1]),ex=xs.indexOf(end[0]),ey=ys.indexOf(end[1]),goal=id(ex,ey),origin=id(sx,sy);
 const incident=new Set([bond.a,bond.b]);
 const atoms=near.filter(a=>!incident.has(a.i));
 const segs=g.bonds.filter((b,i)=>i!==bi&&!incident.has(b.a)&&!incident.has(b.b)&&!((g.routes||[]).some(r=>r.bond===i))&&Math.min(g.atoms[b.a].y,g.atoms[b.b].y)<Math.max(P.y,T.y)+65&&Math.max(g.atoms[b.a].y,g.atoms[b.b].y)>Math.min(P.y,T.y)-65).map(b=>({a:g.atoms[b.a],b:g.atoms[b.b]}));
 for(const r of g.routes||[])if(!r.atoms?.some(i=>incident.has(i)))for(let j=1;j<r.points.length;j++)segs.push({a:{x:r.points[j-1][0],y:r.points[j-1][1]},b:{x:r.points[j][0],y:r.points[j][1]}});
 const orient=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
 function clear(x1,y1,x2,y2){const A={x:x1,y:y1},B={x:x2,y:y2};for(const a of atoms){if(a.x<Math.min(x1,x2)-a.r||a.x>Math.max(x1,x2)+a.r||a.y<Math.min(y1,y2)-a.r||a.y>Math.max(y1,y2)+a.r)continue;const dx=x2-x1,dy=y2-y1,t=Math.max(0,Math.min(1,((a.x-x1)*dx+(a.y-y1)*dy)/(dx*dx+dy*dy||1)));if(Math.hypot(a.x-x1-t*dx,a.y-y1-t*dy)<a.r)return false;}for(const s of segs){if(Math.max(s.a.x,s.b.x)<Math.min(x1,x2)||Math.min(s.a.x,s.b.x)>Math.max(x1,x2)||Math.max(s.a.y,s.b.y)<Math.min(y1,y2)||Math.min(s.a.y,s.b.y)>Math.max(y1,y2))continue;if(orient(A,B,s.a)*orient(A,B,s.b)<-1e-10&&orient(s.a,s.b,A)*orient(s.a,s.b,B)<-1e-10)return false;}return true;}
 const heap=[],push=v=>{heap.push(v);let i=heap.length-1;while(i){const p=(i-1)>>1;if(heap[p][0]<=v[0])break;heap[i]=heap[p];i=p;}heap[i]=v;},pop=()=>{const first=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let j=i*2+1;if(j+1<heap.length&&heap[j+1][0]<heap[j][0])j++;if(heap[j][0]>=last[0])break;heap[i]=heap[j];i=j;}heap[i]=last;}return first;};
 const costs=new Map([[origin,0]]),previous=new Map(),closed=new Set();push([0,origin]);
 while(heap.length){const [,key]=pop();if(closed.has(key))continue;if(key===goal)break;closed.add(key);const x=key%nx,y=Math.floor(key/nx),base=costs.get(key);for(const [xx,yy]of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){if(xx<0||xx>=nx||yy<0||yy>=ys.length)continue;const next=id(xx,yy);if(closed.has(next)||!clear(xs[x],ys[y],xs[xx],ys[yy]))continue;const parent=previous.get(key),turn=parent===undefined?0:((parent%nx===x)===(xx===x)?0:1.8);const value=base+Math.abs(xs[xx]-xs[x])+Math.abs(ys[yy]-ys[y])+turn;if(value>=(costs.get(next)??Infinity))continue;costs.set(next,value);previous.set(next,key);push([value+Math.abs(xs[xx]-end[0])+Math.abs(ys[yy]-end[1]),next]);}}
 if(!costs.has(goal))throw Error('LAYOUT_ROUTING_FAILED: expanded terminal unit requires a clear attachment exit');
 let keys=[goal];while(keys[keys.length-1]!==origin)keys.push(previous.get(keys[keys.length-1]));let points=[[P.x,P.y],...keys.reverse().map(k=>[xs[k%nx],ys[Math.floor(k/nx)]])];
 points=points.filter((p,i,a)=>!i||p[0]!==a[i-1][0]||p[1]!==a[i-1][1]);let compact=[];for(const q of points){while(compact.length>1){const a=compact[compact.length-2],b=compact[compact.length-1];if((a[0]===b[0]&&b[0]===q[0])||(a[1]===b[1]&&b[1]===q[1]))compact.pop();else break;}compact.push(q);}let smooth=[compact[0]],at=0;while(at<compact.length-1){let found=false;for(let j=compact.length-1;j>at;j--){const a=compact[at],z=compact[j];for(const mid of [[a[0],z[1]],[z[0],a[1]]])if(clear(a[0],a[1],mid[0],mid[1])&&clear(mid[0],mid[1],z[0],z[1])){if(mid[0]!==a[0]||mid[1]!==a[1])smooth.push(mid);if(z[0]!==mid[0]||z[1]!==mid[1])smooth.push(z);at=j;found=true;break;}if(found)break;}if(!found){smooth.push(compact[++at]);}}return bond.a===pi?smooth:smooth.reverse();
}
// Canonical phosphorus depiction, independent of chemistry and sequence context.
// Attachments occupy the vertical axis; nonbridging substituents the horizontal axis.
// Existing complex substituent topology is preserved; only coordinates are assigned.
function phosphorusGeometry(code,x,y){
 const t=clone(REFERENCE.links[code]);
 const nb=j=>t.bonds.filter(b=>b.a===j||b.b===j).map(b=>({i:b.a===j?b.b:b.a,o:b.o}));
 let roles={p:t.p},pts={p:[x,y]};
 if(code==='PN(dmi)'||code==='PMO'){
 const N=nb(t.p).find(v=>t.atoms[v.i].e==='N').i,P=t.atoms[t.p],D=t.atoms[N],angle=Math.PI-Math.atan2(D.y-P.y,D.x-P.x),co=Math.cos(angle),si=Math.sin(angle);
 for(const a of t.atoms){const dx=a.x-P.x,dy=a.y-P.y;a._xy=[x+dx*co-dy*si,y+dx*si+dy*co];}
 for(const a of t.atoms){[a.x,a.y]=a._xy;delete a._xy;}
 const O=nb(t.p).find(v=>t.atoms[v.i].e==='O').i;t.atoms[O].x=x+1.7;t.atoms[O].y=y;
 }else if(code==='MsPA'){
 roles.n=nb(t.p).find(v=>t.atoms[v.i].e==='N').i;roles.o=nb(t.p).find(v=>t.atoms[v.i].e==='O').i;
 roles.s=nb(roles.n).find(v=>t.atoms[v.i].e==='S').i;
 let os=nb(roles.s).filter(v=>t.atoms[v.i].e==='O');roles.so1=os[0].i;roles.so2=os[1].i;roles.me=nb(roles.s).find(v=>t.atoms[v.i].e==='C').i;
 Object.assign(pts,{o:[x+1.7,y],n:[x-1.7,y],s:[x-3.2,y],so1:[x-3.2,y-1.45],so2:[x-3.2,y+1.45],me:[x-5.05,y]});
 }else{roles.double=nb(t.p).find(v=>v.o===2).i;roles.single=nb(t.p).find(v=>v.o===1).i;pts.double=[x-1.7,y];pts.single=[x+1.7,y];}
 for(const [role,j]of Object.entries(roles)){t.atoms[j].x=pts[role][0];t.atoms[j].y=pts[role][1];}
 return t;
}
function assemble(p){
 let g={atoms:[],bonds:[],routes:[],depiction_overpasses:[]},sites=[],expanded=[];
 const ts=p.residues.map(template),hasLarge=ts.some(t=>t.layout_metadata?.expanded),minLocalX=extent(ts.flatMap(t=>t.atoms.map(a=>a.x)),'min'),maxLocalX=extent(ts.flatMap(t=>t.atoms.map(a=>a.x)),'max'),minLocalY=extent(ts.flatMap(t=>t.atoms.map(a=>a.y)),'min');
 const origins=[];for(let i=0;i<ts.length;i++){if(i%10===0)origins[i]=0;else{const prev=ts[i-1],next=ts[i];origins[i]=origins[i-1]+Math.max(11,extent(prev.atoms.map(a=>a.y),'max')-extent(next.atoms.map(a=>a.y),'min')+4.5);}}
 // Frozen coordinates: no column-dependent rotation, reflection or terminal transform.
 let width=Math.max(30,...p.residues.map(r=>{let t=template(r);return extent(t.atoms.map(a=>a.x),'max')-extent(t.atoms.map(a=>a.x),'min')+20;}));
 let pitch=Math.max(p.links.includes('PN(dmi)')?15:11,...p.residues.map(r=>{let t=template(r);return extent(t.atoms.map(a=>a.y),'max')-extent(t.atoms.map(a=>a.y),'min')+4.5;}));
 if(hasLarge)width=maxLocalX-minLocalX+36;
 for(let i=0;i<p.residues.length;i++){let t=clone(template(p.residues[i])),o=g.atoms.length;
 for(const v of t.atoms){v.x+=Math.floor(i/10)*width;v.y+=hasLarge?origins[i]:(i%10)*pitch;}
 for(const v of t.depiction_overpasses||[])g.depiction_overpasses.push({...v,front:g.bonds.length+v.front,back:g.bonds.length+v.back});
 append(g.atoms,t.atoms);append(g.bonds,t.bonds.map(b=>({...b,a:b.a+o,b:b.b+o})));const up=t.attachments?.upstream?.atom,down=t.attachments?.downstream?.atom;sites.push({offset:o,o5:Number.isInteger(up)?o+up:null,o3:Number.isInteger(down)?o+down:null,terminalOnly:!Number.isInteger(up)||!Number.isInteger(down),incoming_label:t.incoming_label||'5′ side',outgoing_label:t.outgoing_label||'3′ side'});}
 for(let i=0;i<p.links.length;i++){
 let code=p.links[i],t,a=sites[i].o3,b=sites[i+1].o5,offset=g.atoms.length,A=g.atoms[a],B=g.atoms[b],boundary=(i+1)%10===0;
 let x=A.x,y=(A.y+(boundary?A.y+(hasLarge?11:pitch)-3.8:B.y))/2;const largeLink=hasLarge&&(ts[i].layout_metadata?.expanded||ts[i+1].layout_metadata?.expanded);if(largeLink){x=Math.floor(i/10)*width+minLocalX-10;y=boundary?A.y+4:(A.y+B.y)/2;}
 t=phosphorusGeometry(code,x,y);
 append(g.atoms,t.atoms);g.bonds.push(...t.bonds.map(v=>({...v,a:v.a+offset,b:v.b+offset,s:0})),{a,b:offset+t.p,o:1,s:0},{a:offset+t.p,b,o:1,s:0});
 if(largeLink)expanded.push({bonds:[g.bonds.length-2,g.bonds.length-1],p:offset+t.p});
 if(boundary&&!largeLink){let P=g.atoms[offset+t.p],gutter=B.x+(hasLarge?minLocalX-17:-8),top=Math.min(-5,minLocalY-5);
 // Escape downward below the final linkage before entering the empty gutter.
 g.routes.push({bond:g.bonds.length-1,boundary:i+1,atoms:[offset+t.p,b],points:[[P.x,P.y],[P.x,P.y+3],[gutter,P.y+3],[gutter,top],[B.x,top],[B.x,B.y]]});}
 A.h--;B.h--;}
 for(const [side,count]of Object.entries(p.terminal||{})){
 if(!count)continue;const ri=side==='five'?0:p.residues.length-1,tpl=template(p.residues[ri]),local=terminalAttachment(tpl,side,p.terminalChemistry[side],p.residues[ri]);let anchor=sites[ri].offset+local,sign=side==='five'?-1:1;
 g.atoms[anchor].h--;let previous=anchor,origin=g.atoms[anchor];
 for(let k=0;k<count;k++){
 let x=origin.x,y=origin.y+sign*(3+6*k),pi=g.atoms.length;
 const code=p.terminalChemistry[side],t=phosphorusGeometry(code,x,y);
 g.atoms.push(...t.atoms,{e:'O',h:k===count-1?1:0,x,y:y+sign*3});
 g.bonds.push(...t.bonds.map(b=>({...b,a:b.a+pi,b:b.b+pi,s:0})),{a:previous,b:pi+t.p,o:1,s:0},{a:pi+t.p,b:pi+t.atoms.length,o:1,s:0});previous=pi+t.atoms.length;
 }
 }
 for(const item of expanded)for(const bi of item.bonds){const b=g.bonds[bi];try{g.routes.push({bond:bi,kind:'expanded-unit',atoms:[b.a,b.b],points:routeAvoid(g,bi,item.p)});}catch(e){if(!e.message.startsWith('LAYOUT_ROUTING_FAILED:'))throw e;(g.layout_warnings??=[]).push('Direct bond retained for '+bi+': display route unavailable; inspect layout');}}
 g.sites=sites;g.topology=p.topology||'mixed-or-ribose';g.direction=['alpha-L-threose-3-to-2','S-glycerol-3-to-2'].includes(p.topology)?'3′ → 2′':p.topology==='morpholine-phosphorodiamidate'?'5′ OH → 3′ NH':'5′ → 3′';g.layout={column_pitch:width,residue_pitch:pitch,adaptive:hasLarge,origins:hasLarge?origins:null,rows:10};return g;
}
function calculate(seq){let p=parse(seq);validateChemistry(p);let g=assemble(p),f=graphFormula(g),m=masses(f);if(formula(f)!==formula(composition(p))||formula(f)!==formula(directComposition(p))||!connected(g))throw Error('内部 graph/composition 验证失败');return {schema_version:'oligo-lite/1.2',status:'ok',errors:[],input_sequence:seq,canonical_sequence:p.canonical,sequence:p.canonical,residues:p.residues,linkages:p.links,modifications:p.terminal,notation:p,formula_validation:{direct:formula(directComposition(p)),component:formula(composition(p)),graph:formula(f),equal:true},chemistry:{formula:formula(f),formula_dict:f,...m,charge_model:p.topology==='morpholine-phosphorodiamidate'?'neutral uncapped PMO: free 5-OH / 3-NH':'neutral free acid; terminal OH or specified phosphate',phosphorus_stereochemistry:'unspecified'},optical:od(p,m.average_mw),graph:g,provenance:{coverage:p.residues.map(code=>{const key=code[0]==='{'?'['+code.slice(1,-1)+']':code;return COVERAGE.entries.find(e=>e.notation===key)||{notation:key,status:'USER_CUSTOM',extinction:customLibrary[code]?.extinction||{status:'NEEDS_PARAMETER'}};}),reference:REFERENCE.source,monomers:'versioned atomic library',chemistry_status:'REGRESSION_VALIDATED',mspa:p.links.includes('MsPA')?'MsPA: neutral P(=O)-NH-S(=O)2-Me; phosphorus stereochemistry unspecified':null},limitations:['Neutral terminal PO/PS/PS2/Me-P/PN(dmi)/MsPA; modified polyphosphate and unvalidated modifier attachments rejected','MOL/SDF preserve graph and atom coordinates; routed paths are SVG/JSON display metadata only']};}
const pad=(v,n)=>String(v).padStart(n,' ');
function molV3000(g,title){return [title.replace(/[\r\n]/g,' '),'  OligoLite  2D','','  0  0  0     0  0            999 V3000','M  V30 BEGIN CTAB',`M  V30 COUNTS ${g.atoms.length} ${g.bonds.length} 0 0 0`,'M  V30 BEGIN ATOM',...g.atoms.map((a,i)=>`M  V30 ${i+1} ${a.e} ${a.x.toFixed(4)} ${(-a.y).toFixed(4)} 0 0${a.q?' CHG='+a.q:''}`),'M  V30 END ATOM','M  V30 BEGIN BOND',...g.bonds.map((b,i)=>`M  V30 ${i+1} ${b.o} ${b.a+1} ${b.b+1}${b.s?' CFG='+(b.s===1?1:3):''}`),'M  V30 END BOND','M  V30 END CTAB','M  END',''].join('\n');}
function mol(g,title='Oligo Lite'){if(g.atoms.length>999||g.bonds.length>999||g.atoms.some(a=>a.x.toFixed(4).length>10||(-a.y).toFixed(4).length>10))return molV3000(g,title);let s=[title.replace(/[\r\n]/g,' '),'  OligoLite  2D','',pad(g.atoms.length,3)+pad(g.bonds.length,3)+'  0  0  0  0            999 V2000'];g.atoms.forEach(a=>s.push(pad(a.x.toFixed(4),10)+pad((-a.y).toFixed(4),10)+pad('0.0000',10)+' '+a.e.padEnd(3)+' 0  0  0  0  0  0  0  0  0  0  0  0'));g.bonds.forEach(b=>s.push(pad(b.a+1,3)+pad(b.b+1,3)+pad(b.o,3)+pad(b.s||0,3)+'  0  0  0'));for(let i=0;i<g.atoms.length;i++){let a=g.atoms[i];if(a.q)s.push('M  CHG  1'+pad(i+1,4)+pad(a.q,4));if(a.iso)s.push('M  ISO  1'+pad(i+1,4)+pad(a.iso,4));}return s.join('\n')+'\nM  END\n';}
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
function svg(g){let points=(g.routes||[]).flatMap(r=>r.points),xs=[...g.atoms.map(a=>a.x),...points.map(p=>p[0])],ys=[...g.atoms.map(a=>a.y),...points.map(p=>p[1])],minx=extent(xs,'min')-2,miny=extent(ys,'min')-2,w=extent(xs,'max')-minx+2,h=extent(ys,'max')-miny+2;let s=[`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minx} ${miny} ${w} ${h}" width="${Math.ceil(w*23)}" height="${Math.ceil(h*23)}"><rect x="${minx}" y="${miny}" width="${w}" height="${h}" fill="white"/><g stroke="#27374a" stroke-width=".055" stroke-linecap="round">`];for(const [bi,b] of g.bonds.entries()){let route=(g.routes||[]).find(r=>r.bond===bi);if(route){s.push(`<path ${route.boundary===undefined?'data-route-kind="expanded-unit"':'data-boundary="'+route.boundary+'"'} d="${route.points.map((p,i)=>(i?'L':'M')+p.join(' ')).join(' ')}" fill="none"/>`);continue;}let a=g.atoms[b.a],z=g.atoms[b.b],dx=z.x-a.x,dy=z.y-a.y,L=Math.hypot(dx,dy)||1,nx=-dy/L,ny=dx/L;if(b.s===1){s.push(`<path d="M${a.x} ${a.y} L${z.x+nx*.14} ${z.y+ny*.14} L${z.x-nx*.14} ${z.y-ny*.14}Z" fill="#27374a"/>`);}else if(b.s===6){for(let k=1;k<=7;k++){let t=k/8,r=t*.14;s.push(`<path d="M${a.x+dx*t+nx*r} ${a.y+dy*t+ny*r} l${-2*nx*r} ${-2*ny*r}"/>`);}}else{for(let j=0;j<b.o;j++){let d=(j-(b.o-1)/2)*.16;s.push(`<path d="M${a.x+nx*d} ${a.y+ny*d} L${z.x+nx*d} ${z.y+ny*d}"/>`);}}}for(const v of g.depiction_overpasses||[]){const f=g.bonds[v.front],b=g.bonds[v.back],a=g.atoms[f.a],z=g.atoms[f.b],c=g.atoms[b.a],d=g.atoms[b.b],dx=z.x-a.x,dy=z.y-a.y,ex=d.x-c.x,ey=d.y-c.y,den=dx*ey-dy*ex;if(Math.abs(den)<1e-9)continue;const t=((c.x-a.x)*ey-(c.y-a.y)*ex)/den,u=((c.x-a.x)*dy-(c.y-a.y)*dx)/den;if(t<=0||t>=1||u<=0||u>=1)continue;const L=Math.hypot(dx,dy),x=a.x+t*dx,y=a.y+t*dy;s.push(`<path data-cage-overpass="${v.front}" d="M${x-dx/L*.24} ${y-dy/L*.24} L${x+dx/L*.24} ${y+dy/L*.24}" stroke="white" stroke-width=".21"/><path d="M${x-dx/L*.26} ${y-dy/L*.26} L${x+dx/L*.26} ${y+dy/L*.26}" stroke="#27374a" stroke-width=".055"/>`);}s.push('</g><g font-family="Arial,sans-serif" font-size=".52" text-anchor="middle" dominant-baseline="central">');for(const [ai,a] of g.atoms.entries()){if(a.e==='C')continue;let label=a.e+(a.h?'H'+(a.h>1?a.h:''):'')+(a.q? (a.q>0?'+':'−'):'');s.push(`<text data-atom="${ai}" x="${a.x}" y="${a.y}" fill="${a.e==='O'?'#bb3339':a.e==='N'?'#2858ad':a.e==='S'?'#94701a':'#333'}" stroke="white" stroke-width=".17" paint-order="stroke">${`<tspan x="${a.x}" text-anchor="middle">${esc(a.e)}</tspan>`}${a.h?`<tspan font-size=".40" x="${a.x+.28}" text-anchor="start">H${a.h>1?a.h:''}</tspan>`:''}${a.q?`<tspan>${a.q>0?'+':'−'}</tspan>`:''}</text>`);}s.push('</g>');if(g.sites)g.sites.forEach((v,i)=>{let a=g.atoms[v.o5??v.o3];s.push(`<text data-unit="${i}" x="${a.x-3}" y="${a.y-.65}" font-family="Arial" font-size=".45" fill="#8794a5">${i+1}${i===0?' · '+(v.incoming_label||'5′'):''}${i===g.sites.length-1?' → '+(v.outgoing_label||'3′'):''}</text>`);});return s.join('')+'</svg>';}
function cdxml(g){const nums={H:1,C:6,N:7,O:8,F:9,P:15,S:16};return `<?xml version="1.0"?><CDXML BondLength="30"><page id="1"><fragment id="2">`+g.atoms.map((a,i)=>`<n id="${i+10}" p="${(a.x+8)*20} ${(a.y+8)*20}" Element="${nums[a.e]}" NumHydrogens="${a.h||0}"${a.q?` Charge="${a.q}"`:''}/>`).join('')+g.bonds.map((b,i)=>`<b id="${g.atoms.length+10+i}" B="${b.a+10}" E="${b.b+10}" Order="${b.o}"${b.s?` Display="${b.s===1?'WedgeBegin':'WedgedHashBegin'}"`:''}/>`).join('')+'</fragment></page></CDXML>';}
function readV2000(text){let lines=text.replace(/\r/g,'').split('\n');if(!lines[3]?.includes('V2000'))throw Error('Expected MOL V2000 or V3000');let n=Number(lines[3].slice(0,3)),nb=Number(lines[3].slice(3,6));if(!Number.isInteger(n)||n<1||n>999||!Number.isInteger(nb)||nb<0)throw Error('无效 atom count');let g={atoms:[],bonds:[]},aliases={};for(let i=0;i<n;i++){let l=lines[4+i],e=l.slice(31,34).trim();let qcode=Number(l.slice(36,39));if(![0,1,2,3,5,6,7].includes(qcode))throw Error('Unsupported atom charge/radical code');if(!e||![Number(l.slice(0,10)),Number(l.slice(10,20))].every(Number.isFinite))throw Error('无效 atom line');g.atoms.push({e,x:Number(l.slice(0,10)),y:-Number(l.slice(10,20)),q:({1:3,2:2,3:1,5:-1,6:-2,7:-3})[qcode]||0,map:Number(l.slice(60,63)),h:0});if(Number(l.slice(34,36)))throw Error('暂不支持 atom-line isotope mass difference，请用 M ISO');if(Number(l.slice(39,42)))throw Error('暂不支持 atom parity，请导出 wedge bond stereo');if(!['*','R#','R','Du'].includes(e)&&(Number(l.slice(42,45))||Number(l.slice(48,51))))throw Error('暂不支持显式 H/valence override');}
for(let i=0;i<nb;i++){let l=lines[4+n+i],a=Number(l.slice(0,3))-1,b=Number(l.slice(3,6))-1,o=Number(l.slice(6,9)),s=Number(l.slice(9,12));if(a<0||b<0||a>=n||b>=n||a===b||![1,2,3].includes(o)||![0,1,6].includes(s))throw Error('仅支持 single/double/triple 与 wedge/hash；芳香键请导出 Kekulé');if(g.bonds.some(v=>(v.a===a&&v.b===b)||(v.a===b&&v.b===a)))throw Error('重复 bond');g.bonds.push({a,b,o,s});}
if(!lines.slice(4+n+nb).some(l=>l.startsWith('M  END')))throw Error('Truncated V2000 record');
for(let i=4+n+nb;i<lines.length;i++){let l=lines[i];if(l.startsWith('M  END'))break;if(l.startsWith('M  RGP')){let t=l.trim().split(/\s+/);for(let j=0;j<Number(t[2]);j++)aliases[Number(t[3+2*j])-1]='R'+t[4+2*j];}else if(l.startsWith('A  ')){aliases[Number(l.slice(3))-1]=(lines[++i]||'').replace(/[′']/g,'').trim();}else if(/^M  (CHG|ISO)/.test(l)){let t=l.trim().split(/\s+/),key=t[1]==='CHG'?'q':'iso';for(let j=0;j<Number(t[2]);j++){let a=g.atoms[Number(t[3+j*2])-1];if(!a)throw Error('M property atom 越界');a[key]=Number(t[4+j*2]);}}else if(l.startsWith('M  ')&&!l.startsWith('M  END'))throw Error('未覆盖的 MOL 属性：'+l.slice(0,6));}
return {g,aliases};}
function readV3000(text){
 const physical=text.replace(/\r/g,'').split('\n'),records=[];let continued='';
 for(const line of physical)if(line.startsWith('M  V30 ')){let part=line.slice(7);if(part.endsWith('-')){continued+=part.slice(0,-1);continue;}records.push(continued+part);continued='';}
 if(continued)throw Error('Truncated V3000 continuation');
 const g={atoms:[],bonds:[]},aliases={},ids=new Map(),pending=[],seenBonds=new Set();let mode='',counts;
 for(const line of records){
  if(line.startsWith('COUNTS ')){counts=line.split(/\s+/).slice(1).map(Number);if(counts.slice(2).some(Boolean))throw Error('V3000 collections/SGroups require an explicit chemistry model');continue;}
  if(line==='BEGIN CTAB'||line==='END CTAB')continue;
  if(line==='BEGIN ATOM'){mode='atom';continue;}if(line==='BEGIN BOND'){mode='bond';continue;}
  if(line==='END ATOM'||line==='END BOND'){mode='';continue;}
  const t=line.match(/"[^"\n]*"|\S+/g)||[];
  if(mode==='atom'){
   const id=Number(t[0]),e=t[1]?.replace(/^"|"$/g,''),x=Number(t[2]),y=-Number(t[3]),z=Number(t[4]),map=Number(t[5]);
   if(!Number.isInteger(id)||ids.has(id)||!e||![x,y,z,map].every(Number.isFinite))throw Error('Invalid V3000 atom');
   const a={e,x,y,map,q:0,h:0};ids.set(id,g.atoms.length);
   for(const prop of t.slice(6)){const [k,v]=prop.split('=');if(k==='CHG'||k==='MASS'){if(!Number.isInteger(Number(v)))throw Error('Invalid V3000 '+k);a[k==='CHG'?'q':'iso']=Number(v);}else if(k==='LABEL')aliases[g.atoms.length]=v.replace(/^"|"$/g,'');else throw Error('Unsupported V3000 atom property '+k);}
   g.atoms.push(a);
  }else if(mode==='bond'){
   const id=Number(t[0]),o=Number(t[1]),a=Number(t[2]),b=Number(t[3]);let stereo=0;
   if(!Number.isInteger(id)||seenBonds.has(id)||![1,2,3].includes(o))throw Error('Invalid V3000 bond');seenBonds.add(id);
   for(const prop of t.slice(4)){const [k,v]=prop.split('=');if(k!=='CFG'||!['0','1','3'].includes(v))throw Error('Unsupported V3000 bond property '+prop);stereo=v==='1'?1:v==='3'?6:0;}
   pending.push({a,b,o,s:stereo});
  }else throw Error('Unsupported V3000 section: '+line);
 }
 if(!counts||counts[0]!==g.atoms.length||counts[1]!==pending.length||!g.atoms.length)throw Error('V3000 count mismatch');
 const pairs=new Set();for(const b of pending){b.a=ids.get(b.a);b.b=ids.get(b.b);const key=[b.a,b.b].sort((a,b)=>a-b).join(':');if(b.a===undefined||b.b===undefined||b.a===b.b||pairs.has(key))throw Error('Invalid V3000 bond endpoints');pairs.add(key);g.bonds.push(b);}
 if(!text.includes('M  END')||!records.includes('END CTAB'))throw Error('Truncated V3000 record');
 return {g,aliases};
}
function parseMol(text,options={}){
 const records=text.split(/^\$\$\$\$\s*$/m).filter(x=>x.trim());if(records.length!==1)throw Error('Import one MOL/SDF molecule at a time');
 let {g,aliases}=text.split(/\r?\n/)[3]?.includes('V3000')?readV3000(text):readV2000(text);
let marks={};if(!options.manualMarkers){for(const m of text.matchAll(/>[^\n]*<((?:UPSTREAM|DOWNSTREAM|5_PRIME|3_PRIME)_ATTACHMENT)>[^\n]*\n\s*(\d+)/gi)){const i=Number(m[2])-1;if(!g.atoms[i]||g.atoms[i].e!=='O')throw Error('SDF attachment must identify a real O');const label=/^(UPSTREAM|5_)/i.test(m[1])?'5':'3';aliases[i]=label;}}g.atoms.forEach((a,i)=>{if(a.e==='O'&&!options.manualMarkers){const labels=[aliases[i],a.map].map(v=>String(v??'').replace(/[′'’]/g,'').trim()).filter(v=>v==='3'||v==='5');if(new Set(labels).size>1)throw Error('Conflicting directional O labels');const label=labels[0];if(label==='3'||label==='5'){if(marks[label])throw Error('Duplicate directional OH marker');marks[label]={attachment:i};}return;}if(!['*','R#','R','Du','5','3','R1','R2','R3'].includes(a.e))return;if(options.manualMarkers){let bs=g.bonds.filter(b=>b.a===i||b.b===i);if(bs.length!==1||bs[0].o!==1)throw Error('手动模式也仅允许单键 terminal marker');let j=bs[0].a===i?bs[0].b:bs[0].a;if(g.atoms[j].e!=='O'||g.atoms[j].q)throw Error('手动模式的 marker 仍必须连接真实中性 O');marks['manual'+i]={marker:i,attachment:j};return;}let labels=[aliases[i],a.e,a.map,a.iso].map(String);let v=labels.find(x=>x==='3'||x==='5');let candidates=new Set(labels.flatMap(x=>x==='5'||x==='R1'?['5']:x==='3'||x==='R2'?['3']:[]));if(candidates.size>1)throw Error('同一 marker 的 5′/3′ 标记冲突');if(!v){if(labels.includes('R1'))v='5';else if(labels.includes('R2'))v='3';}if(!v)throw Error('未分配的 general/R3 marker；仅 5/3 或 R1→5′、R2→3′ 可作为两端，其他 marker 请在原绘图中明确处理');let neighbors=g.bonds.filter(b=>b.a===i||b.b===i);if(marks[v]!==undefined||neighbors.length!==1||neighbors[0].o!==1)throw Error('marker 必须唯一且只有一个 single bond');let b=neighbors[0],j=b.a===i?b.b:b.a;if(g.atoms[j].e!=='O'||g.atoms[j].q)throw Error('marker 必须连接真实中性 O');marks[v]={marker:i,attachment:j};});if(!options.manualMarkers&&marks[3]&&marks[5]&&marks[3].attachment===marks[5].attachment)throw Error('需要不同的 5′/3′ attachment O');let remove=new Set(Object.values(marks).filter(v=>v.marker!==undefined).map(v=>v.marker)),mapping={},atoms=[];g.atoms.forEach((a,i)=>{if(!remove.has(i)){mapping[i]=atoms.length;atoms.push(a);}});g={atoms,bonds:g.bonds.filter(b=>!remove.has(b.a)&&!remove.has(b.b)).map(b=>({...b,a:mapping[b.a],b:mapping[b.b]}))};
for(const a of g.atoms){if(!(a.e in REFERENCE.exact)||a.q||a.iso)throw Error('Custom 仅覆盖中性 CHNOPS/F、无 isotope scaffold');}if(!connected(g))throw Error('Custom scaffold 必须连通');const adjacency=g.atoms.map(()=>[]);for(const b of g.bonds){adjacency[b.a].push(b);adjacency[b.b].push(b);}g.atoms.forEach((a,i)=>{let bs=adjacency[i],v=bs.reduce((s,b)=>s+b.o,0),target=({C:4,N:3,O:2,F:1,H:1,P:5,S:v>2?(v<=4?4:6):2})[a.e];if(v>target||(a.e==='P'&&v!==5)||(a.e==='S'&&![0,1,2,4,6].includes(v)))throw Error('不支持或存在歧义的价态；Custom P 仅覆盖五价 P，S 仅覆盖常规 2/4/6 价');a.h=a.e==='H'?0:target-v;});for(const v of Object.values(marks)){let i=mapping[v.attachment],bs=g.bonds.filter(b=>b.a===i||b.b===i);if(bs.length!==1||g.atoms[i].h!==1||g.atoms[bs[0].a===i?bs[0].b:bs[0].a].e!=='C')throw Error('attachment 必须为 alcohol OH');}normalizeCoordinates(g);return {graph:g,attachments:options.manualMarkers?{}:Object.fromEntries(Object.entries(marks).map(([k,v])=>[k,mapping[v.attachment]])),formula:formula(graphFormula(g)),...masses(graphFormula(g)),assembly_supported:!!(marks[5]||marks[3])};}

function selectAttachments(imported,five,three){
 const g=clone(imported.graph),value=x=>x===null||x===undefined||x===''?null:Number(x);five=value(five);three=value(three);
 if(five===null&&three===null)throw Error('Select at least one directional OH attachment');
 if(five!==null&&five===three)throw Error('Select distinct OH attachments');
 for(const i of [five,three].filter(x=>x!==null)){const a=g.atoms[i],bs=g.bonds.filter(b=>b.a===i||b.b===i);if(!Number.isInteger(i)||!a||a.e!=='O'||a.q||a.h!==1||bs.length!==1||bs[0].o!==1||g.atoms[bs[0].a===i?bs[0].b:bs[0].a].e!=='C')throw Error('Atom '+(i+1)+' must be a neutral alcohol OH (primary or secondary)');}
 return {...imported,graph:g,attachments:Object.fromEntries([[5,five],[3,three]].filter(([,v])=>v!==null)),assembly_supported:true};
}
function normalizeCoordinates(g){
 if(g.atoms.some(a=>!Number.isFinite(a.x)||!Number.isFinite(a.y)))throw Error('Invalid nonfinite coordinates');
 const lengths=g.bonds.map(b=>Math.hypot(g.atoms[b.a].x-g.atoms[b.b].x,g.atoms[b.a].y-g.atoms[b.b].y)).filter(x=>x>0&&Number.isFinite(x)).sort((a,b)=>a-b),scale=lengths.length?1.5/lengths[Math.floor(lengths.length/2)]:1;
 const x=g.atoms[0].x,y=g.atoms[0].y;
 for(const a of g.atoms){a.x=(a.x-x)*scale;a.y=(a.y-y)*scale;if(!Number.isFinite(a.x)||!Number.isFinite(a.y))throw Error('Coordinates exceed numeric precision');}
 return g;
}
function registerCustom(name,imported){
 if(!/^[A-Za-z][A-Za-z0-9_]{0,23}$/.test(name))throw Error('名称使用 1–24 位英文字母、数字、下划线，以字母开头');
 if(REFERENCE.templates['{'+name+'}'])throw Error('Reserved built-in chemistry ID: '+name);
 const r=selectAttachments(imported,imported.attachments[5],imported.attachments[3]),g=normalizeCoordinates(r.graph),five=r.attachments[5]??null,three=r.attachments[3]??null;
 const A=g.atoms[five??three],B=g.atoms[three??five],dx=B.x-A.x,dy=B.y-A.y,L=Math.hypot(dx,dy),ax=A.x,ay=A.y;
 // Translation, positive uniform scale and rotation preserve stereochemical handedness.
 for(const a of g.atoms){const x=a.x-ax,y=a.y-ay;a.x=L?(x*dy-y*dx)/L:x;a.y=L?(x*dx+y*dy)/L:y;}
 g.layout_metadata={expanded:extent(g.atoms.map(a=>a.x),'max')-extent(g.atoms.map(a=>a.x),'min')>14};g.schema_version='building-block/2';g.id='{'+name+'}';g.family='Custom';g.assembly_class='o-phosphorus';g.o5=five;g.o3=three;g.attachments={};
 for(const [direction,atom]of [['upstream',five],['downstream',three]])if(atom!==null){const bs=g.bonds.filter(b=>b.a===atom||b.b===atom);g.attachments[direction]={atom,atom_role:'user-selected-OH',direction,element:g.atoms[atom].e,connection_class:'alcohol',local_bonds:bs.map(b=>({atom:b.a===atom?b.b:b.a,order:b.o})),allowed_linkage_classes:[...PHOSPHORUS_CLASSES],internal_phosphorus:[...PHOSPHORUS_CLASSES],terminal_phosphorus:[...PHOSPHORUS_CLASSES]};}
 g.phosphorus_topology='standard-5-to-3';
 if(imported.extinction){if(!validExtinction(imported.extinction))throw Error('Invalid extinction metadata');g.extinction=clone(imported.extinction);}
 customLibrary[g.id]=clone(g);return clone(g);
}
function inferHydrogens(g){
 for(let i=0;i<g.atoms.length;i++){let a=g.atoms[i],v=g.bonds.filter(b=>b.a===i||b.b===i).reduce((s,b)=>s+b.o,0),target={C:4,N:3,O:2,F:1,S:2,H:1}[a.e];
 if(target===undefined||v>target)throw Error('SMILES 子集不覆盖此元素/价态');a.h=a.e==='H'?0:target-v;}
 if(!connected(g))throw Error('只接受单个连通 molecule');
 return {graph:g,attachments:{},formula:formula(graphFormula(g)),...masses(graphFormula(g)),assembly_supported:false};
}
function parseSmiles(text){
 const src=text.trim();if(!src)throw Error('请输入 SMILES');
 // Fail closed: this is a deliberately small, explicit acyclic neutral subset.
 if(/[^CONSFH()=\-#]/.test(src))throw Error('SMILES 当前仅支持中性、非环、非芳香 C/N/O/S/F/H，单/双/三键及分支；不支持环号、芳香小写、[]、电荷、同位素、@、点分隔。复杂结构请用 Kekulé MOL/SDF。');
 let g={atoms:[],bonds:[]},stack=[],prev=-1,order=1,expect=true;
 for(let k=0;k<src.length;k++){let c=src[k];if('CONSFH'.includes(c)){
 let i=g.atoms.length;g.atoms.push({e:c,q:0,h:0,x:i*1.5,y:0});if(prev>=0)g.bonds.push({a:prev,b:i,o:order,s:0});prev=i;order=1;expect=false;
 }else if('=-#'.includes(c)){if(expect&&src[k-1]!=='(')throw Error('SMILES 键的位置无效');order=c==='='?2:c==='#'?3:1;expect=true;}
 else if(c==='('){if(expect)throw Error('SMILES 分支位置无效');stack.push(prev);expect=true;}
 else if(c===')'){if(expect||!stack.length)throw Error('SMILES 分支不匹配');prev=stack.pop();expect=false;}}
 if(expect||stack.length)throw Error('SMILES 未完成');
 // Deterministic tree layout; this subset does not promise ChemDraw-quality arbitrary scaffolds.
 let children=g.atoms.map(()=>[]);for(const b of g.bonds)children[b.a].push(b.b);
 let leaf=0;function place(i,depth){let ch=children[i];if(!ch.length){g.atoms[i].y=leaf++*2;}else{ch.forEach(j=>place(j,depth+1));g.atoms[i].y=ch.reduce((s,j)=>s+g.atoms[j].y,0)/ch.length;}g.atoms[i].x=depth*1.5;}place(0,0);
 return inferHydrogens(g);
}
function quality(g){
 const atoms=g.atoms,pt=i=>[atoms[i].x,atoms[i].y],dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
 function clearance(q,a,b){let dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((q[0]-a[0])*dx+(q[1]-a[1])*dy)/Math.max(1e-12,dx*dx+dy*dy)));return dist(q,[a[0]+t*dx,a[1]+t*dy]);}
 function orient(a,b,c){return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);}
 const cross=(a,b,c,d)=>orient(a,b,c)*orient(a,b,d)<-1e-8&&orient(c,d,a)*orient(c,d,b)<-1e-8;
 let out={intentional_bridge_crossings:[],atom_overlaps:[],atom_bond_overlaps:[],bond_crossings:[],connector_collisions:[],label_overlaps:[],label_bond_overlaps:[],long_bonds:[],column_top_errors:[],min_nonbonded_distance:Infinity};
 let bonded=new Set(g.bonds.map(b=>[b.a,b.b].sort((a,b)=>a-b).join(','))),segments=[];
 for(let i=0;i<atoms.length;i++)for(let j=i+1;j<atoms.length;j++)if(!bonded.has(i+','+j)){let d=dist(pt(i),pt(j));out.min_nonbonded_distance=Math.min(out.min_nonbonded_distance,d);if(d<.65)out.atom_overlaps.push([i,j]);}
 g.bonds.forEach((b,i)=>{let r=(g.routes||[]).find(r=>r.bond===i),p=r?r.points:[pt(b.a),pt(b.b)];for(let k=1;k<p.length;k++)segments.push({a:p[k-1],b:p[k],ends:[b.a,b.b],bond:i,route:!!r});});
 for(let i=0;i<segments.length;i++){let s=segments[i];for(let j=0;j<atoms.length;j++)if(!s.ends.includes(j)&&clearance(pt(j),s.a,s.b)<(s.route?.4:.22))out[s.route?'connector_collisions':'atom_bond_overlaps'].push([j,s.bond]);
 for(let j=i+1;j<segments.length;j++){let t=segments[j];if(s.bond!==t.bond&&!s.ends.some(i=>t.ends.includes(i))&&cross(s.a,s.b,t.a,t.b)){const intentional=(g.depiction_overpasses||[]).some(v=>v.front===s.bond&&v.back===t.bond||v.back===s.bond&&v.front===t.bond);out[intentional?'intentional_bridge_crossings':'bond_crossings'].push([s.bond,t.bond]);}}}
 const labels=atoms.map((a,i)=>({i,x:a.x+(a.h?.16:0),y:a.y,w:(a.e.length+(a.h?1:0)+(a.h>1?1:0)+(a.q?1:0))*.27+.10,h:.58})).filter(v=>atoms[v.i].e!=='C');
 for(let i=0;i<labels.length;i++)for(let j=i+1;j<labels.length;j++){const a=labels[i],b=labels[j];if(Math.abs(a.x-b.x)<(a.w+b.w)/2&&Math.abs(a.y-b.y)<(a.h+b.h)/2)out.label_overlaps.push([a.i,b.i]);}
 const intersects=(s,l)=>{let lo=0,hi=1;for(const [start,delta,min,max]of [[s.a[0],s.b[0]-s.a[0],l.x-l.w/2,l.x+l.w/2],[s.a[1],s.b[1]-s.a[1],l.y-l.h/2,l.y+l.h/2]]){if(Math.abs(delta)<1e-12){if(start<min||start>max)return false;}else{const t1=(min-start)/delta,t2=(max-start)/delta;lo=Math.max(lo,Math.min(t1,t2));hi=Math.min(hi,Math.max(t1,t2));if(lo>hi)return false;}}return true;};
 for(const seg of segments)for(const label of labels)if(!seg.ends.includes(label.i)&&intersects(seg,label))out.label_bond_overlaps.push([label.i,seg.bond]);
 g.bonds.forEach((b,i)=>{const d=dist(pt(b.a),pt(b.b));if(d>6&&!(g.routes||[]).some(r=>r.bond===i))out.long_bonds.push({bond:i,length:d});});
 out.pass=['atom_overlaps','atom_bond_overlaps','bond_crossings','connector_collisions','label_overlaps','label_bond_overlaps','long_bonds','column_top_errors'].every(k=>!out[k].length);
 if(g.sites)g.sites.forEach((s,i)=>{if(i%10===0&&Math.abs(atoms[s.o5].y)>1e-7)out.column_top_errors.push(i);});out.pass=out.pass&&!out.column_top_errors.length;return out;
}
function calculateSafe(sequence){try{return calculate(sequence);}catch(e){return {schema_version:'oligo-lite/1.2',input_sequence:sequence,canonical_sequence:null,status:'error',errors:[{code:e.message.match(/^([A-Z_]+):/)?.[1]||(e.message.includes('not found')?'UNKNOWN_UNIT':'INVALID_CHEMISTRY_OR_NOTATION'),message:e.message}],chemistry:null,optical:null,graph:null};}}
function buildStructure(sequence){return calculate(sequence).graph;}
return {getBuildingBlock:code=>template(code)?clone(template(code)):null,attachment,normalizeCoordinates,parse,validateChemistry,calculate,calculateSafe,buildStructure,formula,graphFormula,connected,mol,svg,cdxml,parseMol,parseSmiles,selectAttachments,registerCustom,customLibrary,quality};})();
if(typeof module!=='undefined')module.exports=Lite;



