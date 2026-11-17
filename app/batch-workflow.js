'use strict';
// Batch owns workbook IO and workflow order. Builder owns molecule state and chemistry.
const BatchWorkflow=(()=>{
 const sheets={
  en:{molecules:'Molecules',instructions:'Instructions',reduce:'Disulfide Reduction',
   prompt:'Choose the next reagent or transformation. Leave unused steps at the end blank.',
   guidance:[
    'Enter one product per row. Use the same sequence notation as Molecule Builder.',
    'Choose steps left to right. Leave all unused steps at the end blank.',
    'One step: Sequence → SMCC',
    'Two steps: Sequence → SMCC → thiol peptide',
    'Three steps: amine + protected disulfide sequence → activated ester peptide → Disulfide Reduction → maleimide payload',
    'Re-upload the same MOL/SDF if you reopen Toolkit. Import this workbook, Preview, then Calculate.',
    'If several products are possible, choose a candidate in Toolkit.'
   ]},
  zh:{molecules:'分子',instructions:'填写说明',reduce:'二硫键还原',
   prompt:'请选择下一步的试剂或操作。未使用的步骤请留在行尾。',
   guidance:[
    '每行填写一个产物，序列格式与分子构建器一致。',
    '从左向右选择步骤，未使用的步骤请在行尾留空。',
    '单步：序列 → SMCC',
    '两步：序列 → SMCC → 巯基肽',
    '三步：含胺和保护二硫键的序列 → 活性酯肽 → 二硫键还原 → 马来酰亚胺载荷',
    '重新打开 Toolkit 后请上传相同的 MOL/SDF。导入工作簿后先预览，再计算。',
    '如有多个可能产物，请在 Toolkit 中选择候选项。'
   ]}
 };
 const reductionId=JSON.stringify(['transformation','reduce-disulfide']);
 const schema='batch-post-functionalization/2';
 const lastRow=1048576;
 const key=s=>String(s??'').trim().toLowerCase();
 const xml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
 function library(){
  return new Map(['builtin','user'].flatMap(source=>Product.store.reagents(source,null,null).map(
   r=>[JSON.stringify([source,r.id]),{...r,source}]
  )));
 }
 function catalog(structures){
  const entries=library();
  for(const [id,record] of structures)if(record.graph){
   entries.set(JSON.stringify(['upload',record.stableId]),{name:id,source:'upload',graph:record.graph});
  }
  return entries;
 }
 function choices(entries,language){
  const names=new Set();
  const suffix=language==='zh'?{builtin:'内置',user:'自定义',upload:'本次上传'}:{builtin:'Built-in',user:'User library',upload:'Uploaded'};
  return [...entries].map(([id,r])=>{
   const base=r.name+' · '+suffix[r.source];
   let label=base;
   for(let n=2;names.has(key(label));n++)label=base+' ('+n+')';
   names.add(key(label));
   return [label,id];
  });
 }
 function sheetRows(book,name,columns,required,ordered=false){
  const sheet=book.Sheets[name];
  if(!sheet)throw Error('Missing worksheet: '+name);
  const [header=[],...data]=XLSX.utils.sheet_to_json(sheet,{header:1,raw:true,defval:'',blankrows:true,range:0});
  const indices=columns.map((col,j)=>{
   if(ordered)return j;
   const matches=header.flatMap((cell,i)=>key(cell)===key(col)?[i]:[]);
   if(matches.length>1||(!matches.length&&j<required))throw Error(name+': expected one column named '+col);
   return matches[0];
  });
  return data.flatMap((line,i)=>{
   const row=i+2;
   const cells=indices.map(c=>c===undefined?undefined:sheet[XLSX.utils.encode_cell({r:i+1,c})]);
   if(!line.some(cell=>String(cell).trim())&&!cells.some(cell=>cell?.f||cell?.t==='e'))return [];
   const values=indices.map(c=>c===undefined?'':String(line[c]??'').trim());
   const invalid=cells.some(cell=>cell&&(cell.f||cell.t==='e'));
   return [{row,values,inputError:invalid?name+' row '+row+': paste values in place of Excel formulas or errors':''}];
  });
 }
 function structured(book){
  return !!book.Sheets.Lists||Object.values(sheets).some(words=>book.Sheets[words.molecules])||
   Object.values(book.Sheets).some(sheet=>{
    const range=XLSX.utils.decode_range(sheet['!ref']||'A1');
    range.s.r=range.e.r=0;
    const [header=[]]=XLSX.utils.sheet_to_json(sheet,{header:1,range});
    return header.some(value=>/^step [0-9]+$/i.test(String(value).trim()));
   });
 }
 function read(book){
  const lists=book.Sheets.Lists;
  const lang=lists?.D1?.v;
  if(lists?.C1?.v!==schema||!Object.hasOwn(sheets,lang))throw Error('Generate a new Post-functionalization template in Toolkit.');
  const words=sheets[lang],choices=new Map();
  for(const {values:[label,id],inputError} of sheetRows(book,'Lists',['Step label','Step ID'],2)){
   if(inputError||!label||!id||choices.has(key(label)))throw Error('Invalid template step list. Generate a new template.');
   choices.set(key(label),id);
  }
  const sheet=book.Sheets[words.molecules];
  if(!sheet)throw Error('Missing worksheet: '+words.molecules);
  const range=XLSX.utils.decode_range(sheet['!ref']||'A1');
  range.s.r=range.e.r=0;
  const [header=[]]=XLSX.utils.sheet_to_json(sheet,{header:1,range});
  const columns=header.map(key);
  if(columns.length<3||columns[0]!=='id'||columns[1]!=='sequence'||
    Array.from(columns.slice(2)).some((label,i)=>label!=='step '+(i+1))){
   throw Error(lang==='zh'?'表头应依次为 ID、Sequence、Step 1、Step 2……。':'Expected ID, Sequence, then consecutive Step 1, Step 2, … columns.');
  }
  const rows=[],ids=new Set();
  for(const {row,values:[ID,Sequence,...steps],inputError} of sheetRows(book,words.molecules,columns,columns.length,true)){
   if(!ID||ID.length>100||ids.has(key(ID)))throw Error(words.molecules+' row '+row+': enter a unique ID (1–100 characters)');
   ids.add(key(ID));
   const entry={ID,Sequence,sourceRow:row,inputError,operations:[]};
   const gap=steps.indexOf('');
   const used=gap===-1?steps:steps.slice(0,gap);
   const later=gap===-1?-1:steps.findIndex((value,i)=>i>gap&&value);
   if(later!==-1){
    entry.inputError=lang==='zh'?`第 ${row} 行：Step ${gap+1} 为空，但 Step ${later+1} 已填写。请把空白步骤移到行尾。`:
     `Row ${row}: Step ${gap+1} is blank but Step ${later+1} is filled. Move unused steps to the end.`;
   }
   entry.operations=used.map((input,i)=>{
    const reagentId=choices.get(key(input));
    return {step:i+1,action:reagentId===reductionId?'reduce-disulfide':'add',input,reagentId};
   });
   rows.push(entry);
  }
  return rows;
 }
 function template(structures=new Map(),language='en',{example=false,stepCount=5}={}){
  if(!Number.isInteger(stepCount)||stepCount<1||stepCount>16382)throw Error('Choose between 1 and 16382 Excel step columns.');
  const words=sheets[language];
  const options=[...choices(catalog(structures),language),[words.reduce,reductionId]];
  const book=XLSX.utils.book_new();
  const smcc=options.find(([,id])=>id===JSON.stringify(['builtin','builtin:linker1:smcc']))?.[0];
  const header=['ID','Sequence',...Array.from({length:stepCount},(_,i)=>'Step '+(i+1))];
  const tables=[
   [words.molecules,[header,...(example&&smcc?[['Example-1','rArC[C6N]',smcc]]:[])],[18,35,...Array(stepCount).fill(29)]],
   [words.instructions,words.guidance.map(line=>[line]),[112]],
   ['Lists',[['Step label','Step ID',schema,language],...options],[50,60]]
  ];
  for(const [name,rows,widths] of tables){
   const sheet=XLSX.utils.aoa_to_sheet(rows);
   sheet['!cols']=widths.map(wch=>({wch}));
   XLSX.utils.book_append_sheet(book,sheet,name);
  }
  book.Workbook={
   Sheets:book.SheetNames.map(name=>({Hidden:name==='Lists'?1:0})),
   Names:[{Name:'BatchSteps',Ref:"'Lists'!$A$2:$A$"+(options.length+1)}]
  };
  return book;
 }
 async function templateBytes(structures,language,options){
  const book=template(structures,language,options),words=sheets[language];
  // The offline workbook writer omits validation and frozen panes. Add those
  // native worksheet parts before saving, preserving the generated workbook.
  const zip=await JSZip.loadAsync(XLSX.write(book,{type:'array',bookType:'xlsx',compression:true}));
  const stylePath='xl/styles.xml';
  const styles=await zip.file(stylePath).async('string');
  const styled=styles
   .replace('<fonts count="1">','<fonts count="2">')
   .replace('</fonts>','<font><b/><sz val="12"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>')
   .replace('<fills count="2">','<fills count="3">')
   .replace('</fills>','<fill><patternFill patternType="solid"><fgColor rgb="FF22545B"/><bgColor indexed="64"/></patternFill></fill></fills>')
   .replace('<cellXfs count="1">','<cellXfs count="3">')
   .replace('</cellXfs>','<xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'+
    '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs>');
  zip.file(stylePath,styled);
  const lastColumn=XLSX.utils.encode_col((options?.stepCount??5)+1);
  const path='xl/worksheets/sheet1.xml';
  const original=await zip.file(path).async('string');
  const pane='<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/>';
  const filter='<autoFilter ref="A1:'+lastColumn+lastRow+'"/>';
  const prompt=xml(words.prompt);
  const data='<dataValidations count="1"><dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1" errorStyle="stop" error="'+prompt+'" prompt="'+prompt+'" sqref="C2:'+lastColumn+lastRow+'"><formula1>BatchSteps</formula1></dataValidation></dataValidations>';
  const formatted=original.replace(/<col\b[^>]+\/>/g,tag=>tag.replace('/>',' style="1"/>'))
   .replace(/<c r="[A-Z]+1"(?=[\s>])/g,tag=>tag+' s="2"');
  zip.file(path,formatted.replace(/(<sheetView\b[^>]*?)(?:\/>|>[\s\S]*?<\/sheetView>)/,
   (_,tag)=>tag+'>'+pane+'</sheetView>').replace('</sheetData>','</sheetData>'+filter+data));
  return zip.generateAsync({type:'uint8array',compression:'DEFLATE'});
 }
 async function upload(files){
  const registry=new Map(),errors=[];
  await SmallFragmentDepictor.ready;
  for(const file of files){
   let records;
   try{
    if(!/\.(mol|sdf)$/i.test(file.name))throw Error('Expected a MOL or SDF file');
    const content=await file.text();
    records=content.replace(/\r\n/g,'\n').split(/^\$\$\$\$[ \t]*$(?:\n)?/m);
    if(records.length>1&&!records.at(-1).trim())records.pop();
    if(records.length>1&&!/\.sdf$/i.test(file.name))throw Error('Multiple records require an SDF file');
   }catch(e){errors.push(file.name+': '+e.message);continue;}
   for(const [i,record] of records.entries()){
    const id=records.length===1?file.name:file.name+'#'+(i+1);
    if(registry.has(id)){registry.set(id,{error:'Duplicate uploaded structure name '+id});continue;}
    try{
     if(!/^M  END[ \t]*$/m.test(record))throw Error('Missing MOL record terminator (M  END)');
     const graph=ReagentSource.parseUpload(record);
     const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(record.trimEnd()));
     const hash=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
     registry.set(id,{graph,stableId:id+'@'+hash});
    }catch(e){registry.set(id,{error:id+': '+e.message});}
   }
  }
  return {registry,errors};
 }
 function reagentError(op,entries){
  if(op.inputError)return op.inputError;
  if(op.action==='reduce-disulfide')return '';
  if(!op.reagentId)return 'Step choice is absent from the template dropdown: '+op.input;
  if(entries.has(op.reagentId))return '';
  if(op.reagentId.startsWith('["upload",'))return 'Missing or changed upload. Re-upload the same MOL/SDF: '+op.input;
  return 'Reagent is no longer available in the active library: '+op.input;
 }
 function apply(state,op,entries){
  const error=reagentError(op,entries);
  if(error)throw Error(error);
  const automatic=!op.selection;
  const secondary=op.action==='add'?entries.get(op.reagentId).graph:null;
  const result=MoleculeBuilder.quick(state,secondary);
  const candidates=result.candidates.filter(c=>secondary?c.family!=='DisulfideReduction':c.family==='DisulfideReduction');
  if(!candidates.length)throw Error('No compatible reaction'+(result.reason?' · '+result.reason:''));
  const candidate=automatic?(candidates.length===1?candidates[0]:null):candidates.find(c=>c.candidate_id===op.selection);
  if(candidate)return {state:MoleculeBuilder.react(state,{family:candidate.family,secondary,candidateId:candidate.candidate_id})};
  const review=candidates.map(c=>({
   id:c.candidate_id,family:c.family,definition:c.definition_id,orientation:c.orientation,
   sites:c.sites.map(s=>({input:s.input,motif:s.motif_type||s.type,atoms:Object.fromEntries(Object.entries(s.atoms).map(([role,i])=>[role,i+1]))})),
   retainedComponent:c.retained_component
  }));
  return {review,message:automatic?'':'The selected candidate is no longer available. Choose again in Toolkit.'};
 }
 return {sheetRows,structured,read,template,templateBytes,upload,catalog,reagentError,apply};
})();
