'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');

(async()=>{
 const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1366,height:900}});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(pathToFileURL(path.join(__dirname,'../Start.html')).href);
  await page.selectOption('#language','en');
  const select='#builderReagentLibraryEntry',candidate=page.locator('#builderCandidate');
  const info=page.locator('#builderCandidateInfo'),apply=page.locator('#builderApply'),preview=page.locator('#builderPreview');
  const builtin=id=>page.selectOption(select,'builtin:linker1:'+id);
  const open=async(input,kind='sequence')=>{
   await page.selectOption('#kind',kind);
   await page.fill('#input',input);
   await page.click('#run');
   await page.click('#builderAdd');
   assert.equal(await page.locator('#builderFamily').isVisible(),false);
   assert.equal(await page.locator('#builderDetect').isVisible(),false);
   assert.equal(await apply.isEnabled(),false);
  };
  const upload=async(text,name='unknown.sdf')=>{
   await page.selectOption('#builderReagentSource','upload');
   await page.setInputFiles('#builderReagentFile',{name,mimeType:'text/plain',buffer:Buffer.from(text)});
   await page.waitForFunction(()=>document.querySelector('#builderReagent').value.length>0);
  };
  const mol=smiles=>page.evaluate(smiles=>Lite.mol(Lite.parseSmiles(smiles).graph),smiles);
  const expectOne=async name=>{
   assert.match(await info.innerText(),new RegExp('Detected reaction: '+name));
   assert.equal(await candidate.isVisible(),false);
   assert(await preview.isEnabled());
   assert(await apply.isEnabled());
  };
  const expectChoice=async(pattern,count)=>{
   assert.match(await info.innerText(),pattern);
   assert(await candidate.isVisible());
   assert.equal(await candidate.locator('option').count(),count+1);
   assert.equal(await candidate.inputValue(),'');
   assert.equal(await preview.isEnabled(),false);
   assert.equal(await apply.isEnabled(),false);
  };
  const fixture=name=>fs.readFileSync(path.join(__dirname,'fixtures','iedda-'+name+'.mol'),'utf8');

  await open('[C6N]rA');
  await builtin('smcc');
  await expectOne('Amine Coupling');
  await preview.click();
  assert.equal(await page.evaluate(()=>MoleculeBuilderUI.preview.operation.kind),'Condensation');
  await builtin('mc');
  await expectOne('Amine Coupling');
  assert.equal(await page.evaluate(()=>MoleculeBuilderUI.preview),null);
  await builtin('smcc');
  await apply.click();
  assert.equal(await page.evaluate(()=>MoleculeBuilderUI.states.at(-1).operation.kind),'Condensation');
  await page.click('#builderAdd');
  await upload(await mol('CCS'),'unknown-thiol.mol');
  await expectOne('Thiol–Maleimide');
  await apply.click();
  assert(await page.evaluate(()=>{
   const [,first,second]=MoleculeBuilderUI.states;
   return second.operation.kind==='ThiolMaleimide'&&second.parentStateId===first.id&&
    JSON.stringify(second.operation.graphEdits.before[0])===JSON.stringify(first.graph);
  }));

  await open('rArA');
  await builtin('smcc');
  assert.match(await info.innerText(),/No compatible reaction detected.*no supported motifs/,await page.locator('#builderStatus').innerText());
  assert.equal(await apply.isEnabled(),false);
  assert.equal(await preview.isEnabled(),false);
  await open(await mol('NCCS'),'mol');
  await builtin('smcc');
  await expectChoice(/Multiple compatible reactions/,2);
  assert.match(await candidate.locator('option').nth(2).innerText(),/Thiol|Amine/);
  await candidate.selectOption({index:1});
  assert(await preview.isEnabled());
  await open(await mol('NCCN'),'mol');
  await builtin('smcc');
  await expectChoice(/Multiple compatible site pairs/,2);
  const siteOptions=await candidate.locator('option').allTextContents();
  assert.notEqual(siteOptions[1],siteOptions[2]);

  await open('[C6N]rA');
  const renamed=await page.evaluate(()=>Lite.mol(REACTION_REAGENTS['builtin:linker1:smcc'].graph).replace(/^[^\r\n]*/,'Unrelated Name'));
  await upload(renamed+'\n$$$$\n','renamed.sdf');
  await expectOne('Amine Coupling');

  const azideOligo=await page.evaluate(()=>{
   const g=Lite.calculate('rArA').graph,azide=REACTION_REAGENTS.azide.graph,offset=g.atoms.length;
   const carbon=g.atoms.findIndex(a=>a.e==='C'&&a.h===2);
   g.atoms[carbon].h--;g.atoms.push(...azide.atoms.map((a,i)=>({...a,h:i===0?2:a.h})));
   g.bonds.push(...azide.bonds.map(b=>({...b,a:b.a+offset,b:b.b+offset})),{a:carbon,b:offset,o:1});
   return Lite.mol(g);
  });
  for(const id of ['dbco','bcn','coct']){
   await open(azideOligo,'mol');
   await builtin(id);
   await expectChoice(/Detected reaction: SPAAC.*connectivity/,2);
   await candidate.selectOption({index:1});
   await preview.click();
   assert.equal(await page.evaluate(()=>MoleculeBuilderUI.preview.operation.reactionDefinition.id),'spaac/2');
   await page.locator('#builderProduct [data-reaction-product=triazole]').waitFor();
  }
  for(const partner of ['tco','norbornene']){
   await open(fixture('tetrazine'),'mol');
   if(partner==='tco')await builtin(partner);
   else await upload(fixture(partner)+'\n$$$$\n');
   await expectOne('IEDDA');
   await preview.click();
   await page.locator('#builderProduct [data-reaction-product=tetrazine_ligation]').waitFor();
  }
  await page.evaluate(text=>{
   const parsed=Lite.parseMol(text,{manualMarkers:true});
   const oh=parsed.graph.atoms.findIndex(a=>a.e==='O'&&a.h===1);
   Product.store.add('UserProbe',Lite.selectAttachments(parsed,oh,null));
  },fixture('tetrazine'));
  await open(await page.evaluate(()=>Lite.mol(REACTION_REAGENTS['builtin:linker1:tco'].graph)),'mol');
  await page.selectOption('#builderReagentSource','user');
  await page.selectOption(select,{label:'UserProbe'});
  await expectOne('IEDDA');
  await open('[p]rA');
  await upload(await page.evaluate(()=>Lite.mol(REACTION_REAGENTS['cap-imidazolide'].graph)),'cap-unknown.mol');
  await expectChoice(/Multiple compatible site pairs/,2);
  await candidate.selectOption({index:1});
  assert.match(await info.innerText(),/Detected reaction: CAP.*experimental process not validated/);
  await preview.click();
  assert.equal(await page.evaluate(()=>MoleculeBuilderUI.preview.operation.kind),'CAP');

  await open(await mol('CCSSCCC'),'mol');
  await page.click('#builderManual');
  await page.selectOption('#builderFamily','DisulfideReduction');
  assert.equal(await page.locator('#builderReagentSource').isVisible(),false);
  await page.click('#builderDetect');
  assert(await candidate.isVisible());
  assert.equal(await apply.isEnabled(),false);
  await candidate.selectOption({index:1});
  await preview.click();
  await apply.click();
  assert.equal(await page.evaluate(()=>MoleculeBuilderUI.states.at(-1).operation.kind),'DisulfideReduction');
  assert.deepEqual(errors,[]);
  console.log('PASS Quick and Advanced: unique, zero, definition/site/connectivity choices, all requested binary families, upload and product chaining');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
