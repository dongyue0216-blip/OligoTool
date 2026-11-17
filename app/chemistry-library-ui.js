'use strict';
const ChemistryLibraryUI=(()=>{
 function mount(store,{refresh,edit,reset,save,dirty}){
  const $=id=>document.getElementById(id);
  const tr=(zh,en)=>$('language').value==='en'?en:zh;
  const add=(parent,tag,label='',id='')=>{
   const node=document.createElement(tag);
   node.textContent=label;
   if(id)node.id=id;
   parent.append(node);
   return node;
  };
  const attempt=run=>{
   try{return run();}catch(error){UILanguage.errorInto(review.open?add(review,'p','','chemistryMergeError'):$('libraryNotice'),error);}
  };
  const button=(parent,label,run,id)=>{
   const node=add(parent,'button',label,id);
   node.type='button';node.onclick=()=>attempt(run);
   return node;
  };
  const box=$('library'),editor=$('custom').querySelector('.custom-grid');
  const root=add($('custom'),'section');root.className='chemistry-library';
  $('custom').querySelector('[data-i18n=custom]').hidden=true;
  const editorNote=$('custom').querySelector('[data-i18n=customnote]');
  editor.prepend(editorNote);
  $('libraryTitle').remove();
  const header=add(root,'div');header.className='chemistry-toolbar';
  const tabs=add(header,'div');tabs.className='chemistry-tabs';
  const controls=add(header,'div');controls.className='chemistry-actions';
  const notice=add(root,'p','','libraryNotice');notice.setAttribute('role','status');
  const layout=add(root,'div');layout.className='chemistry-layout';
  const browser=add(layout,'div');browser.className='chemistry-browser';
  const search=add(browser,'input','','librarySearch');search.type='search';
  browser.append(box);
  const detail=add(layout,'div','','compoundInspector');
  const summary=add(detail,'div');
  const workspace=add(detail,'div','','chemistryEditor');
  const editorBar=add(workspace,'div');editorBar.className='chemistry-panel-title';
  const editorTitle=add(editorBar,'h2');
  const editorActions=add(editorBar,'div');editorActions.className='chemistry-actions';
  workspace.append(editor);
  const review=add(root,'dialog','','libraryMergePreview');review.className='chemistry-dialog';
  const comparison=add(root,'dialog','','chemistryComparison');comparison.className='chemistry-dialog';
  const guard=add(root,'dialog','','chemistryEditGuard');guard.className='chemistry-dialog';
  const file=add(root,'input','','chemistryTransferFiles');
  file.type='file';file.multiple=true;file.hidden=true;file.accept='.oligoentry,.olib,.json';
  const builtins=store.builtinCatalog().map((item,index)=>({...item,id:'builtin:'+index}));
  let scope='custom',selected=new Set(),activeId=null,pending=null,message=null,editing=false;
  const names=()=>({custom:tr('我的自定义','My Custom'),builtin:tr('内置化学库','Built-in')});
  const rows=()=>scope==='builtin'?builtins:store.state.records;
  const absent=()=>tr('未提供','Not provided');
  const category=r=>UILanguage.status(r.category??r.runtime?.category??r.family??r.type??tr('自定义','Custom'));
  const status=()=>notice.textContent=store.blocked?tr('无法读取本地化学库，原始记录已保留 · ','Local chemistry library unreadable. Original records preserved · ')+store.status:message?.()||'';
  function clearViewer(host){
   LocalViewers.instances.get(host)?.dispose();
   host?.replaceChildren();
  }
  function finish(){
   editing=false;reset();
  }
  function confirmNavigation(next){
   if(!editing)return next();
   if(!dirty()){finish();return next();}
   guard.replaceChildren();
   add(guard,'h2',tr('未保存的修改','Unsaved changes'));
   const actions=add(guard,'div');actions.className='chemistry-actions';
   button(actions,tr('保存','Save'),()=>{
    if(!saveEditor(false))return guard.close();
    guard.close();next();
   }).className='primary';
   button(actions,tr('放弃修改','Discard'),()=>{guard.close();finish();next();});
   button(actions,tr('继续编辑','Cancel'),()=>guard.close());
   guard.showModal();
  }
  function leave(next){
   confirmNavigation(()=>{render();next();});
  }
  function graphOf(r){
   return r.runtime|| (r.reagentId?Object.values(REACTION_REAGENTS).find(v=>v.id===r.reagentId)?.graph:
    r.templateKey?REFERENCE.templates[r.templateKey]:null);
  }
  function sitesOf(r,graph){
   return r.block?.sites??graph.attachments??{};
  }
  function siteMarker(site,index){
   if(site.direction==='upstream')return '5′';
   if(site.direction==='downstream')return '3′';
   return site.direction==='branch'?tr('分支 ','Branch ')+index:tr('位点 ','Site ')+index;
  }
  function viewStructure(host,graph,sites){
   const labels=Object.fromEntries(Object.entries(sites).map(([key,site],i,entries)=>[
    key,siteMarker(site,entries.slice(0,i+1).filter(([,v])=>v.direction===site.direction).length)
   ]));
   const atoms=Object.fromEntries(Object.entries(sites).map(([key,site])=>[key,site.atom]));
   LocalViewers.mount(host,Sandbox.record(graph),{mode:'chemical',title:tr('结构','Structure'),selectedSite:{atoms,labels}});
   return labels;
  }
  function view(r){
   clearViewer(comparison.querySelector('.local-viewer'));
   comparison.replaceChildren();
   add(comparison,'h2',r.name+' · '+r.symbol);
   button(comparison,tr('关闭','Close'),()=>comparison.close());
   const graph=graphOf(r);
   if(graph)viewStructure(add(comparison,'div'),graph,sitesOf(r,graph));
   comparison.showModal();
  }
  comparison.addEventListener('close',()=>clearViewer(comparison.querySelector('.local-viewer')));
  const kindLabel=kind=>({
   new:tr('新增','New'),duplicate:tr('完全重复','Exact Duplicate'),
   naming:tr('命名冲突','Naming Conflict'),chemical:tr('化学结构冲突','Chemical Conflict'),
   definition:tr('定义冲突','Definition Conflict'),uncertain:tr('结构比较需人工核对','Graph comparison needs review'),reserved:tr('内置名称或符号','Reserved built-in symbol')
  })[kind];
  function download(rows,kind,meta,suffix=''){
   const data=ChemistryLibrary.transfer(rows,kind,meta);
   const extension=kind==='entry'?'.oligoentry':'.olib';
   const filename=(kind==='entry'?rows[0].symbol:meta.name||'Chemistry-Library').replace(/[^a-zA-Z0-9_.-]/g,'-');
   const url=URL.createObjectURL(new Blob([JSON.stringify(data)],{type:'application/octet-stream'}));
   const link=add(root,'a');link.href=url;link.download=filename+suffix+extension;link.click();link.remove();
   setTimeout(()=>URL.revokeObjectURL(url),3000);
  }
  function renderReview(){
   review.replaceChildren();
   if(!pending){if(review.open)review.close();return;}
   const {records,choices,files}=pending, destination='custom';
   add(review,'h3',tr('合并预览','Merge Preview')+' · '+names()[destination]);
   add(review,'p',files.map(f=>f.label).join(' · '));
   const state=store.state;
   if(destination==='custom'&&files.length===1&&files[0].legacy&&!state.records.length&&!store.blocked){
    button(review,tr('恢复旧版我的自定义库','Restore previous My Custom library'),()=>{
     store.restoreLegacy(files[0].legacy);
     pending=null;refresh();scope='custom';activeId=null;search.value='';selected.clear();
     message=()=>tr('已恢复旧版化学库','Previous chemistry library restored');render();
    },'restoreLegacyChemistry');
   }
   const plan=store.preview(records,destination,choices);
   const hasConflict=plan.some(row=>row.pending);
   for(const [index,row] of plan.entries()){
    const card=add(review,'div');card.className='chemistry-review-row';
    const label=r=>r.name+' ['+r.symbol+']';
    add(card,'strong',label(row.entry)+' · '+kindLabel(row.kind));
    button(card,tr('查看导入结构','View incoming structure'),()=>view(row.entry));
    for(const m of row.matches){
     const match=add(card,'div',names()[m.scope]+' · '+label(m.old)+' · '+kindLabel(m.kind));
     button(match,tr('查看现有结构','View existing structure'),()=>view(m.old));
    }
    const choice=choices[index]||{};
    if(row.kind!=='new'||choice.name!==undefined||choice.action){
     const actions=add(card,'div');actions.className='row';
     const select=add(actions,'select');select.setAttribute('aria-label',tr('处理方式','Resolution'));
     const options=[['',tr('按当前预览处理','Use preview result')],['keep',tr('跳过导入条目','Skip incoming')]];
     if(row.canReplace)options.push(['replace',tr('以导入条目替换现有条目','Replace existing with incoming')]);
     for(const [value,label] of options)add(select,'option',label).value=value;
     select.value=choice.action||'';
     select.onchange=()=>attempt(()=>{
      choices[index]={...choice,action:select.value,existingId:select.value==='replace'?row.matches[0].old.id:undefined};
      renderReview();
     });
     const input=(label,value)=>{
      const field=add(actions,'label',label);
      const node=add(field,'input');node.value=value;return node;
     };
     const name=input(tr('标准名称','Standard name'),row.entry.name);
     const symbol=input(tr('标准符号','Standard symbol'),row.entry.symbol);
     button(actions,tr('重新检查命名','Recheck name'),()=>{
      const newChoices=choices.slice();
      newChoices[index]={name:name.value,symbol:symbol.value};
      store.preview(records,destination,newChoices);
      choices[index]=newChoices[index];renderReview();
     });
     if(choice.name!==undefined)button(actions,tr('撤销改名','Undo rename'),()=>{delete choices[index];renderReview();});
    }
    add(card,'span',{skip:tr('跳过','Skip'),replace:tr('替换','Replace'),review:tr('待处理','Needs Review'),add:tr('加入','Add')}[row.action]);
   }
   const commands=add(review,'div');commands.className='row';
   const apply=button(commands,tr('应用合并','Apply Merge'),()=>{
    const details=files.length===1&&files[0].kind==='library'?files[0].metadata:undefined;
    const result=store.apply(records,destination,choices,details);
    pending=null;refresh();scope=destination;activeId=null;search.value='';selected.clear();
    message=()=>tr('已应用合并','Merge applied')+' · '+result.filter(r=>r.action==='add'||r.action==='replace').length+'/'+result.length;
    render();
   },'applyChemistryMerge');
   apply.disabled=hasConflict||store.blocked;
   button(commands,tr('取消','Cancel'),()=>{pending=null;renderReview();});
   if(!review.open)review.showModal();
  }
  file.onchange=async()=>{
   const picked=[...file.files];file.value='';
   if(!picked.length)return;
   pending=null;renderReview();
   try{
    const packages=await Promise.all(picked.map(async f=>{
     if(f.size>25*1024*1024)throw Error(tr('文件超过 25 MB','File exceeds 25 MB'));
     const data=JSON.parse(await f.text());
     return {...ChemistryLibrary.readTransfer(data),label:f.name,
      legacy:data.schema==='oligo-user-chemistry-library'?data:null};
    }));
    pending={files:packages,records:packages.flatMap(p=>p.records),choices:[]};
    message=null;notice.textContent='';renderReview();
   }catch(e){notice.textContent=tr('无法打开化学库文件 · ','Cannot open chemistry library file · ')+e.message;}
  };
  review.addEventListener('cancel',event=>{event.preventDefault();pending=null;renderReview();});
  function saveEditor(focus=true){
   try{
    const row=save();
    finish();activeId=row.id;search.value='';render();
    if(focus)$('editChemistryEntry')?.focus();
    return true;
   }catch(error){
    let display=error;
    if(error.message==='Import MOL/SDF first')display=Error(tr('请先导入 MOL / SDF','Import MOL/SDF first'));
    UILanguage.errorInto($('customStatus'),display);
    return false;
   }
  }
  function openEditor(r){
   edit(r);editing=true;render();
   (r?$('customDisplayName'):$('customInput')).focus({preventScroll:true});
  }
  function opticalLabel(r,graph){
   const optical=graph.optical||r.block?.optical;
   const extinction=graph.extinction;
   let value=optical?.epsilon;
   if(optical?.mode==='zero')value=0;
   if(value==null&&extinction?.contribution!=null)value=extinction.contribution+(extinction.correction||0);
   if(value==null&&r.templateKey){
    value=BuiltinChemistry.opticalAttachments[r.templateKey]?.value;
    const base=graph.base, isDNA=graph.family==='DNA'||base==='T';
    if(value==null&&BuiltinChemistry.opticalCorrections.negligible.includes(r.templateKey))value=0;
    if(value==null&&!(graph.family==='DNA'&&base==='T'))value=BuiltinChemistry.opticalBases.modifiedMonomers[base];
    if(value==null)value=REFERENCE[isDNA?'dnaMono':'rnaMono'][base];
   }
   if(Number.isFinite(value))return 'ε₂₆₀ '+value.toLocaleString('en-US')+' M⁻¹ cm⁻¹';
   return optical?.mode==='parent'?tr('按母体碱基 ','Parent base ')+optical.parent:absent();
  }
  function renderInspector(list){
   summary.hidden=editing;workspace.hidden=!editing;
   if(editing){
    clearViewer($('libraryStructure'));
    const record=list.find(r=>r.id===activeId);
    editorTitle.textContent=record?tr('编辑 ','Edit ')+record.name:tr('新建自定义化学','New Custom Chemistry');
    $('customDisplayNameLabel').textContent=tr('名称','Name');
    $('customSymbolLabel').textContent=tr('序列符号','Sequence symbol');
    editorActions.replaceChildren();
    button(editorActions,tr('保存','Save'),()=>saveEditor(),'saveCustom').className='primary';
    button(editorActions,tr('取消','Cancel'),()=>confirmNavigation(()=>{render();($('editChemistryEntry')||$('newCustomChemistry'))?.focus();}),'cancelChemistryEdit');
    return;
   }
   clearViewer($('libraryStructure'));
   const r=list.find(entry=>entry.id===activeId);
   summary.replaceChildren();
   if(!r){
    const empty=add(summary,'p',list.length?tr('请选择化合物','Select a compound'):tr('暂无自定义化合物','No custom compounds yet'));
    empty.className='chemistry-empty';return;
   }
   const bar=add(summary,'div');bar.className='chemistry-panel-title';
   const identity=add(bar,'div');
   add(identity,'h2',r.name||r.symbol);
   add(identity,'code',r.symbol);
   add(identity,'span',category(r)).className='chemistry-tag';
   if(scope==='custom'){
    const actions=add(bar,'div');actions.className='chemistry-actions';
    button(actions,tr('编辑','Edit'),()=>openEditor(r),'editChemistryEntry').disabled=store.blocked;
    button(actions,tr('导出条目','Export Entry'),()=>download([r],'entry',{}),'exportChemistryEntry');
    const remove=button(actions,tr('删除','Delete'),()=>{
     if(!confirm(tr('删除 ','Delete ')+r.name+' ['+r.symbol+']?'))return;
     store.remove(r.id);selected.delete(r.id);refresh();render();
    },'deleteChemistryEntry');
    remove.disabled=store.blocked;
   }
   const graph=graphOf(r);
   if(!graph){
    const missing=add(summary,'p',tr('暂无可查看的分子结构','Structure unavailable'));
    missing.className='chemistry-empty';
    const schematic=r.schematicReference&&StructurePresentation.referenceGlyph(r.schematicReference);
    if(schematic)add(summary,'div').innerHTML=schematic;
    return;
   }
   const sites=sitesOf(r,graph),host=add(summary,'div','','libraryStructure');
   const labels=viewStructure(host,graph,sites);
   const legend=add(summary,'div');legend.className='chemistry-site-key';
   add(legend,'strong',tr('连接位点','Attachment sites'));
   if(!Object.keys(labels).length)add(legend,'span',absent());
   for(const label of Object.values(labels))add(legend,'span',label).className='chemistry-site';
   const properties=Lite.graphProperties(graph);
   const opticalText=opticalLabel(r,graph);
   const grid=add(summary,'dl');grid.className='chemistry-properties';
   for(const [label,value] of [
    [tr('分子式','Formula'),properties.formula],
    [tr('平均分子量','Average MW'),properties.average_mw?.toFixed(4)+' Da'],
    [tr('精确质量','Exact mass'),properties.exact_mass?.toFixed(4)+' Da'],
    [tr('光学性质','Optical properties'),opticalText]
   ]){
    const field=add(grid,'div');add(field,'dt',label);add(field,'dd',value);
   }
   if(r.reagentId&&r.selectable){
    const disabled=store.disabledReagents().has(r.reagentId);
    const details=add(summary,'details');add(details,'summary',tr('试剂可用性','Reagent availability'));
    button(details,disabled?tr('恢复使用','Enable in reactions'):tr('停用试剂','Disable in reactions'),()=>{
     store.setReagentEnabled(r.reagentId,disabled);
     document.dispatchEvent(new Event('builtin-reagents-changed'));
    });
   }
  }
  function renderList(list){
   const scroll=box.scrollTop,query=search.value.trim().toLocaleLowerCase();
   box.replaceChildren();
   let visible=0;
   for(const r of list){
    if(query&&![r.name,r.symbol,category(r),...(r.aliases||[])].some(v=>v?.toLocaleLowerCase().includes(query)))continue;
    visible++;
    const row=add(box,'div');row.className='chemistry-entry';row.dataset.entryId=r.id;row.dataset.symbol=r.symbol;row.classList.toggle('is-current',r.id===activeId);
    if(scope==='custom'){
     const pick=add(row,'input');pick.type='checkbox';pick.checked=selected.has(r.id);
     pick.setAttribute('aria-label',tr('选择导出 ','Select for export ')+r.symbol);
     pick.onchange=()=>{
      if(pick.checked)selected.add(r.id);else selected.delete(r.id);
      renderControls(list);
     };
    }
    const item=button(row,'',()=>{
     if(r.id===activeId&&editing)return;
     confirmNavigation(()=>{activeId=r.id;render();[...box.children].find(n=>n.dataset.entryId===r.id)?.querySelector('button')?.focus({preventScroll:true});
     if(matchMedia('(max-width: 850px)').matches)detail.scrollIntoView({block:'start'});});
    });
    item.setAttribute('aria-pressed',String(activeId===r.id));
    add(item,'strong',r.name||r.symbol);
    const secondary=add(item,'span');secondary.className='chemistry-row-meta';
    if(r.symbol!==(r.name||r.symbol))add(secondary,'code',r.symbol);
    add(secondary,'span',category(r)).className='chemistry-tag';
   }
   if(!visible)add(box,'p',query?tr('无匹配条目','No matching entries'):tr('暂无条目','No entries')).className='chemistry-empty';
   box.scrollTop=scroll;
  }
  function renderControls(list){
   controls.replaceChildren();
   button(controls,tr('导入','Import'),()=>confirmNavigation(()=>{render();file.click();}),'mergeChemistryLibrary').disabled=store.blocked;
   if(scope==='custom'){
    if(selected.size)button(controls,tr('导出所选','Export Selected')+' ('+selected.size+')',()=>download(list.filter(r=>selected.has(r.id)),'library',store.state.metadata||{},'-selected'),'exportSelectedChemistry');
    if(list.length)button(controls,tr('导出全部','Export All'),()=>download(list,'library',store.state.metadata||{}),'exportChemistryLibrary');
    button(controls,tr('+ 新建自定义化学','+ New Custom Chemistry'),()=>confirmNavigation(()=>{activeId=null;openEditor(null);}),'newCustomChemistry').className='primary';
    $('newCustomChemistry').disabled=store.blocked;
   }
  }
  function render(){
   const list=rows();
   if(!editing&&!list.some(r=>r.id===activeId))activeId=(scope==='builtin'?list.find(r=>r.templateKey):list[0])?.id??null;
   tabs.replaceChildren();
   for(const key of ['builtin','custom']){
    const tab=button(tabs,names()[key],()=>{
     if(scope===key)return;
     confirmNavigation(()=>{scope=key;activeId=null;selected.clear();search.value='';box.scrollTop=0;render();$('libraryTab-'+key).focus();});
    },'libraryTab-'+key);
    tab.setAttribute('aria-pressed',String(scope===key));
   }
   search.placeholder=tr('搜索名称、符号或类别','Search name, symbol, or category');
   search.setAttribute('aria-label',search.placeholder);
   status();renderControls(list);renderList(list);renderInspector(list);renderReview();
  }
  search.oninput=()=>renderList(rows());
  render();
  return {render,leave};
 }
 return {mount};
})();
