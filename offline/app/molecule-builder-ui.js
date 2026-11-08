'use strict';
// B: choose Operations, display immutable A states, and delegate all chemistry to A.
const MoleculeBuilderUI=(()=>{
 const $=id=>document.getElementById(id),en=()=>$('language').value==='en',txt=(zh,eng)=>en()?eng:zh;
 let active=null;const current=()=>active||states.at(-1);
 let states=[],preview=null,secondary=null,candidates=[],quickResult=null;
 const host=document.createElement('article');host.id='moleculeBuilder';document.querySelector('.workflow').style.display='none';$('sequenceWorkspace').append(host);
 host.innerHTML=`<h2 id="builderTitle"></h2><p id="builderHelp" class="muted"></p><div class="row"><button id="builderStart"></button><button id="builderRestore"></button><input type="file" id="builderStateFile" accept=".json" hidden></div><div id="builderHistory"></div><button id="builderAdd"></button><section id="builderDraft" hidden><label id="operationLabel"></label><select id="builderOperation"><option value="reaction"></option><option value="branch"></option></select><div id="builderBranch"><label id="branchSiteLabel"></label><select id="builderSite"></select><label id="branchSequenceLabel"></label><textarea id="builderSequence" spellcheck="false" placeholder="rArC / [GlycerolBranch]rA / [UserBlock]rA"></textarea><div class="row"><label>Linkage<select id="builderLinkage"></select></label><label id="childEndLabel"></label><select id="builderChildEnd"><option value="start">Start</option><option value="end">End</option></select></div></div><div id="builderReaction"><div id="builderManualFamily" hidden><label for="builderFamily" id="familyLabel"></label><select id="builderFamily"></select></div><label for="builderReagentFile" id="builderReagentLabel" hidden></label><input type="file" id="builderReagentFile" accept=".mol,.sdf"><textarea id="builderReagent" placeholder="MOL / SDF"></textarea><button id="builderDetect" hidden></button><label id="builderCandidateLabel" hidden><span id="builderChoice"></span><select id="builderCandidate"></select></label><p id="builderCandidateInfo" class="muted" role="status"></p><button type="button" id="builderManual" aria-controls="builderManualFamily" aria-expanded="false"></button></div><div class="triptych"><div id="builderStarting"></div><div id="builderSecondary"></div></div><div class="row"><button id="builderPreview"></button><button id="builderApply" disabled></button></div><div id="builderProduct"></div></section><p id="builderStatus" role="status"></p>`;
 const families=['CAP','Condensation','Click','IEDDA','DisulfideReduction','ThiolMaleimide'];
 for(const id of families){const o=document.createElement('option');o.value=id;$('builderFamily').append(o);}
 for(const id of Object.keys(Lite.linkageDefinitions).filter(k=>k!=='PMO')){const o=document.createElement('option');o.value=id;o.textContent=id;$('builderLinkage').append(o);}
 const operationName=s=>({BranchElongation:txt('分支延长','Branch Elongation'),Condensation:txt('胺偶联','Amine Coupling'),DisulfideReduction:txt('二硫键还原','Disulfide Reduction'),ThiolMaleimide:txt('巯基–马来酰亚胺','Thiol–Maleimide'),Click:'Click Reaction',IEDDA:txt('IEDDA / 四嗪偶联','IEDDA / Tetrazine Ligation'),CAP:'CAP'}[s.operation?.kind]||txt('起始序列','Starting Sequence'));
 const record=s=>Sandbox.record(s.graph,{moleculeState:s,assemblyGraph:s.assemblyGraph,optical:s.optical});
 function invalidate(){preview=null;$('builderApply').disabled=true;$('builderProduct').replaceChildren();}
 function attempt(fn){try{return fn();}catch(e){$('builderStatus').textContent=e.message;}}
 function history(){
  const box=$('builderHistory'),open=new Set(Array.from(box.querySelectorAll('details[open]')).map(e=>e.dataset.state));box.replaceChildren();
  states.forEach((s,i)=>{const d=document.createElement('details');d.dataset.state=s.id;d.open=i===states.length-1||open.has(s.id);const summary=document.createElement('summary');summary.textContent=(s===current()?txt('当前分子 · ','Current Molecule · '):'')+i+' · '+operationName(s)+' · '+s.formula;d.append(summary);const v=document.createElement('div');d.append(v);let mounted=false;const mount=()=>{if(d.open&&!mounted){LocalViewers.mount(v,record(s),{title:summary.textContent,exports:{name:'molecule-'+s.id}});mounted=true;}};d.addEventListener('toggle',mount);mount();const row=document.createElement('div');row.className='row';const use=document.createElement('button');use.textContent=txt('从此状态继续','Continue from this state');use.onclick=()=>{active=s;history();openDraft();};row.append(use);d.append(row);box.append(d);});
  $('builderAdd').disabled=!states.length;
 }
 function start(){invalidate();const s=$('kind').value==='sequence'?MoleculeBuilder.start($('input').value):MoleculeBuilder.fromGraph(Sandbox.A[$('kind').value]($('input').value).graph);states=[s];active=null;history();$('builderDraft').hidden=true;$('builderStatus').textContent=txt('已建立状态 0。点击 + 添加步骤继续。','State 0 created. Use + Add Step to continue.');}
 const manual=()=>!$('builderManualFamily').hidden;
 const branchMode=()=>$('builderOperation').value==='branch';
 const selectedFamily=()=>manual()?$('builderFamily').value:null;
 const selectedCandidate=()=>candidates.find(c=>c.candidate_id===$('builderCandidate').value);
 const reagentSource=ReagentSource.mount({input:$('builderReagent'),file:$('builderReagentFile'),language:$('language'),
  family:selectedFamily,substrate:()=>current()?.graph,defaultSource:'builtin',invalidate:refreshReaction});
 function updateOperation(){
  invalidate();const branch=branchMode();$('builderSecondary').hidden=branch;$('builderBranch').hidden=!branch;$('builderReaction').hidden=branch;
  const s=current();if(!s)return;
  const old=$('builderSite').value;$('builderSite').replaceChildren();for(const site of MoleculeBuilder.available(s)){const o=document.createElement('option');o.value=site.id;const laneIndex=s.assemblyGraph.lanes.findIndex(l=>l.id===site.path);o.textContent=(laneIndex?txt('分支序列 ','Branch Sequence ')+laneIndex:txt('主序列','Main Sequence'))+' / '+txt('单元 ','Unit ')+site.node.slice(1)+' / '+site.label+' · '+site.element+(site.atom+1);$('builderSite').append(o);}
  if(Array.from($('builderSite').options).some(o=>o.value===old))$('builderSite').value=old;
  if(!branch){refreshReaction();return;}
  $('builderPreview').disabled=!$('builderSite').options.length;
  $('builderStatus').textContent=$('builderPreview').disabled?txt('当前分子没有可用的分支位点。','No available branch AttachmentSites on this molecule.'):'';
  const site=s.attachmentSites.find(s=>s.id===$('builderSite').value);
  LocalViewers.mount('builderStarting',record(s),{title:txt('起始分子','Starting Molecule'),selectedSite:site?{atoms:{[site.label]:site.atom}}:null});
 }
 function setManual(value){
  $('builderManualFamily').hidden=!value;
  $('builderManual').setAttribute('aria-expanded',String(value));
  $('builderManual').textContent=value?txt('返回快速模式','Back to Quick'):txt('高级 / 手动','Advanced / Manual');
  $('builderDetect').hidden=!value;
 }
 function openDraft(){if(!states.length)return;$('builderDraft').hidden=false;uploadRevision++;reagentSource.reset();setManual(false);updateOperation();}
 function highlightReaction(){
  const c=selectedCandidate(),s=current();if(!s)return;
  LocalViewers.mount('builderStarting',record(s),{title:txt('起始分子','Starting Molecule'),selectedSite:c?.sites[0]});
  LocalViewers.mount('builderSecondary',secondary?Sandbox.record(secondary):null,{title:txt('第二反应物','Secondary reagent'),selectedSite:c?.sites[1]});
 }
 function siteLabel(site,withAtoms){
  const motif=(site.motif_type||site.type).replaceAll('_',' ');
  if(!withAtoms)return motif;
  const graph=site.input===0?current().graph:secondary;
  return motif+' ('+Object.values(site.atoms).map(i=>graph.atoms[i].e+(i+1)).join(', ')+')';
 }
 function candidateLabel(c){
  const name=c.reaction_name||Reactions.v2.families[c.family].name;
  const sites=c.sites.map(s=>siteLabel(s,true)).join(' + ');
  const choice=c.regioselectivity==='not_predicted'?txt('连接方式 ','Connectivity ')+c.orientation.toUpperCase():
   c.retained_component!=null?txt('保留片段 ','Retain fragment ')+(c.retained_component+1):'';
  return [name,sites,choice].filter(Boolean).join(' · ');
 }
 function updateCandidate(){
  const c=selectedCandidate(),info=$('builderCandidateInfo');
  $('builderPreview').disabled=!c;
  $('builderApply').disabled=manual()||!c;
  if(c){
   const name=c.reaction_name||Reactions.v2.families[c.family].name;
   info.textContent=[txt('识别反应：','Detected reaction: ')+name,c.sites.map(s=>siteLabel(s,false)).join(' + '),
    c.semantics.includes('activation_required')?txt('形式缩合，需活化','Formal condensation; activation required'):'',
    c.structural_compatibility?txt('结构兼容，实验工艺未验证','Structurally compatible; experimental process not validated'):'',
    c.product_state].filter(Boolean).join(' · ');
  }else if(candidates.length){
   const pairs=new Set(candidates.map(c=>c.site_pair_id)).size,defs=new Set(candidates.map(c=>c.definition_id)).size;
   info.textContent=manual()?txt('请选择候选位点或产物。','Choose a site pair or product.'):
    defs>1?txt('检测到多个兼容反应，请选择。','Multiple compatible reactions detected. Choose a reaction and sites.'):
    pairs>1?txt('有多对兼容位点，请选择。','Multiple compatible site pairs. Choose the sites.'):
    txt('识别反应：','Detected reaction: ')+candidates[0].reaction_name+txt('。请选择产物连接方式。','. Choose the product connectivity.');
  }else if(quickResult){
   const motifs=quickResult.motifs.map(m=>m.length?m.map(x=>x.replaceAll('_',' ')).join(', '):txt('无受支持的基团','no supported motifs'));
   info.textContent=txt('未检测到兼容反应','No compatible reaction detected')+' · '+
    (quickResult.reason==='NO_COMPLEMENTARY_MOTIFS'?txt('基团不互补','Motifs are not complementary')+' · ':'')+
    txt('当前分子','Current molecule')+' ['+motifs[0]+'] / '+txt('第二反应物','Reagent')+' ['+motifs[1]+']';
  }else info.textContent='';
  highlightReaction();
 }
 function populateCandidates(preserve=false){
  const select=$('builderCandidate'),old=select.value;
  select.replaceChildren(new Option(txt('选择候选','Choose a candidate'),''));
  for(const c of candidates)select.add(new Option(candidateLabel(c),c.candidate_id));
  select.value=candidates.length===1?candidates[0].candidate_id:preserve&&candidates.some(c=>c.candidate_id===old)?old:'';
  $('builderCandidateLabel').hidden=manual()?!candidates.length:candidates.length<2;
  updateCandidate();
 }
 function refreshReaction(){
  invalidate();secondary=null;candidates=[];quickResult=null;
  $('builderStatus').textContent='';
  const family=selectedFamily();
  try{
   reagentSource.refresh(true,family!=='DisulfideReduction');
   $('builderReagentLabel').hidden=$('builderReagentFile').hidden;
   $('builderSecondary').hidden=family==='DisulfideReduction';
   if(!manual()&&reagentSource.hasSelection()){
    secondary=reagentSource.graph();
    quickResult=Reactions.v2.findCompatibleReactionPlans(current().graph,secondary);
    candidates=quickResult.plans.filter(c=>c.materialization_eligible);
   }
  }catch(e){$('builderStatus').textContent=e.message;}
  populateCandidates();
 }
 function detect(){
  refreshReaction();
  const family=selectedFamily(),s=current();
  secondary=family==='DisulfideReduction'?null:reagentSource.graph();
  const result=Reactions.v2.candidates(family,secondary?[s.graph,secondary]:[s.graph]);
  candidates=result.candidates;
  populateCandidates();
  if(!candidates.length)$('builderCandidateInfo').textContent=result.reason;
 }
 $('builderStart').onclick=()=>attempt(start);$('builderAdd').onclick=()=>attempt(openDraft);$('builderOperation').onchange=()=>attempt(updateOperation);$('builderSite').onchange=()=>attempt(updateOperation);
 $('builderManual').onclick=()=>{setManual(!manual());refreshReaction();};
 $('builderFamily').onchange=refreshReaction;
 $('builderDetect').onclick=()=>attempt(detect);
 for(const id of ['builderSequence','builderLinkage','builderChildEnd'])$(id).addEventListener('input',invalidate);
 $('builderCandidate').oninput=()=>{invalidate();$('builderStatus').textContent='';updateCandidate();};
 let uploadRevision=0;
 $('builderReagent').oninput=()=>{uploadRevision++;refreshReaction();};
 $('builderReagentFile').onchange=async()=>{
  const token=++uploadRevision,file=$('builderReagentFile').files[0],state=current();
  if(!file)return;
  $('builderReagent').value='';refreshReaction();
  try{
   const value=await file.text();
   if(token!==uploadRevision||state!==current()||$('builderDraft').hidden)return;
   $('builderReagent').value=value;refreshReaction();
  }catch(e){if(token===uploadRevision)$('builderStatus').textContent=e.message;}
 };
 function materialize(){
  const s=current();
  if(branchMode())return MoleculeBuilder.branch(s,{siteId:$('builderSite').value,sequence:$('builderSequence').value,linkage:$('builderLinkage').value,childEnd:$('builderChildEnd').value});
  const c=selectedCandidate();
  if(!c)throw Error(txt('请选择反应位点。','Select reaction sites.'));
  return MoleculeBuilder.react(s,{family:c.family,secondary,candidateId:c.candidate_id});
 }
 $('builderPreview').onclick=()=>attempt(()=>{
  invalidate();preview=materialize();
  LocalViewers.mount('builderProduct',record(preview),{title:txt('预览产物','Product Preview')});
  $('builderApply').disabled=false;
  $('builderStatus').textContent=txt('预览已就绪；应用后保存新状态。','Preview ready; Apply commits a new state.');
 });
 $('builderApply').onclick=()=>attempt(()=>{
  const next=preview||(!branchMode()&&!manual()&&selectedCandidate()?materialize():null);
  if(!next)return;
  states.push(next);active=null;invalidate();$('builderDraft').hidden=true;history();
  $('builderStatus').textContent=txt('已保存新状态。可导出或添加步骤。','New state saved. Export or add another step.');
 });
 $('builderRestore').onclick=()=>$('builderStateFile').click();$('builderStateFile').onchange=async()=>{try{const f=$('builderStateFile').files[0];if(!f)return;const s=MoleculeBuilder.restore(await f.text());states=[s];active=null;invalidate();history();$('builderDraft').hidden=true;}catch(e){$('builderStatus').textContent=e.message;}finally{$('builderStateFile').value='';}};
 $('run').addEventListener('click',()=>{if(UI.current?.input===$('input').value)attempt(start);});
 function localize(){for(const [id,zh,eng]of [['builderTitle','分子构建 · 操作与状态','Molecule Builder · Operations & States'],['builderHelp','序列 → 反应 / 分支延长 → 任意后续步骤。Apply 保存状态；Export 导出状态。','Sequence → Reaction / Branch Elongation → further steps. Apply saves a state; Export exports it.'],['builderStart','从输入序列建立新分子','Start new molecule from input sequence'],['builderRestore','导入分子状态','Import molecule state'],['builderAdd','+ 添加步骤','+ Add Step'],['operationLabel','操作类型','Operation type'],['branchSiteLabel','可用分支位点','Available branch site'],['branchSequenceLabel','分支序列（与主序列语法相同）','Branch Sequence (same syntax as main sequence)'],['childEndLabel','子序列连接端','Child Sequence endpoint'],['familyLabel','反应类型','Reaction family'],['builderReagentLabel','选择第二反应物（MOL / SDF）','Choose Secondary Reagent (MOL / SDF)'],['builderDetect','检测兼容位点','Detect compatible sites'],['builderPreview','预览产物','Preview Product'],['builderChoice','兼容候选','Compatible options'],['builderApply','应用','Apply']])$(id).textContent=txt(zh,eng);
  $('builderChildEnd').options[0].textContent=txt('起点（输入序列首端）','Start (first end in input notation)');$('builderChildEnd').options[1].textContent=txt('终点（输入序列末端）','End (last end in input notation)');$('builderOperation').options[0].textContent=txt('合成后修饰','Post-functionalization');$('builderOperation').options[1].textContent=txt('分支延长','Branch Elongation');const names=en()?['CAP','Amine Coupling','Click Reaction','IEDDA / Tetrazine Ligation','Disulfide Reduction','Thiol–Maleimide']:['CAP','胺偶联','Click Reaction','IEDDA / 四嗪偶联','二硫键还原','巯基–马来酰亚胺'];Array.from($('builderFamily').options).forEach((o,i)=>o.textContent=names[i]);setManual(manual());history();
  if(!$('builderDraft').hidden&&!branchMode()){
   const canApply=!$('builderApply').disabled;
   reagentSource.refresh(true,selectedFamily()!=='DisulfideReduction');
   populateCandidates(true);
   $('builderApply').disabled=!canApply;
  }
 }
 // Extend the existing editor with optional, unbounded branch selections.
 const editor=document.createElement('div');editor.id='branchSelectors';$('customStatus').before(editor);const add=document.createElement('button');add.id='addBranchAttachment';add.textContent='＋ Branch AttachmentSite';editor.before(add);
 window.addBranchSelector=(atom='')=>{const row=document.createElement('label'),index=editor.children.length+1;row.textContent='Branch '+index+' ';const select=$('fiveOH').cloneNode(true);select.removeAttribute('id');select.dataset.branchAtom='';select.value=String(atom);select.addEventListener('change',()=>{const vals=Array.from(editor.querySelectorAll('select')).filter(e=>e.value!=='').map(e=>Number(e.value));$('customStatus').textContent=vals.map((a,i)=>'Branch '+(i+1)+' → O'+(a+1)).join(' · ');});row.append(select);const remove=document.createElement('button');remove.textContent='×';remove.onclick=()=>{row.remove();Array.from(editor.children).forEach((r,i)=>r.firstChild.textContent='Branch '+(i+1)+' ');};row.append(remove);editor.append(row);};add.onclick=()=>window.addBranchSelector();
 $('language').addEventListener('change',localize);localize();
 return {get states(){return states.slice();},get preview(){return preview;},record,start};
})();
