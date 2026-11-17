async raw=>{
 const $=id=>document.getElementById(id);
 const click=id=>$(id).click();
 const tests=[];
 const assert=(condition,message)=>{if(!condition)throw Error(message);};
 async function test(name,fn){
  try{await fn();tests.push({name,status:'PASS'});}
  catch(error){tests.push({name,status:'FAIL',error:error.stack});}
 }
 async function until(fn){
  for(let i=0;i<100;i++){if(fn())return;await new Promise(resolve=>setTimeout(resolve,20));}
  throw Error('Timed out');
 }
 const packets=[];
 const create=URL.createObjectURL;
 URL.createObjectURL=function(blob){
  if(blob.type==='application/octet-stream')packets.push(blob.text().then(JSON.parse));
  return create.call(this,blob);
 };
 const pick=files=>{
  const data=new DataTransfer();
  for(const [name,contents] of files)data.items.add(new File([JSON.stringify(contents)],name));
  $('chemistryTransferFiles').files=data.files;
  $('chemistryTransferFiles').dispatchEvent(new Event('change'));
 };
 const lang=value=>{$('language').value=value;$('language').dispatchEvent(new Event('change',{bubbles:true}));};
 const row=symbol=>[...$('library').querySelectorAll('.chemistry-entry')].find(r=>r.dataset.symbol===symbol);
 const choose=symbol=>row(symbol).querySelector('button').click();
 const button=(host,label)=>[...host.querySelectorAll('button')].find(b=>b.textContent===label);
 const current=()=>Product.store.state.records;
 const inspector=()=>$('compoundInspector').innerText;
 const original=JSON.parse(raw);
 const save=()=>click('saveCustom');
 const graphAndSites=(r,graph,sites)=>{
  const circles=[...$('libraryStructure').querySelectorAll('[data-site-atom]')];
  const record=LocalViewers.instances.get($('libraryStructure')).record;
  const plotted=LocalViewers.chemicalDrawing(record);
  assert(circles.length===Object.keys(sites).length,'Number of plotted sites');
  for(const [key,site] of Object.entries(sites)){
   const circle=circles.find(c=>Number(c.dataset.siteAtom)===site.atom);
   const atom=plotted.atoms[site.atom];
   assert(circle&&Number(circle.getAttribute('cx'))===atom.x&&Number(circle.getAttribute('cy'))===atom.y,'Atom mapping for '+key);
   assert(record.graph.atoms[site.atom].e===graph.atoms[site.atom].e,'Atom type for '+key);
  }
  const grid=$('compoundInspector').querySelector('.chemistry-properties').textContent;
  const p=Lite.graphProperties(graph);
  for(const v of [p.formula,p.average_mw.toFixed(4),p.exact_mass.toFixed(4)])assert(grid.includes(v),'Inspector property '+v);
 };
 await test('01 file:// Start.html and automatic legacy restoration',()=>{
  assert(location.protocol==='file:','file protocol');
  document.querySelector('[data-page=custom]').click();
  lang('en');
  assert(!$('customWorkspace').hidden,'custom workspace');
  assert(current().length===3,'restored count');
  assert(localStorage.getItem(ChemistryLibrary.KEY)===raw,'original bytes');
  assert(row('CLterminal')&&row('CLlinear')&&row('CLbranch'),'legacy rows');
 });
 await test('02 Built-in inspector, real structure and read-only actions',()=>{
  click('libraryTab-builtin');
  const item=Product.store.builtinCatalog().find(r=>r.symbol==='rA'&&r.templateKey)||
   Product.store.builtinCatalog().find(r=>r.templateKey&&r.symbol!=='A');
  window.cl2Builtin=item.symbol;
  choose(item.symbol);
  const g=REFERENCE.templates[item.templateKey];
  graphAndSites(item,g,g.attachments);
  assert(inspector().includes('Optical properties'),'Optical field');
  assert(!$('editChemistryEntry')&&!$('deleteChemistryEntry')&&!$('newCustomChemistry'),'read only');
  assert(!$('libraryTab-team'),'Former team scope absent');
  const stage=$('libraryStructure').getBoundingClientRect(), list=$('library').getBoundingClientRect();
  assert(stage.left>list.right&&stage.top<list.bottom&&scrollY===0,'Side-by-side with no page scrolling');
 });
 await test('03 My Custom inspector, attachment atom alignment and optical value',()=>{
  click('libraryTab-custom');choose('CLbranch');
  const r=current().find(r=>r.symbol==='CLbranch');
  graphAndSites(r,r.runtime,r.block.sites);
  const field=$('compoundInspector').querySelector('.chemistry-properties').textContent;
  assert(field.includes('Optical properties')&&inspector().includes('Branch 1'),'Branch and optical fields');
  const value=r.runtime.optical?.epsilon??r.runtime.extinction?.contribution;
  if(value!=null)assert(field.includes(value.toLocaleString('en-US')),'Known optical value');
  assert($('library').innerText.includes('CLbranch')&&!$('library').innerText.includes('Exact mass'),'Compact list');
 });
 await test('04 Search and scope switch reset stale selection and editor',()=>{
  $('librarySearch').value='CLterminal';$('librarySearch').dispatchEvent(new Event('input'));
  assert(row('CLterminal')&&!row('CLbranch'),'Search filter');
  choose('CLterminal');click('editChemistryEntry');
  assert(!$('chemistryEditor').hidden&&$('chemistryEditor').innerText.includes('CLterminal'),'Inline editor');
  click('libraryTab-builtin');
  assert($('chemistryEditor').hidden&&!inspector().includes('CLterminal'),'Scope reset');
  click('libraryTab-custom');
  assert($('librarySearch').value===''&&row('CLbranch'),'Scope search reset');
 });
 let edited;
 await test('05 Edit save returns to inspector and preserves legacy graph, sites and optics',()=>{
  choose('CLbranch');click('editChemistryEntry');
  assert(!chemistryEditor.hidden,'Editor open: '+libraryNotice.innerText); const before=current().find(r=>r.symbol==='CLbranch');
  $('customDisplayName').value='Legacy branched linker';
  save();
  assert($('chemistryEditor').hidden&&inspector().includes('Legacy branched linker'),'Saved to inspector: '+$('customStatus').innerText);
  edited=current().find(r=>r.id===before.id);
  assert(JSON.stringify(edited.runtime)===JSON.stringify(before.runtime),'Full runtime unchanged');
  assert(JSON.stringify(edited.block)===JSON.stringify(before.block),'Graph, coordinates and site IDs unchanged');
  assert(Lite.getBuildingBlock('{CLbranch}').attachments.user_branch,'Legacy branch usable');
 });
 await test('06 Dirty switch preserves drafts on Cancel and supports Discard and Save',()=>{
  click('editChemistryEntry');$('customDisplayName').value='Discard me';
  click('libraryTab-builtin');
  const guard=$('chemistryEditGuard');
  assert(guard.open,'Dirty scope guard');
  button(guard,'Cancel').click();
  assert(!$('chemistryEditor').hidden&&$('customDisplayName').value==='Discard me','Draft retained');
  choose('CLterminal');assert(guard.open,'Dirty entry guard');
  button(guard,'Discard').click();
  assert($('chemistryEditor').hidden&&inspector().includes('CLterminal'),'Discard and navigate');
  click('editChemistryEntry');$('customDisplayName').value='Edited terminal';
  click('libraryTab-builtin');button(guard,'Save').click();
  assert($('chemistryEditor').hidden&&current().find(r=>r.symbol==='CLterminal').name==='Edited terminal','Save and navigate');
 });
 let single,pack;
 await test('07 Export single, selected and all via UI with intact records',async()=>{
  click('libraryTab-custom');
  choose('CLterminal');click('exportChemistryEntry');single=await packets.at(-1);
  assert(single.kind==='entry'&&single.records[0].name==='Edited terminal','Single entry');
  assert(!$('exportSelectedChemistry'),'Selection export hidden initially');
  row('CLlinear').querySelector('input').click();
  row('CLbranch').querySelector('input').click();
  assert(inspector().includes('Edited terminal'),'Checkbox does not navigate');
  click('exportSelectedChemistry');
  const selection=await packets.at(-1);
  assert(selection.records.length===2,'Two selected entries');
  click('exportChemistryLibrary');pack=await packets.at(-1);
  assert(pack.records.length===3&&JSON.stringify(pack.records)===JSON.stringify(current()),'Complete package');
 });
 await test('08 New uses same editor, Cancel returns, Save creates usable entry',()=>{
  click('newCustomChemistry');
  assert(!$('chemistryEditor').hidden&&$('customInput').value==='','Empty editor');
  click('cancelChemistryEdit');assert($('chemistryEditor').hidden,'Cancel clean editor');
  click('newCustomChemistry');
  $('customInput').value=Lite.mol(Lite.parseSmiles('OCCCCCl'.replace('Cl','S')).graph);
  click('importCustom');$('fiveOH').value='0';$('customName').value='CLnew';
  save();
  assert($('chemistryEditor').hidden&&row('CLnew')&&inspector().includes('CLnew'),'New inspector: '+$('customStatus').innerText);
  assert(MoleculeBuilder.start('rA[CLnew]').graph.atoms.length>10,'New entry in Builder');
 });
 await test('09 My Custom deletion asks permission and unregisters immediately',()=>{
  const native=window.confirm;
  try{
   window.confirm=()=>false;click('deleteChemistryEntry');assert(row('CLnew'),'Cancel deletion');
   window.confirm=()=>true;click('deleteChemistryEntry');assert(!row('CLnew')&&!Lite.getBuildingBlock('{CLnew}'),'Delete and unregister');
  }finally{window.confirm=native;}
 });
 await test('10 Strict multi-file Merge from Built-in into My Custom',async()=>{
  const renamed=structuredClone(single),r=renamed.records[0];
  r.name=r.symbol='CLconflict';r.runtime.id=r.block.id='{CLconflict}';
  const definition=structuredClone(single), other=definition.records[0];
  other.runtime.optical={mode:'explicit',epsilon:777,source:'Regression fixture'};
  other.block.optical=structuredClone(other.runtime.optical);
  const collision=ChemistryLibrary.normalize('CLterminal',Lite.selectAttachments(Lite.parseSmiles('OCCCCF'),0,null));
  const fresh=ChemistryLibrary.normalize('CLimport',Lite.selectAttachments(Lite.parseSmiles('OCCCCC#N'),0,null));
  click('libraryTab-builtin');
  const before=localStorage.getItem(ChemistryLibrary.KEY);
  pick([['all.olib',pack],['rename.oligoentry',renamed],['definition.oligoentry',definition],
   ['collision.oligoentry',ChemistryLibrary.transfer([collision],'entry')],['new.oligoentry',ChemistryLibrary.transfer([fresh],'entry')]]);
  const preview=$('libraryMergePreview');
  await until(()=>preview.open&&preview.textContent.includes('Naming Conflict'));
  for(const label of ['Exact Duplicate','Naming Conflict','Definition Conflict','Chemical Conflict','New'])assert(preview.textContent.includes(label),label);
  assert($('applyChemistryMerge').disabled&&localStorage.getItem(ChemistryLibrary.KEY)===before,'Strict preview');
  button(preview,'View incoming structure').click();assert($('chemistryComparison').open,'Compare incoming structure');button($('chemistryComparison'),'Close').click();
  let resolution;
  while((resolution=[...preview.querySelectorAll('select')].find(s=>s.value!=='keep'))){resolution.value='keep';resolution.dispatchEvent(new Event('change'));}
  assert(!$('applyChemistryMerge').disabled,'Review resolved');
  click('applyChemistryMerge');
  assert(!preview.open&&row('CLimport')&&!Product.store.state.team,'Joined My Custom');
 });
 await test('11 Bilingual browser, inspector and editor',()=>{
  lang('zh-CN');assert($('libraryTab-custom').textContent==='我的自定义','Chinese tab');
  choose('CLbranch');assert(inspector().includes('分子式')&&inspector().includes('连接位点'),'Chinese inspector');
  click('editChemistryEntry');assert($('saveCustom').textContent==='保存','Chinese editor');click('cancelChemistryEdit');
  lang('en');assert($('libraryTab-custom').textContent==='My Custom'&&inspector().includes('Average MW'),'English');
 });
 await test('12 CL1 team records unify without changing entries and future schema is rejected',async()=>{
  const legacy=structuredClone(original);
  legacy.team={records:[legacy.records.pop()],metadata:{name:'Former library',version:'1'}};
  const stored=JSON.stringify(legacy), storage={getItem:()=>stored,setItem:()=>{throw Error('Read unexpectedly wrote');}};
  const temp=ChemistryLibrary.create(storage);
  try{
   temp.load();assert(temp.state.records.length===3&&!temp.state.team,'Single scope');
   assert(JSON.stringify(temp.state.records)===JSON.stringify(original.records),'Legacy structures and metadata');
   assert(temp.state.metadata.version==='1','Library version retained');
  }finally{Product.store.load();}
  const before=localStorage.getItem(ChemistryLibrary.KEY);
  pick([['future.olib',{...pack,schemaVersion:99}]]);
  await until(()=>$('libraryNotice').textContent.includes('unsupported'));
  assert(localStorage.getItem(ChemistryLibrary.KEY)===before,'Future schema preserves bytes');
 });
 await test('13 Editing a directional site preserves the graph and untouched stable branch ID',()=>{
  click('libraryTab-custom');choose('CLbranch');
  const before=current().find(r=>r.symbol==='CLbranch');
  click('editChemistryEntry');
  assert($('branchSelectors').querySelector('select').value==='3','Legacy branch preselected');
  $('threeOH').value='';$('threeOH').dispatchEvent(new Event('change'));save();
  const after=current().find(r=>r.id===before.id);
  assert($('chemistryEditor').hidden&&!after.block.sites.downstream,'Removed selected directional site: '+$('customStatus').innerText);
  assert(JSON.stringify(before.block.graph)===JSON.stringify(after.block.graph),'Coordinate snapshot retained');
  assert(JSON.stringify(before.block.sites.user_branch)===JSON.stringify(after.block.sites.user_branch),'Untouched custom branch ID retained');
  click('editChemistryEntry');
  $('threeOH').value=String(before.block.sites.downstream.atom);
  $('threeOH').dispatchEvent(new Event('change'));save();
  assert(current().find(r=>r.id===before.id).block.sites.downstream.atom===before.block.sites.downstream.atom,'Restored 3′ selection');
 });
 window.cl2Screenshot=mode=>{
  Workspaces.show('custom');
  lang(mode==='builtin'?'en':'zh-CN');
  click(mode==='builtin'?'libraryTab-builtin':'libraryTab-custom');
  choose(mode==='builtin'?window.cl2Builtin:'CLbranch');
  if(mode==='editor')click('editChemistryEntry');
  $('libraryNotice').textContent='';
  scrollTo(0,0);
 };
 return {tests,protocol:location.protocol};
}



