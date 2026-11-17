'use strict';
// Only orchestration and IO. All chemistry belongs to the shared Molecule Builder.
const Batch = (() => {
 const headers=['ID','Name','Sequence','Workflow Status','Last Successful Step','Review Step','Operations Applied','Candidates','Formula','Average MW','Exact Mass','epsilon260','nmol/OD260','ug/OD260','Chemistry Status','Structure Status','OD Status','Error/Warning','Structure Details','OD Details','Output Name','Source Row'];
 const filesWarning=status=>status==='PARTIAL_EXPORT_ERROR'?'Some structure formats failed to export.':'Structure export failed.';
 const pause=()=>new Promise(resolve=>setTimeout(resolve,0));
 function classify(e){const m=e.message||String(e);let code=m.match(/^([A-Z_]+):/)?.[1];if(/PENDING|IMPLEMENTATION_PENDING/.test(code||''))code='CHEMISTRY_PENDING';if(!code)code=/Unsupported notation|not found|Missing|请输入|linkage|unit ID/i.test(m)?'INVALID_TOKEN':'INVALID_CHEMISTRY_OR_NOTATION';return {code,message:m};}
 function validate(sequence,inputError){try{if(inputError)throw Error(inputError);MoleculeBuilder.start(sequence);return {status:'VALID',message:''};}catch(e){const x=classify(e);return {status:x.code==='CHEMISTRY_PENDING'?'RECOGNIZED_PENDING':'INVALID',message:x.code+': '+x.message};}}
 function names(rows,{sequenceOnly=false}={}){const used=new Set();return rows.map((r,i)=>{let base=String((sequenceOnly?r['Compound ID']??r.ID:r.ID)||'').normalize('NFKC').trim().replace(/[<>:"/\\|?*\x00-\x1f\x7f]/g,'_').replace(/[. ]+$/g,'').slice(0,100).replace(/[. ]+$/g,'')||'row_'+(r.sourceRow||i+2);if(/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(base))base='_'+base;let s=base,n=2;while(used.has(s.toLowerCase()))s=base+'_'+n++;used.add(s.toLowerCase());return s;});}
 async function run(rows,{sequenceOnly=false,formats=[],structures=new Map(),progress=()=>{},cancelled=()=>false,onResult=()=>{},rowsPerColumn=PresentationOptions.rows}={}){
  const output=[],diagnostics=new Map(),entries=sequenceOnly?null:BatchWorkflow.catalog(structures),stems=names(rows,{sequenceOnly}),zip=formats.length?new JSZip():null;let bytes=0;const started=performance.now();
  for(let i=0;i<rows.length;i++){
   if(cancelled())break;
   const input=rows[i],r={ID:input.ID,Name:input.Name||'',Sequence:input.Sequence,'Workflow Status':'FAILED','Last Successful Step':'','Operations Applied':'',Candidates:'',Formula:'','Average MW':'','Exact Mass':'',epsilon260:'','nmol/OD260':'','ug/OD260':'','Chemistry Status':'','Structure Status':formats.length?'STRUCTURE_UNSUPPORTED':'NOT_REQUESTED','OD Status':'UNSUPPORTED','Error/Warning':'','Output Name':'','Source Row':input.sourceRow||i+2};
   if(sequenceOnly)Object.assign(r,{'Sequence No.':input['Sequence No.']??String(i+1),'Compound ID':input['Compound ID']??input.ID});
   const notes=[],operations=[],exportErrors=[],unavailable=[];
   let state=null,step=0;
   try{
    if(input.inputError)throw Error(input.inputError);
    state=MoleculeBuilder.start(input.Sequence);
    r['Last Successful Step']=0;
    for(const op of sequenceOnly?[]:input.operations||[]){
     step=op.step;
     const next=BatchWorkflow.apply(state,op,entries);
     if(next.review){
      r['Workflow Status']='NEEDS REVIEW';
      r['Review Step']=step;
      r.Candidates=JSON.stringify(next.review);
      throw Error(next.message||'Multiple compatible candidates. Choose a product in Toolkit.');
     }
     state=next.state;
     r['Last Successful Step']=step;
     operations.push(step+' '+state.operation.kind+(op.input?' ('+op.input+')':''));
    }
    const o=state.optical;
    r.Formula=state.formula;r['Average MW']=state.average_mw;r['Exact Mass']=state.exact_mass;
    r['Workflow Status']='PASS';r['Chemistry Status']='REGRESSION_VALIDATED';
    r['OD Status']=o?.supported?(o.estimated?'ESTIMATED':o.status):'OD_PARAMETER_UNAVAILABLE';
    r['OD Details']=o?.supported?[o.method,...new Set(o.assumptionLedger?.map(a=>a.detail)||[])].join(' · '):(o?.reason||'Optical parameters unavailable');
    if(!o?.supported&&o?.evidence?.reasonCodes?.length)r['OD Details']=o.evidence.reasonCodes.join(', ')+' · '+r['OD Details'];
    if(o?.supported){
     r.epsilon260=o.epsilon260;r['nmol/OD260']=o.nmol_per_od;r['ug/OD260']=o.ug_per_od;
    }
   }catch(e){
    const x=classify(e);
    if(x.code==='CHEMISTRY_PENDING')r['Workflow Status']='UNRESOLVED';
    r['Chemistry Status']=r['Workflow Status']==='NEEDS REVIEW'?'NEEDS REVIEW':x.code;
    if(formats.length)r['Structure Status']='NO_FINAL_PRODUCT';
    r['OD Status']='NO_FINAL_PRODUCT';
    r.failureMessage=x.message;
    notes.push(input.ID+' · Step '+step+' · '+x.message);
    if(state)diagnostics.set(i,state);
   }
   r['Operations Applied']=operations.join(' → ');
   if(r['Workflow Status']==='PASS'){
    onResult(state,r,i);
    if(formats.length){
     const files=[];
     try{
      const record=MoleculeBuilder.record(state);
      let drawing;
      for(const format of formats){
       try{
        const schematic=format==='schematic.svg'?StructurePresentation.schematic(record,{language:document.documentElement.lang,basesPerColumn:rowsPerColumn}):undefined;
        if(schematic&&!schematic.supported){
         unavailable.push(format+': '+schematic.reason);
         continue;
        }
        if(['cdxml','mol','sdf'].includes(format))drawing||=LocalViewers.chemicalDrawing(record,rowsPerColumn);
        const data=LocalViewers.serializeStructure(record,format,{name:stems[i],drawing,schematic,rows:rowsPerColumn});
        const filename=stems[i]+'.'+(sequenceOnly&&format==='schematic.svg'?'svg':format);
        zip.file(filename,data);bytes+=new TextEncoder().encode(data).length;files.push(filename);
       }catch(e){exportErrors.push(format+': '+e.message);}
      }
     }catch(e){exportErrors.push('Product structure: '+e.message);}
     r['Output Name']=files.join('; ');
     r['Structure Status']=exportErrors.length?(files.length?'PARTIAL_EXPORT_ERROR':'EXPORT_ERROR'):
      unavailable.length?(files.length?'PARTIAL_UNSUPPORTED':'STRUCTURE_UNSUPPORTED'):'OK';
     r['Structure Details']=[...exportErrors,...unavailable].join(' | ');
    }
   }
   if(r['Workflow Status']==='PASS'){
    if(exportErrors.length)notes.push(filesWarning(r['Structure Status']));
    if(unavailable.length)notes.push('Some requested structure formats are unavailable for this product.');
    if(r['OD Status']==='OD_PARAMETER_UNAVAILABLE')notes.push('OD parameters unavailable.');
    if(r['OD Status']==='ESTIMATED')notes.push('OD estimated.');
    if(notes.length)notes.unshift('Chemistry succeeded.');
   }
   r['Error/Warning']=notes.join(' ');output.push(r);progress({done:i+1,total:rows.length,bytes});
   // Yield after every row so progress, cancellation and other page controls work.
   await pause();
  }
  return {rows:output,diagnostics,zip,bytes,elapsedMs:performance.now()-started,total:rows.length,cancelled:output.length<rows.length};
 }
 function summary(r){const a=r.rows;return [['Metric','Value'],['Total input',r.total],['Processed',a.length],['Cancelled / unprocessed',r.total-a.length],['Chemistry valid',a.filter(x=>!!x.Formula).length],['Chemistry pending',a.filter(x=>x['Chemistry Status']==='CHEMISTRY_PENDING').length],['Chemistry failed',a.filter(x=>x['Workflow Status']==='FAILED').length],['Structure OK',a.filter(x=>x['Structure Status']==='OK').length],['Structure export errors',a.filter(x=>/EXPORT_ERROR/.test(x['Structure Status'])).length],['Structure formats unavailable',a.filter(x=>['PARTIAL_UNSUPPORTED','STRUCTURE_UNSUPPORTED'].includes(x['Structure Status'])).length],['OD unavailable',a.filter(x=>x['OD Status']==='OD_PARAMETER_UNAVAILABLE').length],['OD estimated',a.filter(x=>x['OD Status']==='ESTIMATED').length],['Duration (s)',r.elapsedMs/1000],['Structure source bytes',r.bytes],...['PASS','NEEDS REVIEW','FAILED','UNRESOLVED'].map(status=>[status,a.filter(x=>x['Workflow Status']===status).length]),['Engine','Shared Molecule Builder and Presentation C'],['OD convention','1 OD260 = A260 1 in 1 mL at 1 cm'],['Version','v2.4.3']];}
 function candidateRows(r){
  return r.Candidates?JSON.parse(r.Candidates).map(c=>({selection:c.id,description:[c.definition||c.family,c.orientation,
    ...c.sites.map(s=>['Input '+(s.input+1),s.motif,Object.entries(s.atoms).map(([role,n])=>role+' '+n).join(', ')].join(' / ')),
    c.retainedComponent==null?'':'Retained fragment '+(c.retainedComponent+1)].filter(Boolean).join(' · ')})):[];
 }
 function workbook(result){
  const w=XLSX.utils.book_new();
  const candidates=[];
  const rows=result.rows.map(r=>{
   const choices=candidateRows(r);
   for(const c of choices)candidates.push([r.ID,r['Review Step'],c.selection,c.description]);
   return {...r,Candidates:choices.length?choices.length+' (see Candidates sheet)':''};
  });
  const sheet=XLSX.utils.json_to_sheet(rows,{header:headers.slice()});
  const massColumn=headers.indexOf('ug/OD260');
  for(let i=0;i<rows.length;i++){
   const cell=sheet[XLSX.utils.encode_cell({r:i+1,c:massColumn})];
   if(cell?.t==='n')cell.z='0.00';
  }
  sheet['!cols']=headers.map(h=>({wch:h==='Sequence'?48:h==='Error/Warning'?70:h==='Output Name'?42:23}));
  sheet['!autofilter']={ref:sheet['!ref']};
  XLSX.utils.book_append_sheet(w,sheet,'Results');
  XLSX.utils.book_append_sheet(w,XLSX.utils.aoa_to_sheet(summary(result)),'Summary');
  if(candidates.length){
   const choices=XLSX.utils.aoa_to_sheet([['Molecule ID','Step','Candidate ID','Candidate details'],...candidates]);
   choices['!cols']=[{wch:23},{wch:10},{wch:60},{wch:80}];
   XLSX.utils.book_append_sheet(w,choices,'Candidates');
  }
  return w;
 }
 const norm=x=>String(x??'').replace(/^\uFEFF/,'').trim().toLowerCase().replace(/[\s_\-]+/g,'');
 function sequenceRows(book){
  const sheet=book.SheetNames.find(name=>norm(name)==='sequences')||book.SheetNames[0];
  const [header=[]]=XLSX.utils.sheet_to_json(book.Sheets[sheet],{header:1,range:0,blankrows:true});
  const aliases=['Sequence No.','序列编号','序列编号 / Sequence No.'];
  const numberHeader=header.find(cell=>aliases.some(alias=>norm(alias)===norm(cell)));
  const modern=numberHeader!==undefined||header.some(cell=>norm(cell)==='compoundid');
  const columns=modern?[numberHeader??'Sequence No.','Compound ID','Sequence']:['ID','Sequence','Name'];
  return BatchWorkflow.sheetRows(book,sheet,columns,modern?3:2).map(({row,values,inputError},i)=>{
   const [number,compound,sequence]=modern?values:[values[0],values[2]||values[0],values[1]];
   return {ID:compound,Name:modern?'':values[2],'Sequence No.':number||String(i+1),
    'Compound ID':compound,Sequence:sequence,inputError,sourceRow:row};
  });
 }
 function mapping(header){return ['id','sequence'].map(k=>{const ix=header.map((v,i)=>norm(v)===k?i:-1).filter(i=>i>=0);return ix.length===1?ix[0]:null;});}
 function readRows(w,sheet,id,seq,headerRow=0){if(id===seq||id===null||seq===null)throw Error('请选择不同的 ID 与 Sequence 列');const ws=w.Sheets[sheet],data=XLSX.utils.sheet_to_json(ws,{header:1,raw:true,defval:'',blankrows:true,range:0}),rows=[];for(let i=headerRow+1;i<data.length;i++){const a=data[i];if(!a.some(v=>String(v).trim()))continue;const cells=[id,seq].map(c=>ws[XLSX.utils.encode_cell({r:i,c})]);const inputError=cells.some(c=>c?.f)?'INVALID_INPUT: ID / Sequence 必须为文本，请先粘贴为值':cells.some(c=>c?.t==='e')?'INVALID_INPUT: Excel cell error':'';rows.push({ID:String(a[id]??''),Sequence:String(a[seq]??'').trim(),sourceRow:i+1,inputError});}return rows;}
 return {run,validate,sequenceRows,names,headers,workbook,mapping,readRows,summary,candidateRows};
})();

if(typeof document!=='undefined')window.initializeBatch=()=>{
 const el=id=>document.getElementById(id);let book,rows=[],last,stop=false,busy=false,structured=false;
 let uploads={registry:new Map(),errors:[]};
 const en=()=>el('language').value==='en';
 const status=render=>UILanguage.write(el('batchstatus'),typeof render==='function'?render:()=>UILanguage.error(render));
 let displayed=null;
 function save(name,data,type){const u=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),30000);}
 function lock(value){busy=value;for(const id of ['batchfile','batchreagents','batchsheet','batchheader','batchid','batchseq','batchpreview','batchtemplate','batchStepCount','batchcalc','batchstructures'])el(id).disabled=value;el('batchcancel').disabled=!value;}
 function table(data,fields){displayed={data,fields};const t=el('batchtable');t.replaceChildren();const tr=document.createElement('tr');for(const f of fields){const th=document.createElement('th');th.textContent=batchLabel(f);tr.append(th);}t.append(tr);for(const r of [...data.slice(0,100),...data.slice(100).filter(row=>row['Workflow Status']==='NEEDS REVIEW')]){const tr=document.createElement('tr');for(const f of fields){const td=document.createElement('td');const v=r[f];if(f==='Candidates'&&v){
    const details=document.createElement('details'),summary=document.createElement('summary'),choices=Batch.candidateRows(r);
    summary.textContent=en()?choices.length+' candidates':choices.length+' 个候选项';
    details.append(summary);
    for(const [i,c] of choices.entries()){
     const item=document.createElement('p');
     const button=document.createElement('button');
     button.type='button';
     button.textContent=en()?'Choose candidate '+(i+1):'选择候选 '+(i+1);
     button.addEventListener('click',()=>{
      if(busy)return;
      const row=rows.find(row=>row.sourceRow===r['Source Row']);
      const operation=row?.operations.find(op=>op.step===r['Review Step']);
      if(!operation)return;
      operation.selection=c.selection;
      execute(lastRequestedStructures);
     });
     item.append(c.description,document.createElement('br'),button);details.append(item);
    }
    td.append(details);tr.append(td);continue;
   }td.textContent=typeof v==='number'?((r['OD Status']==='ESTIMATED'&&['epsilon260','nmol/OD260','ug/OD260'].includes(f)?'≈ ':'')+(f==='ug/OD260'?v.toFixed(2):Number.isInteger(v)?v:v.toFixed(4))):(['Status','Workflow Status','Chemistry Status','Structure Status','OD Status'].includes(f)?batchLabel(v):['Warning','Error/Warning'].includes(f)&&v?displayWarning(v):v??'');tr.append(td);}t.append(tr);}}
 function batchLabel(value){
  const labels={
   'Structure Details':'结构详情','OD Details':'OD 详情',
   'PARTIAL_UNSUPPORTED':'部分格式不支持','STRUCTURE_UNSUPPORTED':'结构格式不支持',
   'PARTIAL_EXPORT_ERROR':'部分格式导出失败','EXPORT_ERROR':'结构导出失败',
   'OD_PARAMETER_UNAVAILABLE':'缺少 OD 参数','ESTIMATED':'估算'
  };
  const opticalLabels={epsilon260:"ε₂₆₀ (L·mol⁻¹·cm⁻¹)","nmol/OD260":"nmol/OD₂₆₀","ug/OD260":"µg/OD₂₆₀"};
  return opticalLabels[value]||(!en()&&labels[value])||UILanguage.status(value);
 }
 function displayWarning(value){
  if(en())return value;
  const messages={
   'Chemistry succeeded.':'后修饰成功。',
   'Some structure formats failed to export.':'部分结构格式导出失败。',
   'Structure export failed.':'结构导出失败。',
   'Some requested structure formats are unavailable for this product.':'部分所选结构格式不支持此产物。',
   'OD parameters unavailable.':'缺少 OD 参数。',
   'OD estimated.':'OD 为估算值。',
   'Multiple compatible candidates. Choose a product in Toolkit.':'有多个兼容产物，请在 Toolkit 中选择候选项。'
  };
  for(const [english,chinese] of Object.entries(messages))value=value.replace(english,chinese);
  return value;
 }
 function clearResult(){displayed=null;last=null;rows=[];el('batchxlsx').disabled=true;el('batchzip').disabled=true;el('batchcalc').disabled=true;el('batchstructures').disabled=true;el('batchtable').replaceChildren();}
 function columns(){clearResult();if(!book)return;const data=XLSX.utils.sheet_to_json(book.Sheets[el('batchsheet').value],{header:1,raw:true,defval:'',range:0}),header=data[Number(el('batchheader').value)-1]||[],auto=Batch.mapping(header);for(const [j,id]of ['batchid','batchseq'].entries()){const s=el(id);s.replaceChildren(new Option(UILanguage.text("select.a.column"),''));header.forEach((v,i)=>{const option=new Option((i+1)+': '+String(v||UILanguage.text("empty.column")),String(i));option.dataset.emptyColumn=v?'':String(i+1);s.append(option);});s.value=auto[j]===null?'':String(auto[j]);}status(()=>UILanguage.text("confirm.the.worksheet.header.row.and.column.mapping.then"));}
 el('batchfile').onchange=async e=>{if(busy)return;clearResult();lock(true);book=undefined;structured=false;el('batchmapping').hidden=false;try{const f=e.target.files[0];e.target.value='';if(!f)return;if(f.size>25*1024*1024)throw Error('输入文件超过 25 MB，请拆分');status(()=>UILanguage.text("reading.file"));await new Promise(r=>setTimeout(r,0));book=XLSX.read(await f.arrayBuffer(),{type:'array',raw:true,cellFormula:true});el('batchsheet').replaceChildren(...book.SheetNames.map(n=>new Option(n,n)));el('batchheader').value=1;structured=BatchWorkflow.structured(book);el('batchmapping').hidden=structured;if(structured)status(()=>en()?'Workbook loaded. Preview to check the inputs.':'已加载工作簿。请预览并核对输入。');else columns();}catch(e){status(()=>UILanguage.text("import.failed")+' '+UILanguage.error(e));}finally{lock(false);el('batchcalc').disabled=el('batchstructures').disabled=true;}};
 el('batchreagents').onchange=async e=>{
  clearResult();lock(true);
  try{
   const selected=Array.from(e.target.files);
   e.target.value='';
   uploads=await BatchWorkflow.upload(selected);
   renderReagents();
  }catch(e){status(e.message);}
  finally{lock(false);el('batchcalc').disabled=el('batchstructures').disabled=true;}
 };
 function renderReagents(){
  const list=el('batchReagentList');
  list.replaceChildren();
  const counts={builtin:0,user:0,upload:0};
  for(const item of BatchWorkflow.catalog(uploads.registry).values())counts[item.source]++;
  el('batchReagentSummary').textContent=en()
   ?counts.builtin+' built-in · '+counts.user+' user library · '+counts.upload+' uploaded'
   :'内置 '+counts.builtin+' · 自定义 '+counts.user+' · 上传 '+counts.upload;
  for(const [name,record] of uploads.registry){
   const li=document.createElement('li');
   li.textContent=record.error||(en()?'Ready · ':'已就绪 · ')+name;
   list.append(li);
  }
  for(const message of uploads.errors){
   const li=document.createElement('li');li.textContent=message;list.append(li);
  }
 }
 window.refreshBatchReagents=renderReagents;
 renderReagents();

 el('batchsheet').onchange=columns;el('batchheader').onchange=columns;for(const id of ['batchid','batchseq'])el(id).onchange=()=>{clearResult();status(()=>UILanguage.text("the.column.mapping.changed.validate.again"));};
 el('batchpreview').onclick=async()=>{if(busy)return;try{clearResult();if(!book)throw Error('请先上传 XLSX / CSV');if(structured){
    lock(true);
    rows=BatchWorkflow.read(book);
    const entries=BatchWorkflow.catalog(uploads.registry),preview=[];
    for(const [i,r] of rows.entries()){
     const warnings=r.operations.flatMap(o=>{
      const message=BatchWorkflow.reagentError(o,entries);
      return message?['Step '+o.step+': '+message]:[];
     });
     const validation=r.inputError?{message:r.inputError}:Batch.validate(r.Sequence);
     if(validation.message)warnings.unshift(validation.message);
     const Inputs=r.operations.map(o=>o.step+' · '+o.input).join(' | ');
     preview.push({...r,Inputs,Steps:r.operations.length,Status:warnings.length?'INVALID':'READY',Warning:warnings.join(' | ')});
     if(i%20===0)await new Promise(resolve=>setTimeout(resolve,0));
    }
    lock(false);
    const issues=preview.filter(r=>r.Warning).length;
    table(preview,['ID','Sequence','Steps','Inputs','Status','Warning']);
    status(()=>en()?rows.length+' molecule(s) · '+rows.reduce((n,r)=>n+r.operations.length,0)+' operation(s) · '+issues+' row(s) with input issues':rows.length+' 个分子 · '+rows.reduce((n,r)=>n+r.operations.length,0)+' 个操作 · '+issues+' 行输入问题');
    el('batchcalc').disabled=el('batchstructures').disabled=!rows.length;
    return;
   }if(el('batchid').value===''||el('batchseq').value==='')throw Error('请选择 ID 与 Sequence 列');const n=Number(el('batchheader').value);if(!Number.isInteger(n)||n<1)throw Error('标题行必须是正整数');rows=Batch.readRows(book,el('batchsheet').value,Number(el('batchid').value),Number(el('batchseq').value),n-1);lock(true);let counts={VALID:0,INVALID:0,RECOGNIZED_PENDING:0},preview=[];for(let i=0;i<rows.length;i++){const r=rows[i],v=r.inputError?{status:'INVALID',message:r.inputError}:Batch.validate(r.Sequence);counts[v.status]++;preview.push({...r,Status:v.status,Warning:v.message});if(i%20===0){status(()=>UILanguage.text("validating")+(i+1)+' / '+rows.length);await new Promise(r=>setTimeout(r,0));}}table(preview,['ID','Sequence','Status','Warning']);status(()=>[rows.length+' '+UILanguage.text("rows"),UILanguage.status('VALID')+' '+counts.VALID,UILanguage.status('INVALID')+' '+counts.INVALID,UILanguage.status('RECOGNIZED_PENDING')+' '+counts.RECOGNIZED_PENDING,UILanguage.text("preview.shows.up.to.100.rows.calculation.includes.all.ro")].join(' · '));lock(false);el('batchcalc').disabled=el('batchstructures').disabled=!rows.length;}catch(e){lock(false);el('batchcalc').disabled=el('batchstructures').disabled=true;status(e.message);}};
 let lastRequestedStructures=false;
 async function execute(structures){if(busy||!rows.length)return;lastRequestedStructures=structures;stop=false;last=null;el('batchxlsx').disabled=el('batchzip').disabled=true;lock(true);try{const formats=structures?Array.from(document.querySelectorAll('[data-batch-format]:checked'),x=>x.dataset.batchFormat):[];if(structures&&!formats.length)throw Error('请选择至少一个结构格式');last=await Batch.run(rows,{formats,structures:uploads.registry,cancelled:()=>stop,progress:p=>status(()=>`${p.done} / ${p.total} · ${UILanguage.text("structure.data")} ${(p.bytes/1048576).toFixed(1)} MB`)});table(last.rows,['ID','Workflow Status','Last Successful Step','Formula','Average MW','Exact Mass','epsilon260','nmol/OD260','ug/OD260','Operations Applied','Error/Warning','Candidates','Structure Status','Structure Details','OD Status','OD Details','Output Name']);{const result=last;status(()=>`${result.cancelled?UILanguage.text("stopped.processed.results.retained"):UILanguage.text("calculation.complete")} · ${result.rows.length} / ${result.total} · ${(result.elapsedMs/1000).toFixed(2)} s`);};el('batchxlsx').disabled=false;el('batchzip').disabled=!last.zip||!last.bytes;}catch(e){status(()=>UILanguage.text("batch.processing.failed")+' '+UILanguage.error(e));}finally{lock(false);el('batchcalc').disabled=el('batchstructures').disabled=!rows.length;}}
 el('batchcalc').onclick=()=>execute(false);el('batchstructures').onclick=()=>execute(true);el('batchcancel').onclick=()=>{stop=true;status(()=>UILanguage.text("stopping.after.the.current.row"));};
 el('language').addEventListener('change',()=>{
  if(displayed)table(displayed.data,displayed.fields);
  for(const id of ['batchid','batchseq'])for(const option of el(id).options){
   if(option.value==='')option.textContent=UILanguage.text("select.a.column");
   else if(option.dataset.emptyColumn)option.textContent=option.dataset.emptyColumn+': '+UILanguage.text("empty.column");
  }
 });
 el('batchtemplate').onclick=async()=>{
  if(busy)return;
  lock(true);
  try{
   renderReagents();
   const bytes=await BatchWorkflow.templateBytes(uploads.registry,en()?'en':'zh',{stepCount:Number(el('batchStepCount').value)});
   save('Batch.xlsx',bytes,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  }catch(e){status(e.message);}
  finally{lock(false);el('batchcalc').disabled=el('batchstructures').disabled=!rows.length;}
 };
 el('batchxlsx').onclick=()=>{try{XLSX.writeFile(Batch.workbook(last),'results.xlsx',{compression:true});}catch(e){status(()=>UILanguage.text("xlsx.export.failed")+' '+UILanguage.error(e));}};
 el('batchzip').onclick=async()=>{if(!last?.zip)return;el('batchzip').disabled=true;try{const result=await last.zip.generateAsync({type:'uint8array',compression:'DEFLATE',compressionOptions:{level:1}},p=>status('ZIP '+p.percent.toFixed(0)+'%'));save('structures.zip',result,'application/zip');status(()=>UILanguage.text("structures.zip.is.ready.output.names.match.the.filenames"));}catch(e){status(()=>UILanguage.text("zip.export.failed")+' '+UILanguage.error(e));}finally{el('batchzip').disabled=false;}};
};
