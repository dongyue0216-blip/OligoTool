'use strict';
(()=>{
 const host=document.createElement('article');
 host.id='hybridizationAnalysis';
 host.innerHTML='<h2 data-ui="analysis.title">Duplex / Annealing &amp; Self Analysis</h2>'+
  '<p data-ui="analysis.help">Enter each sequence 5′ → 3′ using Toolkit notation. Sequence screening reports complementarity and competing stems.</p>'+
  '<div class="row"><label><span data-ui="analysis.strand.a"></span> <textarea id="annealingA" rows="2"></textarea></label>'+
  '<label><span data-ui="analysis.strand.b"></span> <textarea id="annealingB" rows="2"></textarea></label></div>'+
  '<div class="row"><button type="button" id="annealingUseCurrent" data-ui="analysis.use">Use current as A</button>'+
  '<button type="button" id="annealingDuplex" data-ui="analysis.duplex">Analyze Duplex</button>'+
  '<button type="button" id="annealingSelf" data-ui="analysis.self">Analyze Self</button></div>'+
  '<p id="annealingStatus" aria-live="polite"></p><div id="annealingDiagram" style="overflow:auto"></div>'+
  '<details id="annealingDetails" hidden><summary data-ui="analysis.alignment">Alignment details</summary><pre></pre></details>'+
  '<details id="annealingSelfDetails" hidden><summary data-ui="analysis.self.detail">Self pairing</summary><pre></pre></details>'+
  '<details><summary data-ui="analysis.thermo">Thermodynamics</summary><p data-ui="analysis.thermo.note">This version reports sequence topology. Tm and free energy models are deferred.</p></details>';
 document.getElementById('sequenceWorkspace').append(host);
 const $=id=>host.querySelector('#'+id), status=$('annealingStatus'), diagram=$('annealingDiagram');
 const detail=$('annealingDetails'), selfDetail=$('annealingSelfDetails');
 const a=$('annealingA'),b=$('annealingB');
 let currentSnapshot=null, displayResult=null;
 const parse=input=>Annealing.resolve(input===a&&currentSnapshot?(currentSnapshot.moleculeState||currentSnapshot):Lite.calculate(input.value.trim()));
 a.addEventListener('input',()=>{currentSnapshot=null;});
 $('annealingUseCurrent').onclick=()=>{
  if(!UI.current){UILanguage.write(status,()=>UILanguage.text("analysis.generate"));return;}
  currentSnapshot=UI.current;displayResult=null;
  a.value=UI.current.input||'(current structure)';
  UILanguage.write(status,()=>UILanguage.text("analysis.selected"));
 };
 function displaySelf(views){
  const results=views.map(strand=>Annealing.self(strand));
  selfDetail.hidden=false;
  selfDetail.querySelector('pre').textContent=results.map((result,index)=>{
   const lines=[(index?UILanguage.text('analysis.strand.b'):UILanguage.text('analysis.strand.a'))+' · '+UILanguage.status(result.status)];
   if(result.reasonCodes.length)lines.push(result.reasonCodes.join(', '));
   for(const kind of ['hairpins','dimers']){
    lines.push((kind==='hairpins'?UILanguage.text("analysis.hairpins"):UILanguage.text("analysis.dimers"))+' · '+result.totals[kind]+(result.truncated[kind]?UILanguage.text("analysis.truncated"):''));
    if(!result[kind].length&&result.status==='resolved')lines.push(UILanguage.text("analysis.no.stem"));
    for(const item of result[kind])lines.push(item.length+UILanguage.text("analysis.paired")+item.gc+' GC'+
     (item.strong?UILanguage.text("analysis.strong"):'')+(item.near3Prime?UILanguage.text("analysis.near"):'')+
     (item.loop?UILanguage.text("analysis.loop")+item.loop.start+'–'+item.loop.end:UILanguage.text("analysis.offset")+item.offset)+
     ' · '+item.pairs.map(pair=>Array.isArray(pair)?pair.join('↔'):pair.a+'↔'+pair.b).join(' '));
   }
   return lines.join('\n');
  }).join('\n\n');
  return results;
 }
 function renderAnalysis(show){
  const {strandA,strandB,result,duplex}=displayResult;
  diagram.replaceChildren();detail.hidden=true;selfDetail.hidden=true;
   if(!duplex){
    const [result]=displaySelf([strandA]);if(show)selfDetail.open=true;
    status.textContent=(result.status==='resolved'?UILanguage.text("analysis.self.screen"):UILanguage.status('unresolved'))+' · '+result.totals.hairpins+UILanguage.text("analysis.hairpin.candidates")+result.totals.dimers+UILanguage.text("analysis.dimer.candidates");
    return;
   }

   const competition=displaySelf([strandA,strandB]).some(r=>[...r.hairpins,...r.dimers].some(c=>c.strong));
   const tails=result.overhangs?Object.entries(result.overhangs).filter(([,v])=>v.length)
    .map(([end,v])=>end[0].toUpperCase()+' '+end[1]+'′ '+v.length+' nt').join(', '):'';
   status.textContent=UILanguage.status(result.feasibility)+' · '+result.pairs.length+UILanguage.text("analysis.paired")+(result.mismatchRefs?.length??0)+
    UILanguage.text("analysis.mismatches")+(tails?' · '+tails:'')+(competition?UILanguage.text("analysis.competition"):'');
   if(result.columns.length)diagram.innerHTML=StructurePresentation.duplex([strandA,strandB],result);
   detail.hidden=false;
   detail.querySelector('pre').textContent=[
    UILanguage.text("analysis.profile")+result.profile+' · '+result.algorithmVersion,
    UILanguage.text("analysis.register")+(result.selectedRegister??'—')+UILanguage.text("analysis.longest")+(result.longestRun??'—'),
    'GC '+(result.gc??'—')+' · AU/AT '+(result.auAt??'—'),
    UILanguage.text("analysis.fractions")+JSON.stringify(result.pairedFractions??null),
    UILanguage.text("analysis.registers")+(result.equivalentRegisters?.map(r=>r.offset).join(', ')||'—'),
    result.reasonCodes.join(', '),
    ...result.columns.map(c=>(c.a??'—')+' ↔ '+(c.b??'—')+' · '+UILanguage.status(c.kind))
   ].join('\n');
 }
 function analyze(duplex){
  try{
   const strandA=parse(a),strandB=duplex?parse(b):null;
   displayResult={strandA,strandB,duplex,result:duplex?Annealing.duplex(strandA,strandB):null};
   renderAnalysis(true);
  }catch(error){displayResult=null;diagram.replaceChildren();detail.hidden=true;selfDetail.hidden=true;UILanguage.errorInto(status,error);}
 }
 document.getElementById('language').addEventListener('change',()=>{if(displayResult)renderAnalysis(false);});
 $('annealingDuplex').onclick=()=>analyze(true);
 $('annealingSelf').onclick=()=>analyze(false);
})();

