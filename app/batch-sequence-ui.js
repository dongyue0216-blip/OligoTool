'use strict';
const BatchSequenceUI=(()=>{
 const identity=['Sequence No.','Compound ID','Sequence'];
 const fields=[...identity,'Formula','Average MW','Exact Mass','epsilon260','nmol/OD260','ug/OD260','Result/Message'];
 const labels={epsilon260:'ε₂₆₀ (L·mol⁻¹·cm⁻¹)','nmol/OD260':'nmol/OD₂₆₀','ug/OD260':'µg/OD₂₆₀'};
 function mount(host){
  const panel=document.createElement('article');
  panel.innerHTML=`<div class="row">
   <button id="sequenceBatchTemplate"></button>
   <label><span id="sequenceBatchUpload"></span> <input id="sequenceBatchFile" type="file" accept=".xlsx,.xls"></label>
   <button id="sequenceBatchPreview" disabled data-ui="validate.preview"></button>
   <label><span id="sequenceBatchLayoutLabel"></span> <input id="sequenceBatchLayout" type="number" min="1" max="500" step="1" required></label>
   <button id="sequenceBatchRun" class="primary" disabled data-ui="calculate"></button>
   <button id="sequenceBatchDownload" disabled></button>
   <button id="sequenceBatchStructures" disabled></button>
  </div><p id="sequenceBatchStatus" role="status"></p><div class="batch-table"><table></table></div>`;
  host.insertBefore(panel,host.lastElementChild);
  const get=id=>panel.querySelector('#sequenceBatch'+id);
  const file=get('File'),preview=get('Preview'),run=get('Run'),download=get('Download'),table=panel.querySelector('table');
  const structures=get('Structures'),layout=get('Layout'),sharedLayout=document.getElementById('basesPerColumn');
  const syncLayout=()=>{layout.value=PresentationOptions.rows;};
  syncLayout();
  sharedLayout.addEventListener('change',syncLayout);
  layout.onchange=()=>{
   if(!layout.reportValidity()){syncLayout();return;}
   sharedLayout.value=layout.value;
   sharedLayout.dispatchEvent(new Event('change',{bubbles:true}));
  };
  const language=document.getElementById('language'),en=()=>language.value==='en';
  let rows=[],result=null,summary=null,displayed=null;
  const label=field=>labels[field]||(!en()&&{
   'Sequence No.':'序列编号',Sequence:'序列',Formula:'分子式','Average MW':'平均分子量',
   'Exact Mass':'精确质量','Result/Message':'结果 / 说明',Validation:'校验',Message:'说明',sourceRow:'源行'
  }[field])||field;
  function message(row){
   if(row['Workflow Status']!=='PASS')return (en()?'Failed — ':'失败 — ')+(row.failureMessage||row['Error/Warning']);
   const notes=[];
   if(row['OD Status']==='ESTIMATED')notes.push(en()?'Optical values estimated':'OD 数值为估算');
   if(row['OD Status']==='OD_PARAMETER_UNAVAILABLE')notes.push(en()?'Optical values unavailable':'缺少 OD 参数');
   if(row['Structure Status']!=='OK')notes.push(en()?'Structure export incomplete':'结构导出不完整');
   return notes.join(' · ');
  }
  const value=(row,field)=>field==='Result/Message'?message(row):row[field]??null;
  const say=(zh,eng)=>{summary=[zh,eng];get('Status').textContent=summary[+en()];};
  function localize(){
   get('Template').textContent=en()?'Download Excel template':'下载 Excel 模板';
   get('Upload').textContent=en()?'Upload workbook':'上传工作簿';
   download.textContent=en()?'Download results':'下载结果';
   structures.textContent=en()?'Download structures ZIP':'下载结构 ZIP';
   get('LayoutLabel').textContent=en()?'Bases per column':'每列碱基数';
   if(displayed)render(...displayed);
   if(summary)get('Status').textContent=summary[+en()];
  }
  function render(data,columns){
   displayed=[data,columns];
   table.replaceChildren();
   const header=table.createTHead().insertRow(),body=table.createTBody();
   for(const field of columns){
    const th=document.createElement('th');th.textContent=label(field);header.append(th);
   }
   for(const item of data.slice(0,100)){
    const tr=body.insertRow();
    for(const field of columns)tr.insertCell().textContent=
     item['OD Status']==='ESTIMATED'&&labels[field]&&typeof item[field]==='number'?'≈ '+item[field]:value(item,field)??'';
   }
  }
  function save(name,sheet,filename){
   const book=XLSX.utils.book_new();
   XLSX.utils.book_append_sheet(book,sheet,name);
   XLSX.writeFile(book,filename,{compression:true});
  }
  const error=e=>say('无法处理工作簿 · '+e.message,'Could not process workbook · '+e.message);
  get('Template').onclick=()=>save('Sequences',XLSX.utils.aoa_to_sheet([en()?identity:['序列编号','Compound ID','Sequence']]),'sequences.xlsx');
  file.onchange=()=>{
   rows=[];result=null;run.disabled=download.disabled=structures.disabled=true;preview.disabled=!file.files.length;
   displayed=null;table.replaceChildren();say('请预览并校验工作簿。','Preview and validate the workbook.');
  };
  preview.onclick=async()=>{
   file.disabled=preview.disabled=run.disabled=download.disabled=structures.disabled=true;
   rows=[];result=null;
   try{
    const fileBytes=await file.files[0].arrayBuffer();
    const input=Batch.sequenceRows(XLSX.read(fileBytes,{type:'array'}));
    const validated=[];
    for(const row of input){
     const v=Batch.validate(row.Sequence,row.inputError);
     validated.push({...row,Validation:v.status,Message:v.message});
     if(validated.length%25===0)await new Promise(resolve=>setTimeout(resolve,0));
    }
    rows=input;
    render(validated,[...identity,'Validation','Message','sourceRow']);
    const valid=validated.filter(r=>r.Validation==='VALID').length;
    say(`校验通过 ${valid} / ${rows.length} · 预览最多 100 行`,`${valid} / ${rows.length} validated · first 100 rows shown`);
   }catch(e){displayed=null;table.replaceChildren();error(e);}
   finally{file.disabled=preview.disabled=false;run.disabled=!rows.length;}
  };
  run.onclick=async()=>{
   layout.disabled=true;
   file.disabled=preview.disabled=run.disabled=download.disabled=structures.disabled=true;
   try{
    result=await Batch.run(rows,{sequenceOnly:true,formats:['cdxml','schematic.svg'],progress:({done,total,phase})=>say(`${phase==='structures'?'生成结构':'化学计算'} ${done} / ${total}`,`${phase==='structures'?'Generating structures':'Calculating chemistry'} ${done} / ${total}`)});
    render(result.rows,fields);
    const passed=result.rows.filter(r=>r['Workflow Status']==='PASS').length;
    say(`计算成功 ${passed} / ${result.total} · 结果预览最多 100 行`,`${passed} / ${result.total} calculated · first 100 results shown`);
   }catch(e){result=null;error(e);}
   finally{
    layout.disabled=file.disabled=preview.disabled=run.disabled=false;
    download.disabled=!result;
    structures.disabled=!result?.bytes;
   }
  };
  download.onclick=()=>{
   try{
    const sheet=XLSX.utils.aoa_to_sheet([fields.map(label),...result.rows.map(row=>fields.map(field=>value(row,field)))]);
    sheet['!cols']=[{wch:15},{wch:24},{wch:44},{wch:25},{wch:15},{wch:15},{wch:24},{wch:16},{wch:16},{wch:68}];
    sheet['!autofilter']={ref:sheet['!ref']};
    save('Results',sheet,'sequence-results.xlsx');
   }catch(e){error(e);}
  };
  structures.onclick=async()=>{
   const current=result;
   structures.disabled=true;
   try{
    const mapping=[['Sequence No.','Compound ID','CDXML','SVG']];
    for(const row of current.rows){
     const files=row['Output Name'].split('; ');
     mapping.push([row['Sequence No.'],row['Compound ID'],files.find(name=>name.endsWith('.cdxml'))||'',files.find(name=>name.endsWith('.svg'))||'']);
    }
    const book=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet(mapping),'Files');
    current.zip.file('file-map.xlsx',XLSX.write(book,{type:'array',bookType:'xlsx',compression:true}));
    const bytes=await current.zip.generateAsync({type:'uint8array',compression:'DEFLATE'});
    const url=URL.createObjectURL(new Blob([bytes],{type:'application/zip'}));
    const link=document.createElement('a');
    link.href=url;link.download='structures.zip';link.click();
    setTimeout(()=>URL.revokeObjectURL(url),30000);
   }catch(e){error(e);}
   finally{if(result===current)structures.disabled=false;}
  };
  language.addEventListener('change',localize);localize();
  return panel;
 }
 return {mount};
})();
