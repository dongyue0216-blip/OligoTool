const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');

(async()=>{
 const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true});
 try {
  const page=await browser.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(pathToFileURL(path.join(__dirname,'../Start.html')).href);
  await page.waitForSelector('#adaptiveGrid');
  const legacy=JSON.parse(fs.readFileSync(path.join(__dirname,'BASELINE_USER_LIBRARY_V200_SINGLE.json'),'utf8'));
  await page.evaluate(legacy=>localStorage.setItem(ChemistryLibrary.KEY,JSON.stringify(legacy)),legacy);
  await page.reload();
  assert.deepEqual(await page.evaluate(()=>Product.store.state),legacy);
  const isolation=await page.evaluate(()=>{
   const reagents=Product.store.unified().filter(r=>r.id.startsWith('builtin:linker1:'));
   return reagents.map(r=>[r.name,r.metadata.roles[0],Lite.builtinAudit().some(b=>b.names.includes(r.name)),
    Object.hasOwn(REFERENCE.templates,r.name),r.sequence_assembly]);
  });
  assert.equal(isolation.length,8);
  for(const [name,...flags] of isolation)assert.deepEqual(flags,['ReactionReagent',false,false,false],name);

  await page.click('[data-page=custom]');
  await page.locator('#builtinChemistryCatalog summary').click();
  await page.locator('#builtinReactionReagentCatalog summary').click();
  assert.equal(await page.locator('#builtinChemistryCatalog strong').filter({hasText:/^SMCC$/}).count(),0);
  assert.equal(await page.locator('#builtinReactionReagentCatalog strong').filter({hasText:/^SMCC$/}).count(),1);
  await page.fill('#customInput',await page.evaluate(()=>Lite.mol(Lite.parseSmiles('OCCCN').graph)));
  await page.click('#importCustom');
  await page.fill('#customName','SMCC');
  await page.selectOption('#fiveOH','0');
  await page.click('#saveCustom');
  assert.match(await page.locator('#customStatus').innerText(),/Saved locally/);
  await page.reload();
  assert.deepEqual(await page.evaluate(()=>Product.store.state.records[0]),legacy.records[0]);
  const ids=await page.evaluate(()=>Product.store.unified().filter(r=>r.symbol==='SMCC').map(r=>r.id));
  assert.equal(new Set(ids).size,2);
  await page.click('[data-page=sequence]');
  await page.selectOption('#kind','sequence');
  await page.fill('#input','[SMCC]rA');
  await page.click('#run');
  assert(await page.locator('#viewer svg').count());

  const expected=['BCN','cOct','DBCO','MC','MCVCPABC','SMCC','SPDP','TCO'];
  const select='#builderReagentLibraryEntry';
  const options=()=>page.locator(select+' option').allTextContents();
  const open=async(sequence,family)=>{
   await page.fill('#input',sequence);
   await page.click('#run');
   await page.click('#builderAdd');
   await page.click('#builderManual');
   await page.selectOption('#builderFamily',family);
   await page.selectOption('#builderReagentSource','builtin');
  };
  await open('[C6N]rA','Condensation');
  assert.deepEqual((await options()).filter(n=>expected.includes(n)),expected);
  await page.selectOption(select,'builtin:linker1:smcc');
  await page.click('#builderDetect');
  assert(await page.locator('#builderCandidate option').count()>1);
  await page.selectOption('#builderReagentSource','upload');
  const mol=await page.evaluate(()=>Lite.mol(REACTION_REAGENTS['builtin:linker1:smcc'].graph));
  for(const extension of ['mol','sdf']){
   await page.setInputFiles('#builderReagentFile',{name:'SMCC.'+extension,mimeType:'text/plain',
    buffer:Buffer.from(mol+(extension==='sdf'?'\n$$$$\n':''))});
   await page.waitForFunction(()=>document.querySelector('#builderReagent').value.length>0);
   await page.click('#builderDetect');
   assert(await page.locator('#builderCandidate option').count()>1);
   await page.fill('#builderReagent','');
  }
  await open('[C6N]rA','Condensation');
  const thiol=await page.evaluate(()=>Lite.parseSmiles('CCS').graph);
  const azide=await page.evaluate(()=>REACTION_REAGENTS.azide.graph);
  const check=async(family,graph,names)=>assert.deepEqual(await page.evaluate(({family,graph})=>Product.store.reagents('builtin',family,graph)
   .filter(r=>r.id.startsWith('builtin:linker1:')).map(r=>r.name),{family,graph}),names);
  await check('ThiolMaleimide',thiol,['MC','MCVCPABC','SMCC']);
  await check('Click',azide,['BCN','cOct','DBCO']);
  await page.selectOption('#builderReagentSource','user');
  assert.equal(await page.locator('#builderReagentSource').inputValue(),'user');
  const fixture=name=>fs.readFileSync(path.join(__dirname,'fixtures','iedda-'+name+'.mol'),'utf8');
  const startMol=async text=>{
   await page.selectOption('#kind','mol');
   await page.fill('#input',text);
   await page.click('#run');
   await page.click('#builderAdd');
   await page.click('#builderManual');
   await page.selectOption('#builderFamily','IEDDA');
  };
  await startMol(fixture('tetrazine'));
  await page.selectOption('#builderReagentSource','builtin');
  assert((await options()).includes('TCO'));
  assert(!(await options()).includes('cOct'));
  await page.selectOption(select,'builtin:linker1:tco');
  const preview=async()=>{
   await page.click('#builderDetect');
   assert.equal(await page.locator('#builderCandidate option').count(),2);
   await page.click('#builderPreview');
   const product=page.locator('#builderProduct');
   await product.locator('[data-reaction-product=tetrazine_ligation]').waitFor();
   for(const mode of ['schematic','detailed','chemical']){
    await product.locator('.viewer-mode').selectOption(mode);
    assert.equal(await product.getAttribute('data-presentation'),mode);
    assert.equal(await product.locator('.structure-canvas svg').count(),1);
    assert.equal(await product.locator('[data-reaction-ring=tetrazine_ligation]').count(),mode==='chemical'?0:1);
    assert.match(await product.locator('.local-metrics').innerText(),/MW.*Exact/);
   }
  };
  await preview();
  await page.click('#builderApply');
  const last=page.locator('#builderHistory details').last();
  assert.match(await last.locator('summary').innerText(),/IEDDA/);
  await page.evaluate(()=>{
   const create=URL.createObjectURL;
   URL.createObjectURL=function(blob){window.testExport=blob;return create.call(this,blob);};
   const click=HTMLAnchorElement.prototype.click;
   HTMLAnchorElement.prototype.click=function(){if(!this.download)click.call(this);};
  });
  const checkpoint=await page.evaluate(()=>JSON.parse(MoleculeBuilder.exportJSON(MoleculeBuilderUI.states.at(-1))));
  assert.equal(checkpoint.operation.graphEdits.removedAtoms.length,2);
  for(const name of ['JSON','SVG','MOL','SDF','CDXML'])
   assert.equal(await last.getByRole('button',{name,exact:true}).count(),0);
  await last.getByRole('button',{name:'Export ChemDraw (.cdxml)',exact:true}).click();
  const cdxml=await page.evaluate(()=>window.testExport.text());
  assert.equal([...cdxml.matchAll(/<b id=/g)].length,checkpoint.graph.bonds.length);
  await last.getByRole('button',{name:'Export Schematic (.svg)',exact:true}).click();
  assert.match(await page.evaluate(()=>window.testExport.text()),/data-reaction-ring="tetrazine_ligation"/);


  await startMol(fixture('tetrazine'));
  await page.selectOption('#builderReagentSource','upload');
  await page.setInputFiles('#builderReagentFile',{name:'norbornene.sdf',mimeType:'text/plain',
   buffer:Buffer.from(fixture('norbornene')+'\n$$$$\n')});
  await page.waitForFunction(()=>document.querySelector('#builderReagent').value.includes('V2000'));
  await preview();

  const tetIndex=await page.evaluate(text=>{
   const parsed=Lite.parseMol(text,{manualMarkers:true});
   return parsed.graph.atoms.findIndex(a=>a.e==='O'&&a.h===1);
  },fixture('tetrazine'));
  await page.click('[data-page=custom]');
  await page.fill('#customInput',fixture('tetrazine'));
  await page.click('#importCustom');
  await page.fill('#customName','TetProbe');
  await page.selectOption('#fiveOH',String(tetIndex));
  await page.click('#saveCustom');
  assert.match(await page.locator('#customStatus').innerText(),/Saved locally/);
  await page.click('[data-page=sequence]');
  await startMol(await page.evaluate(()=>Lite.mol(REACTION_REAGENTS['builtin:linker1:tco'].graph)));
  await page.selectOption('#builderReagentSource','user');
  await page.selectOption(select,{label:'TetProbe'});
  await preview();
  const azideMol=await page.evaluate(()=>Lite.mol(REACTION_REAGENTS.azide.graph));
  for(const id of ['coct','bcn','dbco']){
   await startMol(azideMol);
   await page.selectOption('#builderFamily','Click');
   await page.selectOption('#builderReagentSource','builtin');
   await page.selectOption(select,'builtin:linker1:'+id);
   await page.click('#builderDetect');
   assert.equal(await page.locator('#builderCandidate option').count(),3);
   await page.locator('#builderCandidate').selectOption({index:1});
   await page.click('#builderPreview');
   const product=page.locator('#builderProduct');
   await product.locator('[data-reaction-product=triazole]').waitFor();
   await product.locator('[data-reaction-ring=triazole]').waitFor();
   await product.locator('.viewer-mode').selectOption('detailed');
   assert.equal(await product.locator('[data-product-atom]').count(),5);
   await product.locator('.viewer-mode').selectOption('chemical');
   assert.equal(await product.locator('[data-reaction-ring]').count(),0);
  }
  assert.equal(await page.locator('[data-page=hybridization]').count(),0);
  assert.deepEqual(errors,[]);
  console.log('PASS: catalog isolation, same-name Custom Chemistry save/reload, v2.00 restore, sequence assembly, built-in selector, family filters, MOL/SDF upload, IEDDA sources and three presentation modes');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

