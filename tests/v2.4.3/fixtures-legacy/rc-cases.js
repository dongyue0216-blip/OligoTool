async fixtures=>{
 const $=id=>document.getElementById(id);
 const check=(value,message)=>{if(!value)throw Error(message);};
 const close=(actual,expected)=>Math.abs(actual-expected)<1e-8;
 const metrics=o=>[o.epsilon260,o.nmolPerOD260,o.ugPerOD260];
 const reference='rArCrGrU'.repeat(5), start=MoleculeBuilder.start;
 const record=MoleculeBuilder.record;
 const report={layout:[],batch:[],reactions:[],exports:{}};
 const change=(el,value)=>{el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));};
 check($('basesPerColumn').value==='5','Default UI rows');
 const geometry=(state,rows,key)=>{
  const before=JSON.stringify(state),r=record(state),presentation=Sandbox.C.present(r,false),d=presentation.drawing;
  const xml=LocalViewers.serializeStructure(r,'cdxml');
  const doc=new DOMParser().parseFromString(xml,'application/xml');
  check(!doc.querySelector('parsererror, graphic, curve, b[color], b[bgcolor], b[Visible], b[Z]'),'CDXML has no routing graphics or hidden bonds');
  const nodes=[...doc.querySelectorAll('n')],bonds=[...doc.querySelectorAll('b')];
  check(nodes.length===state.graph.atoms.length&&bonds.length===state.graph.bonds.length,'CDXML graph size');
  check(Sandbox.identity(d)===Sandbox.identity(state.graph)&&JSON.stringify(state)===before,'Graph/state identity');
  const plain=new DOMParser().parseFromString(Lite.cdxml(state.graph),'application/xml');
  const chemistry=x=>[...x.querySelectorAll('n,b')].map(e=>[e.tagName,...['id','Element','NumHydrogens','Charge','B','E','Order','Display'].map(k=>e.getAttribute(k))]);
  check(JSON.stringify(chemistry(doc))===JSON.stringify(chemistry(plain)),'CDXML chemistry invariance');
  if(key==='linear'){
   const count=Math.floor((state.assemblyGraph.lanes[0].assembly.nodes.length-1)/rows);
   check(d.routes.filter(r=>r.boundary).length===count,'Chemical SVG wrap count');
   const routes=d.routes.filter(route=>route.boundary);
   check(routes.every((route,i)=>route.boundary===(i+1)*rows),'Boundary indices');
   check(!presentation.quality.connector_collisions.some(([,bond])=>routes.some(route=>route.bond===bond)),'Connector intersects atoms');
   check(!presentation.quality.label_bond_overlaps.some(([,bond])=>routes.some(route=>route.bond===bond)),'Connector intersects labels');
   check(!presentation.quality.bond_crossings.some(hit=>hit.some(bond=>routes.some(route=>route.bond===bond))),'Connector crosses bond');
   const point=e=>e.getAttribute('p').split(' ').map(Number);
   for(const route of routes){
    const bond=d.bonds[route.bond], exported=bonds[route.bond];
    check(exported.getAttribute('B')===nodes[bond.a].id&&exported.getAttribute('E')===nodes[bond.b].id&&
     exported.getAttribute('Order')==='1','Real straight backbone endpoints');
   }
   check(routes.every(route=>close(point(nodes[d.bonds[route.bond].b])[1],point(nodes[d.bonds[routes[0].bond].b])[1])),'Parallel column tops');
   report.exports[key+'-'+rows+'-detailed.svg']=presentation.svg;
   const svg=LocalViewers.serializeStructure(r,'schematic.svg');
   const parsed=new DOMParser().parseFromString(svg,'image/svg+xml');
   check([...parsed.querySelectorAll('[data-assembly-edge]')].filter(p=>p.getAttribute('d').includes(' H ')).length===count,'Schematic wrap count');
   report.exports[key+'-'+rows+'.svg']=svg;
  }
  report.exports[key+'-'+rows+'.cdxml']=xml;
  report.layout.push([key,rows,nodes.length,bonds.length,state.formula,state.average_mw,state.exact_mass??r.metrics.exact_mass]);
 };
 for(const rows of [5,3,8,10]){
  change($('basesPerColumn'),String(rows));
  geometry(start(reference),rows,'linear');
 }
 change($('basesPerColumn'),'5');
 geometry(start('rArCrG'),5,'short');
 geometry(start(reference+'rArCrGrU'.repeat(3)),5,'long');
 geometry(start('[NAG37]'+reference),5,'linker');
 const branch=start('[GlycerolBranch]'+reference);
 geometry(MoleculeBuilder.branch(branch,{siteId:MoleculeBuilder.available(branch)[0].id,sequence:'rUrGrCrArUrC'}),5,'branch');
 const parent=start('[C6N]'+reference);
 const couple=(graph,base=parent)=>{
  const plan=Reactions.v2.candidates('Condensation',[base.graph,graph]).candidates[0];
  check(plan,'Missing amine candidate');
  return MoleculeBuilder.react(base,{family:'Condensation',secondary:graph,candidateId:plan.candidate_id});
 };
 const reagent=Lite.parseMol(fixtures['azido-nhs.mol']).graph;
 const product=couple(reagent);
 const epsilon=parent.optical.epsilon260;
 check(product.optical.estimated&&product.optical.assumptionLedger.some(x=>x.code==='POST_MODIFIER_ZERO'),'Fallback assumption absent');
 check(product.optical.epsilon260===epsilon&&close(product.optical.nmolPerOD260,1e6/epsilon)&&
  close(product.optical.ugPerOD260,1000*product.average_mw/epsilon)&&product.average_mw!==parent.average_mw,'Fallback numbers');
 check(JSON.stringify(metrics(MoleculeBuilder.restore(MoleculeBuilder.exportJSON(product)).optical))===JSON.stringify(metrics(product.optical)),'Checkpoint optical');
 geometry(product,5,'conjugate');
 const measured=couple({...reagent,optical:{mode:'explicit',epsilon:1234,source:'Synthetic test fixture'}});
 check(measured.optical.epsilon260===epsilon+1234,'Modifier contribution');
 report.reactions.push(['uploaded-payload',metrics(product.optical)],['synthetic-modifier-delta',metrics(measured.optical)]);
 for(const name of ['lipid-NHS','protected-dipeptide-NHS']){
  const final=couple(Lite.parseMol(fixtures[name+'.mol']).graph);
  check(final.optical.estimated&&final.optical.epsilon260===epsilon&&
   close(final.optical.ugPerOD260,1000*final.average_mw/epsilon),'Fallback '+name);
  report.reactions.push([name,metrics(final.optical)]);
 }

 const catalog=Product.store.reagents('builtin',null,null);
 const smcc=catalog.find(r=>r.id==='builtin:linker1:smcc');
 const thiol=Lite.selectAttachments(Lite.parseSmiles('OCCS'),0,null);
 Product.store.add('BatchThiol',thiol);
 Product.store.add('BatchDiol',Lite.selectAttachments(Lite.parseSmiles('OCCO'),0,3));
 const sequences=['rArCrGrU'.repeat(5),'dAdCdGdT','mA*fU','pApTpC','rA[BatchDiol]rC','[unknown]'];
 const ids=['ABC-001','abc-001','Bad/Name','CON','定制-001','Bad'];
 const wb=XLSX.utils.book_new();
 XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['序列编号','Compound ID','Sequence'],...sequences.map((s,i)=>[String(i).padStart(3,'0'),ids[i],s])]),'Sequences');
 const bytes=XLSX.write(wb,{type:'array',bookType:'xlsx'});
 document.querySelector('[data-page="batch"]').click();
 check(!$('sequenceBatchFile').closest('article').hidden&&$('batchfile').closest('article').hidden,'Batch split');
 change($('language'),'en');
 change($('sequenceBatchLayout'),'3');
 check(PresentationOptions.rows===3&&$('basesPerColumn').value==='3','Shared column control');
 const dt=new DataTransfer();dt.items.add(new File([bytes],'sequences.xlsx'));$('sequenceBatchFile').files=dt.files;
 $('sequenceBatchFile').dispatchEvent(new Event('change',{bubbles:true}));
 await $('sequenceBatchPreview').onclick();
 check(!$('sequenceBatchRun').disabled&&$('sequenceBatchFile').closest('article').innerText.includes('INVALID'),'Preview validation');
 await $('sequenceBatchRun').onclick();
 check(!$('sequenceBatchDownload').disabled,'Calculate results');
 const downloads=[];
 const click=HTMLAnchorElement.prototype.click;
 HTMLAnchorElement.prototype.click=function(){downloads.push(fetch(this.href).then(x=>x.arrayBuffer()));};
 try{$('sequenceBatchTemplate').click();$('sequenceBatchDownload').click();await $('sequenceBatchStructures').onclick();}finally{HTMLAnchorElement.prototype.click=click;}
 const template=XLSX.read(await downloads[0],{type:'array'});
 check(JSON.stringify(XLSX.utils.sheet_to_json(template.Sheets.Sequences,{header:1})[0])===JSON.stringify(['Sequence No.','Compound ID','Sequence']),'Three-field template');
 const output=XLSX.read(await downloads[1],{type:'array'});
 check(output.SheetNames.length===1&&XLSX.utils.sheet_to_json(output.Sheets.Results,{header:1})[0].length===10,'Clean result headers');
 const structures=await JSZip.loadAsync(await downloads[2]);
 check(Object.keys(structures.files).length===11,'ZIP file count');
 const filenames=['ABC-001','abc-001_2','Bad_Name','_CON','定制-001'];
 const map=XLSX.read(await structures.file('file-map.xlsx').async('uint8array'),{type:'array'});
 const mappings=XLSX.utils.sheet_to_json(map.Sheets.Files);
 const graphStates=new Map();
 await Batch.run(Batch.sequenceRows(wb),{sequenceOnly:true,onResult:(state,row)=>graphStates.set(row['Compound ID'],state)});

 const rows=XLSX.utils.sheet_to_json(output.Sheets.Results);
 for(const [i,sequence] of sequences.entries()){
  const row=rows[i];check(row['Sequence No.']===String(i).padStart(3,'0')&&row['Compound ID']===ids[i],'Row identity');
  if(i===5){check(row['Result/Message'].startsWith('Failed — ')&& !mappings[i].CDXML,'Invalid row accepted');continue;}
  const r=Sandbox.A.sequence(sequence),o=r.optical;
  const expected=[r.metrics.formula,r.metrics.average_mw,r.metrics.exact_mass,...metrics(o)];
  const actual=['Formula','Average MW','Exact Mass','ε₂₆₀ (L·mol⁻¹·cm⁻¹)','nmol/OD₂₆₀','µg/OD₂₆₀'].map(k=>row[k]);
  check(actual.every((n,j)=>n===expected[j]),'01 / 2.1 differ '+sequence);
  const state=graphStates.get(ids[i]);
  check(Sandbox.identity(state.graph)===Sandbox.identity(r.graph),'Batch graph parity');
  for(const [extension,format] of [['cdxml','cdxml'],['svg','schematic.svg']]){
   const file=filenames[i]+'.'+extension;
   check(mappings[i]['Compound ID']===ids[i]&&mappings[i][extension.toUpperCase()]===file,'File mapping');
   check(await structures.file(file).async('string')===LocalViewers.serializeStructure(r,format),'Export parity '+format+' '+sequence);
  }
  report.batch.push([sequence,'PASS']);
 }
 report.batch.push(['invalid','FAILED']);
 const uploads=await BatchWorkflow.upload([
  new File([fixtures['azido-nhs.mol']],'azido-nhs.mol'),
  new File([fixtures['azidothiol.mol']],'azidothiol.mol'),
  new File([fixtures['JQ1.mol']],'JQ1.mol')
 ]);
 check(uploads.registry.size===3,'Uploaded reagents');
 const postBytes=await BatchWorkflow.templateBytes(uploads.registry,'en',{stepCount:3});
 const postZip=await JSZip.loadAsync(postBytes);
 const sheetXml=await postZip.file('xl/worksheets/sheet1.xml').async('string');
 check(sheetXml.includes('sqref="C2:E1048576"')&&sheetXml.includes('<formula1>BatchSteps</formula1>'),'Excel dropdown validation');
 const postbook=XLSX.read(postBytes,{type:'array'});
 const lists=XLSX.utils.sheet_to_json(postbook.Sheets.Lists,{header:1});
 const label=(source,id)=>{
  const row=lists.find(([,value])=>value===JSON.stringify([source,id]));check(row,'Missing dropdown '+id);return row[0];
 };
 const uploaded=name=>{
  const reagent=[...uploads.registry.entries()].find(([key])=>key===name);
  return label('upload',reagent[1].stableId);
 };
 const built=id=>label('builtin',id);
 const working='rArCrG[C6N]';
 const user=Product.store.reagents('user',null,null).find(r=>r.name==='BatchThiol');
 const postRows=[
  ['payload',working,uploaded('azido-nhs.mol')],
  ['click',working,uploaded('azido-nhs.mol'),built('alkyne')],
  ['smcc-user',working,built('builtin:linker1:smcc'),label('user',user.id)],
  ['smcc-click',working,built('builtin:linker1:smcc'),uploaded('azidothiol.mol'),built('alkyne')],
  ['reduction',working,built('builtin:linker1:spdp'),label('transformation','reduce-disulfide')],
  ['ambiguous',working,built('builtin:linker1:dbco'),uploaded('JQ1.mol')],
  ['custom','rA[BatchDiol]rCrG[C6N]',uploaded('azido-nhs.mol')]
 ];
 XLSX.utils.sheet_add_aoa(postbook.Sheets.Molecules,postRows,{origin:'A2'});
 const postInput=BatchWorkflow.read(postbook);
 const postStates=new Map();
 const postResult=await Batch.run(postInput,{formats:['svg','cdxml','mol','sdf'],structures:uploads.registry,onResult:(s,r)=>postStates.set(r.ID,s)});
 check(Object.keys(postResult.zip.files).length===24,'2.2 structure export count');
 report.post=postResult.rows.map(r=>[r.ID,r['Workflow Status'],r['Last Successful Step'],r['OD Status']]);
 for(const [i,row]of postResult.rows.entries()){
  const id=row.ID;
  if(['ambiguous','reduction'].includes(id)){check(row['Workflow Status']==='NEEDS REVIEW'||(id==='reduction'&&row['Workflow Status']==='PASS'),'Expected review for '+id);continue;}
  check(row['Workflow Status']==='PASS'&&row['OD Status']==='ESTIMATED','Post batch '+id+' '+row['Error/Warning']);
  const state=postStates.get(id);
  check(row.epsilon260===state.optical.epsilon260&&row['nmol/OD260']===state.optical.nmolPerOD260&&row['ug/OD260']===state.optical.ugPerOD260,'Post optical row parity '+id);
  check(row.epsilon260===start(postInput[i].Sequence).optical.epsilon260,'Post inherited epsilon '+id);
  if(id==='payload'){
   const individual=couple(reagent,start(working));
   check(state.formula===individual.formula&&state.average_mw===individual.average_mw&&JSON.stringify(metrics(state.optical))===JSON.stringify(metrics(individual.optical)),'2.2 / Builder product parity');
  }
 }
 const overrideState=Sandbox.A.sequence('rArC');
 Optical.setOverride(overrideState,{kind:'wholeMolecule',wavelength:260,identity:Optical.chemicalIdentity(overrideState.graph),value:12345,
  unit:'M^-1 cm^-1',source:'test',conditions:'test',measured:true});
 const overrideBatch=await Batch.run([{ID:'A',Sequence:'rArC'}],{sequenceOnly:true});
 check(overrideBatch.rows[0].epsilon260===12345,'Shared session override');
 Optical.clearOverride(overrideState.graph);
 check(start('rArC').optical.epsilon260!==12345,'Reset session override');
 const entries=BatchWorkflow.catalog(new Map());
 const key=[...entries.keys()].find(k=>String(k).includes('smcc'));
 report.catalogKeys={smcc:!!smcc,entries:[...entries.keys()].slice(0,3)};
 return report;
}

