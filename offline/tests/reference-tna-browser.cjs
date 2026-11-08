'use strict';
const assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');

(async()=>{
 const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1366,height:900},acceptDownloads:true});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(pathToFileURL(path.join(__dirname,'../Start.html')).href);
  await page.waitForSelector('#adaptiveGrid');
  await page.selectOption('#language','en');
  assert.deepEqual((await page.locator('nav [data-page]').allTextContents()).map(s=>s.trim().split(/\s+/)[0]),['01','02','03','04']);
  await page.click('[data-page=reference]');
  const table=page.locator('#referenceWorkspace table');
  assert.deepEqual(await table.locator('th').allTextContents(),['Symbol','Name / Meaning','Type']);
  assert.equal(await table.locator('tbody tr').count(),await page.evaluate(()=>ChemistryLibrary.referenceRows().length));
  assert.match(await table.locator('tr').filter({hasText:'MsPA'}).innerText(),/#.*MsPA.*Backbone linkage/s);
  assert.match(await table.locator('tr').filter({has:page.locator('code',{hasText:/^SMCC$/})}).innerText(),/Post-modification reagent/);
  assert.match(await table.locator('tr').filter({has:page.locator('code',{hasText:/^\[absic\]$/})}).innerText(),/dSpacer/);
  assert.equal(await page.locator('#referenceWorkspace details,#referenceWorkspace button').count(),0);
  if(process.env.OLIGO_QA_DIR)await page.screenshot({path:path.join(process.env.OLIGO_QA_DIR,'reference.png')});
  await page.click('[data-page=sequence]');
  await page.fill('#input','VpmUfUmU*eU+UcEt-AFANA-UnUUNA-UUhdAda#rAAtArAtAAeArAcEt-A');
  await page.click('#run');
  const viewer=page.locator('#viewer');
  await viewer.locator('[data-component=base]').first().waitFor();
  assert.equal(await viewer.locator('[data-component=base]').count(),20);
  if(process.env.OLIGO_QA_DIR)await viewer.screenshot({path:path.join(process.env.OLIGO_QA_DIR,'annotated.png')});
  await viewer.locator('.schematic-density').selectOption('compact');
  const svg=viewer.locator('svg');
  assert.equal(await svg.getAttribute('data-density'),'compact');
  if(process.env.OLIGO_QA_DIR)await viewer.screenshot({path:path.join(process.env.OLIGO_QA_DIR,'compact.png')});
  const initial=await svg.getAttribute('viewBox');
  await viewer.getByRole('button',{name:'+',exact:true}).click();
  assert.notEqual(await svg.getAttribute('viewBox'),initial);
  await viewer.getByRole('button',{name:'Fit',exact:true}).click();
  assert.equal(await svg.getAttribute('viewBox'),initial);
  await viewer.getByRole('button',{name:'Fullscreen',exact:true}).click();
  await page.waitForFunction(()=>document.fullscreenElement?.id==='viewer');
  await page.evaluate(()=>document.exitFullscreen());
  for(const mode of ['detailed','chemical','schematic']){
   await viewer.locator('.viewer-mode').selectOption(mode);
   assert.equal(await viewer.getAttribute('data-presentation'),mode);
  }
  await page.fill('#input','rA*[absic]#UgntA');
  await page.click('#run');
  assert.equal(await viewer.locator('[data-linkage-edge]').count(),3);
  assert.equal(await viewer.locator('[data-base]').count(),3);
  const exported=()=>page.evaluate(()=>[Lite.mol(UI.current.graph),Lite.cdxml(UI.current.graph),JSON.stringify(UI.current.graph)]);
  const before=await exported();
  for(const mode of ['detailed','chemical']){
   await viewer.locator('.viewer-mode').selectOption(mode);
   assert.equal(await viewer.getAttribute('data-presentation'),mode);
   assert.equal(await viewer.locator('svg').count(),1);
   assert.equal(await viewer.locator('[data-linkage-edge]').count(),0);
   assert.deepEqual(await exported(),before);
  }
  await page.locator('#workspaceSettings summary').click();
  await page.selectOption('#workspaceMode','chemical');
  await page.keyboard.press('Escape');
  await page.click('#run');
  await page.waitForFunction(()=>document.getElementById('viewer').dataset.presentation==='chemical');
  await page.click('#builderAdd');
  assert(await page.evaluate(()=>MoleculeBuilderUI.states.length>0));
  await page.click('[data-page=batch]');
  await page.setInputFiles('#batchfile',{name:'tna.csv',mimeType:'text/csv',buffer:Buffer.from('ID,Sequence\nD,AtAA\nR,rAtArA\n')});
  await page.waitForFunction(()=>document.getElementById('batchseq').options.length>1);
  await page.click('#batchpreview');
  await page.waitForFunction(()=>document.getElementById('batchstatus').textContent.includes('Valid 2'));
  await page.click('#batchstructures');
  await page.waitForFunction(()=>!document.getElementById('batchzip').disabled);
  const [zip]=await Promise.all([page.waitForEvent('download'),page.click('#batchzip')]);
  assert.match(zip.suggestedFilename(),/\.zip$/);
  assert.deepEqual(errors,[]);
  console.log('04, 20-unit Compact, viewer controls, Molecule Builder, and mixed TNA Batch ZIP passed');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});


