'use strict';
// B: switch persistent DOM workspaces. Navigation never recreates chemistry state.
const Workspaces=(()=>{
 const $=id=>document.getElementById(id),main=$('workspace'),sequence=document.createElement('section'),reaction=document.createElement('section'),custom=document.createElement('section'),batch=document.createElement('section'),reference=document.createElement('section');
 sequence.id='sequenceWorkspace';reaction.id='reactionWorkspace';custom.id='customWorkspace';batch.id='batchWorkspace';
 sequence.append(main.querySelector('.input-grid'));sequence.append(main.querySelector('.workflow'));custom.append($('custom'));main.append(sequence,reaction,batch,custom,reference);
 reference.id='referenceWorkspace';
 reference.innerHTML='<article><div class="reference-table"><table><thead><tr></tr></thead><tbody></tbody></table></div></article>';
 batch.innerHTML=`<article><h2 id="batchTitle"></h2><p id="batchHelp"></p>
 <div class="row"><label><span id="batchReagentsLabel"></span><input id="batchreagents" type="file" accept=".mol,.sdf" multiple></label></div>
 <p id="batchReagentSummary" role="status"></p><ul id="batchReagentList"></ul>
 <div class="row"><label><span id="batchStepCountLabel"></span><input id="batchStepCount" type="number" min="1" max="16382" value="5"></label><button id="batchtemplate"></button></div>
 <div class="row"><label><span id="batchImportLabel"></span><input id="batchfile" type="file" accept=".xlsx,.xls,.csv"></label></div><div class="row" id="batchmapping"><label><span data-ui="sheet">Sheet</span><select id="batchsheet"></select></label><label><span data-ui="header.row">Header row</span><input id="batchheader" type="number" value="1" min="1"></label><label><span data-ui="id">ID</span><select id="batchid"></select></label><label><span data-ui="sequence">Sequence</span><select id="batchseq"></select></label></div><div class="row"><button id="batchpreview" data-ui="validate.preview">Validate / Preview</button><button id="batchcalc" disabled data-ui="calculate">Calculate</button><button id="batchstructures" class="primary" disabled data-ui="calculate.structures">Calculate + Structures</button><button id="batchcancel" disabled data-ui="cancel">Cancel</button></div><p><label><input type="checkbox" data-batch-format="svg" checked> <span id="batchChemicalLabel"></span></label><label><input type="checkbox" data-batch-format="schematic.svg"> <span id="batchSchematicLabel"></span></label><label><input type="checkbox" data-batch-format="mol" checked> MOL</label><label><input type="checkbox" data-batch-format="sdf"> SDF</label><label><input type="checkbox" data-batch-format="cdxml"> CDXML</label></p><p id="batchstatus" role="status"></p><div class="row"><button id="batchxlsx" disabled data-ui="results.xlsx">results.xlsx</button><button id="batchzip" disabled data-ui="structures.zip">structures.zip</button></div><div class="batch-table"><table id="batchtable"></table></div></article>`;
 const postPanel=batch.firstElementChild;
 const choices=document.createElement('div');choices.className='row';
 const sequences=document.createElement('button'),post=document.createElement('button');
 sequences.type=post.type='button';choices.append(sequences,post);batch.prepend(choices);
 const sequencePanel=BatchSequenceUI.mount(batch);
 function choose(showSequences){
  sequencePanel.hidden=!showSequences;postPanel.hidden=showSequences;
  sequences.classList.toggle('primary',showSequences);post.classList.toggle('primary',!showSequences);
  sequences.setAttribute('aria-pressed',String(showSequences));post.setAttribute('aria-pressed',String(!showSequences));
 }
 sequences.onclick=()=>choose(true);post.onclick=()=>choose(false);choose(true);
 window.initializeBatch();
 const pages={sequence,reaction,batch,custom,reference};let current='sequence';
 const labels={sequence:['分子构建','Molecule Builder'],reaction:['合成后修饰','Post-synthesis Modification'],batch:['批量处理','Batch Processing'],custom:['化学库','Chemistry Library'],reference:['内置化学速查','Built-in Chemistry Reference']};
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
  body.replaceChildren();
  for(const {symbol,name,type} of ChemistryLibrary.referenceRows()){
   const row=body.insertRow(),code=document.createElement('code');
   code.textContent=symbol;row.insertCell().append(code);
   row.insertCell().textContent=name;row.insertCell().textContent=type.split(' · ').map(UILanguage.status).join(' · ');
  }
 }
 function localize(){const en=$('language').value==='en';if(current==='reference')renderReference(en);document.querySelectorAll('[data-page]').forEach((b,i)=>b.textContent=String(i+1).padStart(2,'0')+'　'+labels[b.dataset.page][+en]);document.querySelector('.heading h1').textContent=labels[current][+en];document.querySelector('.heading p').textContent=UILanguage.text("local.molecular.workbench.results.and.exports.stay.with");sequences.textContent=en?'2.1 Batch Sequence Calculation':'2.1 批量序列计算';post.textContent=en?'2.2 Batch Post-functionalization':'2.2 批量后合成修饰';$('batchTitle').textContent=post.textContent;$('batchHelp').textContent=en?'Prepare your reagents, then generate the Excel template. Built-in and saved reagents are included automatically. If you reopen or refresh the page, upload the same MOL/SDF files again before previewing.':'先准备本次试剂，再生成 Excel 模板。内置和已保存的试剂会自动加入。重新打开或刷新页面后，请在预览前重新上传相同的 MOL/SDF 文件。';$('batchStepCountLabel').textContent=en?'Step columns':'步骤列数';$('batchtemplate').textContent=en?'Generate Excel template':'生成 Excel 模板';$('batchImportLabel').textContent=en?'Import completed workbook':'导入填写好的工作簿';window.refreshBatchReagents();$('batchChemicalLabel').textContent=en?'Chemical SVG':'化学结构 SVG';$('batchSchematicLabel').textContent=en?'Schematic SVG':'示意 SVG';$('batchReagentsLabel').textContent=en?'Uploaded structures (MOL / SDF)':'上传结构（MOL / SDF）';$('gapText').textContent=UILanguage.text("see.known.gaps.md.for.unsupported.chemistry.and.remainin");}
 function show(id){if(current==='custom'&&id!==current)return Product.leaveEditor(()=>activate(id));activate(id);}
 function activate(id){current=id;for(const [key,page]of Object.entries(pages))page.hidden=key!==id;document.querySelectorAll('[data-page]').forEach(b=>{b.classList.toggle('active',b.dataset.page===id);if(b.dataset.page===id)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});localize();window.scrollTo(0,0);}
 document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>show(b.dataset.page));$('language').addEventListener('change',localize);
 const use=document.createElement('button');use.id='useSequence';use.hidden=true;
 show('sequence');return {show,get current(){return current;}};
})();
