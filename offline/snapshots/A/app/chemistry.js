'use strict';
const TOOLKIT_VERSION='0.9.3';
// CTfile SGroup boundary. No expansion is guessed; graph reader remains authoritative.
// Display expansion state and labels do not establish graph completeness.
const CTFileSGroups=(()=>{
 const fail=(message,line,group,record)=>{throw Error('CHEMISTRY_UNSUPPORTED: UNSUPPORTED_SGROUP_SEMANTICS; line '+line+', SGroup '+(group?.id??'?')+' ('+(group?.type??'unknown')+'), '+record+': '+message+'. 请在 ChemDraw 中展开为完整、确定的 explicit structure 后导出；不要手工删除重复单元或连接定义。');};
 const integer=(v,line,g,code)=>{if(!/^\d+$/.test(String(v))||!Number.isSafeInteger(+v))fail('Invalid integer '+v,line,g,code);return +v;};
 function prepare(source){
  const lines=source.replace(/\r/g,'').split('\n'),v3=lines[3]?.includes('V3000'),groups=new Map(),raw=[],skip=new Set();let expected=0,atomIds=[],bondIds=[],bondEnds=new Map();
  const get=(id,line,code)=>{id=integer(id,line,null,code);const g=groups.get(id);if(!g)fail('Referenced group has no preceding type declaration',line,{id},code);return g;};
  const define=(id,type,line,code)=>{id=integer(id,line,null,code);if(!id||groups.has(id))fail('Duplicate/zero group identity',line,{id,type},code);const g={id,type:type.toUpperCase().slice(0,3),line,atoms:[],bonds:[],parentAtoms:[],fields:{},records:[],status:'preserved'};groups.set(id,g);return g;};
  const field=(g,k,v)=>{(g.fields[k]??=[]).push(v);};
  const remember=(g,line,code,text)=>{const r={line,record:code,text};g.records.push(r);raw.push(r);};
  const list=(values,line,g,code)=>{const n=integer(values.shift(),line,g,code);if(values.length!==n)fail('List count mismatch',line,g,code);return values.map(v=>integer(v,line,g,code));};
  if(!v3){
   const n=+lines[3]?.slice(0,3),nb=+lines[3]?.slice(3,6);atomIds=Array.from({length:n||0},(_,i)=>i+1);bondIds=Array.from({length:nb||0},(_,i)=>i+1);
   for(let j=0;j<nb;j++){const l=lines[4+n+j]||'';bondEnds.set(j+1,[+l.slice(0,3),+l.slice(3,6)]);}
   for(let i=4+n+nb;i<lines.length;i++){
    const l=lines[i];if(l==='M  END')break;if(l.startsWith('A  ')){i++;continue;}if(l.trim()&&!/^M  [A-Z]{3}\b/.test(l))fail('Unrecognized or malformed property record',i+1,null,l);const code=l.match(/^M  ([A-Z]{3})\b/)?.[1];if(!code?.startsWith('S'))continue;
    const t=l.slice(6).trim().split(/\s+/),line=i+1;skip.add(i);
    if(['STY','SLB','SST','SCN','SPL','SNC','SBT'].includes(code)){
     const count=integer(t.shift(),line,null,code);if(t.length!==count*2)fail('Pair count mismatch',line,null,code);
     for(let j=0;j<count;j++){const g=code==='STY'?define(t[j*2],t[j*2+1],line,code):get(t[j*2],line,code);if(code!=='STY')field(g,code,t[j*2+1]);remember(g,line,code,l);if(code==='SPL')g.parent=integer(t[j*2+1],line,g,code);}
    }else if(code==='SDS'){
     if(t.shift()!=='EXP')fail('Unknown expansion flag',line,null,code);for(const id of list(t,line,null,code)){const g=get(id,line,code);g.expanded=true;remember(g,line,code,l);}
    }else{
     const g=get(t.shift(),line,code);remember(g,line,code,l);
     if(['SAL','SBL','SPA'].includes(code)){const key={SAL:'atoms',SBL:'bonds',SPA:'parentAtoms'}[code];const values=list(t,line,g,code);g[key].push(...values);field(g,code,values);}
     else if(code==='SDT'){
      // CTfile 1999 pp. 2-16/17: columns 12-41 name, 42-43 type,
      // 44-63 units, 64-65 query type, 66 onward query operator.
      if(!/^M  SDT {1,3}\d{1,3} /.test(l)||!/^ *\d+ $/.test(l.slice(6,11)))fail('SDT requires a fixed-width group field',line,g,code);
      const payload=l.slice(11),description={name:payload.slice(0,30),type:payload.slice(30,32),units:payload.slice(32,52),queryType:payload.slice(52,54),queryOperator:payload.slice(54)};
      field(g,'SDT',payload);field(g,'SDT_FIELDS',description);
      for(const k of ['queryType','queryOperator'])if(description[k].trim())fail('Unsupported nonempty '+k+' '+JSON.stringify(description[k]),line,g,'SDT.'+k);
     }
     else if(['SMT','SDD','SCD','SED'].includes(code)){const text=t.join(' ');field(g,code,text);if(code==='SMT')g.label=text;}
     else if(code==='SDI'){const count=integer(t.shift(),line,g,code);if(count!==4||t.length!==count||!t.every(v=>Number.isFinite(+v)))fail('Invalid bracket coordinates',line,g,code);field(g,code,t.map(Number));}
     else if(['SBV','SAP','SCL'].includes(code))field(g,code,t.join(' '));
     else fail('Record requires an unimplemented semantic interpretation',line,g,code);
    }
   }
  }else{
   let buffer='',start=0,indices=[],mode='',seen=false,ended=false;
   for(let i=0;i<lines.length;i++){
    if(lines[i]==='M  END')break;if(/^M\s/.test(lines[i])&&!lines[i].startsWith('M  V30 '))fail('Unsupported or malformed V3000 M record',i+1,null,lines[i]);if(!lines[i].startsWith('M  V30 '))continue;let part=lines[i].slice(7);if(!buffer)start=i;indices.push(i);if(part.endsWith('-')){buffer+=part.slice(0,-1);continue;}const l=buffer+part,line=start+1;buffer='';const physical=indices;indices=[];
    if(l.startsWith('COUNTS ')){const t=l.split(/\s+/);expected=integer(t[3],line,null,'COUNTS');continue;}
    if(l==='BEGIN SGROUP'){if(seen)fail('Duplicate SGROUP section',line,null,'BEGIN SGROUP');seen=true;mode='sgroup';physical.forEach(v=>skip.add(v));continue;}
    if(l==='END SGROUP'){if(mode!=='sgroup')fail('Unexpected section end',line,null,l);ended=true;mode='';physical.forEach(v=>skip.add(v));continue;}
    if(mode==='sgroup'){
     physical.forEach(v=>skip.add(v));
     const tokens=l.match(/(?:[^\s"()]+|"(?:""|[^"\n])*"|\([^()]*\))+/g)||[];
     if(tokens.join(' ').replace(/\s+/g,'')!==l.replace(/\s+/g,''))fail('Malformed SGroup tokens',line,null,'SGROUP');
     const id=tokens.shift(),type=tokens.shift(),ext=tokens.shift();if(!type)fail('Missing type',line,null,'SGROUP');const g=define(id,type,line,'SGROUP');g.externalId=integer(ext,line,g,'SGROUP');remember(g,line,'SGROUP',physical.map(v=>lines[v]).join('\n'));
     for(const token of tokens){const m=token.match(/^([A-Z][A-Z_0-9]*)=(.*)$/s);if(!m)fail('Malformed property '+token,line,g,'SGROUP');const k=m[1],v=m[2];field(g,k,v);
      if(['ATOMS','XBONDS','CBONDS','PATOMS'].includes(k)){if(!v.startsWith('(')||!v.endsWith(')'))fail('Expected counted list',line,g,k);const values=list(v.slice(1,-1).trim().split(/\s+/),line,g,k);g[{ATOMS:'atoms',XBONDS:'bonds',CBONDS:'bonds',PATOMS:'parentAtoms'}[k]].push(...values);}
      else if(k==='PARENT')g.parent=integer(v,line,g,k);
      else if(k==='LABEL')g.label=v.replace(/^"|"$/g,'').replace(/""/g,'"');
      else if(k==='ESTATE'){if(!['E','C'].includes(v))fail('Unknown expansion state',line,g,k);g.expanded=v==='E';}
      else if(!['BRKXYZ','CSTATE','FIELDNAME','FIELDINFO','FIELDDISP','FIELDDATA','QUERYTYPE','QUERYOP','CLASS','SAP','NATREPLACE','SUBTYPE','MULT','CONNECT','COMPNO','XBHEAD','XBCORR','BRKTYP','MRV_FIELDDISP'].includes(k))fail('Unknown SGroup property',line,g,k);
     }
     continue;
    }
    if(l==='BEGIN ATOM'){mode='atom';continue;}if(l==='BEGIN BOND'){mode='bond';continue;}if(l.startsWith('END ')){mode='';continue;}
    const t=l.split(/\s+/);if(mode==='atom')atomIds.push(+t[0]);if(mode==='bond'){bondIds.push(+t[0]);bondEnds.set(+t[0],[+t[2],+t[3]]);}
   }
   if(buffer)fail('Truncated continuation',start+1,null,'V30');if(seen&&!ended||groups.size!==expected)fail('SGROUP block/count mismatch',4,null,'COUNTS');
  }
  const aset=new Set(atomIds),bset=new Set(bondIds);
  for(const g of groups.values()){
   for(const [key,set]of [['atoms',aset],['bonds',bset],['parentAtoms',aset]]){if(new Set(g[key]).size!==g[key].length)fail('Duplicate '+key,g.line,g,key);for(const id of g[key])if(!set.has(id))fail('Out-of-range '+key+' '+id,g.line,g,key);}
   if(g.parent&&!groups.has(g.parent))fail('Missing parent '+g.parent,g.line,g,'PARENT/SPL');const path=new Set([g.id]);let p=g.parent;while(p){if(path.has(p))fail('Cyclic hierarchy',g.line,g,'PARENT/SPL');path.add(p);p=groups.get(p)?.parent;}
   if(!['DAT','GEN','SUP'].includes(g.type))fail('This type does not define a supported, unambiguous finite molecule',g.line,g,'STY/SGROUP');
   if(g.type==='DAT'&&Object.entries(g.fields).some(([k,vs])=>['SDT','FIELDNAME'].includes(k)&&vs.some(v=>/QUERY|SMARTS|IMPLICIT|VALENCE|AROMATIC|MRV_/i.test(v))))fail('Data field may encode chemical/query semantics',g.line,g,'SDT/FIELDNAME');
   if((g.fields.SCD||g.fields.SED)&&!g.fields.SDT)fail('Data has no SDT field description',g.line,g,'SCD/SED');
   const semantic=['SCN','SST','SPA','SNC','SAP','SCL','CONNECT','SUBTYPE','MULT','COMPNO','PATOMS','XBHEAD','XBCORR','SAP','CLASS','NATREPLACE','QUERYTYPE','QUERYOP'];
   for(const k of semantic)if(g.fields[k]&&(!['QUERYTYPE','QUERYOP'].includes(k)||g.fields[k].some(v=>v.replace(/^"|"$/g,'').trim())))fail('Semantic property cannot safely be interpreted',g.records.find(r=>r.record===k)?.line||g.line,g,k);
   if(g.type==='SUP'){
    const label=(g.label||'').trim();
    if(/^(?:A|AH|Q|QH|X|XH|M|MH|R|R#|ALK|ALH|AOX|AOH|ARY|ARH|ACY|ACH|ABC|ABH|AHC|ALC|ALHC|AYL|AYH|CAL|CAH|CEL|CEH|CHC|CYC|CYH|HAR|HAH|HET|HEH|POL|POH|\*)$/i.test(label))fail('Generic/query label is not a concrete abbreviation',g.line,g,'SMT/LABEL');
    if(!g.atoms.length)fail('Abbreviation has no explicit member atoms',g.line,g,'SAL/ATOMS');
    const members=new Set(g.atoms),cross=[...bondEnds].filter(([,ends])=>members.has(ends[0])!==members.has(ends[1])).map(([id])=>id),internal=[...bondEnds].filter(([,ends])=>members.has(ends[0])&&members.has(ends[1]));
    if((g.fields.SBL||g.fields.XBONDS)&&(g.bonds.length!==cross.length||cross.some(id=>!g.bonds.includes(id))))fail('Crossing bond membership does not match explicit graph',g.line,g,'SBL/XBONDS');
    // SUP defines a display grouping over the atom/bond graph. Neither a
    // label nor ESTATE C/E can prove hidden/missing atoms. Pseudo/query atoms,
    // unsupported replacement/attachment semantics are rejected independently.
    g.derivedCrossingBonds=cross;g.internalBonds=internal.map(([id])=>id);g.status='preserved-explicit-superatom';g.disposition='PRESERVED';
   }else {g.status='preserved-non-graph-metadata';g.disposition='PRESERVED';}
  }
  const clean=lines.filter((_,i)=>!skip.has(i));if(v3&&groups.size){const i=clean.findIndex(l=>l.startsWith('M  V30 COUNTS '));clean[i]=clean[i].replace(/^(M  V30 COUNTS \d+ \d+) \d+/, '$1 0');}
  return {text:clean.join('\n'),metadata:groups.size?{schema_version:'ctfile-sgroups/1',graphDisposition:'SUPPORTED',graphBasis:'explicit atom/bond graph; labels do not certify completeness',format:v3?'V3000':'V2000',source,groups:[...groups.values()],rawRecords:raw,atomIds,bondIds,index_basis:'source IDs; sourceToGraph maps to saved graph indices',notice:'SGroup drawing coordinates remain in source space. Source is archival, not an export of an edited/assembled graph.'}:null};
 }
 return {prepare};
})();

const Lite = (()=>{
const clone=x=>JSON.parse(JSON.stringify(x));
const extent=(xs,mode)=>xs.reduce((v,x)=>mode==='min'?Math.min(v,x):Math.max(v,x),mode==='min'?Infinity:-Infinity);
const append=(a,b)=>{for(const x of b)a.push(x);};
const customLibrary=Object.create(null);
const customKey=code=>Object.keys(customLibrary).find(k=>k.toLowerCase()===code.toLowerCase());
const template=code=>customLibrary[customKey(code)]||REFERENCE.templates[code];
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
 if(seq[pos]==='['){let close=seq[pos]==='['?']':'}',end=seq.indexOf(close,pos);if(end<0)throw Error('SYNTAX_ERROR: Missing '+close);let id=seq.slice(pos+1,end);if(typeof CONJUGATION_POOL!=='undefined'&&CONJUGATION_POOL.some(e=>e.id===id))throw Error('CONJUGATION_REAGENT: ['+id+'] belongs to Conjugation Pool; sequence assembly is unavailable');if(!/^[A-Za-z0-9_][A-Za-z0-9_.-]{0,47}$/.test(id))throw Error('Invalid custom unit ID: '+id);const alias=COVERAGE.aliases?.['['+id+']'];if(alias)id=alias.slice(1,-1);code=customKey('{'+id+'}')||'{'+id+'}';if(!template(code)&&!COVERAGE.entries.some(e=>e.notation==='['+id+']'))throw Error('['+id+'] not found in Custom Chemistry Library');pos=end+1;}
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
const linkageDefinitions=ChemistryCore.linkageDefinitions(REFERENCE);
function toAssemblyGraph(p){return ChemistryCore.fromNotation(p,template,linkageDefinitions);}
function validateChemistry(p){
 const ag=toAssemblyGraph(p);p.links=ag.edges.map(e=>e.linkage);
 const topology=ag.nodes.map(n=>n.block.metadata.topology);
 if(p.links.includes('PMO'))p.topology='morpholine-phosphorodiamidate';
 else if(topology.every(t=>t===topology[0]))p.topology=topology[0];
 return ag;
}
// Metadata is resolved at BuildingBlock level, never inferred from mass.
function opticalProperty(code){
 const t=template(code),e=t?.optical;
 if(e)return e;
 if(customLibrary[code])return validExtinction(t.extinction)?{mode:'explicit',epsilon:t.extinction.contribution+(t.extinction.correction||0),source:t.extinction.source}:{mode:'unknown'};
 if(t?.base&&'ACGTUI'.includes(t.base)&&t.base.length===1)return {mode:'parent',parent:t.base,source:'library base identity'};
 if(['PEG4','spacer3','spacer9','spacer18'].some(x=>code==='['+x+']'||code==='{'+x+'}'))return {mode:'zero',source:'defined saturated aliphatic ether spacer; no conjugated chromophore'};
 return {mode:'unknown'};
}
function validOptical(e){return !!e&&(['unknown','zero'].includes(e.mode)||e.mode==='parent'&&'ACGTUI'.includes(e.parent)&&e.parent.length===1||e.mode==='explicit'&&Number.isFinite(e.epsilon)&&e.epsilon>=0)&& (e.mode==='unknown'||typeof e.source==='string'&&!!e.source.trim());}
function od(p,mw){
 const provenance={parameters:'reference-data.js; docs/PHOTOMETRY.md',mass_basis:'average_mw',convention:'1 OD260 = A260 1 in 1 mL at 1 cm',limitations:'single strand; folding, salt, pH and unparameterized junction effects are not modeled'};
 const properties=p.residues.map(code=>({code,...opticalProperty(code)}));
 const bases=properties.filter(e=>e.mode==='parent').map(e=>e.parent);
 const dna=p.residues.every(r=>r[0]==='d')&&!bases.includes('U');
 const exact=(dna||p.residues.every(r=>r[0]==='r'&&r[1]!=='T'))&&properties.every(e=>e.mode==='parent'&&e.parent!=='I')&&p.links.every(l=>l==='PO')&&!Object.values(p.terminal).some(Boolean);
 const mono=dna?REFERENCE.dnaMono:REFERENCE.rnaMono,nn=dna?REFERENCE.dnaNN:REFERENCE.rnaNN;
 let eps=0,segment=[],literature=false;
 function flush(){if(!segment.length)return;eps+=segment.length===1?mono[segment[0]]:segment.slice(1).reduce((v,b,i)=>v+nn[segment[i]+b],0)-segment.slice(1,-1).reduce((v,b)=>v+mono[b],0);segment=[];}
 const missing=[];
 for(const e of properties){if(e.mode==='parent'&&e.parent!=='I')segment.push(dna?e.parent:e.parent==='T'?'U':e.parent);else{flush();if(e.mode==='parent'&&e.parent==='I'){eps+=7145.35;literature=true;}else if(e.mode==='explicit')eps+=e.epsilon;else if(e.mode==='unknown')missing.push(e.code);}}
 flush();
 const method=missing.length?'Estimated (partial, unknown modifier excluded: '+missing.join(', ')+')':exact?'Exact NN':literature?'Estimated (literature inosine monomer + segmented NN)':properties.some(e=>e.mode==='explicit')?'Estimated (custom contribution + segmented NN)':'Estimated (parent chromophore; segmented NN)';
 const out=opticalResult(eps,mw,!exact,method,{...provenance,building_blocks:properties,inosine:literature?{epsilon260:7145.35,source:'https://academic.oup.com/view-large/119395286',note:'RNA nucleoside measurement; dI inherits chromophore; I junctions unparameterized'}:null});
 if(missing.length){out.missing_units=missing;out.partial=true;if(out.supported)out.status='PARTIAL';}
 if(!out.supported){out.status='NEEDS_PARAMETER';out.reason='Needs parameter: no positive modeled A260 contribution'+(missing.length?' ('+missing.join(', ')+')':'');}
 return out;
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
 const definition=linkageDefinitions[code];if(!definition)throw Error('CHEMISTRY_UNSUPPORTED: undefined linkage '+code);
 const t={...clone(definition.graph),p:definition.center};
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
function expandAssemblyGraph(input){
 const ag=ChemistryCore.validateAssembly(clone(input),linkageDefinitions);
 const ts=ag.nodes.map(n=>({...clone(n.block.graph),id:n.block.id,attachments:n.block.sites,layout_metadata:n.block.layout,depiction_overpasses:n.block.layout.depiction_overpasses,incoming_label:n.block.metadata.incoming_label,outgoing_label:n.block.metadata.outgoing_label}));
 if(ts.some(t=>t.atoms.some(a=>!Number.isFinite(a.x)||!Number.isFinite(a.y))))throw Error('CHEMISTRY_UNSUPPORTED: expansion layout requires finite atom coordinates');
 const p={residues:ag.nodes.map(n=>n.block.id),links:ag.edges.map(e=>e.linkage),terminal:{five:0,three:0},terminalChemistry:{five:'PO',three:'PO'}};
 for(const t of ag.terminations)if(t.kind==='linkage'){
  const side=t.at.node===ag.nodes[0].id&&t.at.site===(ag.nodes[0].orientation==='reverse'?'downstream':'upstream')?'five':t.at.node===ag.nodes[ag.nodes.length-1].id&&t.at.site===(ag.nodes[ag.nodes.length-1].orientation==='reverse'?'upstream':'downstream')?'three':null;
  if(!side)throw Error('CHEMISTRY_UNSUPPORTED: layout for branch termination unavailable');
  p.terminal[side]=t.linkages.length;p.terminalChemistry[side]=t.linkages[0];
 }
 const topologies=ag.nodes.map(n=>n.block.metadata.topology);
 p.topology=p.links.includes('PMO')?'morpholine-phosphorodiamidate':topologies.every(t=>t===topologies[0])?topologies[0]:undefined;

 let g={schema_version:'molecular-graph/1',atoms:[],bonds:[],routes:[],depiction_overpasses:[],provenance:{atoms:[],bonds:[]}},sites=[],expanded=[];
 const mark=(a,b,origin)=>{for(let j=a;j<g.atoms.length;j++)g.provenance.atoms[j]={...origin,local_atom:j-a};for(let j=b;j<g.bonds.length;j++)g.provenance.bonds[j]={...origin,local_bond:j-b};};
 const hasLarge=ts.some(t=>t.layout_metadata?.expanded),minLocalX=extent(ts.flatMap(t=>t.atoms.map(a=>a.x)),'min'),maxLocalX=extent(ts.flatMap(t=>t.atoms.map(a=>a.x)),'max'),minLocalY=extent(ts.flatMap(t=>t.atoms.map(a=>a.y)),'min');
 const origins=[];for(let i=0;i<ts.length;i++){if(i%10===0)origins[i]=0;else{const prev=ts[i-1],next=ts[i];origins[i]=origins[i-1]+Math.max(11,extent(prev.atoms.map(a=>a.y),'max')-extent(next.atoms.map(a=>a.y),'min')+4.5);}}
 // Frozen coordinates: no column-dependent rotation, reflection or terminal transform.
 let width=Math.max(30,...ts.map(t=>{return extent(t.atoms.map(a=>a.x),'max')-extent(t.atoms.map(a=>a.x),'min')+20;}));
 let pitch=Math.max(p.links.includes('PN(dmi)')?15:11,...ts.map(t=>{return extent(t.atoms.map(a=>a.y),'max')-extent(t.atoms.map(a=>a.y),'min')+4.5;}));
 if(hasLarge)width=maxLocalX-minLocalX+36;
 for(let i=0;i<p.residues.length;i++){let t=clone(ts[i]),o=g.atoms.length;
 for(const v of t.atoms){v.x+=Math.floor(i/10)*width;v.y+=hasLarge?origins[i]:(i%10)*pitch;}
 for(const v of t.depiction_overpasses||[])g.depiction_overpasses.push({...v,front:g.bonds.length+v.front,back:g.bonds.length+v.back});
 const bondStart=g.bonds.length;append(g.atoms,t.atoms);append(g.bonds,t.bonds.map(b=>({...b,a:b.a+o,b:b.b+o})));mark(o,bondStart,{kind:'building-block',node:ag.nodes[i].id,position:i+1,block:ag.nodes[i].block.id});const up=t.attachments?.upstream?.atom,down=t.attachments?.downstream?.atom;sites.push({offset:o,local_anchor_y:ts[i].atoms[up??down??0].y,o5:Number.isInteger(up)?o+up:null,o3:Number.isInteger(down)?o+down:null,terminalOnly:!Number.isInteger(up)||!Number.isInteger(down),incoming_label:t.incoming_label||'5′ side',outgoing_label:t.outgoing_label||'3′ side'});}
 for(let i=0;i<p.links.length;i++){
 const edge=ag.edges[i];let code=edge.linkage,t,a=sites[i].offset+ts[i].attachments[edge.source.site].atom,b=sites[i+1].offset+ts[i+1].attachments[edge.target.site].atom,offset=g.atoms.length,A=g.atoms[a],B=g.atoms[b],boundary=(i+1)%10===0;
 let x=A.x,y=(A.y+(boundary?A.y+(hasLarge?11:pitch)-3.8:B.y))/2;const largeLink=hasLarge&&(ts[i].layout_metadata?.expanded||ts[i+1].layout_metadata?.expanded);if(largeLink){x=Math.floor(i/10)*width+minLocalX-10;y=boundary?A.y+4:(A.y+B.y)/2;}
 t=phosphorusGeometry(code,x,y);
 const bondStart=g.bonds.length;append(g.atoms,t.atoms);g.bonds.push(...t.bonds.map(v=>({...v,a:v.a+offset,b:v.b+offset,s:0})),{a,b:offset+t.p,o:1,s:0},{a:offset+t.p,b,o:1,s:0});
 mark(offset,bondStart,{kind:'linkage',edge:edge.id,linkage:edge.linkage,source:edge.source,target:edge.target,positions:[i+1,i+2]});if(largeLink)expanded.push({bonds:[g.bonds.length-2,g.bonds.length-1],p:offset+t.p});
 if(boundary&&!largeLink){let P=g.atoms[offset+t.p],gutter=B.x+(hasLarge?minLocalX-17:-8),top=Math.min(-5,minLocalY-5);
 // Escape downward below the final linkage before entering the empty gutter.
 g.routes.push({bond:g.bonds.length-1,boundary:i+1,atoms:[offset+t.p,b],points:[[P.x,P.y],[P.x,P.y+3],[gutter,P.y+3],[gutter,top],[B.x,top],[B.x,B.y]]});}
 A.h--;B.h--;}
 for(const [side,count]of Object.entries(p.terminal||{})){
 if(!count)continue;const ri=side==='five'?0:p.residues.length-1,tpl=ts[ri],term=ag.terminations.find(t=>t.kind==='linkage'&&t.at.node===ag.nodes[ri].id&&t.at.site===(ag.nodes[ri].orientation==='reverse'?(side==='five'?'downstream':'upstream'):(side==='five'?'upstream':'downstream'))),local=tpl.attachments[term.at.site].atom;let anchor=sites[ri].offset+local,sign=side==='five'?-1:1;
 g.atoms[anchor].h--;let previous=anchor,origin=g.atoms[anchor];
 for(let k=0;k<count;k++){
 let x=origin.x,y=origin.y+sign*(3+6*k),pi=g.atoms.length;
 const code=p.terminalChemistry[side],t=phosphorusGeometry(code,x,y);
 const bondStart=g.bonds.length;g.atoms.push(...t.atoms,{e:'O',h:k===count-1?1:0,x,y:y+sign*3});
 g.bonds.push(...t.bonds.map(b=>({...b,a:b.a+pi,b:b.b+pi,s:0})),{a:previous,b:pi+t.p,o:1,s:0},{a:pi+t.p,b:pi+t.atoms.length,o:1,s:0});mark(pi,bondStart,{kind:'terminal-linkage',termination:term.id,node:term.at.node,position:ri+1,linkage:code,step:k+1});previous=pi+t.atoms.length;
 }
 }
 for(const item of expanded)for(const bi of item.bonds){const b=g.bonds[bi];try{g.routes.push({bond:bi,kind:'expanded-unit',atoms:[b.a,b.b],points:routeAvoid(g,bi,item.p)});}catch(e){if(!e.message.startsWith('LAYOUT_ROUTING_FAILED:'))throw e;(g.layout_warnings??=[]).push('Direct bond retained for '+bi+': display route unavailable; inspect layout');}}
 g.sites=sites;g.topology=p.topology||'mixed-or-ribose';g.direction=['alpha-L-threose-3-to-2','S-glycerol-3-to-2','S-glycerol-phosphate'].includes(p.topology)?'3′ → 2′':p.topology==='morpholine-phosphorodiamidate'?'5′ OH → 3′ NH':'5′ → 3′';g.layout={column_pitch:width,residue_pitch:pitch,adaptive:hasLarge,origins:hasLarge?origins:null,rows:10};return g;
}
function calculate(seq){let p=parse(seq);const ag=validateChemistry(p);let g=expandAssemblyGraph(ag),f=graphFormula(g),m=masses(f);if(formula(f)!==formula(composition(p))||formula(f)!==formula(directComposition(p))||!connected(g))throw Error('内部 graph/composition 验证失败');return {schema_version:'oligo-lite/2',assembly_graph:ag,status:'ok',errors:[],input_sequence:seq,canonical_sequence:p.canonical,sequence:p.canonical,residues:p.residues,linkages:p.links,modifications:p.terminal,notation:p,formula_validation:{direct:formula(directComposition(p)),component:formula(composition(p)),graph:formula(f),equal:true},chemistry:{formula:formula(f),formula_dict:f,...m,charge_model:p.topology==='morpholine-phosphorodiamidate'?'neutral uncapped PMO: free 5-OH / 3-NH':'neutral free acid; terminal OH or specified phosphate',phosphorus_stereochemistry:'unspecified',...(g.atoms.some(a=>a.q)?{formal_charge:graphProperties(g).formal_charge,exact_ion_mass:graphProperties(g).exact_ion_mass,charge_model:'explicit graph formal charge; no counterions'}:{})},optical:od(p,m.average_mw),graph:g,provenance:{coverage:p.residues.map(code=>{const key=code[0]==='{'?'['+code.slice(1,-1)+']':code;return COVERAGE.entries.find(e=>e.notation===key)||{notation:key,status:'USER_CUSTOM',extinction:customLibrary[code]?.extinction||{status:'NEEDS_PARAMETER'}};}),reference:REFERENCE.source,monomers:'versioned atomic library',chemistry_status:'REGRESSION_VALIDATED',mspa:p.links.includes('MsPA')?'MsPA: neutral P(=O)-NH-S(=O)2-Me; phosphorus stereochemistry unspecified':null},limitations:['Neutral terminal PO/PS/PS2/Me-P/PN(dmi)/MsPA; modified polyphosphate and unvalidated modifier attachments rejected','MOL/SDF preserve graph and atom coordinates; routed paths are SVG/JSON display metadata only']};}
const pad=(v,n)=>String(v).padStart(n,' ');
function molV3000(g,title){return [title.replace(/[\r\n]/g,' '),'  OligoLite  2D','','  0  0  0     0  0            999 V3000','M  V30 BEGIN CTAB',`M  V30 COUNTS ${g.atoms.length} ${g.bonds.length} 0 0 0`,'M  V30 BEGIN ATOM',...g.atoms.map((a,i)=>`M  V30 ${i+1} ${a.e} ${a.x.toFixed(4)} ${(-a.y).toFixed(4)} 0 0${a.q?' CHG='+a.q:''}`),'M  V30 END ATOM','M  V30 BEGIN BOND',...g.bonds.map((b,i)=>`M  V30 ${i+1} ${b.o} ${b.a+1} ${b.b+1}${b.s?' CFG='+(b.s===1?1:3):''}`),'M  V30 END BOND','M  V30 END CTAB','M  END',''].join('\n');}
function mol(g,title='Oligo Lite'){if(g.atoms.length>999||g.bonds.length>999||g.atoms.some(a=>a.x.toFixed(4).length>10||(-a.y).toFixed(4).length>10))return molV3000(g,title);let s=[title.replace(/[\r\n]/g,' '),'  OligoLite  2D','',pad(g.atoms.length,3)+pad(g.bonds.length,3)+'  0  0  0  0            999 V2000'];g.atoms.forEach(a=>s.push(pad(a.x.toFixed(4),10)+pad((-a.y).toFixed(4),10)+pad('0.0000',10)+' '+a.e.padEnd(3)+' 0  0  0  0  0  0  0  0  0  0  0  0'));g.bonds.forEach(b=>s.push(pad(b.a+1,3)+pad(b.b+1,3)+pad(b.o,3)+pad(b.s||0,3)+'  0  0  0'));for(let i=0;i<g.atoms.length;i++){let a=g.atoms[i];if(a.q)s.push('M  CHG  1'+pad(i+1,4)+pad(a.q,4));if(a.iso)s.push('M  ISO  1'+pad(i+1,4)+pad(a.iso,4));}return s.join('\n')+'\nM  END\n';}
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
function svg(g){let points=(g.routes||[]).flatMap(r=>r.points),xs=[...g.atoms.map(a=>a.x),...points.map(p=>p[0])],ys=[...g.atoms.map(a=>a.y),...points.map(p=>p[1])],minx=extent(xs,'min')-2,miny=extent(ys,'min')-2,w=extent(xs,'max')-minx+2,h=extent(ys,'max')-miny+2;
 let s=[`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minx} ${miny} ${w} ${h}" width="${Math.ceil(w*23)}" height="${Math.ceil(h*23)}"><rect x="${minx}" y="${miny}" width="${w}" height="${h}" fill="white"/><g stroke="#27374a" stroke-width=".055" stroke-linecap="round">`];
 for(const [bi,b] of g.bonds.entries()){let route=(g.routes||[]).find(r=>r.bond===bi);
 if(route){s.push(`<path ${route.boundary===undefined?'data-route-kind="expanded-unit"':'data-boundary="'+route.boundary+'"'} d="${route.points.map((p,i)=>(i?'L':'M')+p.join(' ')).join(' ')}" fill="none"/>`);
 continue;
 }let a=g.atoms[b.a],z=g.atoms[b.b],dx=z.x-a.x,dy=z.y-a.y,L=Math.hypot(dx,dy)||1,nx=-dy/L,ny=dx/L;
 if(b.s===1){s.push(`<path d="M${a.x} ${a.y} L${z.x+nx*.14} ${z.y+ny*.14} L${z.x-nx*.14} ${z.y-ny*.14}Z" fill="#27374a"/>`);
 }else if(b.s===6){for(let k=1;
 k<=7;
 k++){let t=k/8,r=t*.14;
 s.push(`<path d="M${a.x+dx*t+nx*r} ${a.y+dy*t+ny*r} l${-2*nx*r} ${-2*ny*r}"/>`);
 }}else{for(let j=0;
 j<b.o;
 j++){let d=(j-(b.o-1)/2)*.16;
 s.push(`<path d="M${a.x+nx*d} ${a.y+ny*d} L${z.x+nx*d} ${z.y+ny*d}"/>`);
 }}}for(const v of g.depiction_overpasses||[]){const f=g.bonds[v.front],b=g.bonds[v.back],a=g.atoms[f.a],z=g.atoms[f.b],c=g.atoms[b.a],d=g.atoms[b.b],dx=z.x-a.x,dy=z.y-a.y,ex=d.x-c.x,ey=d.y-c.y,den=dx*ey-dy*ex;
 if(Math.abs(den)<1e-9)continue;
 const t=((c.x-a.x)*ey-(c.y-a.y)*ex)/den,u=((c.x-a.x)*dy-(c.y-a.y)*dx)/den;
 if(t<=0||t>=1||u<=0||u>=1)continue;
 const L=Math.hypot(dx,dy),x=a.x+t*dx,y=a.y+t*dy;
 s.push(`<path data-cage-overpass="${v.front}" d="M${x-dx/L*.24} ${y-dy/L*.24} L${x+dx/L*.24} ${y+dy/L*.24}" stroke="white" stroke-width=".21"/><path d="M${x-dx/L*.26} ${y-dy/L*.26} L${x+dx/L*.26} ${y+dy/L*.26}" stroke="#27374a" stroke-width=".055"/>`);
 }s.push('</g><g font-family="Arial,sans-serif" font-size=".52" text-anchor="middle" dominant-baseline="central">');
 for(const [ai,a] of g.atoms.entries()){if(a.e==='C')continue;
 s.push(`<text data-atom="${ai}" x="${a.x}" y="${a.y}" fill="${a.e==='O'?'#bb3339':a.e==='N'?'#2858ad':a.e==='S'?'#94701a':'#333'}" stroke="white" stroke-width=".17" paint-order="stroke">${`<tspan x="${a.x}" text-anchor="middle">${esc(a.e)}</tspan>`}${a.h?`<tspan font-size=".40" x="${a.x+.28}" text-anchor="start">H${a.h>1?a.h:''}</tspan>`:''}${a.q?`<tspan>${a.q>0?'+':'−'}</tspan>`:''}</text>`);
 }s.push('</g>');
 if(g.sites)g.sites.forEach((v,i)=>{let a=g.atoms[v.o5??v.o3];
 s.push(`<text data-unit="${i}" x="${a.x-3}" y="${a.y-.65}" font-family="Arial" font-size=".45" fill="#8794a5">${i+1}${i===0?' · '+(v.incoming_label||'5′'):''}${i===g.sites.length-1?' → '+(v.outgoing_label||'3′'):''}</text>`);
 });
 return s.join('')+'</svg>';
 }
function cdxml(g){const nums={H:1,C:6,N:7,O:8,F:9,P:15,S:16};return `<?xml version="1.0"?><CDXML BondLength="30"><page id="1"><fragment id="2">`+g.atoms.map((a,i)=>`<n id="${i+10}" p="${(a.x+8)*20} ${(a.y+8)*20}" Element="${nums[a.e]}" NumHydrogens="${a.h||0}"${a.q?` Charge="${a.q}"`:''}/>`).join('')+g.bonds.map((b,i)=>`<b id="${g.atoms.length+10+i}" B="${b.a+10}" E="${b.b+10}" Order="${b.o}"${b.s?` Display="${b.s===1?'WedgeBegin':'WedgedHashBegin'}"`:''}/>`).join('')+'</fragment></page></CDXML>';}
function readV2000(text){let lines=text.replace(/\r/g,'').split('\n');if(!lines[3]?.includes('V2000'))throw Error('Expected MOL V2000 or V3000');let n=Number(lines[3].slice(0,3)),nb=Number(lines[3].slice(3,6));if(!Number.isInteger(n)||n<1||n>999||!Number.isInteger(nb)||nb<0)throw Error('无效 atom count');let g={atoms:[],bonds:[]},aliases={};for(let i=0;i<n;i++){let l=lines[4+i];if(!l||l.length<34)throw Error('MOL V2000 atom line '+(i+1)+' is missing or truncated');let e=l.slice(31,34).trim();let qcode=Number(l.slice(36,39));if(![0,1,2,3,5,6,7].includes(qcode))throw Error('Unsupported atom charge/radical code');if(!e||![Number(l.slice(0,10)),Number(l.slice(10,20))].every(Number.isFinite))throw Error('无效 atom line');g.atoms.push({e,x:Number(l.slice(0,10)),y:-Number(l.slice(10,20)),q:({1:3,2:2,3:1,5:-1,6:-2,7:-3})[qcode]||0,map:Number(l.slice(60,63)),h:0});if(Number(l.slice(34,36)))throw Error('暂不支持 atom-line isotope mass difference，请用 M ISO');if(Number(l.slice(39,42)))throw Error('暂不支持 atom parity，请导出 wedge bond stereo');if(!['*','R#','R','Du'].includes(e)&&(Number(l.slice(42,45))||Number(l.slice(48,51))))throw Error('暂不支持显式 H/valence override');}
for(let i=0;i<nb;i++){let l=lines[4+n+i];if(!l||l.length<12)throw Error('MOL V2000 bond line '+(i+1)+' is missing or truncated');let a=Number(l.slice(0,3))-1,b=Number(l.slice(3,6))-1,o=Number(l.slice(6,9)),s=Number(l.slice(9,12));if(!Number.isInteger(a)||!Number.isInteger(b)||a<0||b<0||a>=n||b>=n||a===b||![1,2,3].includes(o)||![0,1,6].includes(s))throw Error('仅支持 single/double/triple 与 wedge/hash；芳香键请导出 Kekulé');if(g.bonds.some(v=>(v.a===a&&v.b===b)||(v.a===b&&v.b===a)))throw Error('重复 bond');g.bonds.push({a,b,o,s});}
if(!lines.slice(4+n+nb).some(l=>l.startsWith('M  END')))throw Error('Truncated V2000 record');
for(let i=4+n+nb;i<lines.length;i++){let l=lines[i];if(l.startsWith('M  END'))break;if(l.startsWith('M  RGP')){let t=l.trim().split(/\s+/);for(let j=0;j<Number(t[2]);j++)aliases[Number(t[3+2*j])-1]='R'+t[4+2*j];}else if(l.startsWith('A  ')){const id=Number(l.slice(3))-1;if(aliases[id]!==undefined)throw Error('UNRESOLVED_ABBREVIATION: duplicate atom alias');aliases[id]=(lines[++i]||'').replace(/[′']/g,'').trim();}else if(/^M  (CHG|ISO)/.test(l)){let t=l.trim().split(/\s+/),key=t[1]==='CHG'?'q':'iso';for(let j=0;j<Number(t[2]);j++){let a=g.atoms[Number(t[3+j*2])-1];if(!a)throw Error('M property atom 越界');a[key]=Number(t[4+j*2]);}}else if(l.startsWith('M  ')&&!l.startsWith('M  END'))throw Error('MOL V2000 property '+l.slice(3,6).trim()+' is not supported'+(/^M  (STY|SAL|SBL|SMT|SDI|SDS|SCN|SST|SPA|SPL)/.test(l)?' (SGroup / abbreviated group or polymer metadata). Export a fully expanded, explicit atom/bond structure without SGroups; do not remove polymer/repeat definitions unless the full molecule is expanded.':'. Export an explicit Kekulé MOL/SDF without this property.'));}
return {g,aliases};}
function readV3000(text){
 const physical=text.replace(/\r/g,'').split('\n'),records=[];let continued='';
 for(const line of physical){if(line==='M  END')break;if(!line.startsWith('M  V30 '))continue;let part=line.slice(7);if(part.endsWith('-')){continued+=part.slice(0,-1);continue;}records.push(continued+part);continued='';}
 if(continued)throw Error('Truncated V3000 continuation');
 const g={atoms:[],bonds:[]},aliases={},ids=new Map(),pending=[],seenBonds=new Set();let mode='',counts;
 for(const line of records){
  if(line.startsWith('COUNTS ')){counts=line.split(/\s+/).slice(1).map(Number);if(counts.slice(2).some(Boolean))throw Error('MOL V3000 SGroup / collection metadata is not supported. Export a fully expanded, explicit molecule without abbreviation or polymer/repeat groups.');continue;}
  if(line==='BEGIN CTAB'||line==='END CTAB')continue;
  if(line==='BEGIN ATOM'){mode='atom';continue;}if(line==='BEGIN BOND'){mode='bond';continue;}
  if(line==='END ATOM'||line==='END BOND'){mode='';continue;}
  const t=line.match(/"[^"\n]*"|\S+/g)||[];
  if(mode==='atom'){
   const id=Number(t[0]),e=t[1]?.replace(/^"|"$/g,''),x=Number(t[2]),y=-Number(t[3]),z=Number(t[4]),map=Number(t[5]);
   if(!Number.isInteger(id)||ids.has(id)||!e||![x,y,z,map].every(Number.isFinite))throw Error('Invalid V3000 atom');
   const a={e,x,y,map,q:0,h:0};ids.set(id,g.atoms.length);
   for(const prop of t.slice(6)){const [k,v]=prop.split('=');if(k==='CHG'||k==='MASS'){if(!Number.isInteger(Number(v)))throw Error('Invalid V3000 '+k);a[k==='CHG'?'q':'iso']=Number(v);}else if(k==='LABEL'){if(aliases[g.atoms.length]!==undefined)throw Error('UNRESOLVED_ABBREVIATION: duplicate atom LABEL');aliases[g.atoms.length]=v.replace(/^"|"$/g,'');}else throw Error('Unsupported V3000 atom property '+k);}
   g.atoms.push(a);
  }else if(mode==='bond'){
   const id=Number(t[0]),o=Number(t[1]),a=Number(t[2]),b=Number(t[3]);let stereo=0;
   if(!Number.isInteger(id)||seenBonds.has(id)||![1,2,3].includes(o))throw Error('Invalid V3000 bond');seenBonds.add(id);
   for(const prop of t.slice(4)){const [k,v]=prop.split('=');if(k!=='CFG'||!['0','1','3'].includes(v))throw Error('Unsupported V3000 bond property '+prop);stereo=v==='1'?1:v==='3'?6:0;}
   pending.push({a,b,o,s:stereo});
  }else throw Error('MOL V3000 section is not supported: '+line+'. For SGroup abbreviations or polymer/repeat groups, export the fully expanded explicit molecule.');
 }
 if(!counts||counts[0]!==g.atoms.length||counts[1]!==pending.length||!g.atoms.length)throw Error('V3000 count mismatch');
 const pairs=new Set();for(const b of pending){b.a=ids.get(b.a);b.b=ids.get(b.b);const key=[b.a,b.b].sort((a,b)=>a-b).join(':');if(b.a===undefined||b.b===undefined||b.a===b.b||pairs.has(key))throw Error('Invalid V3000 bond endpoints');pairs.add(key);g.bonds.push(b);}
 if(!text.includes('M  END')||!records.includes('END CTAB'))throw Error('Truncated V3000 record');
 return {g,aliases};
}
function valenceTarget(a,v){
 const q=a.q||0;
 if(q){if(a.e==='N'&&q===1)return 4;if(a.e==='N'&&q===-1)return 2;if(a.e==='O'&&q===-1)return 1;if(a.e==='O'&&q===1)return 3;throw Error('Unsupported formal-charge valence state');}
 return ({C:4,N:3,O:2,F:1,H:1,P:5,S:v>2?(v<=4?4:6):2})[a.e];
}
function graphProperties(g){const f=graphFormula(g),q=g.atoms.reduce((n,a)=>n+(a.q||0),0),m=masses(f);return {formula:formula(f),formula_dict:f,...m,formal_charge:q,exact_ion_mass:m.exact_mass-q*0.000548579909065,mass_convention:'exact_mass = sum of neutral atomic isotope masses; exact_ion_mass corrects electron mass; no counterions'};}

// Frozen rooted fragments. '*' in definitions is the external single-bond port,
// never an atom retained in Chemistry Core. No user SMILES/string substitution.
const abbreviationDefinitions=Object.freeze({"Ac":{"definition":"*C(=O)C","atoms":[{"e":"C","q":0,"h":0,"x":0.0,"y":0.0},{"e":"O","q":0,"h":0,"x":0.0,"y":1.5000000000000002},{"e":"C","q":0,"h":0,"x":1.299038105676658,"y":-0.7500000000000004}],"bonds":[{"a":0,"b":1,"o":2,"s":0},{"a":0,"b":2,"o":1,"s":0}]},"OAc":{"definition":"*OC(=O)C","atoms":[{"e":"O","q":0,"h":0,"x":-0.779422863405995,"y":0.7500000000000002},{"e":"C","q":0,"h":0,"x":0.519615242270663,"y":-1.77635683940025e-16},{"e":"O","q":0,"h":0,"x":0.519615242270663,"y":-1.5000000000000004},{"e":"C","q":0,"h":0,"x":1.818653347947321,"y":0.7499999999999998}],"bonds":[{"a":0,"b":1,"o":1,"s":0},{"a":1,"b":2,"o":2,"s":0},{"a":1,"b":3,"o":1,"s":0}]},"NHAc":{"definition":"*NC(=O)C","atoms":[{"e":"N","q":0,"h":0,"x":-0.779422863405995,"y":0.7500000000000002},{"e":"C","q":0,"h":0,"x":0.519615242270663,"y":-1.77635683940025e-16},{"e":"O","q":0,"h":0,"x":0.519615242270663,"y":-1.5000000000000004},{"e":"C","q":0,"h":0,"x":1.818653347947321,"y":0.7499999999999998}],"bonds":[{"a":0,"b":1,"o":1,"s":0},{"a":1,"b":2,"o":2,"s":0},{"a":1,"b":3,"o":1,"s":0}]},"Me":{"definition":"*C","atoms":[{"e":"C","q":0,"h":0,"x":0.75,"y":-5.551115123125783e-17}],"bonds":[]},"OMe":{"definition":"*OC","atoms":[{"e":"O","q":0,"h":0,"x":0.0,"y":0.5000000000000001},{"e":"C","q":0,"h":0,"x":1.299038105676658,"y":-0.25000000000000033}],"bonds":[{"a":0,"b":1,"o":1,"s":0}]},"NMe":{"definition":"*NC","atoms":[{"e":"N","q":0,"h":0,"x":0.0,"y":0.5000000000000001},{"e":"C","q":0,"h":0,"x":1.299038105676658,"y":-0.25000000000000033}],"bonds":[{"a":0,"b":1,"o":1,"s":0}]},"Et":{"definition":"*CC","atoms":[{"e":"C","q":0,"h":0,"x":0.0,"y":0.5000000000000001},{"e":"C","q":0,"h":0,"x":1.299038105676658,"y":-0.25000000000000033}],"bonds":[{"a":0,"b":1,"o":1,"s":0}]},"OEt":{"definition":"*OCC","atoms":[{"e":"O","q":0,"h":0,"x":-0.5993786074712486,"y":0.4508273338051132},{"e":"C","q":0,"h":0,"x":0.5993786074712486,"y":-0.4508273338051133},{"e":"C","q":0,"h":0,"x":1.9796130625337671,"y":0.13649953349985902}],"bonds":[{"a":0,"b":1,"o":1,"s":0},{"a":1,"b":2,"o":1,"s":0}]},"Bn":{"definition":"*Cc1ccccc1","atoms":[{"e":"C","q":0,"h":0,"x":-2.0677127601063026,"y":-0.6327283711780093},{"e":"C","q":0,"h":0,"x":-0.60445528134794,"y":-0.3027623867830734},{"e":"C","q":0,"h":0,"x":0.41293238290199547,"y":-1.4049975434679165},{"e":"C","q":0,"h":0,"x":1.8761898616603585,"y":-1.0750315590729809},{"e":"C","q":0,"h":0,"x":2.3220596761687866,"y":0.35716958200679816},{"e":"C","q":0,"h":0,"x":1.3046720119188513,"y":1.4594047386916413},{"e":"C","q":0,"h":0,"x":-0.1585854668395116,"y":1.1294387542967064}],"bonds":[{"a":0,"b":1,"o":1,"s":0},{"a":1,"b":2,"o":2,"s":0},{"a":2,"b":3,"o":1,"s":0},{"a":3,"b":4,"o":2,"s":0},{"a":4,"b":5,"o":1,"s":0},{"a":5,"b":6,"o":2,"s":0},{"a":6,"b":1,"o":1,"s":0}]},"OBn":{"definition":"*OCc1ccccc1","atoms":[{"e":"O","q":0,"h":0,"x":-2.58652919516224,"y":0.4134946598016572},{"e":"C","q":0,"h":0,"x":-1.5519828657544443,"y":-0.6726516895955393},{"e":"C","q":0,"h":0,"x":-0.09407937024484557,"y":-0.31978146163504284},{"e":"C","q":0,"h":0,"x":0.9404669591629495,"y":-1.4059278110322395},{"e":"C","q":0,"h":0,"x":2.398370454672549,"y":-1.0530575830717437},{"e":"C","q":0,"h":0,"x":2.821727620774353,"y":0.38595899428594976},{"e":"C","q":0,"h":0,"x":1.7871812913665581,"y":1.4721053436831468},{"e":"C","q":0,"h":0,"x":0.32927779585695904,"y":1.119235115722651}],"bonds":[{"a":0,"b":1,"o":1,"s":0},{"a":1,"b":2,"o":1,"s":0},{"a":2,"b":3,"o":2,"s":0},{"a":3,"b":4,"o":1,"s":0},{"a":4,"b":5,"o":2,"s":0},{"a":5,"b":6,"o":1,"s":0},{"a":6,"b":7,"o":2,"s":0},{"a":7,"b":2,"o":1,"s":0}]},"NBn":{"definition":"*NCc1ccccc1","atoms":[{"e":"N","q":0,"h":0,"x":-2.58652919516224,"y":0.4134946598016572},{"e":"C","q":0,"h":0,"x":-1.5519828657544443,"y":-0.6726516895955393},{"e":"C","q":0,"h":0,"x":-0.09407937024484557,"y":-0.31978146163504284},{"e":"C","q":0,"h":0,"x":0.9404669591629495,"y":-1.4059278110322395},{"e":"C","q":0,"h":0,"x":2.398370454672549,"y":-1.0530575830717437},{"e":"C","q":0,"h":0,"x":2.821727620774353,"y":0.38595899428594976},{"e":"C","q":0,"h":0,"x":1.7871812913665581,"y":1.4721053436831468},{"e":"C","q":0,"h":0,"x":0.32927779585695904,"y":1.119235115722651}],"bonds":[{"a":0,"b":1,"o":1,"s":0},{"a":1,"b":2,"o":1,"s":0},{"a":2,"b":3,"o":2,"s":0},{"a":3,"b":4,"o":1,"s":0},{"a":4,"b":5,"o":2,"s":0},{"a":5,"b":6,"o":1,"s":0},{"a":6,"b":7,"o":2,"s":0},{"a":7,"b":2,"o":1,"s":0}]},"Boc":{"definition":"*C(=O)OC(C)(C)C","atoms":[{"e":"C","q":0,"h":0,"x":1.4606420232489952,"y":0.10514813321729444},{"e":"O","q":0,"h":0,"x":1.4723440008379383,"y":-1.3948062206616856},{"e":"O","q":0,"h":0,"x":0.15579245947825326,"y":0.8449911002902439},{"e":"C","q":0,"h":0,"x":-1.1373551267035453,"y":0.08487971348421305},{"e":"C","q":0,"h":0,"x":-1.8974665135095763,"y":1.3780272996660117},{"e":"C","q":0,"h":0,"x":-0.37724373989751464,"y":-1.2082678726975853},{"e":"C","q":0,"h":0,"x":-2.4305027128853443,"y":-0.6752316733218175}],"bonds":[{"a":0,"b":1,"o":2,"s":0},{"a":0,"b":2,"o":1,"s":0},{"a":2,"b":3,"o":1,"s":0},{"a":3,"b":4,"o":1,"s":0},{"a":3,"b":5,"o":1,"s":0},{"a":3,"b":6,"o":1,"s":0}]},"NBoc":{"definition":"*NC(=O)OC(C)(C)C","atoms":[{"e":"N","q":0,"h":0,"x":2.315305838439405,"y":-0.8167843364476217},{"e":"C","q":0,"h":0,"x":1.0109334867003854,"y":-0.07610034983874416},{"e":"O","q":0,"h":0,"x":1.000198459410496,"y":1.423861236065737},{"e":"O","q":0,"h":0,"x":-0.2827038377487451,"y":-0.8353779491343479},{"e":"C","q":0,"h":0,"x":-1.5870761894877645,"y":-0.09469396252547044},{"e":"C","q":0,"h":0,"x":-2.3277601760966418,"y":-1.3990663142644901},{"e":"C","q":0,"h":0,"x":-0.8463922028788876,"y":1.2096783892135492},{"e":"C","q":0,"h":0,"x":-2.8914485412267843,"y":0.6459900240834064}],"bonds":[{"a":0,"b":1,"o":1,"s":0},{"a":1,"b":2,"o":2,"s":0},{"a":1,"b":3,"o":1,"s":0},{"a":3,"b":4,"o":1,"s":0},{"a":4,"b":5,"o":1,"s":0},{"a":4,"b":6,"o":1,"s":0},{"a":4,"b":7,"o":1,"s":0}]},"Cbz":{"definition":"*C(=O)OCc1ccccc1","atoms":[{"e":"C","q":0,"h":0,"x":-3.176384363057016,"y":0.08769159676618732},{"e":"O","q":0,"h":0,"x":-3.6024637534882755,"y":-1.35052130577979},{"e":"O","q":0,"h":0,"x":-1.7178157581860163,"y":0.43780247189671745},{"e":"C","q":0,"h":0,"x":-0.6853265437462761,"y":-0.6502995555187304},{"e":"C","q":0,"h":0,"x":0.7732420611247233,"y":-0.30018868038820024},{"e":"C","q":0,"h":0,"x":1.8057312755644634,"y":-1.3882907078036482},{"e":"C","q":0,"h":0,"x":3.2642998804354635,"y":-1.0381798326731184},{"e":"C","q":0,"h":0,"x":3.690379270866723,"y":0.4000330698728596},{"e":"C","q":0,"h":0,"x":2.6578900564269836,"y":1.4881350972883078},{"e":"C","q":0,"h":0,"x":1.1993214515559838,"y":1.1380242221577785}],"bonds":[{"a":0,"b":1,"o":2,"s":0},{"a":0,"b":2,"o":1,"s":0},{"a":2,"b":3,"o":1,"s":0},{"a":3,"b":4,"o":1,"s":0},{"a":4,"b":5,"o":2,"s":0},{"a":5,"b":6,"o":1,"s":0},{"a":6,"b":7,"o":2,"s":0},{"a":7,"b":8,"o":1,"s":0},{"a":8,"b":9,"o":2,"s":0},{"a":9,"b":4,"o":1,"s":0}]},"NCbz":{"definition":"*NC(=O)OCc1ccccc1","atoms":[{"e":"N","q":0,"h":0,"x":-3.7809014025268457,"y":0.9446081644631964},{"e":"C","q":0,"h":0,"x":-2.7023908610284124,"y":-0.09789603786730516},{"e":"O","q":0,"h":0,"x":-3.0659707130494422,"y":-1.5531656662195101},{"e":"O","q":0,"h":0,"x":-1.2603004675089486,"y":0.31486938815439885},{"e":"C","q":0,"h":0,"x":-0.18178992601051494,"y":-0.7276348141761029},{"e":"C","q":0,"h":0,"x":1.2603004675089484,"y":-0.3148693881543989},{"e":"C","q":0,"h":0,"x":2.338811009007382,"y":-1.3573735904849007},{"e":"C","q":0,"h":0,"x":3.780901402526846,"y":-0.9446081644631968},{"e":"C","q":0,"h":0,"x":4.144481254547876,"y":0.5106614638890085},{"e":"C","q":0,"h":0,"x":3.065970713049443,"y":1.5531656662195106},{"e":"C","q":0,"h":0,"x":1.6238803195299791,"y":1.1404002401978075}],"bonds":[{"a":0,"b":1,"o":1,"s":0},{"a":1,"b":2,"o":2,"s":0},{"a":1,"b":3,"o":1,"s":0},{"a":3,"b":4,"o":1,"s":0},{"a":4,"b":5,"o":1,"s":0},{"a":5,"b":6,"o":2,"s":0},{"a":6,"b":7,"o":1,"s":0},{"a":7,"b":8,"o":2,"s":0},{"a":8,"b":9,"o":1,"s":0},{"a":9,"b":10,"o":2,"s":0},{"a":10,"b":5,"o":1,"s":0}]},"Fmoc":{"definition":"*C(=O)OCC1c2ccccc2-c2ccccc21","atoms":[{"e":"C","q":0,"h":0,"x":4.215338392889604,"y":0.769964495166561},{"e":"O","q":0,"h":0,"x":4.372407665967835,"y":2.261718242758527},{"e":"O","q":0,"h":0,"x":2.8449071147452063,"y":0.16011360201028002},{"e":"C","q":0,"h":0,"x":1.6315451096790394,"y":1.0420164564459662},{"e":"C","q":0,"h":0,"x":0.2611138315346422,"y":0.432165563289686},{"e":"C","q":0,"h":0,"x":-1.03778519963713,"y":1.1824063958368298},{"e":"C","q":0,"h":0,"x":-1.3493807033947691,"y":2.649685592867178},{"e":"C","q":0,"h":0,"x":-2.775879514346303,"y":3.113475569423227},{"e":"C","q":0,"h":0,"x":-3.8907828215401983,"y":2.1099863489489277},{"e":"C","q":0,"h":0,"x":-3.5791873177825595,"y":0.6427071519185794},{"e":"C","q":0,"h":0,"x":-2.1526885068310255,"y":0.17891717536253016},{"e":"C","q":0,"h":0,"x":-1.5428376136747444,"y":-1.1915141027818665},{"e":"C","q":0,"h":0,"x":-2.153196628773972,"y":-2.561719150461629},{"e":"C","q":0,"h":0,"x":-1.271743756639243,"y":-3.775408086806292},{"e":"C","q":0,"h":0,"x":0.22006813059471342,"y":-3.6188919754711915},{"e":"C","q":0,"h":0,"x":0.8304271456939413,"y":-2.2486869277914288},{"e":"C","q":0,"h":0,"x":-0.05102572644078801,"y":-1.0349979914467662}],"bonds":[{"a":0,"b":1,"o":2,"s":0},{"a":0,"b":2,"o":1,"s":0},{"a":2,"b":3,"o":1,"s":0},{"a":3,"b":4,"o":1,"s":0},{"a":4,"b":5,"o":1,"s":0},{"a":5,"b":6,"o":2,"s":0},{"a":6,"b":7,"o":1,"s":0},{"a":7,"b":8,"o":2,"s":0},{"a":8,"b":9,"o":1,"s":0},{"a":9,"b":10,"o":2,"s":0},{"a":10,"b":11,"o":1,"s":0},{"a":11,"b":12,"o":2,"s":0},{"a":12,"b":13,"o":1,"s":0},{"a":13,"b":14,"o":2,"s":0},{"a":14,"b":15,"o":1,"s":0},{"a":15,"b":16,"o":2,"s":0},{"a":16,"b":4,"o":1,"s":0},{"a":10,"b":5,"o":1,"s":0},{"a":16,"b":11,"o":1,"s":0}]},"NFmoc":{"definition":"*NC(=O)OCC1c2ccccc2-c2ccccc21","atoms":[{"e":"N","q":0,"h":0,"x":5.063997160370378,"y":-0.29757375842731437},{"e":"C","q":0,"h":0,"x":3.8789747662306513,"y":0.6220576489242131},{"e":"O","q":0,"h":0,"x":4.082887730045246,"y":2.1081328499784355},{"e":"O","q":0,"h":0,"x":2.49003940827633,"y":0.05561385522151774},{"e":"C","q":0,"h":0,"x":1.3050170141366033,"y":0.9752452625730456},{"e":"C","q":0,"h":0,"x":-0.08391834381771773,"y":0.4088014688703504},{"e":"C","q":0,"h":0,"x":-1.3585767190745321,"y":1.199526469352603},{"e":"C","q":0,"h":0,"x":-1.6238664581265252,"y":2.6758805442119256},{"e":"C","q":0,"h":0,"x":-3.035071461461368,"y":3.184309928259216},{"e":"C","q":0,"h":0,"x":-4.1809867257442175,"y":2.216385237447184},{"e":"C","q":0,"h":0,"x":-3.9156969866922253,"y":0.7400311625878618},{"e":"C","q":0,"h":0,"x":-2.504491983357383,"y":0.23160177854057085},{"e":"C","q":0,"h":0,"x":-1.9380481896546868,"y":-1.1573335794137498},{"e":"C","q":0,"h":0,"x":-2.5912034346925368,"y":-2.507662511888925},{"e":"C","q":0,"h":0,"x":-1.7483618982228382,"y":-3.7484760129443413},{"e":"C","q":0,"h":0,"x":-0.25236511671528916,"y":-3.638960581524582},{"e":"C","q":0,"h":0,"x":0.4007901283225611,"y":-2.2886316490494063},{"e":"C","q":0,"h":0,"x":-0.44205140814713817,"y":-1.0478181479939903}],"bonds":[{"a":0,"b":1,"o":1,"s":0},{"a":1,"b":2,"o":2,"s":0},{"a":1,"b":3,"o":1,"s":0},{"a":3,"b":4,"o":1,"s":0},{"a":4,"b":5,"o":1,"s":0},{"a":5,"b":6,"o":1,"s":0},{"a":6,"b":7,"o":2,"s":0},{"a":7,"b":8,"o":1,"s":0},{"a":8,"b":9,"o":2,"s":0},{"a":9,"b":10,"o":1,"s":0},{"a":10,"b":11,"o":2,"s":0},{"a":11,"b":12,"o":1,"s":0},{"a":12,"b":13,"o":2,"s":0},{"a":13,"b":14,"o":1,"s":0},{"a":14,"b":15,"o":2,"s":0},{"a":15,"b":16,"o":1,"s":0},{"a":16,"b":17,"o":2,"s":0},{"a":17,"b":5,"o":1,"s":0},{"a":11,"b":6,"o":1,"s":0},{"a":17,"b":12,"o":1,"s":0}]},"Tr":{"definition":"*C(c1ccccc1)(c1ccccc1)c1ccccc1","atoms":[{"e":"C","q":0,"h":0,"x":5.01441178374015e-16,"y":-0.8249999999999997},{"e":"C","q":0,"h":0,"x":-6.711021105823672e-17,"y":0.675},{"e":"C","q":0,"h":0,"x":1.2990381056766578,"y":1.425},{"e":"C","q":0,"h":0,"x":1.2990381056766576,"y":2.9250000000000003},{"e":"C","q":0,"h":0,"x":-5.764267602005749e-16,"y":3.6750000000000007},{"e":"C","q":0,"h":0,"x":-1.2990381056766587,"y":2.9250000000000007},{"e":"C","q":0,"h":0,"x":-1.299038105676659,"y":1.425000000000001},{"e":"C","q":0,"h":0,"x":1.5000000000000002,"y":-0.8249999999999998},{"e":"C","q":0,"h":0,"x":2.2499999999999996,"y":-2.124038105676658},{"e":"C","q":0,"h":0,"x":3.7499999999999996,"y":-2.1240381056766586},{"e":"C","q":0,"h":0,"x":4.5,"y":-0.8250000000000005},{"e":"C","q":0,"h":0,"x":3.7500000000000013,"y":0.47403810567665805},{"e":"C","q":0,"h":0,"x":2.2500000000000013,"y":0.47403810567665877},{"e":"C","q":0,"h":0,"x":-1.4999999999999996,"y":-0.8250000000000001},{"e":"C","q":0,"h":0,"x":-2.2499999999999996,"y":0.4740381056766578},{"e":"C","q":0,"h":0,"x":-3.7499999999999996,"y":0.4740381056766576},{"e":"C","q":0,"h":0,"x":-4.5,"y":-0.8250000000000003},{"e":"C","q":0,"h":0,"x":-3.7500000000000004,"y":-2.1240381056766586},{"e":"C","q":0,"h":0,"x":-2.2500000000000004,"y":-2.124038105676659}],"bonds":[{"a":0,"b":1,"o":1,"s":0},{"a":1,"b":2,"o":2,"s":0},{"a":2,"b":3,"o":1,"s":0},{"a":3,"b":4,"o":2,"s":0},{"a":4,"b":5,"o":1,"s":0},{"a":5,"b":6,"o":2,"s":0},{"a":0,"b":7,"o":1,"s":0},{"a":7,"b":8,"o":2,"s":0},{"a":8,"b":9,"o":1,"s":0},{"a":9,"b":10,"o":2,"s":0},{"a":10,"b":11,"o":1,"s":0},{"a":11,"b":12,"o":2,"s":0},{"a":0,"b":13,"o":1,"s":0},{"a":13,"b":14,"o":2,"s":0},{"a":14,"b":15,"o":1,"s":0},{"a":15,"b":16,"o":2,"s":0},{"a":16,"b":17,"o":1,"s":0},{"a":17,"b":18,"o":2,"s":0},{"a":6,"b":1,"o":1,"s":0},{"a":12,"b":7,"o":1,"s":0},{"a":18,"b":13,"o":1,"s":0}]},"OTr":{"definition":"*OC(c1ccccc1)(c1ccccc1)c1ccccc1","atoms":[{"e":"O","q":0,"h":0,"x":0.08034350951947622,"y":2.1779680715010703},{"e":"C","q":0,"h":0,"x":-0.017475724741321287,"y":0.6811610039707793},{"e":"C","q":0,"h":0,"x":-1.5142827922716129,"y":0.7789802382315761},{"e":"C","q":0,"h":0,"x":-2.177972384188167,"y":2.124162800407297},{"e":"C","q":0,"h":0,"x":-3.6747794517184587,"y":2.2219820346680943},{"e":"C","q":0,"h":0,"x":-4.5078969273321965,"y":0.9746187067531706},{"e":"C","q":0,"h":0,"x":-3.8442073354156427,"y":-0.3705638554225506},{"e":"C","q":0,"h":0,"x":-2.347400267885351,"y":-0.4683830896833483},{"e":"C","q":0,"h":0,"x":1.4793313427889703,"y":0.583341769709982},{"e":"C","q":0,"h":0,"x":2.143020934705525,"y":-0.761840792465739},{"e":"C","q":0,"h":0,"x":3.6398280022358165,"y":-0.8596600267265362},{"e":"C","q":0,"h":0,"x":4.472945477849555,"y":0.3877033011883875},{"e":"C","q":0,"h":0,"x":3.809255885933,"y":1.7328858633641087},{"e":"C","q":0,"h":0,"x":2.3124488184027086,"y":1.8307050976249066},{"e":"C","q":0,"h":0,"x":-0.11529495900211836,"y":-0.8156460635595124},{"e":"C","q":0,"h":0,"x":-1.4604775211778394,"y":-1.4793356554760666},{"e":"C","q":0,"h":0,"x":-1.5582967554386367,"y":-2.9761427230063586},{"e":"C","q":0,"h":0,"x":-0.31093342752371295,"y":-3.8092601986200965},{"e":"C","q":0,"h":0,"x":1.0342491346520084,"y":-3.1455706067035427},{"e":"C","q":0,"h":0,"x":1.1320683689128064,"y":-1.648763539173251}],"bonds":[{"a":0,"b":1,"o":1,"s":0},{"a":1,"b":2,"o":1,"s":0},{"a":2,"b":3,"o":2,"s":0},{"a":3,"b":4,"o":1,"s":0},{"a":4,"b":5,"o":2,"s":0},{"a":5,"b":6,"o":1,"s":0},{"a":6,"b":7,"o":2,"s":0},{"a":1,"b":8,"o":1,"s":0},{"a":8,"b":9,"o":2,"s":0},{"a":9,"b":10,"o":1,"s":0},{"a":10,"b":11,"o":2,"s":0},{"a":11,"b":12,"o":1,"s":0},{"a":12,"b":13,"o":2,"s":0},{"a":1,"b":14,"o":1,"s":0},{"a":14,"b":15,"o":2,"s":0},{"a":15,"b":16,"o":1,"s":0},{"a":16,"b":17,"o":2,"s":0},{"a":17,"b":18,"o":1,"s":0},{"a":18,"b":19,"o":2,"s":0},{"a":7,"b":2,"o":1,"s":0},{"a":13,"b":8,"o":1,"s":0},{"a":19,"b":14,"o":1,"s":0}]},"MMT":{"definition":"*C(c1ccc(OC)cc1)(c1ccccc1)c1ccccc1","atoms":[{"e":"C","q":0,"h":0,"x":0.5704840601309279,"y":-0.8154619679673981},{"e":"C","q":0,"h":0,"x":-0.9294226029448841,"y":-0.7987287058592072},{"e":"C","q":0,"h":0,"x":-1.664884504408913,"y":0.5085951987240888},{"e":"C","q":0,"h":0,"x":-3.1647911674847258,"y":0.5253284608322801},{"e":"C","q":0,"h":0,"x":-3.929235929096509,"y":-0.7652621816428246},{"e":"O","q":0,"h":0,"x":-5.4291425921723215,"y":-0.7485289195346332},{"e":"C","q":0,"h":0,"x":-6.164604493636349,"y":0.558794985048663},{"e":"C","q":0,"h":0,"x":-3.1937740276324806,"y":-2.0725860862261207},{"e":"C","q":0,"h":0,"x":-1.6938673645566684,"y":-2.0893193483343127},{"e":"C","q":0,"h":0,"x":0.5872173222391196,"y":0.684444695108414},{"e":"C","q":0,"h":0,"x":1.894541226822416,"y":1.419906596572442},{"e":"C","q":0,"h":0,"x":1.9112744889306081,"y":2.9198132596482544},{"e":"C","q":0,"h":0,"x":0.6206838464555032,"y":3.684258021260039},{"e":"C","q":0,"h":0,"x":-0.6866400581277933,"y":2.9487961197960106},{"e":"C","q":0,"h":0,"x":-0.7033733202359855,"y":1.4488894567201984},{"e":"C","q":0,"h":0,"x":2.07039072320674,"y":-0.8321952300755895},{"e":"C","q":0,"h":0,"x":2.8058526246707696,"y":-2.1395191346588853},{"e":"C","q":0,"h":0,"x":4.305759287746581,"y":-2.1562523967670773},{"e":"C","q":0,"h":0,"x":5.070204049358365,"y":-0.8656617542919722},{"e":"C","q":0,"h":0,"x":4.334742147894337,"y":0.441662150291324},{"e":"C","q":0,"h":0,"x":2.8348354848185244,"y":0.45839541239951587}],"bonds":[{"a":0,"b":1,"o":1,"s":0},{"a":1,"b":2,"o":1,"s":0},{"a":2,"b":3,"o":2,"s":0},{"a":3,"b":4,"o":1,"s":0},{"a":4,"b":5,"o":1,"s":0},{"a":5,"b":6,"o":1,"s":0},{"a":4,"b":7,"o":2,"s":0},{"a":7,"b":8,"o":1,"s":0},{"a":0,"b":9,"o":1,"s":0},{"a":9,"b":10,"o":2,"s":0},{"a":10,"b":11,"o":1,"s":0},{"a":11,"b":12,"o":2,"s":0},{"a":12,"b":13,"o":1,"s":0},{"a":13,"b":14,"o":2,"s":0},{"a":0,"b":15,"o":1,"s":0},{"a":15,"b":16,"o":2,"s":0},{"a":16,"b":17,"o":1,"s":0},{"a":17,"b":18,"o":2,"s":0},{"a":18,"b":19,"o":1,"s":0},{"a":19,"b":20,"o":2,"s":0},{"a":8,"b":1,"o":2,"s":0},{"a":14,"b":9,"o":1,"s":0},{"a":20,"b":15,"o":1,"s":0}]},"OMMT":{"definition":"*OC(c1ccc(OC)cc1)(c1ccccc1)c1ccccc1","atoms":[{"e":"O","q":0,"h":0,"x":-1.9863804915936156,"y":-1.793561660798177},{"e":"C","q":0,"h":0,"x":-0.9164835881829575,"y":-0.7422193682633982},{"e":"C","q":0,"h":0,"x":0.15341331522770033,"y":0.3091229242713809},{"e":"C","q":0,"h":0,"x":1.5988509003411187,"y":-0.0917638272451653},{"e":"C","q":0,"h":0,"x":2.668747803751777,"y":0.9595784652896137},{"e":"C","q":0,"h":0,"x":2.293207122049017,"y":2.4118075093409392},{"e":"O","q":0,"h":0,"x":3.3631040254596756,"y":3.463149801875718},{"e":"C","q":0,"h":0,"x":4.808541610573093,"y":3.062263050359171},{"e":"C","q":0,"h":0,"x":0.8477695369355986,"y":2.8126942608574863},{"e":"C","q":0,"h":0,"x":-0.22212736647505982,"y":1.7613519683227077},{"e":"C","q":0,"h":0,"x":0.134858704351821,"y":-1.8121162716740564},{"e":"C","q":0,"h":0,"x":-0.2660280471647256,"y":-3.2575538567874744},{"e":"C","q":0,"h":0,"x":0.7853142453700526,"y":-4.327450760198134},{"e":"C","q":0,"h":0,"x":2.237543289421378,"y":-3.9519100784953736},{"e":"C","q":0,"h":0,"x":2.638430040937926,"y":-2.5064724933819558},{"e":"C","q":0,"h":0,"x":1.5870877484031478,"y":-1.4365755899712969},{"e":"C","q":0,"h":0,"x":-1.9678258807177367,"y":0.32767753514725995},{"e":"C","q":0,"h":0,"x":-1.56693912920119,"y":1.773115120260678},{"e":"C","q":0,"h":0,"x":-2.618281421735969,"y":2.8430120236713363},{"e":"C","q":0,"h":0,"x":-4.070510465787295,"y":2.4674713419685768},{"e":"C","q":0,"h":0,"x":-4.471397217303842,"y":1.0220337568551587},{"e":"C","q":0,"h":0,"x":-3.4200549247690626,"y":-0.04786314655550017}],"bonds":[{"a":0,"b":1,"o":1,"s":0},{"a":1,"b":2,"o":1,"s":0},{"a":2,"b":3,"o":1,"s":0},{"a":3,"b":4,"o":2,"s":0},{"a":4,"b":5,"o":1,"s":0},{"a":5,"b":6,"o":1,"s":0},{"a":6,"b":7,"o":1,"s":0},{"a":5,"b":8,"o":2,"s":0},{"a":8,"b":9,"o":1,"s":0},{"a":1,"b":10,"o":1,"s":0},{"a":10,"b":11,"o":2,"s":0},{"a":11,"b":12,"o":1,"s":0},{"a":12,"b":13,"o":2,"s":0},{"a":13,"b":14,"o":1,"s":0},{"a":14,"b":15,"o":2,"s":0},{"a":1,"b":16,"o":1,"s":0},{"a":16,"b":17,"o":2,"s":0},{"a":17,"b":18,"o":1,"s":0},{"a":18,"b":19,"o":2,"s":0},{"a":19,"b":20,"o":1,"s":0},{"a":20,"b":21,"o":2,"s":0},{"a":9,"b":2,"o":2,"s":0},{"a":15,"b":10,"o":1,"s":0},{"a":21,"b":16,"o":1,"s":0}]},"DMT":{"definition":"*C(c1ccc(OC)cc1)(c1ccc(OC)cc1)c1ccccc1","atoms":[{"e":"C","q":0,"h":0,"x":0.053609102522715404,"y":-0.6854066779122518},{"e":"C","q":0,"h":0,"x":1.5490418543312643,"y":-0.5684413633172363},{"e":"C","q":0,"h":0,"x":2.398053164036461,"y":-1.8050414587372017},{"e":"C","q":0,"h":0,"x":3.89348591584501,"y":-1.6880761441421863},{"e":"C","q":0,"h":0,"x":4.539907357948363,"y":-0.33451073412720567},{"e":"O","q":0,"h":0,"x":6.035340109756912,"y":-0.21754541953219053},{"e":"C","q":0,"h":0,"x":6.884351419462108,"y":-1.454145514952156},{"e":"C","q":0,"h":0,"x":3.6908960482431667,"y":0.9020893612927599},{"e":"C","q":0,"h":0,"x":2.195463296434618,"y":0.7851240466977452},{"e":"C","q":0,"h":0,"x":-1.4418236492858336,"y":-0.802371992507267},{"e":"C","q":0,"h":0,"x":-2.2908349589910304,"y":0.43422810291269826},{"e":"C","q":0,"h":0,"x":-3.7862677107995792,"y":0.31726278831768306},{"e":"C","q":0,"h":0,"x":-4.432689152902932,"y":-1.0363026216972975},{"e":"O","q":0,"h":0,"x":-5.928121904711481,"y":-1.1532679362923122},{"e":"C","q":0,"h":0,"x":-6.777133214416677,"y":0.08333215912765346},{"e":"C","q":0,"h":0,"x":-3.583677843197736,"y":-2.272902717117263},{"e":"C","q":0,"h":0,"x":-2.088245091389187,"y":-2.1559374025222486},{"e":"C","q":0,"h":0,"x":-0.06335621207229998,"y":0.8100260738962972},{"e":"C","q":0,"h":0,"x":1.1732438833476653,"y":1.6590373836014936},{"e":"C","q":0,"h":0,"x":1.0562785687526501,"y":3.1544701354100426},{"e":"C","q":0,"h":0,"x":-0.29728684126233035,"y":3.8008915775133953},{"e":"C","q":0,"h":0,"x":-1.533886936682296,"y":2.9518802678081997},{"e":"C","q":0,"h":0,"x":-1.4169216220872816,"y":1.4564475159996506}],"bonds":[{"a":0,"b":1,"o":1,"s":0},{"a":1,"b":2,"o":1,"s":0},{"a":2,"b":3,"o":2,"s":0},{"a":3,"b":4,"o":1,"s":0},{"a":4,"b":5,"o":1,"s":0},{"a":5,"b":6,"o":1,"s":0},{"a":4,"b":7,"o":2,"s":0},{"a":7,"b":8,"o":1,"s":0},{"a":0,"b":9,"o":1,"s":0},{"a":9,"b":10,"o":1,"s":0},{"a":10,"b":11,"o":2,"s":0},{"a":11,"b":12,"o":1,"s":0},{"a":12,"b":13,"o":1,"s":0},{"a":13,"b":14,"o":1,"s":0},{"a":12,"b":15,"o":2,"s":0},{"a":15,"b":16,"o":1,"s":0},{"a":0,"b":17,"o":1,"s":0},{"a":17,"b":18,"o":2,"s":0},{"a":18,"b":19,"o":1,"s":0},{"a":19,"b":20,"o":2,"s":0},{"a":20,"b":21,"o":1,"s":0},{"a":21,"b":22,"o":2,"s":0},{"a":8,"b":1,"o":2,"s":0},{"a":16,"b":9,"o":2,"s":0},{"a":22,"b":17,"o":1,"s":0}]},"ODMT":{"definition":"*OC(c1ccc(OC)cc1)(c1ccc(OC)cc1)c1ccccc1","atoms":[{"e":"O","q":0,"h":0,"x":0.11338726196318527,"y":-2.660688498192327},{"e":"C","q":0,"h":0,"x":0.2787849219925368,"y":-1.169835180774139},{"e":"C","q":0,"h":0,"x":-1.2120683954256506,"y":-1.0044375207447878},{"e":"C","q":0,"h":0,"x":-1.814256478822824,"y":0.3693781554703438},{"e":"C","q":0,"h":0,"x":-3.3051097962410116,"y":0.5347758154996956},{"e":"C","q":0,"h":0,"x":-4.193775030262026,"y":-0.6736422006860846},{"e":"O","q":0,"h":0,"x":-5.6846283476802135,"y":-0.5082445406567329},{"e":"C","q":0,"h":0,"x":-6.286816431077387,"y":0.8655711355583989},{"e":"C","q":0,"h":0,"x":-3.5915869468648536,"y":-2.0474578769012166},{"e":"C","q":0,"h":0,"x":-2.1007336294466663,"y":-2.2128555369305687},{"e":"C","q":0,"h":0,"x":0.44418258202188865,"y":0.3210181366440484},{"e":"C","q":0,"h":0,"x":1.8179982582370204,"y":0.9232062200412209},{"e":"C","q":0,"h":0,"x":1.983395918266373,"y":2.414059537459408},{"e":"C","q":0,"h":0,"x":0.7749779020805929,"y":3.3027247714804235},{"e":"O","q":0,"h":0,"x":0.9403755621099452,"y":4.79357808889861},{"e":"C","q":0,"h":0,"x":2.3141912383250776,"y":5.395766172295782},{"e":"C","q":0,"h":0,"x":-0.5988377741345391,"y":2.7005366880832518},{"e":"C","q":0,"h":0,"x":-0.7642354341638917,"y":1.209683370665064},{"e":"C","q":0,"h":0,"x":1.7696382394107244,"y":-1.3352328408034908},{"e":"C","q":0,"h":0,"x":2.3718263228078977,"y":-2.7090485170186227},{"e":"C","q":0,"h":0,"x":3.8626796402260855,"y":-2.8744461770479743},{"e":"C","q":0,"h":0,"x":4.751344874247099,"y":-1.666028160862194},{"e":"C","q":0,"h":0,"x":4.149156790849927,"y":-0.2922124846470622},{"e":"C","q":0,"h":0,"x":2.6583034734317397,"y":-0.12681482461771001}],"bonds":[{"a":0,"b":1,"o":1,"s":0},{"a":1,"b":2,"o":1,"s":0},{"a":2,"b":3,"o":1,"s":0},{"a":3,"b":4,"o":2,"s":0},{"a":4,"b":5,"o":1,"s":0},{"a":5,"b":6,"o":1,"s":0},{"a":6,"b":7,"o":1,"s":0},{"a":5,"b":8,"o":2,"s":0},{"a":8,"b":9,"o":1,"s":0},{"a":1,"b":10,"o":1,"s":0},{"a":10,"b":11,"o":1,"s":0},{"a":11,"b":12,"o":2,"s":0},{"a":12,"b":13,"o":1,"s":0},{"a":13,"b":14,"o":1,"s":0},{"a":14,"b":15,"o":1,"s":0},{"a":13,"b":16,"o":2,"s":0},{"a":16,"b":17,"o":1,"s":0},{"a":1,"b":18,"o":1,"s":0},{"a":18,"b":19,"o":2,"s":0},{"a":19,"b":20,"o":1,"s":0},{"a":20,"b":21,"o":2,"s":0},{"a":21,"b":22,"o":1,"s":0},{"a":22,"b":23,"o":2,"s":0},{"a":9,"b":2,"o":2,"s":0},{"a":17,"b":10,"o":2,"s":0},{"a":23,"b":18,"o":1,"s":0}]}});
function normalizeAbbreviations(g,aliases,metadata){
 const fail=reason=>{const e=Error('UNRESOLVED_ABBREVIATION: '+reason);e.code='UNRESOLVED_ABBREVIATION';throw e;};
 const sourceAtoms=g.atoms.length,sourceBonds=g.bonds.length,expansions=[];
 const provenance={schema_version:'abbreviation-normalization/1',hadAbbreviation:!!metadata?.groups.some(x=>x.type==='SUP'),expansions,sourceAtomCount:sourceAtoms,sourceBondCount:sourceBonds};
 const pseudo=a=>['*','Du','R','R#'].includes(a.e)||!Object.hasOwn(REFERENCE.exact,a.e);
 for(let i=0;i<sourceAtoms;i++){
  const a=g.atoms[i],groups=(metadata?.groups||[]).filter(s=>s.atoms.includes(metadata.atomIds[i])),sup=groups.filter(s=>s.type==='SUP'),alias=aliases[i];
  // Real atoms in SUP remain authoritative, including display-only labels.
  if(!pseudo(a))continue;
  // Unsupported real elements (notably Ac = actinium) must never become
  // protecting groups merely because their symbols resemble dictionary labels.
  if(!['*','Du','R','R#'].includes(a.e))fail('unsupported atom symbol or untyped abbreviation '+a.e);
  const labels=[alias,...sup.map(s=>s.label)].filter(Boolean);
  if(!labels.length||labels.every(x=>['3','5','R1','R2'].includes(x)))continue;
  provenance.hadAbbreviation=true;
  if(new Set(labels).size!==1)fail('conflicting labels at source atom '+(i+1));
  const label=labels[0],def=Object.hasOwn(abbreviationDefinitions,label)?abbreviationDefinitions[label]:null;if(!def)fail('unsupported or ambiguous label '+label);
  if(groups.length>1||sup.some(s=>s.atoms.length!==1||s.parent)||groups.some(s=>s.type!=='SUP'))fail('overlapping/nested or multi-atom placeholder '+label);
  if(sup.some(s=>['SMT','LABEL'].some(k=>(s.fields[k]||[]).length>1)))fail('duplicate abbreviation definition '+label);
  if(a.q||a.iso||a.map)fail('charged/isotopic/mapped placeholder '+label);
  const edges=g.bonds.map((b,j)=>({b,j})).filter(x=>x.b.a===i||x.b.b===i);
  if(edges.length!==1||edges[0].b.o!==1||edges[0].b.s)fail('requires one non-stereo single-bond attachment: '+label);
  const other=edges[0].b.a===i?edges[0].b.b:edges[0].b.a;
  if(pseudo(g.atoms[other])||g.atoms[other].q||!['C','N','O','S','P'].includes(g.atoms[other].e))fail('unresolved/unsupported external attachment '+label);
  const indices=[i],origin={x:a.x,y:a.y};
  for(let k=1;k<def.atoms.length;k++)indices.push(g.atoms.length+k-1);
  const atoms=def.atoms.map(v=>({...v,x:origin.x+v.x-def.atoms[0].x,y:origin.y+v.y-def.atoms[0].y}));
  g.atoms[i]=atoms[0];g.atoms.push(...atoms.slice(1));delete aliases[i];
  const bonds=[];for(const b of def.bonds){bonds.push(g.bonds.length);g.bonds.push({...b,a:indices[b.a],b:indices[b.b]});}
  expansions.push({label,sourceAtom:metadata?.atomIds[i]??i+1,sourceSGroup:sup[0]?.id??null,definition:def.definition,atoms:indices,bonds,externalAtom:other,externalBond:edges[0].j});
  if(sup[0]){sup[0].disposition='SUPPORTED';sup[0].status='normalized-explicit-fragment';}
 }
 return provenance;
}
function presentationInput(graph){
 // Snapshot boundary: annotations cannot become chemical atoms or identities.
 const molecule=ChemistryCore.molecularGraph(graph);
 for(const [i,a]of molecule.atoms.entries()){
  const v=molecule.bonds.filter(b=>b.a===i||b.b===i).reduce((n,b)=>n+b.o,0);
  if(!Object.hasOwn(REFERENCE.exact,a.e)||!Number.isInteger(a.h)||a.h<0||valenceTarget(a,v)!==v+(a.e==='H'?0:a.h))throw Error('UNRESOLVED_ABBREVIATION: presentation requires a complete atom-level graph');
 }
 return {schema_version:'chemistry-to-presentation/1',molecularGraph:{schema_version:molecule.schema_version,atoms:clone(molecule.atoms),bonds:clone(molecule.bonds)},provenance:clone(graph.normalization||null),semanticAnnotations:clone(graph.ctfile?{groups:graph.ctfile.groups,sourceToGraph:graph.ctfile.sourceToGraph,index_basis:graph.ctfile.index_basis}:null)};
}

function parseMol(text,options={}){
 const records=text.split(/^\$\$\$\$\s*$/m).filter(x=>x.trim());if(records.length!==1)throw Error('Import one MOL/SDF molecule at a time');
 const prepared=CTFileSGroups.prepare(text),sgroups=prepared.metadata;text=prepared.text;
 let {g,aliases}=text.split(/\r?\n/)[3]?.includes('V3000')?readV3000(text):readV2000(text);
const normalization=normalizeAbbreviations(g,aliases,sgroups);
for(const [id,label] of Object.entries(aliases))if(!['3','5','R1','R2'].includes(String(label))&&!['*','R#','R','Du'].includes(g.atoms[id]?.e))throw Error('CHEMISTRY_UNSUPPORTED: unresolved atom alias '+label+' at atom '+(+id+1)+'; export a fully expanded structure');
 // Unrelated directional markers still undergo the existing O/single-bond
 // validation below. A pseudoatom inside any SGroup is never exempted.
 if(sgroups&&g.atoms.some((a,i)=>(!/^[A-Z][a-z]?$/.test(a.e)||['R','Du'].includes(a.e))&&!(['3','5','R1','R2'].includes(String(aliases[i]))&&!sgroups.groups.some(s=>s.atoms.includes(sgroups.atomIds[i])))))throw Error('CHEMISTRY_UNSUPPORTED: UNSUPPORTED_SGROUP_SEMANTICS; SGroup contains unresolved pseudoatoms; export expanded structure');
let marks={};if(!options.manualMarkers){for(const m of text.matchAll(/>[^\n]*<((?:UPSTREAM|DOWNSTREAM|5_PRIME|3_PRIME)_ATTACHMENT)>[^\n]*\n\s*(\d+)/gi)){const i=Number(m[2])-1;if(!g.atoms[i]||g.atoms[i].e!=='O')throw Error('SDF attachment must identify a real O');const label=/^(UPSTREAM|5_)/i.test(m[1])?'5':'3';aliases[i]=label;}}g.atoms.forEach((a,i)=>{if(a.e==='O'&&!options.manualMarkers){const labels=[aliases[i],a.map].map(v=>String(v??'').replace(/[′'’]/g,'').trim()).filter(v=>v==='3'||v==='5');if(new Set(labels).size>1)throw Error('Conflicting directional O labels');const label=labels[0];if(label==='3'||label==='5'){if(marks[label])throw Error('Duplicate directional OH marker');marks[label]={attachment:i};}return;}if(!['*','R#','R','Du','5','3','R1','R2','R3'].includes(a.e))return;if(options.manualMarkers){let bs=g.bonds.filter(b=>b.a===i||b.b===i);if(bs.length!==1||bs[0].o!==1)throw Error('手动模式也仅允许单键 terminal marker');let j=bs[0].a===i?bs[0].b:bs[0].a;if(g.atoms[j].e!=='O'||g.atoms[j].q)throw Error('手动模式的 marker 仍必须连接真实中性 O');marks['manual'+i]={marker:i,attachment:j};return;}let labels=[aliases[i],a.e,a.map,a.iso].map(String);let v=labels.find(x=>x==='3'||x==='5');let candidates=new Set(labels.flatMap(x=>x==='5'||x==='R1'?['5']:x==='3'||x==='R2'?['3']:[]));if(candidates.size>1)throw Error('同一 marker 的 5′/3′ 标记冲突');if(!v){if(labels.includes('R1'))v='5';else if(labels.includes('R2'))v='3';}if(!v)throw Error('未分配的 general/R3 marker；仅 5/3 或 R1→5′、R2→3′ 可作为两端，其他 marker 请在原绘图中明确处理');let neighbors=g.bonds.filter(b=>b.a===i||b.b===i);if(marks[v]!==undefined||neighbors.length!==1||neighbors[0].o!==1)throw Error('marker 必须唯一且只有一个 single bond');let b=neighbors[0],j=b.a===i?b.b:b.a;if(g.atoms[j].e!=='O'||g.atoms[j].q)throw Error('marker 必须连接真实中性 O');marks[v]={marker:i,attachment:j};});if(!options.manualMarkers&&marks[3]&&marks[5]&&marks[3].attachment===marks[5].attachment)throw Error('需要不同的 5′/3′ attachment O');let remove=new Set(Object.values(marks).filter(v=>v.marker!==undefined).map(v=>v.marker)),mapping={},atoms=[];g.atoms.forEach((a,i)=>{if(!remove.has(i)){mapping[i]=atoms.length;atoms.push(a);}});const sgroupMetadata=sgroups?{...sgroups,sourceToGraph:{atoms:Object.fromEntries(sgroups.atomIds.map((id,i)=>[id,mapping[i]??null])),bonds:{}}}:null;let sourceBondIndex=0;if(sgroupMetadata)g.bonds.slice(0,normalization.sourceBondCount).forEach((b,i)=>{sgroupMetadata.sourceToGraph.bonds[sgroups.bondIds[i]]=remove.has(b.a)||remove.has(b.b)?null:sourceBondIndex++;});const bondMapping={};let normalizedBondIndex=0;g.bonds.forEach((b,i)=>{if(!remove.has(b.a)&&!remove.has(b.b))bondMapping[i]=normalizedBondIndex++;});for(const e of normalization.expansions){e.bonds=e.bonds.map(i=>bondMapping[i]);e.externalBond=bondMapping[e.externalBond];e.atoms=e.atoms.map(i=>mapping[i]);e.externalAtom=mapping[e.externalAtom];}g={normalization,...(sgroupMetadata?{ctfile:sgroupMetadata}:{}),atoms,bonds:g.bonds.filter(b=>!remove.has(b.a)&&!remove.has(b.b)).map(b=>({...b,a:mapping[b.a],b:mapping[b.b]}))};
for(const a of g.atoms){if(!(a.e in REFERENCE.exact)||!Number.isInteger(a.q||0)||a.iso)throw Error('Custom requires supported elements, integer formal charge, no isotope scaffold');}if(!connected(g))throw Error('Custom scaffold 必须连通');const adjacency=g.atoms.map(()=>[]);for(const b of g.bonds){adjacency[b.a].push(b);adjacency[b.b].push(b);}g.atoms.forEach((a,i)=>{let bs=adjacency[i],v=bs.reduce((s,b)=>s+b.o,0),target=valenceTarget(a,v);if(v>target||(a.e==='P'&&v!==5)||(a.e==='S'&&![0,1,2,4,6].includes(v)))throw Error('不支持或存在歧义的价态；Custom P 仅覆盖五价 P，S 仅覆盖常规 2/4/6 价');a.h=a.e==='H'?0:target-v;});for(const v of Object.values(marks)){let i=mapping[v.attachment],bs=g.bonds.filter(b=>b.a===i||b.b===i);if(bs.length!==1||g.atoms[i].h!==1||g.atoms[bs[0].a===i?bs[0].b:bs[0].a].e!=='C')throw Error('attachment 必须为 alcohol OH');}normalizeCoordinates(g);return {graph:g,attachments:options.manualMarkers?{}:Object.fromEntries(Object.entries(marks).map(([k,v])=>[k,mapping[v.attachment]])),formula:formula(graphFormula(g)),...masses(graphFormula(g)),assembly_supported:!!(marks[5]||marks[3])};}

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
function registerCustom(name,imported,target=customLibrary){
 if(typeof name!=='string'||!/^[A-Za-z0-9_]{1,24}$/.test(name))throw Error('名称不能为空；请使用 1–24 位英文字母、数字或下划线，可用数字或下划线开头');
 const key=('{'+name+'}').toLowerCase();
 if(Object.keys(target).some(k=>k.toLowerCase()===key))throw Error('Name / symbol already exists: '+name+'; choose a different name');
 const reserved=['[p]','[pp]','[ppp]','[PHO]','[phosphorylation]',...Object.keys(REFERENCE.templates),...COVERAGE.entries.map(e=>e.notation),...Object.keys(COVERAGE.aliases||{}),...(typeof CONJUGATION_POOL==='undefined'?[]:CONJUGATION_POOL.map(e=>'['+e.id+']'))];
 if(reserved.some(k=>k.replace(/^\[/,'{').replace(/\]$/,'}').toLowerCase()===key))throw Error('Reserved built-in name / symbol: '+name+'; choose a different name');
 const r=selectAttachments(imported,imported.attachments[5],imported.attachments[3]),g=normalizeCoordinates(r.graph),five=r.attachments[5]??null,three=r.attachments[3]??null;
 const A=g.atoms[five??three],B=g.atoms[three??five],dx=B.x-A.x,dy=B.y-A.y,L=Math.hypot(dx,dy),ax=A.x,ay=A.y;
 // Translation, positive uniform scale and rotation preserve stereochemical handedness.
 for(const a of g.atoms){const x=a.x-ax,y=a.y-ay;a.x=L?(x*dy-y*dx)/L:x;a.y=L?(x*dx+y*dy)/L:y;}
 g.layout_metadata={expanded:extent(g.atoms.map(a=>a.x),'max')-extent(g.atoms.map(a=>a.x),'min')>14};g.id='{'+name+'}';g.family='Custom';g.assembly_class='o-phosphorus';g.o5=five;g.o3=three;g.attachments={};
 for(const [direction,atom]of [['upstream',five],['downstream',three]])if(atom!==null){const bs=g.bonds.filter(b=>b.a===atom||b.b===atom);g.attachments[direction]={atom,atom_role:'user-selected-OH',direction,element:g.atoms[atom].e,connection_class:'alcohol',compatibility_domain:'standard-O',unconnected:{state:'OH',hydrogens:1},local_bonds:bs.map(b=>({atom:b.a===atom?b.b:b.a,order:b.o})),allowed_linkage_classes:[...PHOSPHORUS_CLASSES],internal_phosphorus:[...PHOSPHORUS_CLASSES],terminal_phosphorus:[...PHOSPHORUS_CLASSES]};}
 g.phosphorus_topology='standard-5-to-3';
 if(imported.optical){if(!validOptical(imported.optical))throw Error('Invalid optical metadata');g.optical=clone(imported.optical);}
 if(imported.extinction){if(!validExtinction(imported.extinction))throw Error('Invalid extinction metadata');g.extinction=clone(imported.extinction);}
 target[g.id]=clone(g);return clone(g);
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
 if(g.sites)g.sites.forEach((s,i)=>{if(i%10===0&&Math.abs(atoms[s.o5??s.o3??s.offset].y-(s.local_anchor_y||0))>1e-7)out.column_top_errors.push(i);});out.pass=out.pass&&!out.column_top_errors.length;return out;
}
function calculateSafe(sequence){try{return calculate(sequence);}catch(e){return {schema_version:'oligo-lite/2',input_sequence:sequence,canonical_sequence:null,status:'error',errors:[{code:e.message.match(/^([A-Z_]+):/)?.[1]||(e.message.includes('not found')?'UNKNOWN_UNIT':'INVALID_CHEMISTRY_OR_NOTATION'),message:e.message}],chemistry:null,optical:null,graph:null};}}
function buildStructure(sequence){return calculate(sequence).graph;}
return {presentationInput,abbreviationSupport:()=>Object.fromEntries(Object.entries(abbreviationDefinitions).map(([k,v])=>[k,v.definition])),graphProperties,valenceTarget,core:ChemistryCore,linkageDefinitions,toAssemblyGraph:p=>toAssemblyGraph(typeof p==='string'?parse(p):p),expandAssemblyGraph,getBuildingBlock:code=>template(code)?clone(template(code)):null,attachment,normalizeCoordinates,exportImportedSource:g=>g.ctfile?.source||null,parse,validateChemistry,calculate,calculateSafe,buildStructure,formula,graphFormula,connected,mol,svg,cdxml,parseMol,parseSmiles,selectAttachments,registerCustom,customLibrary,quality};})();
if(typeof module!=='undefined')module.exports=Lite;



