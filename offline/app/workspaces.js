'use strict';
// B: switch persistent DOM workspaces. Navigation never recreates chemistry state.
const Workspaces=(()=>{
 const $=id=>document.getElementById(id),main=$('workspace'),sequence=document.createElement('section'),reaction=document.createElement('section'),custom=document.createElement('section'),batch=document.createElement('section'),reference=document.createElement('section');
 sequence.id='sequenceWorkspace';reaction.id='reactionWorkspace';custom.id='customWorkspace';batch.id='batchWorkspace';
 sequence.append(main.querySelector('.input-grid'));sequence.append(main.querySelector('.workflow'));custom.append($('custom'));main.append(sequence,reaction,batch,custom,reference);
 reference.id='referenceWorkspace';
 reference.innerHTML='<article><div class="reference-table"><table><thead><tr></tr></thead><tbody></tbody></table></div></article>';
 batch.innerHTML=`<article><h2 id="batchTitle">Batch Excel</h2><p id="batchHelp"></p><div class="row"><input id="batchfile" type="file" accept=".xlsx,.xls,.csv"><button id="batchtemplate">Template.xlsx</button></div><div class="row"><label>Sheet<select id="batchsheet"></select></label><label>Header row<input id="batchheader" type="number" value="1" min="1"></label><label>ID<select id="batchid"></select></label><label>Sequence<select id="batchseq"></select></label></div><div class="row"><button id="batchpreview">Validate / Preview</button><button id="batchcalc" disabled>Calculate</button><button id="batchstructures" class="primary" disabled>Calculate + Structures</button><button id="batchcancel" disabled>Cancel</button></div><p><label><input type="checkbox" data-batch-format="svg" checked> SVG</label><label><input type="checkbox" data-batch-format="mol" checked> MOL</label><label><input type="checkbox" data-batch-format="sdf"> SDF</label><label><input type="checkbox" data-batch-format="cdxml"> CDXML</label></p><p id="batchstatus" role="status"></p><div class="row"><button id="batchxlsx" disabled>results.xlsx</button><button id="batchzip" disabled>structures.zip</button></div><div class="batch-table"><table id="batchtable"></table></div></article>`;
 window.initializeBatch();
 const pages={sequence,reaction,batch,custom,reference};let current='sequence';
 const labels={sequence:['分子构建','Molecule Builder'],reaction:['合成后修饰','Post-synthesis Modification'],batch:['Excel 批处理','Batch Excel'],custom:['自定义化学','Custom Chemistry'],reference:['内置化学速查','Built-in Chemistry Reference']};
 function renderReference(en){
  const table=reference.querySelector('table');
  table.setAttribute('aria-label',labels.reference[+en]);
  const header=table.tHead.rows[0];
  header.replaceChildren();
  for(const label of en?['Symbol','Name / Meaning','Type']:['符号','名称 / 含义','类型']){
   const th=document.createElement('th');
   th.scope='col';th.textContent=label;header.append(th);
  }
  const body=table.tBodies[0];
  if(body.rows.length)return;
  for(const {symbol,name,type} of ChemistryLibrary.referenceRows()){
   const row=body.insertRow(),code=document.createElement('code');
   code.textContent=symbol;row.insertCell().append(code);
   row.insertCell().textContent=name;row.insertCell().textContent=type;
  }
 }
 function localize(){const en=$('language').value==='en';if(current==='reference')renderReference(en);document.querySelectorAll('[data-page]').forEach((b,i)=>b.textContent=String(i+1).padStart(2,'0')+'　'+labels[b.dataset.page][+en]);document.querySelector('.heading h1').textContent=labels[current][+en];document.querySelector('.heading p').textContent=en?'Local molecular workbench · results and exports stay with each context':'本地分子工作台 · 结构、结果与导出随当前工作区展示';$('batchHelp').textContent=en?'Import an Excel workbook, confirm ID / Sequence columns, validate, then calculate. Uses the same chemistry and structure layout as Sequence.':'导入 Excel，确认 ID / Sequence 列，验证后计算。与单条序列使用相同的化学计算及结构排版。';$('gapText').textContent=en?'See KNOWN_GAPS.md for unsupported chemistry and remaining geometry limitations.':'不支持的化学类型与剩余排版限制详见 KNOWN_GAPS.md。';}
 function show(id){current=id;for(const [key,page]of Object.entries(pages))page.hidden=key!==id;document.querySelectorAll('[data-page]').forEach(b=>{b.classList.toggle('active',b.dataset.page===id);if(b.dataset.page===id)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});localize();window.scrollTo(0,0);}
 document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>show(b.dataset.page));$('language').addEventListener('change',localize);
 const use=document.createElement('button');use.id='useSequence';use.hidden=true;
 show('sequence');return {show,get current(){return current;}};
})();
