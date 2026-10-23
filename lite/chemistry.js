'use strict';
const Lite = (()=>{
const clone=x=>JSON.parse(JSON.stringify(x));
const customLibrary=Object.create(null);
const template=code=>customLibrary[code]||REFERENCE.templates[code];
function parse(input){
 if(typeof input!=='string')throw Error('Sequence must be a string');
 let seq=input.trim(),terminal={five:0,three:0};if(!seq)throw Error('请输入 sequence');
 const leading=seq.match(/^\((p{1,3})\)/i);if(leading){terminal.five=leading[1].length;seq=seq.slice(leading[0].length);}
 const trailing=seq.match(/\((p{1,3})\)$/i);if(trailing){terminal.three=trailing[1].length;seq=seq.slice(0,-trailing[0].length);}
 if(!seq)throw Error('Terminal chemistry requires a structural unit');
 let pos=0,residues=[],links=[];
 while(pos<seq.length){let code;
 if(seq[pos]==='['||seq[pos]==='{'){let close=seq[pos]==='['?']':'}',end=seq.indexOf(close,pos);if(end<0)throw Error('Missing '+close);let id=seq.slice(pos+1,end);if(!/^[A-Za-z][A-Za-z0-9_]{0,23}$/.test(id))throw Error('Invalid custom unit ID: '+id);code='{'+id+'}';if(!customLibrary[code])throw Error('['+id+'] not found in Custom Chemistry Library');pos=end+1;}
 else if('ACGT'.includes(seq[pos]))code='d'+seq[pos++];
 else{code=Object.keys(REFERENCE.templates).sort((a,b)=>b.length-a.length).find(c=>seq.startsWith(c,pos));if(!code)throw Error('Unsupported notation at '+(pos+1)+': '+seq.slice(pos)+'; terminal chemistry supports (p), (pp), (ppp) only at sequence ends');pos+=code.length;}
 residues.push(code);if(pos<seq.length){let link='PO';if(seq.startsWith('**',pos)){link='PS2';pos+=2;}else if(seq[pos]==='*'){link='PS';pos++;}else if(seq[pos]==='&'){link='MsPA';pos++;}links.push(link);if(pos===seq.length)throw Error('末尾不能是 linkage');}}
 if(residues.length>60)throw Error('Lite limit: 60 structural units');
 const symbols={PO:'',PS:'*',PS2:'**',MsPA:'&'};
 let canonical=(terminal.five?'('+'p'.repeat(terminal.five)+')':'')+residues.map((r,i)=>(r[0]==='{'?'['+r.slice(1,-1)+']':r)+(symbols[links[i]]||'')).join('')+(terminal.three?'('+'p'.repeat(terminal.three)+')':'');
 return {residues,links,terminal,canonical};
}
function formulaObj(s){let f={};for(const m of s.matchAll(/([A-Z][a-z]?)(\d*)/g))f[m[1]]=(f[m[1]]||0)+Number(m[2]||1);return f;}
function add(f,g,k=1){for(const [e,n]of Object.entries(g))f[e]=(f[e]||0)+n*k;return f;}
function formula(f){return ['C','H','N','O','P','S','F',...Object.keys(f).filter(e=>!'CHNOPS'.includes(e)&&e!=='F').sort()].filter(e=>f[e]>0).map(e=>e+(f[e]===1?'':f[e])).join('');}
function masses(f){let exact=0,avg=0;for(const [e,n]of Object.entries(f)){if(!(e in REFERENCE.exact))throw Error('质量表未覆盖元素 '+e);exact+=REFERENCE.exact[e]*n;avg+=REFERENCE.average[e]*n;}return {exact_mass:exact,average_mw:avg};}
function composition(p){let f={};for(const r of p.residues){if(customLibrary[r]){add(f,graphFormula(customLibrary[r]));continue;}add(f,formulaObj(REFERENCE.bases[r[1]].formula));add(f,formulaObj(REFERENCE.sugars[r[0]].formula));add(f,{H:2,O:1},-1);}for(const l of p.links){let r=REFERENCE.linkRules[l];add(f,formulaObj(r.formula_add));add(f,formulaObj(r.formula_remove),-1);}for(const n of Object.values(p.terminal||{}))add(f,{H:n,P:n,O:3*n});return f;}
function od(p,mw){if(p.residues.some(r=>customLibrary[r]))return {supported:false,reason:'Custom monomer 未提供 extinction coefficient，OD260 不计算'};let bases=p.residues.map(r=>r[1]);if(bases.includes('I'))return {supported:false,reason:'参考规则尚不支持 inosine OD260'};let dna=p.residues.every(r=>r[0]==='d');let mono=dna?REFERENCE.dnaMono:REFERENCE.rnaMono,nn=dna?REFERENCE.dnaNN:REFERENCE.rnaNN;let estimated=!dna&&p.residues.some(r=>r[0]!=='r'||r[1]==='T');if(!dna)bases=bases.map(b=>b==='T'?'U':b);let eps=bases.length===1?mono[bases[0]]:bases.slice(1).reduce((s,b,i)=>s+nn[bases[i]+b],0)-bases.slice(1,-1).reduce((s,b)=>s+mono[b],0);return {supported:true,epsilon260:eps,epsilon_unit:'L mol−1 cm−1',estimated,method:dna?'DNA nearest-neighbor':'RNA nearest-neighbor (base-preserving estimate for modified/mixed sugars)',nmol_per_od:1e6/eps,ug_per_od:1000*mw/eps,od_per_umol:eps/1000,provenance:'public_release/oligo-chemistry-toolkit/photometry.py; 1 OD = A260 1 in 1 mL, 1 cm path length; backbone optical effects not separately modeled'};}
function graphFormula(g){let f={};for(const a of g.atoms){add(f,{[a.e]:1});if(a.e!=='H')add(f,{H:a.h||0});}return f;}
function connected(g){if(!g.atoms.length)return false;let seen=new Set([0]),stack=[0];while(stack.length){let i=stack.pop();for(const b of g.bonds){let n=b.a===i?b.b:b.b===i?b.a:-1;if(n>=0&&!seen.has(n)){seen.add(n);stack.push(n);}}}return seen.size===g.atoms.length;}
function assemble(p){
 let g={atoms:[],bonds:[],routes:[]},sites=[];
 // Frozen coordinates: no column-dependent rotation, reflection or terminal transform.
 let width=Math.max(24,...p.residues.map(r=>{let t=template(r);return Math.max(...t.atoms.map(a=>a.x))-Math.min(...t.atoms.map(a=>a.x))+14;}));
 let pitch=Math.max(11,...p.residues.map(r=>{let t=template(r);return Math.max(...t.atoms.map(a=>a.y))-Math.min(...t.atoms.map(a=>a.y))+4.5;}));
 for(let i=0;i<p.residues.length;i++){let t=clone(template(p.residues[i])),o=g.atoms.length;
 for(const v of t.atoms){v.x+=Math.floor(i/10)*width;v.y+=(i%10)*pitch;}
 g.atoms.push(...t.atoms);g.bonds.push(...t.bonds.map(b=>({...b,a:b.a+o,b:b.b+o})));sites.push({o5:o+t.o5,o3:o+t.o3});}
 for(let i=0;i<p.links.length;i++){
 let code=p.links[i],t=clone(REFERENCE.links[code]),a=sites[i].o3,b=sites[i+1].o5,offset=g.atoms.length,A=g.atoms[a],B=g.atoms[b],boundary=(i+1)%10===0;
 let x=A.x,y=(A.y+(boundary?A.y+pitch-3.8:B.y))/2;
 const nb=j=>t.bonds.filter(b=>b.a===j||b.b===j).map(b=>({i:b.a===j?b.b:b.a,o:b.o}));
 let roles={p:t.p},pts={p:[x,y]};
 if(code==='MsPA'){
 roles.n=nb(t.p).find(v=>t.atoms[v.i].e==='N').i;roles.o=nb(t.p).find(v=>t.atoms[v.i].e==='O').i;
 roles.s=nb(roles.n).find(v=>t.atoms[v.i].e==='S').i;
 let os=nb(roles.s).filter(v=>t.atoms[v.i].e==='O');roles.so1=os[0].i;roles.so2=os[1].i;roles.me=nb(roles.s).find(v=>t.atoms[v.i].e==='C').i;
 Object.assign(pts,{o:[x+1.7,y],n:[x-1.7,y],s:[x-3.2,y],so1:[x-3.2,y-1.45],so2:[x-3.2,y+1.45],me:[x-5.05,y]});
 }else{roles.double=nb(t.p).find(v=>v.o===2).i;roles.single=nb(t.p).find(v=>v.o===1).i;pts.double=[x-1.7,y];pts.single=[x+1.7,y];}
 for(const [role,j]of Object.entries(roles)){t.atoms[j].x=pts[role][0];t.atoms[j].y=pts[role][1];}
 g.atoms.push(...t.atoms);g.bonds.push(...t.bonds.map(v=>({...v,a:v.a+offset,b:v.b+offset,s:0})),{a,b:offset+t.p,o:1,s:0},{a:offset+t.p,b,o:1,s:0});
 if(boundary){let P=g.atoms[offset+t.p],gutter=B.x-8,top=-5;
 // Escape downward below the final linkage before entering the empty gutter.
 g.routes.push({bond:g.bonds.length-1,boundary:i+1,atoms:[offset+t.p,b],points:[[P.x,P.y],[P.x,P.y+3],[gutter,P.y+3],[gutter,top],[B.x,top],[B.x,B.y]]});}
 A.h--;B.h--;}
 for(const [side,count]of Object.entries(p.terminal||{})){
 if(!count)continue;let anchor=side==='five'?sites[0].o5:sites[sites.length-1].o3,sign=side==='five'?-1:1;
 g.atoms[anchor].h--;let previous=anchor,origin=g.atoms[anchor];
 for(let k=0;k<count;k++){
 let x=origin.x,y=origin.y+sign*(3+4*k),pi=g.atoms.length;
 g.atoms.push({e:'P',h:0,x,y},{e:'O',h:0,x:x-1.6,y},{e:'O',h:1,x:x+1.6,y},{e:'O',h:k===count-1?1:0,x,y:y+sign*1.5});
 g.bonds.push({a:previous,b:pi,o:1,s:0},{a:pi,b:pi+1,o:2,s:0},{a:pi,b:pi+2,o:1,s:0},{a:pi,b:pi+3,o:1,s:0});previous=pi+3;
 }
 }
 g.sites=sites;g.layout={column_pitch:width,residue_pitch:pitch,rows:10};return g;
}
function calculate(seq){let p=parse(seq),g=assemble(p),f=graphFormula(g),m=masses(f);if(formula(f)!==formula(composition(p))||!connected(g))throw Error('内部 graph/composition 验证失败');return {schema_version:'oligo-lite/1.1',status:'ok',errors:[],input_sequence:seq,canonical_sequence:p.canonical,sequence:p.canonical,residues:p.residues,linkages:p.links,modifications:p.terminal,notation:p,chemistry:{formula:formula(f),formula_dict:f,...m,charge_model:'neutral free acid; terminal OH or specified phosphate',phosphorus_stereochemistry:'unspecified'},optical:od(p,m.average_mw),graph:g,provenance:{reference:REFERENCE.source,monomers:'versioned atomic library',mspa:p.links.includes('MsPA')?'reference legacy tautomer P(OH)=N-SO2Me; chemistry review required':null},limitations:['Terminal chemistry: neutral P/PP/PPP only; no salts, LNA/UNA','MOL/SDF preserve graph and atom coordinates; routed paths are SVG/JSON display metadata only']};}
const pad=(v,n)=>String(v).padStart(n,' ');
function mol(g,title='Oligo Lite'){if(g.atoms.length>999||g.bonds.length>999)throw Error('V2000 999 atoms/bonds 上限；请缩短 sequence');let s=[title.replace(/[\r\n]/g,' '),'  OligoLite  2D','',pad(g.atoms.length,3)+pad(g.bonds.length,3)+'  0  0  0  0            999 V2000'];g.atoms.forEach(a=>s.push(pad(a.x.toFixed(4),10)+pad((-a.y).toFixed(4),10)+pad('0.0000',10)+' '+a.e.padEnd(3)+' 0  0  0  0  0  0  0  0  0  0  0  0'));g.bonds.forEach(b=>s.push(pad(b.a+1,3)+pad(b.b+1,3)+pad(b.o,3)+pad(b.s||0,3)+'  0  0  0'));for(let i=0;i<g.atoms.length;i++){let a=g.atoms[i];if(a.q)s.push('M  CHG  1'+pad(i+1,4)+pad(a.q,4));if(a.iso)s.push('M  ISO  1'+pad(i+1,4)+pad(a.iso,4));}return s.join('\n')+'\nM  END\n';}
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
function svg(g){let points=(g.routes||[]).flatMap(r=>r.points),xs=[...g.atoms.map(a=>a.x),...points.map(p=>p[0])],ys=[...g.atoms.map(a=>a.y),...points.map(p=>p[1])],minx=Math.min(...xs)-2,miny=Math.min(...ys)-2,w=Math.max(...xs)-minx+2,h=Math.max(...ys)-miny+2;let s=[`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minx} ${miny} ${w} ${h}" width="${Math.ceil(w*23)}" height="${Math.ceil(h*23)}"><rect x="${minx}" y="${miny}" width="${w}" height="${h}" fill="white"/><g stroke="#27374a" stroke-width=".055" stroke-linecap="round">`];for(const [bi,b] of g.bonds.entries()){let route=(g.routes||[]).find(r=>r.bond===bi);if(route){s.push(`<path data-boundary="${route.boundary}" d="${route.points.map((p,i)=>(i?'L':'M')+p.join(' ')).join(' ')}" fill="none"/>`);continue;}let a=g.atoms[b.a],z=g.atoms[b.b],dx=z.x-a.x,dy=z.y-a.y,L=Math.hypot(dx,dy),nx=-dy/L,ny=dx/L;if(b.s===1){s.push(`<path d="M${a.x} ${a.y} L${z.x+nx*.14} ${z.y+ny*.14} L${z.x-nx*.14} ${z.y-ny*.14}Z" fill="#27374a"/>`);}else if(b.s===6){for(let k=1;k<=7;k++){let t=k/8,r=t*.14;s.push(`<path d="M${a.x+dx*t+nx*r} ${a.y+dy*t+ny*r} l${-2*nx*r} ${-2*ny*r}"/>`);}}else{for(let j=0;j<b.o;j++){let d=(j-(b.o-1)/2)*.16;s.push(`<path d="M${a.x+nx*d} ${a.y+ny*d} L${z.x+nx*d} ${z.y+ny*d}"/>`);}}}s.push('</g><g font-family="Arial,sans-serif" font-size=".52" text-anchor="middle" dominant-baseline="central">');for(const a of g.atoms){if(a.e==='C'&&a.h!==3)continue;let label=a.e+(a.h?'H'+(a.h>1?a.h:''):'')+(a.q? (a.q>0?'+':'−'):'');s.push(`<text x="${a.x}" y="${a.y}" fill="${a.e==='O'?'#bb3339':a.e==='N'?'#2858ad':a.e==='S'?'#94701a':'#333'}" stroke="white" stroke-width=".17" paint-order="stroke">${esc(label)}</text>`);}s.push('</g>');if(g.sites)g.sites.forEach((v,i)=>{let a=g.atoms[v.o5];s.push(`<text x="${a.x-3}" y="${a.y}" font-family="Arial" font-size=".45" fill="#8794a5">${i+1}${i===0?' · 5′':''}${i===g.sites.length-1?' → 3′':''}</text>`);});return s.join('')+'</svg>';}
function cdxml(g){const nums={H:1,C:6,N:7,O:8,F:9,P:15,S:16};return `<?xml version="1.0"?><CDXML BondLength="30"><page id="1"><fragment id="2">`+g.atoms.map((a,i)=>`<n id="${i+10}" p="${(a.x+8)*20} ${(a.y+8)*20}" Element="${nums[a.e]}" NumHydrogens="${a.h||0}"${a.q?` Charge="${a.q}"`:''}/>`).join('')+g.bonds.map((b,i)=>`<b id="${g.atoms.length+10+i}" B="${b.a+10}" E="${b.b+10}" Order="${b.o}"${b.s?` Display="${b.s===1?'WedgeBegin':'WedgedHashBegin'}"`:''}/>`).join('')+'</fragment></page></CDXML>';}
function parseMol(text,options={}){let lines=text.replace(/\r/g,'').split('\n');if(!lines[3]?.includes('V2000'))throw Error('仅支持 MOL V2000；V3000 尚未迁移');let n=Number(lines[3].slice(0,3)),nb=Number(lines[3].slice(3,6));if(!n||n>999)throw Error('无效 atom count');let g={atoms:[],bonds:[]},aliases={};for(let i=0;i<n;i++){let l=lines[4+i],e=l.slice(31,34).trim();let qcode=Number(l.slice(36,39));if(!e||![Number(l.slice(0,10)),Number(l.slice(10,20))].every(Number.isFinite))throw Error('无效 atom line');g.atoms.push({e,x:Number(l.slice(0,10)),y:-Number(l.slice(10,20)),q:({1:3,2:2,3:1,5:-1,6:-2,7:-3})[qcode]||0,map:Number(l.slice(60,63)),h:0});if(Number(l.slice(34,36)))throw Error('暂不支持 atom-line isotope mass difference，请用 M ISO');if(Number(l.slice(39,42)))throw Error('暂不支持 atom parity，请导出 wedge bond stereo');if(!['*','R#','R','Du'].includes(e)&&(Number(l.slice(42,45))||Number(l.slice(48,51))))throw Error('暂不支持显式 H/valence override');}
for(let i=0;i<nb;i++){let l=lines[4+n+i],a=Number(l.slice(0,3))-1,b=Number(l.slice(3,6))-1,o=Number(l.slice(6,9)),s=Number(l.slice(9,12));if(a<0||b<0||a>=n||b>=n||a===b||![1,2,3].includes(o)||![0,1,6].includes(s))throw Error('仅支持 single/double/triple 与 wedge/hash；芳香键请导出 Kekulé');if(g.bonds.some(v=>(v.a===a&&v.b===b)||(v.a===b&&v.b===a)))throw Error('重复 bond');g.bonds.push({a,b,o,s});}
for(let i=4+n+nb;i<lines.length;i++){let l=lines[i];if(l.startsWith('M  END'))break;if(l.startsWith('M  RGP')){let t=l.trim().split(/\s+/);for(let j=0;j<Number(t[2]);j++)aliases[Number(t[3+2*j])-1]='R'+t[4+2*j];}else if(l.startsWith('A  ')){aliases[Number(l.slice(3))-1]=(lines[++i]||'').replace(/[′']/g,'').trim();}else if(/^M  (CHG|ISO)/.test(l)){let t=l.trim().split(/\s+/),key=t[1]==='CHG'?'q':'iso';for(let j=0;j<Number(t[2]);j++){let a=g.atoms[Number(t[3+j*2])-1];if(!a)throw Error('M property atom 越界');a[key]=Number(t[4+j*2]);}}else if(l.startsWith('M  ')&&!l.startsWith('M  END'))throw Error('未覆盖的 MOL 属性：'+l.slice(0,6));}
let marks={};g.atoms.forEach((a,i)=>{if(!['*','R#','R','Du','5','3','R1','R2','R3'].includes(a.e))return;if(options.manualMarkers){let bs=g.bonds.filter(b=>b.a===i||b.b===i);if(bs.length!==1||bs[0].o!==1)throw Error('手动模式也仅允许单键 terminal marker');let j=bs[0].a===i?bs[0].b:bs[0].a;if(g.atoms[j].e!=='O'||g.atoms[j].q)throw Error('手动模式的 marker 仍必须连接真实中性 O');marks['manual'+i]={marker:i,attachment:j};return;}let labels=[aliases[i],a.e,a.map,a.iso].map(String);let v=labels.find(x=>x==='3'||x==='5');let candidates=new Set(labels.flatMap(x=>x==='5'||x==='R1'?['5']:x==='3'||x==='R2'?['3']:[]));if(candidates.size>1)throw Error('同一 marker 的 5′/3′ 标记冲突');if(!v){if(labels.includes('R1'))v='5';else if(labels.includes('R2'))v='3';}if(!v)throw Error('未分配的 general/R3 marker；仅 5/3 或 R1→5′、R2→3′ 可作为两端，其他 marker 请在原绘图中明确处理');let neighbors=g.bonds.filter(b=>b.a===i||b.b===i);if(marks[v]!==undefined||neighbors.length!==1||neighbors[0].o!==1)throw Error('marker 必须唯一且只有一个 single bond');let b=neighbors[0],j=b.a===i?b.b:b.a;if(g.atoms[j].e!=='O'||g.atoms[j].q)throw Error('marker 必须连接真实中性 O');marks[v]={marker:i,attachment:j};});if(!options.manualMarkers&&Object.keys(marks).length&&(!marks[3]||!marks[5]||marks[3].attachment===marks[5].attachment))throw Error('需要不同的 5′/3′ attachment O');let remove=new Set(Object.values(marks).map(v=>v.marker)),mapping={},atoms=[];g.atoms.forEach((a,i)=>{if(!remove.has(i)){mapping[i]=atoms.length;atoms.push(a);}});g={atoms,bonds:g.bonds.filter(b=>!remove.has(b.a)&&!remove.has(b.b)).map(b=>({...b,a:mapping[b.a],b:mapping[b.b]}))};
for(const a of g.atoms){if(!(a.e in REFERENCE.exact)||a.q||a.iso)throw Error('Custom 仅覆盖中性 CHNOPS/F、无 isotope scaffold');}if(!connected(g))throw Error('Custom scaffold 必须连通');g.atoms.forEach((a,i)=>{let bs=g.bonds.filter(b=>b.a===i||b.b===i),v=bs.reduce((s,b)=>s+b.o,0),target=({C:4,N:3,O:2,F:1,H:1,P:5,S:v>2?(v<=4?4:6):2})[a.e];if(v>target||(a.e==='P'&&v!==5)||(a.e==='S'&&![0,1,2,4,6].includes(v)))throw Error('不支持或存在歧义的价态；Custom P 仅覆盖五价 P，S 仅覆盖常规 2/4/6 价');a.h=a.e==='H'?0:target-v;});for(const v of Object.values(marks)){let i=mapping[v.attachment],bs=g.bonds.filter(b=>b.a===i||b.b===i);if(bs.length!==1||g.atoms[i].h!==1||g.atoms[bs[0].a===i?bs[0].b:bs[0].a].e!=='C')throw Error('attachment 必须为 alcohol OH');}return {graph:g,attachments:options.manualMarkers?{}:Object.fromEntries(Object.entries(marks).map(([k,v])=>[k,mapping[v.attachment]])),formula:formula(graphFormula(g)),...masses(graphFormula(g)),assembly_supported:!!(marks[5]&&marks[3])};}

function selectAttachments(imported,five,three){
 let g=clone(imported.graph);five=Number(five);three=Number(three);
 if(!Number.isInteger(five)||!Number.isInteger(three)||five===three)throw Error('请选择两个不同的 attachment O');
 for(const i of [five,three]){let a=g.atoms[i],bs=g.bonds.filter(b=>b.a===i||b.b===i);if(!a||a.e!=='O'||a.q||a.h!==1||bs.length!==1||bs[0].o!==1||g.atoms[bs[0].a===i?bs[0].b:bs[0].a].e!=='C')throw Error('Atom '+(i+1)+' 必须是中性 alcohol OH，且以单键连接 C');}
 return {...imported,graph:g,attachments:{5:five,3:three},assembly_supported:true};
}
function registerCustom(name,imported){
 if(!/^[A-Za-z][A-Za-z0-9_]{0,23}$/.test(name))throw Error('名称使用 1–24 位英文字母、数字、下划线，以字母开头');
 let r=selectAttachments(imported,imported.attachments[5],imported.attachments[3]),g=r.graph;
 let five=r.attachments[5],three=r.attachments[3],A=g.atoms[five],B=g.atoms[three],dx=B.x-A.x,dy=B.y-A.y,L=Math.hypot(dx,dy);
 if(L<.01)throw Error('两端坐标重叠，请在 MOL 中整理坐标');
 let ax=A.x,ay=A.y;
 // One documented rigid rotation at import, never reflection/scaling. Wedges retain handedness.
 for(const a of g.atoms){let x=a.x-ax,y=a.y-ay;a.x=(x*dy-y*dx)/L;a.y=(x*dx+y*dy)/L;}
 g.o5=five;g.o3=three;customLibrary['{'+name+'}']=clone(g);return clone(g);
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
 let out={atom_overlaps:[],atom_bond_overlaps:[],bond_crossings:[],connector_collisions:[],column_top_errors:[],min_nonbonded_distance:Infinity};
 let bonded=new Set(g.bonds.map(b=>[b.a,b.b].sort((a,b)=>a-b).join(','))),segments=[];
 for(let i=0;i<atoms.length;i++)for(let j=i+1;j<atoms.length;j++)if(!bonded.has(i+','+j)){let d=dist(pt(i),pt(j));out.min_nonbonded_distance=Math.min(out.min_nonbonded_distance,d);if(d<.65)out.atom_overlaps.push([i,j]);}
 g.bonds.forEach((b,i)=>{let r=(g.routes||[]).find(r=>r.bond===i),p=r?r.points:[pt(b.a),pt(b.b)];for(let k=1;k<p.length;k++)segments.push({a:p[k-1],b:p[k],ends:[b.a,b.b],bond:i,route:!!r});});
 for(let i=0;i<segments.length;i++){let s=segments[i];for(let j=0;j<atoms.length;j++)if(!s.ends.includes(j)&&clearance(pt(j),s.a,s.b)<(s.route?.4:.22))out[s.route?'connector_collisions':'atom_bond_overlaps'].push([j,s.bond]);
 for(let j=i+1;j<segments.length;j++){let t=segments[j];if(s.bond!==t.bond&&!s.ends.some(i=>t.ends.includes(i))&&cross(s.a,s.b,t.a,t.b))out.bond_crossings.push([s.bond,t.bond]);}}
 if(g.sites)g.sites.forEach((s,i)=>{if(i%10===0&&Math.abs(atoms[s.o5].y)>1e-7)out.column_top_errors.push(i);});return out;
}
function calculateSafe(sequence){try{return calculate(sequence);}catch(e){return {schema_version:'oligo-lite/1.1',input_sequence:sequence,canonical_sequence:null,status:'error',errors:[{code:e.message.includes('not found')?'UNKNOWN_UNIT':'INVALID_CHEMISTRY_OR_NOTATION',message:e.message}],chemistry:null,optical:null,graph:null};}}
function buildStructure(sequence){return calculate(sequence).graph;}
return {parse,calculate,calculateSafe,buildStructure,formula,graphFormula,connected,mol,svg,cdxml,parseMol,parseSmiles,selectAttachments,registerCustom,customLibrary,quality};})();
if(typeof module!=='undefined')module.exports=Lite;


