'use strict';
const Product=(()=>{
 const $=id=>document.getElementById(id);let imported=null,entries=[];const store=ChemistryLibrary.create({getItem:k=>InfinityStorage.getItem(k),setItem:(k,v)=>InfinityStorage.setItem(k,v)});const refreshEntries=()=>{entries=store.state.records.map(r=>({id:r.id,name:r.symbol,imported:{graph:r.runtime,attachments:{5:r.runtime.attachments.upstream?.atom,3:r.runtime.attachments.downstream?.atom},optical:r.runtime.optical,extinction:r.runtime.extinction}}));};
 const words={customnav:['化学库','Chemistry Library'],reactionnav:['修饰反应','Modifications'],examples:['示例','Examples'],custom:['化学库','Chemistry Library'],customnote:['导入 MOL/SDF，选择羟基连接位点并保存。之后可在序列中用 [name] 引用该条目。','Import MOL/SDF → select real OH sites → save → use [name] in a sequence. A expands supported aliases to full atoms.'],importcustom:['导入并选择位点','Import & select sites'],savecustom:['保存','Save'],savenew:['保存并新建','Save & New'],secondary:['第二反应物 · MOL / SDF','Secondary reagent · MOL / SDF']};
 function localize(){const en=$('language').value==='en';for(const [k,v]of Object.entries(words))document.querySelectorAll('[data-i18n="'+k+'"]').forEach(e=>e.textContent=v[+en]);}
 const branchList=document.createElement('div');
 branchList.id='branchSelectors';
 $('customStatus').before(branchList);
 const addBranch=document.createElement('button');
 addBranch.type='button';addBranch.id='addBranchAttachment';
 addBranch.dataset.ui='add.branch.attachment.site';branchList.before(addBranch);
 function editorSites(){
  return [['5′',$('fiveOH').value],['3′',$('threeOH').value],
   ...branches().map((value,i)=>[UILanguage.text('branch')+(i+1),value])].filter(([,value])=>value!=='');
 }
 function addBranchSelector(atom=''){
  const row=document.createElement('div'),label=document.createElement('label');
  const number=document.createElement('span');
  const select=$('fiveOH').cloneNode(true);
  select.removeAttribute('id');select.dataset.branchAtom='';select.value=String(atom);
  select.addEventListener('change',displayCustom);
  label.append(number,select);
  const remove=document.createElement('button');
  remove.type='button';remove.textContent='×';remove.dataset.uiAria='remove';
  remove.onclick=()=>{row.remove();updateBranchLabels();displayCustom();};
  row.append(label,remove);branchList.append(row);updateBranchLabels();
 }
 function updateBranchLabels(){
  [...branchList.children].forEach((row,i)=>{row.querySelector('span').textContent=UILanguage.text('branch')+(i+1)+' ';});
 }
 addBranch.onclick=()=>addBranchSelector();
 function displayCustom(){
  if(!imported){$('customViewer').replaceChildren();return;}
  const candidates=Array.from($('fiveOH').options).filter(o=>o.value!=='').map(o=>Number(o.value));
  const sites=editorSites();
  LocalViewers.mount('customViewer',Sandbox.record(imported.graph),{
   title:$('customName').value||UILanguage.text('custom.chemistry'),candidates,
   selectedSite:{atoms:Object.fromEntries(sites.map(([k,v])=>[k,Number(v)])),labels:Object.fromEntries(sites.map(([k])=>[k,k]))},
   onAtom:i=>{
    const target=$('attachmentTarget');
    $(target.value).value=String(i);
    $('customStatus').textContent=target.selectedOptions[0].textContent+' → '+UILanguage.text('atom')+(i+1);
    displayCustom();
   }
  });
 }
 let libraryUI;
 function library(){libraryUI?.render();}
 let editing=null, baseline=null;
 const branches=()=>Array.from(document.querySelectorAll('[data-branch-atom]'),e=>e.value);
 const attachments=()=>[$('fiveOH').value,$('threeOH').value,...branches()];
 const fingerprint=()=>JSON.stringify([$('customInput').value,$('customName').value,$('customDisplayName').value,attachments()]);
 let fileRequest=0;
 function resetEditor(){
  fileRequest++;
  imported=null;editing=null;baseline=null;addBranch.disabled=true;
  $('attachmentTarget').value='fiveOH';
  for(const id of ['customInput','customName','customDisplayName','customFile'])$(id).value='';
  for(const id of ['fiveOH','threeOH','branchSelectors'])$(id)?.replaceChildren();
  LocalViewers.instances.get($('customViewer'))?.dispose();
  $('customViewer').replaceChildren();
  UILanguage.write($('customStatus'),()=>'');
 }
 function editEntry(r){
  resetEditor();editing=r;
  if(r){
   $('customName').value=r.symbol;
   $('customDisplayName').value=r.name;
   $('customInput').value=Lite.mol(r.runtime);
   loadGraph({graph:structuredClone(r.runtime),formula:Lite.graphProperties(r.runtime).formula});
   $('fiveOH').value=String(r.runtime.attachments.upstream?.atom??'');
   $('threeOH').value=String(r.runtime.attachments.downstream?.atom??'');
   for(const site of Object.values(r.runtime.attachments).filter(s=>s.direction==='branch'))addBranchSelector(site.atom);
   displayCustom();
  }
  baseline={fingerprint:fingerprint(),graph:imported,sites:JSON.stringify(attachments())};
 }
 function importMol(){
  if(editing&&baseline?.graph&&$('customInput').value===Lite.mol(editing.runtime)&&imported===baseline.graph)return imported;
  return loadGraph(Lite.parseMol($('customInput').value,{manualMarkers:true}));
 }
 function loadGraph(graph){imported=graph;addBranch.disabled=false;const candidates=imported.graph.atoms.flatMap((a,i)=>{try{Lite.selectAttachments(imported,i,null);return [i];}catch{return [];}});for(const id of ['fiveOH','threeOH']){$(id).replaceChildren();const none=document.createElement('option');none.value='';none.textContent='—';$(id).append(none);for(const i of candidates){const o=document.createElement('option');o.value=i;o.textContent='O · '+UILanguage.text("atom")+(i+1);$(id).append(o);}}document.getElementById('branchSelectors')?.replaceChildren();displayCustom();UILanguage.write($('customStatus'),()=>imported.formula+' · '+candidates.length+' '+UILanguage.text("oh.sites"));return imported;}
 function save(){
  if(!imported)throw Error('Import MOL/SDF first');
  const symbol=$('customName').value.trim(),name=$('customDisplayName').value.trim()||symbol;
  const preserveGraph=Boolean(editing&&imported===baseline.graph);
  const changed=!preserveGraph||baseline.sites!==JSON.stringify(attachments());
  let selected;
  if(changed){
   selected=Lite.selectAttachments(imported,$('fiveOH').value,$('threeOH').value);
   selected.branchSites=branches().filter(Boolean).map(Number);
   if(!editing&&name!==symbol)selected.graph.metadata={...selected.graph.metadata,displayName:name};
  }
  const row=editing?store.update(editing.id,name,symbol,selected,preserveGraph):store.add(symbol,selected);
  refreshConsumers();
  return row;
 }
 function attempt(fn){try{return fn();}catch(e){UILanguage.errorInto($('customStatus'),e);}}
 for(const [file,input]of [['customFile','customInput'],['reagentFile','reagentInput']])$(file).onchange=async()=>{const f=$(file).files[0];if(f){const ticket=file==='customFile'?++fileRequest:null;const contents=await f.text();if(ticket!==null&&ticket!==fileRequest)return;$(input).value=contents;if(file==='customFile'){imported=null;attempt(importMol);}else $('reaction').dispatchEvent(new Event('change'));}};
 $('reagentInput').oninput=()=>{try{$('reaction').dispatchEvent(new Event('change'));}catch(e){UILanguage.errorInto($('error'),e);}};
 $('customInput').addEventListener('input',()=>{fileRequest++;imported=null;addBranch.disabled=true;LocalViewers.instances.get($('customViewer'))?.dispose();$('customViewer').replaceChildren();UILanguage.write($('customStatus'),()=>UILanguage.text("input.changed.import.it.again.before.saving"));});
 for(const id of ['fiveOH','threeOH'])$(id).addEventListener('change',displayCustom);
 $('importCustom').onclick=()=>attempt(importMol);
 store.load();refreshEntries();library();UILanguage.write($('customStatus'),()=>UILanguage.status(store.status));
 function refreshConsumers(){
  refreshEntries();
  window.refreshBatchReagents?.();
  document.dispatchEvent(new Event('editable-chemistry-changed'));
 }
 libraryUI=ChemistryLibraryUI.mount(store,{
  refresh:refreshConsumers,edit:editEntry,reset:resetEditor,save,
  dirty:()=>baseline?.fingerprint!==fingerprint()
 });
 const refreshReagents=()=>{if(!$('customWorkspace')?.hidden)library();};
 document.addEventListener('builtin-reagents-changed',refreshReagents);
 window.addEventListener('storage',event=>{if(event.key===ChemistryLibrary.REAGENT_KEY)refreshReagents();});
 $('language').addEventListener('change',()=>{localize();library();updateBranchLabels();if(imported)displayCustom();});localize();
 // Invalidate a reagent preview as soon as the reagent is edited; A still validates every site.
 $('input').addEventListener('input',()=>{UILanguage.write($('error'),()=>UILanguage.text('input.changed'));});

 return {importMol,save,store,leaveEditor:next=>libraryUI.leave(next),get entries(){return entries;}};
})();

