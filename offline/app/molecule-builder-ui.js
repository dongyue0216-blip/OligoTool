'use strict';
// B: choose Operations, display immutable A states, and delegate all chemistry to A.
const MoleculeBuilderUI=(()=>{
 const $=id=>document.getElementById(id),en=()=>$('language').value==='en',txt=(zh,eng)=>en()?eng:zh;
 let active=null;const current=()=>active||states.at(-1);
 let states=[],preview=null,secondary=null,candidates=[],quickResult=null;
 const host=document.createElement('article');host.id='moleculeBuilder';document.querySelector('.workflow').style.display='none';$('sequenceWorkspace').append(host);
 host.innerHTML=`<h2 id="builderTitle"></h2><p id="builderHelp" class="muted"></p><div class="row"><button id="builderStart"></button><button id="builderRestore"></button><input type="file" id="builderStateFile" accept=".json" hidden></div><div id="builderHistory"></div><button id="builderAdd"></button><section id="builderDraft" hidden><label id="operationLabel"></label><select id="builderOperation"><option value="reaction"></option><option value="branch"></option></select><div id="builderBranch"><label id="branchSiteLabel"></label><select id="builderSite"></select><label id="branchSequenceLabel"></label><textarea id="builderSequence" spellcheck="false" placeholder="rArC / [GlycerolBranch]rA / [UserBlock]rA"></textarea><div class="row"><label><span data-ui="backbone.linkage"></span><select id="builderLinkage"></select></label><span id="childEndLabel"></span></div></div><div id="builderReaction"><div id="builderManualFamily" hidden><label for="builderFamily" id="familyLabel"></label><select id="builderFamily"></select></div><label for="builderReagentFile" id="builderReagentLabel" hidden></label><input type="file" id="builderReagentFile" accept=".mol,.sdf"><textarea id="builderReagent" placeholder="MOL / SDF"></textarea><button id="builderDetect" hidden></button><label id="builderCandidateLabel" hidden><span id="builderChoice"></span><select id="builderCandidate"></select></label><p id="builderCandidateInfo" class="muted" role="status"></p><button type="button" id="builderManual" aria-controls="builderManualFamily" aria-expanded="false"></button></div><div class="triptych"><div id="builderStarting"></div><div id="builderSecondary"></div></div><div class="row"><button id="builderPreview"></button><button id="builderApply" disabled></button></div><div id="builderProduct"></div></section><p id="builderStatus" role="status"></p>`;
 const exportProduct=document.createElement('button');
 exportProduct.id='builderExportProduct';exportProduct.type='button';exportProduct.hidden=true;
 $('builderStatus').after(exportProduct);
 const families=['','CAP','Condensation','Click','IEDDA','DisulfideReduction','ThiolMaleimide','ThiolOxadiazole'];
 for(const id of families){const o=document.createElement('option');o.value=id;$('builderFamily').append(o);}
 for(const id of Object.keys(Lite.linkageDefinitions).filter(k=>k!=='PMO')){const o=document.createElement('option');o.value=id;o.textContent=id;$('builderLinkage').append(o);}
 const operationName=s=>({BranchElongation:UILanguage.text("branch.elongation"),Condensation:UILanguage.text("amine.coupling"),DisulfideReduction:UILanguage.text("disulfide.reduction"),ThiolOxadiazole:UILanguage.text("thiol.oxadiazole"),ThiolMaleimide:UILanguage.text("thiol.maleimide"),Click:ReactionLabels.name({family:'Click'}),IEDDA:UILanguage.text("iedda.tetrazine.ligation"),CAP:'CAP'}[s.operation?.kind]||UILanguage.text("starting.sequence"));
 const record=MoleculeBuilder.record;
 function invalidate(){preview=null;exportProduct.hidden=true;$('builderApply').disabled=true;$('builderProduct').replaceChildren();}
 function attempt(fn){try{return fn();}catch(e){UILanguage.errorInto($('builderStatus'),e);}}
 function history(){
  const box=$('builderHistory'),open=new Set(Array.from(box.querySelectorAll('details[open]')).map(e=>e.dataset.state));box.replaceChildren();
  states.forEach((s,i)=>{const d=document.createElement('details');d.dataset.state=s.id;d.open=i===states.length-1||open.has(s.id);const summary=document.createElement('summary');summary.textContent=(s===current()?UILanguage.text("current.molecule"):'')+i+' · '+operationName(s)+' · '+s.formula;d.append(summary);const v=document.createElement('div');d.append(v);let mounted=false;const mount=()=>{if(d.open&&!mounted){LocalViewers.mount(v,record(s),{title:summary.textContent,exports:{name:'molecule-'+s.id}});mounted=true;}};d.addEventListener('toggle',mount);mount();const row=document.createElement('div');row.className='row';const use=document.createElement('button');use.textContent=UILanguage.text("continue.from.this.state");use.onclick=()=>{active=s;history();openDraft();};row.append(use);d.append(row);box.append(d);});
  $('builderAdd').disabled=!states.length;
 }
 function start(){invalidate();const s=$('kind').value==='sequence'?MoleculeBuilder.start($('input').value):MoleculeBuilder.fromGraph(Sandbox.A[$('kind').value]($('input').value).graph);states=[s];active=null;history();$('builderDraft').hidden=true;UILanguage.write($('builderStatus'),()=>UILanguage.text("state.0.created.use.add.step.to.continue"));}
 const manual=()=>!$('builderManualFamily').hidden;
 const branchMode=()=>$('builderOperation').value==='branch';
 const selectedFamily=()=>manual()?($('builderFamily').value||null):null;
 const selectedCandidate=()=>candidates.find(c=>c.candidate_id===$('builderCandidate').value);
 const reagentSource=ReagentSource.mount({input:$('builderReagent'),file:$('builderReagentFile'),language:$('language'),
  family:selectedFamily,substrate:()=>current()?.graph,defaultSource:'builtin',invalidate:refreshReaction});
 function updateOperation(){
  invalidate();const branch=branchMode();$('builderSecondary').hidden=branch;$('builderBranch').hidden=!branch;$('builderReaction').hidden=branch;
  const s=current();if(!s)return;
  renderBranchSites();
  if(!branch){refreshReaction();return;}
  $('builderPreview').disabled=!$('builderSite').options.length;
  UILanguage.write($('builderStatus'),()=>$('builderPreview').disabled?UILanguage.text("no.available.branch.attachmentsites.on.this.molecule"):'');
  renderBranchStarting();
 }
 function renderBranchSites(){
  const s=current(),old=$('builderSite').value;$('builderSite').replaceChildren();for(const site of MoleculeBuilder.available(s)){const o=document.createElement('option');o.value=site.id;const laneIndex=s.assemblyGraph.lanes.findIndex(l=>l.id===site.path);o.textContent=(laneIndex?UILanguage.text("branch.sequence")+laneIndex:UILanguage.text("main.sequence"))+' / '+UILanguage.text("unit")+site.node.slice(1)+' / '+UILanguage.branchLabel(site.label)+' · '+site.element+(site.atom+1);$('builderSite').append(o);}
  if(Array.from($('builderSite').options).some(o=>o.value===old))$('builderSite').value=old;
 }
 function renderBranchStarting(){
  const s=current(),site=s.attachmentSites.find(s=>s.id===$('builderSite').value);
  LocalViewers.mount('builderStarting',record(s),{title:UILanguage.text("starting.molecule"),selectedSite:site?{atoms:{[site.label]:site.atom},labels:{[site.label]:UILanguage.branchLabel(site.label)}}:null});
 }
 function setManual(value){
  $('builderManualFamily').hidden=!value;
  $('builderManual').setAttribute('aria-expanded',String(value));
  $('builderManual').textContent=value?UILanguage.text("back.to.quick"):UILanguage.text("advanced.manual");
  $('builderDetect').hidden=!value;
 }
 function openDraft(){if(!states.length)return;$('builderDraft').hidden=false;uploadRevision++;reagentSource.reset();$('builderFamily').value='';setManual(false);updateOperation();}
 function highlightReaction(){
  const s=current();if(!s)return;
  const sharedPair=candidates.length&&candidates.every(c=>c.site_pair_id===candidates[0].site_pair_id);
  const c=selectedCandidate()||(sharedPair?candidates[0]:null);
  LocalViewers.mount('builderStarting',record(s),{title:UILanguage.text("starting.molecule"),selectedSite:c?.sites[0]});
  LocalViewers.mount('builderSecondary',secondary?Sandbox.record(secondary):null,{title:UILanguage.text("secondary.reagent"),selectedSite:c?.sites[1]});
 }
 function siteLabel(site,withAtoms){
  const motif=ReactionLabels.motif(site.motif_type||site.type);
  if(!withAtoms)return motif;
  const graph=site.input===0?current().graph:secondary;
  return motif+' ('+Object.values(site.atoms).map(i=>graph.atoms[i].e+(i+1)).join(', ')+')';
 }
 function candidateLabel(c){
  const name=ReactionLabels.name(c);
  const sites=c.sites.map(s=>siteLabel(s,true)).join(' + ');
  let choice='';
  if(c.regioselectivity==='not_predicted'){
   const azide=c.sites[c.roles.indexOf('azide')],alkyne=c.sites[c.roles.indexOf('strainedAlkyne')];
   const [c1,c2]=c.orientation==='b'?[alkyne.atoms.internal,alkyne.atoms.terminal]:[alkyne.atoms.terminal,alkyne.atoms.internal];
   const input=s=>s.input===0?UILanguage.text("start"):UILanguage.text("reagent");
   choice=UILanguage.text("new.bonds")+input(azide)+' N'+(azide.atoms.proximal+1)+'–'+input(alkyne)+' C'+(c1+1)+
    ', '+input(azide)+' N'+(azide.atoms.distal+1)+'–'+input(alkyne)+' C'+(c2+1);
  }else if(c.retained_component!=null){
   const fragment=c.fragments[c.retained_component],sulfur=Object.values(c.sites[0].atoms).filter(i=>fragment.atom_indices.includes(i));
   choice=UILanguage.text("retain.fragment.with")+sulfur.map(i=>'S'+(i+1)).join(' + ')+
    ' ('+fragment.atom_count+UILanguage.text("explicit.atoms");
  }
  return [name,sites,choice].filter(Boolean).join(' · ');
 }
 function updateCandidate(){
  const c=selectedCandidate(),info=$('builderCandidateInfo');
  $('builderPreview').disabled=!c;
  $('builderApply').disabled=!preview;
  if(c){
   const name=ReactionLabels.name(c);
   info.textContent=[UILanguage.text("detected.reaction")+name,c.sites.map(s=>siteLabel(s,false)).join(' + '),
    c.semantics.includes('activation_required')?UILanguage.text("formal.condensation.activation.required"):'',
    c.structural_compatibility?UILanguage.text("structurally.compatible.experimental.process.not.validat"):'',
    c.product_state&&UILanguage.error(c.product_state)].filter(Boolean).join(' · ');
  }else if(candidates.length){
   const pairs=new Set(candidates.map(c=>c.site_pair_id)).size,defs=new Set(candidates.map(c=>c.definition_id)).size;
   info.textContent=manual()&&selectedFamily()?UILanguage.text("choose.a.site.pair.or.product"):
    defs>1?UILanguage.text("multiple.compatible.reactions.detected.choose.a.reaction"):
    pairs>1?UILanguage.text("multiple.compatible.site.pairs.choose.the.sites"):
    UILanguage.text("detected.reaction")+ReactionLabels.name(candidates[0])+
     (candidates[0].retained_component!=null?UILanguage.text("choose.the.retained.fragment"):UILanguage.text("choose.the.product.connectivity"));
  }else if(quickResult){
   const motifs=quickResult.motifs.map(m=>m.length?m.map(ReactionLabels.motif).join(', '):UILanguage.text("no.supported.motifs"));
   info.textContent=quickResult.reason==='NO_UNARY_REACTION'?UILanguage.text("select.or.upload.a.second.reactant")+
    ' · '+UILanguage.text("current.molecule.2")+' ['+motifs[0]+']':UILanguage.text("no.compatible.reaction.detected")+' · '+
    (quickResult.reason==='NO_COMPLEMENTARY_MOTIFS'?UILanguage.text("motifs.are.not.complementary")+' · ':'')+
    UILanguage.text("current.molecule.2")+' ['+motifs[0]+'] / '+UILanguage.text("reagent.2")+' ['+motifs[1]+']';
  }else info.textContent='';
  highlightReaction();
 }
 function populateCandidates(preserve=false){
  const select=$('builderCandidate'),old=select.value;
  select.replaceChildren(new Option(UILanguage.text("choose.a.candidate"),''));
  for(const c of candidates)select.add(new Option(candidateLabel(c),c.candidate_id));
  select.value=candidates.length===1?candidates[0].candidate_id:preserve&&candidates.some(c=>c.candidate_id===old)?old:'';
  $('builderCandidateLabel').hidden=candidates.length<2;
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
   if(!family){
    if(reagentSource.hasSelection())secondary=reagentSource.graph();
    quickResult=MoleculeBuilder.quick(current(),secondary);
    candidates=quickResult.candidates;
   }
  }catch(e){UILanguage.errorInto($('builderStatus'),e);}
  populateCandidates();
 }
 function detect(){
  refreshReaction();
  const family=selectedFamily(),s=current();
  if(!family)return;
  secondary=family==='DisulfideReduction'?null:reagentSource.graph();
  const result=Reactions.v2.candidates(family,secondary?[s.graph,secondary]:[s.graph]);
  candidates=MoleculeBuilder.distinctProducts(result.candidates,s.graph,secondary);
  populateCandidates();
  if(!candidates.length){
   $('builderCandidateInfo').textContent=family==='CAP'
    ?UILanguage.text("no.compatible.cap.site.pair.a.supported.terminal.phospha")
    :result.reason;
  }
 }
 $('builderStart').onclick=()=>attempt(start);$('builderAdd').onclick=()=>attempt(openDraft);$('builderOperation').onchange=()=>attempt(updateOperation);$('builderSite').onchange=()=>attempt(updateOperation);
 $('builderManual').onclick=()=>{setManual(!manual());refreshReaction();};
 $('builderFamily').onchange=refreshReaction;
 $('builderDetect').onclick=()=>attempt(detect);
 for(const id of ['builderSequence','builderLinkage'])$(id).addEventListener('input',invalidate);
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
  }catch(e){if(token===uploadRevision)UILanguage.errorInto($('builderStatus'),e);}
 };
 function materialize(){
  const s=current();
  if(branchMode())return MoleculeBuilder.branch(s,{siteId:$('builderSite').value,sequence:$('builderSequence').value,linkage:$('builderLinkage').value});
  const c=selectedCandidate();
  if(!c)throw Error(UILanguage.text("select.reaction.sites"));
  return MoleculeBuilder.react(s,{family:c.family,secondary,candidateId:c.candidate_id});
 }
 $('builderPreview').onclick=()=>attempt(()=>{
  invalidate();preview=materialize();
  renderProduct();
  $('builderApply').disabled=false;
  UILanguage.write($('builderStatus'),()=>UILanguage.text("preview.ready.apply.commits.a.new.state"));
 });
 $('builderApply').onclick=()=>attempt(()=>{
  const next=preview;
  if(!next)return;
  states.push(next);active=null;invalidate();$('builderDraft').hidden=true;history();
  UILanguage.write($('builderStatus'),()=>UILanguage.text("new.state.saved.export.or.add.another.step"));
  if(next.operation.kind==='Click'){
   exportProduct.onclick=()=>attempt(()=>LocalViewers.exportChemDraw('click-product',record(next)));
   exportProduct.hidden=false;
  }
 });
 $('builderRestore').onclick=()=>$('builderStateFile').click();$('builderStateFile').onchange=async()=>{try{const f=$('builderStateFile').files[0];if(!f)return;const s=MoleculeBuilder.restore(await f.text());states=[s];active=null;invalidate();history();$('builderDraft').hidden=true;}catch(e){UILanguage.errorInto($('builderStatus'),e);}finally{$('builderStateFile').value='';}};
 $('basesPerColumn').addEventListener('change',()=>{history();if(preview)renderProduct();});
 $('run').addEventListener('click',()=>{if(UI.current?.input===$('input').value)attempt(start);});
 function renderProduct(){
  LocalViewers.mount('builderProduct',record(preview),{title:UILanguage.text("product.preview")});
 }
 function localize(){for(const [id,zh,eng]of [['builderTitle','分子构建 · 操作与状态','Molecule Builder · Operations & States'],['builderHelp','从序列开始，逐步进行反应或支链延长。应用后可导出该步骤的分子状态。','Sequence → Reaction / Branch Elongation → further steps. Apply saves a state; Export exports it.'],['builderStart','从输入序列建立新分子','Start new molecule from input sequence'],['builderRestore','导入分子状态','Import molecule state'],['builderAdd','+ 添加步骤','+ Add Step'],['operationLabel','操作类型','Operation type'],['branchSiteLabel','可用支链位点','Available branch site'],['branchSequenceLabel','支链序列（与主序列语法相同）','Branch Sequence (same syntax as main sequence)'],['childEndLabel','支链按 5′→3′ 输入，经 3′ 端连接','Enter child 5′→3′. Attaches at 3′.'],['familyLabel','反应类型','Reaction family'],['builderReagentLabel','选择第二反应物（MOL / SDF）','Choose Secondary Reagent (MOL / SDF)'],['builderDetect','检测兼容位点','Detect compatible sites'],['builderPreview','预览产物','Preview Product'],['builderChoice','兼容候选','Compatible options'],['builderApply', '应用修饰', 'Apply Modification']])$(id).textContent=txt(zh,eng);
  $('builderOperation').options[0].textContent=UILanguage.text("post.functionalization");$('builderOperation').options[1].textContent=UILanguage.text("branch.elongation");const names=en()?['Auto-detect','CAP','Amine Coupling','Click Reaction','IEDDA / Tetrazine Ligation','Disulfide Reduction','Thiol–Maleimide','Thiol–Oxadiazole']:['自动检测','CAP','胺偶联','点击反应','IEDDA / 四嗪偶联','二硫键还原','巯基–马来酰亚胺','巯基–噁二唑'];Array.from($('builderFamily').options).forEach((o,i)=>o.textContent=names[i]);setManual(manual());history();
  if(!$('builderDraft').hidden&&branchMode()){renderBranchSites();renderBranchStarting();}
  if(preview)renderProduct();
  if(!$('builderDraft').hidden&&!branchMode()){
   const canApply=!$('builderApply').disabled;
   reagentSource.refresh(true,selectedFamily()!=='DisulfideReduction');
   populateCandidates(true);
   $('builderApply').disabled=!canApply;
  }
 }
 const localizeExport=()=>{exportProduct.textContent=UILanguage.text("export.final.product.cdxml");};
 $('language').addEventListener('change',localize);$('language').addEventListener('change',localizeExport);localize();localizeExport();
 SmallFragmentDepictor.ready.then(()=>{
  if(preview||$('builderDraft').hidden||branchMode())return;
  if(!selectedFamily()&&!candidates.length&&reagentSource.hasSelection())refreshReaction();
  else if(candidates.length>1){
   candidates=distinctProducts(candidates);populateCandidates(true);
  }
 });
 return {get states(){return states.slice();},get preview(){return preview;},record,start};
})();
