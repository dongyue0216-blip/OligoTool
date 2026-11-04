'use strict';
// Presentation and API transport only. No motif matching or graph transformation.
const ReactionFamilyUI=(()=>{
 const $=id=>document.getElementById(id),t=k=>ReactionFamilyWords[$('language').value][k];
 let result=null,secondary=null,pair=null,revision=0;
 const note=document.createElement('p');note.id='familyStatus';note.setAttribute('role','status');$('sites').before(note);
 const controls=document.createElement('div');controls.className='row';$('sites').after(controls);
 const pairLabel=document.createElement('label'),pairSelect=document.createElement('select');pairSelect.id='roleAssignment';pairLabel.append(pairSelect);controls.append(pairLabel);
 const confirmLabel=document.createElement('label'),confirm=document.createElement('input');confirm.type='checkbox';confirm.id='confirmReactionSites';confirmLabel.append(confirm);controls.append(confirmLabel);
 const engine=()=>ReactionFamilyAPI.available()?ReactionFamilyAPI:null;
 const family=()=>$('reaction').value;
 const single=()=>family()==='reduction';
 function inputVisibility(){for(const e of [$('reagentInput'),$('reagentFile'),$('reagentViewer'),document.querySelector('[data-i18n=secondary]')]){e.hidden=single();if('disabled' in e)e.disabled=single()||!JSON.parse(UI.state()).draftOpen;}if($('site1'))$('site1').parentElement.hidden=single();if(pairLabel.firstChild?.nodeType===3)pairLabel.firstChild.nodeValue=t(single()?'retentionPair':'pair');while(confirmLabel.childNodes.length>1)confirmLabel.lastChild.remove();confirmLabel.append(document.createTextNode(t(single()?'confirmSingle':'confirm')));}
 const reason=r=>typeof r==='string'?r:r?.message||r?.reason||r?.code||t('unsupported');
 function invalidate(){revision++;UI.invalidate();confirm.checked=false;}
 function overlay(site,g){
  if(!site)return null;
  let atoms=site.atoms;
  if(single()&&pair?.raw?.retention==='explicit_selection_required'){const f=pair.raw.fragments[pair.raw.retained_component];atoms={...atoms,...Object.fromEntries(f.atom_indices.filter(i=>!Object.values(site.atoms).includes(i)).map((i,k)=>['fragment'+k,i]))};}
  if(!atoms||Object.values(atoms).some(i=>!Number.isInteger(i)||!g.atoms[i]))throw Error(t('failed'));
  const words=ReactionFamilyWords[$('language').value];
  return {atoms,atomIds:site.selected_atom_ids,labels:Object.fromEntries(Object.entries(atoms).map(([role,i])=>[role,role.startsWith('fragment')?'':(words['atom.'+role]??role)+' '+g.atoms[i].e+(i+1)]))};
 }
 function label(site,g){const words=ReactionFamilyWords[$('language').value],motif=site.product_class==='carbamate'?site.motif+' · '+t('carbonate'):(words['motif.'+site.motif]||site.motif||site.type);return motif+' · '+Object.entries(site.atoms).map(([role,i])=>(words['atom.'+role]??role)+' '+g.atoms[i].e+(i+1)).join(' / ');}
 function selected(){return pair?[result.candidates[0].find(s=>s.id===pair.siteIds[0]),result.candidates[1].find(s=>s.id===pair.siteIds[1])]:[null,null];}
 function render(){
  const w=UI.workflow;if(!w)return;
  const draftOpen=JSON.parse(UI.state()).draftOpen;
  for(const id of ['reaction','reagentInput','reagentFile','roleAssignment','site0','site1','confirmReactionSites'])if($(id))$(id).disabled=!draftOpen;
  inputVisibility();const ss=draftOpen?selected():[null,null];
  LocalViewers.mount('startingViewer',Sandbox.record(w.current),{title:t('starting'),selectedSite:overlay(ss[0],w.current)});
  LocalViewers.mount('reagentViewer',secondary?Sandbox.record(secondary):null,{title:t('secondary'),selectedSite:secondary?overlay(ss[1],secondary):null});
  const state=JSON.parse(UI.state()),preview=state.preview;
  LocalViewers.mount('productViewer',preview?Sandbox.A.checkpoint(preview,preview.steps.length):null,{title:t('product')});
 }
 function status(){note.textContent=[single()?(pair?.raw?.retention==='explicit_selection_required'?t('retainRequired'):t('reductionHelp')):'',family()==='cap'?t('capHelp'):'',result?.reason?reason(result.reason):'',pair?.activation_required?t('activation'):'',pair?t(single()?'readySingle':'ready'):''].filter(Boolean).join(' · ');}
 function selectPair(value){invalidate();pair=result?.assignments.find(p=>p.id===value)||null;for(let i=0;i<2;i++)$('site'+i).value=pair?.siteIds[i]||'';status();render();$('preview').disabled=!pair||!confirm.checked;}
 function populate(preserve=false){
  $('sites').replaceChildren();
  for(let i=0;i<2;i++){
   const l=document.createElement('label');l.textContent=t(i?'secondary':'starting');const select=document.createElement('select');select.id='site'+i;
   const empty=document.createElement('option');empty.value='';empty.textContent=t('choose');select.append(empty);
   for(const site of result?.candidates[i]||[]){const o=document.createElement('option');o.value=site.id;o.textContent=label(site,i?secondary:UI.workflow.current);select.append(o);}
   select.onchange=()=>{const other=$('site'+(1-i)).value,options=result.assignments.filter(p=>p.siteIds[i]===select.value),next=options.find(p=>p.siteIds[1-i]===other)||options[0];pairSelect.value=next?.id||'';selectPair(pairSelect.value);};
   l.append(select);$('sites').append(l);
  }
  pairSelect.replaceChildren();const empty=document.createElement('option');empty.value='';empty.textContent=t('selectPair');pairSelect.append(empty);
  for(const p of result?.assignments||[]){const o=document.createElement('option');o.value=p.id;o.textContent=(single()?t('retain')+' '+(p.raw.retained_component+1)+' ('+p.raw.fragments[p.raw.retained_component].atom_count+' '+t('atoms')+') · ':'')+p.roles.map(r=>ReactionFamilyWords[$('language').value]['role.'+r]||r).join(' ↔ ')+(p.raw?.regioselectivity==='not_predicted'?' · '+t('isomer')+' '+p.orientation.toUpperCase():'');pairSelect.append(o);}
  pairSelect.onchange=()=>selectPair(pairSelect.value);
  pairSelect.value=preserve?(pair?.id||''):(result?.assignments.length===1?result.assignments[0].id:'');
  if(preserve){for(let i=0;i<2;i++)$('site'+i).value=pair?.siteIds[i]||'';status();render();}else selectPair(pairSelect.value);
 }
 function detect(){
  invalidate();result=null;secondary=null;pair=null;$('preview').disabled=true;
  try{
   if(!UI.workflow)return;
   inputVisibility();
   if(!single()&&!$('reagentInput').value.trim()){populate();render();note.textContent=t('required');return;}
   secondary=single()?null:Reactions.v2.parseReagent($('reagentInput').value,family());
   if(!engine()){populate();render();note.textContent=t('unavailable');return;}
   result=engine().analyze({family:family(),inputs:single()?[UI.workflow.current]:[UI.workflow.current,secondary]});
   populate();status();render();
  }catch(e){result=null;pair=null;populate();note.textContent=e.message;render();}
 }
 function preview(workflow){
  if(!pair||!confirm.checked)throw Error(t('confirm'));
  const next=engine().append(workflow,{family:family(),secondary,assignmentId:pair.id,siteIds:pair.siteIds});
  if(typeof FragmentComposition!=='undefined')FragmentComposition.remember(next);
  // Existing C renderer and immutable Notebook consume the native A workflow.
  Sandbox.C.present(Sandbox.A.checkpoint(next,next.steps.length),false);return next;
 }
 function localize(){
  inputVisibility();
  for(const o of $('reaction').options)o.textContent=t(o.value);
  document.querySelector('[data-i18n=reaction]').textContent=t('family');
  document.querySelector('[data-i18n=secondary]').textContent=t('input');
  for(const [id,key]of [['apply','apply'],['preview','preview'],['next','next']])$(id).textContent=t(key);
  pairLabel.firstChild?.nodeType===3&&pairLabel.firstChild.remove();pairLabel.prepend(document.createTextNode(t('pair')));
  while(confirmLabel.childNodes.length>1)confirmLabel.lastChild.remove();confirmLabel.append(document.createTextNode(t('confirm')));
  if(result)populate(true);else if(UI.workflow)render();
  const state=JSON.parse(UI.state());if(state.preview)$('previewResult').textContent=t('previewReady');else if(!state.draftOpen&&UI.workflow?.steps.length)$('previewResult').textContent=t('applied');
 }
 confirm.onchange=()=>{UI.invalidate();render();$('preview').disabled=!pair||!confirm.checked;};
 $('language').addEventListener('change',localize);
 // Reuse the existing file import / input invalidation events via reaction.onchange.
 localize();return {detect,render,preview,localize,get result(){return result;},get pair(){return pair;},get revision(){return revision;}};
})();
