'use strict';
const Product=(()=>{
 const $=id=>document.getElementById(id);let imported=null,entries=[];const store=ChemistryLibrary.create({getItem:k=>localStorage.getItem(k),setItem:(k,v)=>localStorage.setItem(k,v)});const refreshEntries=()=>{entries=store.state.records.map(r=>({id:r.id,name:r.symbol,imported:{graph:r.runtime,attachments:{5:r.runtime.attachments.upstream?.atom,3:r.runtime.attachments.downstream?.atom},optical:r.runtime.optical,extinction:r.runtime.extinction}}));};
 const words={customnav:['自定义化学','Custom Chemistry'],reactionnav:['修饰反应','Modifications'],examples:['示例','Examples'],custom:['自定义化学库','Custom Chemistry Library'],customnote:['导入 MOL/SDF，选择羟基连接位点并保存。之后可在序列中用 [name] 引用该条目。','Import MOL/SDF → select real OH sites → save → use [name] in a sequence. A expands supported aliases to full atoms.'],importcustom:['导入并选择位点','Import & select sites'],savecustom:['保存','Save'],savenew:['保存并新建','Save & New'],secondary:['第二反应物 · MOL / SDF','Secondary reagent · MOL / SDF']};
 function localize(){const en=$('language').value==='en';for(const [k,v]of Object.entries(words))document.querySelectorAll('[data-i18n="'+k+'"]').forEach(e=>e.textContent=v[+en]);}
 function displayCustom(){if(!imported){$('customViewer').replaceChildren();return;}const candidates=Array.from($('fiveOH').options).filter(o=>o.value!=='').map(o=>Number(o.value));LocalViewers.mount('customViewer',Sandbox.record(imported.graph),{title:$('customName').value||UILanguage.text("custom.chemistry"),candidates,selectedSite:{atoms:Object.fromEntries([['5′', $('fiveOH').value],['3′', $('threeOH').value]].filter(([,v])=>v!=='').map(([k,v])=>[k,Number(v)]))},onAtom:i=>{$($('attachmentTarget').value).value=String(i);$('customStatus').textContent=$('attachmentTarget').selectedOptions[0].textContent+' → '+UILanguage.text("atom")+(i+1);displayCustom();}});}
 function library(){const box=$('library');box.replaceChildren();const en=$('language').value==='en';$('libraryTitle').textContent=(UILanguage.text("saved.custom.chemistry"))+' · '+entries.length;if(!entries.length)box.textContent=UILanguage.text("no.saved.entries");for(const e of entries){const row=document.createElement('div');row.className='library-row';const name=document.createElement('strong');name.textContent='['+e.name+']';const info=document.createElement('span');info.textContent=e.imported.formula||Lite.graphProperties(e.imported.graph).formula;row.append(name,info);const view=document.createElement('button');view.textContent=UILanguage.text("view");view.dataset.action='view';view.onclick=()=>{imported=e.imported;$('customName').value=e.name;$('customInput').value=Lite.mol(imported.graph);importMol();$('fiveOH').value=String(e.imported.attachments[5]??'');$('threeOH').value=String(e.imported.attachments[3]??'');for(const s of Object.values(e.imported.graph.attachments||{}).filter(s=>s.direction==='branch'))window.addBranchSelector(s.atom);displayCustom();};const del=document.createElement('button');del.textContent=UILanguage.text("delete");del.dataset.action='delete';del.onclick=()=>attempt(()=>{store.remove(e.id);refreshEntries();library();$('customStatus').textContent=(UILanguage.text("deleted"))+e.name;});row.append(view,del);box.append(row);}}
 function importMol(){imported=Lite.parseMol($('customInput').value,{manualMarkers:true});const candidates=imported.graph.atoms.flatMap((a,i)=>{try{Lite.selectAttachments(imported,i,null);return [i];}catch{return [];}});for(const id of ['fiveOH','threeOH']){$(id).replaceChildren();const none=document.createElement('option');none.value='';none.textContent='—';$(id).append(none);for(const i of candidates){const o=document.createElement('option');o.value=i;o.textContent='O · '+UILanguage.text("atom")+(i+1);$(id).append(o);}}document.getElementById('branchSelectors')?.replaceChildren();displayCustom();UILanguage.write($('customStatus'),()=>imported.formula+' · '+candidates.length+' '+UILanguage.text("oh.sites"));return imported;}
 function save(fresh){if(!imported)throw Error('Import MOL/SDF first');const name=$('customName').value,selected=Lite.selectAttachments(imported,$('fiveOH').value,$('threeOH').value);selected.branchSites=Array.from(document.querySelectorAll('[data-branch-atom]')).filter(e=>e.value!=='').map(e=>Number(e.value));store.add(name,selected);refreshEntries();UILanguage.write($('customStatus'),()=>UILanguage.text("saved.locally")+'{'+name+'}');library();if(fresh){imported=null;$('customViewer').replaceChildren();$('customInput').value='';$('customName').value='';for(const id of ['fiveOH','threeOH'])$(id).replaceChildren();}}
 function attempt(fn){try{return fn();}catch(e){UILanguage.errorInto($('customStatus'),e);}}
 for(const [file,input]of [['customFile','customInput'],['reagentFile','reagentInput']])$(file).onchange=async()=>{const f=$(file).files[0];if(f){$(input).value=await f.text();if(file==='customFile')attempt(importMol);else $('reaction').dispatchEvent(new Event('change'));}};
 $('reagentInput').oninput=()=>{try{$('reaction').dispatchEvent(new Event('change'));}catch(e){UILanguage.errorInto($('error'),e);}};
 $('customInput').addEventListener('input',()=>{imported=null;$('customViewer').replaceChildren();UILanguage.write($('customStatus'),()=>UILanguage.text("input.changed.import.it.again.before.saving"));});
 for(const id of ['fiveOH','threeOH'])$(id).addEventListener('change',displayCustom);
 $('importCustom').onclick=()=>attempt(importMol);$('saveCustom').onclick=()=>attempt(()=>save(false));$('saveNew').onclick=()=>attempt(()=>save(true));
 store.load();refreshEntries();library();UILanguage.write($('customStatus'),()=>UILanguage.status(store.status));
 const controls=document.createElement('div');controls.className='row';
 const ex=document.createElement('button');ex.id='exportUserLibrary';ex.dataset.i18n='exportlibrary';words.exportlibrary=['导出用户化学库 JSON','Export User Chemistry Library'];ex.onclick=()=>attempt(()=>{const a=document.createElement('a'),url=URL.createObjectURL(new Blob([store.exportJSON()],{type:'application/json'}));a.href=url;a.download='oligo-user-chemistry-library.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});controls.append(ex);
 for(const mode of ['merge']){const button=document.createElement('button'),file=document.createElement('input');button.id=mode+'UserLibrary';button.dataset.i18n=mode+'library';words[mode+'library']=mode==='import'?['导入用户化学库（空库）','Import User Chemistry Library (empty library)']:['导入/合并用户化学库','Import/Merge User Library'];file.type='file';file.accept='.json,application/json';file.hidden=true;file.id=mode+'UserLibraryFile';button.onclick=()=>file.click();file.onchange=async()=>{try{const f=file.files[0];if(!f)return;if(f.size>25*1024*1024)throw Error('Library exceeds 25 MB');const result=store.ingest(JSON.parse(await f.text()),mode);refreshEntries();library();UILanguage.write($('customStatus'),()=>result.applied?UILanguage.text('library.merged')+(result.duplicates.join(', ')||'—'):UILanguage.text('library.conflict')+result.conflicts.map(c=>c.symbol).join(', '));}catch(e){UILanguage.errorInto($('customStatus'),e);}finally{file.value='';}};controls.append(button,file);}
 $('library').before(controls);
 const builtinDetails=document.createElement('details'),builtinTitle=document.createElement('summary'),builtinRows=document.createElement('div');
 builtinDetails.id='builtinChemistryCatalog';
 const reagentDetails=document.createElement('details'),reagentTitle=document.createElement('summary'),reagentRows=document.createElement('div');
 reagentDetails.id='builtinReactionReagentCatalog';
 reagentDetails.append(reagentTitle,reagentRows);
 builtinDetails.append(builtinTitle,builtinRows);$('library').after(builtinDetails,reagentDetails);
 const builtinLabel=()=>{builtinTitle.textContent=$('language').value==='en'?'Built-in Sequence Chemistry':'内置序列化学';
  reagentTitle.textContent=$('language').value==='en'?'Built-in Reaction Reagents':'内置后修饰反应试剂';};
 builtinLabel();$('language').addEventListener('change',builtinLabel);
 function renderBuiltin(details,rows,reagents){
  if(!details.open)return;
  const en=$('language').value==='en';
  const disabled=reagents?store.disabledReagents():null;
  rows.replaceChildren();
  for(const item of store.builtinCatalog()){
   if(Boolean(item.roles?.includes('ReactionReagent'))!==reagents)continue;
   const row=document.createElement('div'),symbol=document.createElement('strong'),info=document.createElement('span');
   row.className='library-row';symbol.textContent=item.symbol;
   info.textContent=(reagents
    ?[item.type,item.reactionStatus,...(item.compatibleFamilies||[]).map(family=>ReactionLabels.name({family}))]
    :[item.type,item.family,item.assemblyStatus,item.structureStatus==='unresolved'?item.provenance:null,(en?'Amidite':'亚磷酰胺')+' · '+(item.amidite.identity||UILanguage.status(item.amidite.status))]).filter(Boolean).map(UILanguage.status).join(' · ');
   row.append(symbol,info);
   const preview=item.schematicReference&&StructurePresentation.referenceGlyph(item.schematicReference);
   if(preview){const glyph=document.createElement('span');glyph.innerHTML=preview;info.append(glyph);}
   if(reagents&&item.selectable){
    const isDisabled=disabled.has(item.reagentId);
    if(isDisabled)info.append(UILanguage.text("disabled.locally"));
    const button=document.createElement('button');
    button.type='button';button.textContent=isDisabled?(UILanguage.text("restore")):(UILanguage.text("disable"));
    button.onclick=()=>attempt(()=>{
     store.setReagentEnabled(item.reagentId,isDisabled);
     document.dispatchEvent(new Event('builtin-reagents-changed'));
    });
    row.append(button);
   }
   if(!reagents&&item.templateKey){
    const button=document.createElement('button');
    button.type='button';button.textContent=UILanguage.text("copy.to.editor");
    button.onclick=()=>attempt(()=>{
     const block=Lite.getBuildingBlock(item.templateKey);
     $('customInput').value=Lite.mol(block);
     $('customName').value='';
     importMol();
     for(const [select,site] of [['fiveOH','upstream'],['threeOH','downstream']]){
      const value=String(block.attachments?.[site]?.atom??'');
      if([...$(select).options].some(option=>option.value===value))$(select).value=value;
     }
     displayCustom();
     $('customStatus').textContent=UILanguage.text("built.in.copy.loaded.edit.or.replace.mol.sdf.verify.the");
     $('customInput').focus();
    });
    row.append(button);
   }
   rows.append(row);
  }
 }
 builtinDetails.addEventListener('toggle',()=>attempt(()=>renderBuiltin(builtinDetails,builtinRows,false)));
 reagentDetails.addEventListener('toggle',()=>attempt(()=>renderBuiltin(reagentDetails,reagentRows,true)));
 const refreshReagents=()=>attempt(()=>renderBuiltin(reagentDetails,reagentRows,true));
 document.addEventListener('builtin-reagents-changed',refreshReagents);
 window.addEventListener('storage',event=>{if(event.key===ChemistryLibrary.REAGENT_KEY)refreshReagents();});
 $('language').addEventListener('change',()=>{localize();library();displayCustom();
  attempt(()=>renderBuiltin(builtinDetails,builtinRows,false));refreshReagents();
 });localize();
 // Invalidate a reagent preview as soon as the reagent is edited; A still validates every site.
 $('input').addEventListener('input',()=>{UILanguage.write($('error'),()=>UILanguage.text('input.changed'));});

 return {importMol,save,store,get entries(){return entries;}};
})();
