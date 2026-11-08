'use strict';
(()=>{
 const host=document.createElement('article');
 host.id='hybridizationAnalysis';
 host.innerHTML='<h2>Duplex / Annealing &amp; Self Analysis</h2>'+
  '<p>Enter each sequence 5′ → 3′ using Toolkit notation. Sequence screening reports complementarity and competing stems.</p>'+
  '<div class="row"><label>Strand A <textarea id="annealingA" rows="2"></textarea></label>'+
  '<label>Strand B <textarea id="annealingB" rows="2"></textarea></label></div>'+
  '<div class="row"><button type="button" id="annealingUseCurrent">Use current as A</button>'+
  '<button type="button" id="annealingDuplex">Analyze Duplex</button>'+
  '<button type="button" id="annealingSelf">Analyze Self</button></div>'+
  '<p id="annealingStatus" aria-live="polite"></p><div id="annealingDiagram" style="overflow:auto"></div>'+
  '<details id="annealingDetails" hidden><summary>Alignment details</summary><pre></pre></details>'+
  '<details id="annealingSelfDetails" hidden><summary>Self pairing</summary><pre></pre></details>'+
  '<details><summary>Thermodynamics</summary><p>This version reports sequence topology. Tm and free energy models are deferred.</p></details>';
 document.getElementById('sequenceWorkspace').append(host);
 const $=id=>host.querySelector('#'+id), status=$('annealingStatus'), diagram=$('annealingDiagram');
 const detail=$('annealingDetails'), selfDetail=$('annealingSelfDetails');
 const a=$('annealingA'),b=$('annealingB');
 let currentSnapshot=null;
 const parse=input=>Annealing.resolve(input===a&&currentSnapshot?(currentSnapshot.moleculeState||currentSnapshot):Lite.calculate(input.value.trim()));
 a.addEventListener('input',()=>{currentSnapshot=null;});
 $('annealingUseCurrent').onclick=()=>{
  if(!UI.current){status.textContent='Generate or import a structure first.';return;}
  currentSnapshot=UI.current;
  a.value=UI.current.input||'(current structure)';
  status.textContent='Current structure selected as strand A.';
 };
 function displaySelf(views){
  const results=views.map(strand=>Annealing.self(strand));
  selfDetail.hidden=false;
  selfDetail.querySelector('pre').textContent=results.map((result,index)=>{
   const lines=['Strand '+(index?'B':'A')+' · '+result.status];
   if(result.reasonCodes.length)lines.push(result.reasonCodes.join(', '));
   for(const kind of ['hairpins','dimers']){
    lines.push(kind+' · '+result.totals[kind]+(result.truncated[kind]?' · first 20 shown':''));
    if(!result[kind].length&&result.status==='resolved')lines.push('No continuous stem meets the screening threshold.');
    for(const item of result[kind])lines.push(item.length+' paired · '+item.gc+' GC'+
     (item.strong?' · strong screen hit':'')+(item.near3Prime?' · near 3′':'')+
     (item.loop?' · loop '+item.loop.start+'–'+item.loop.end:' · offset '+item.offset)+
     ' · '+item.pairs.map(pair=>Array.isArray(pair)?pair.join('↔'):pair.a+'↔'+pair.b).join(' '));
   }
   return lines.join('\n');
  }).join('\n\n');
  return results;
 }
 function analyze(duplex){
  diagram.replaceChildren();detail.hidden=true;selfDetail.hidden=true;
  try{
   const strandA=parse(a);
   if(!duplex){
    const [result]=displaySelf([strandA]);selfDetail.open=true;
    status.textContent=(result.status==='resolved'?'Self screen':'Unresolved')+' · '+result.totals.hairpins+' hairpin candidate(s) · '+result.totals.dimers+' self-dimer candidate(s)';
    return;
   }
   const strandB=parse(b), result=Annealing.duplex(strandA,strandB);
   const competition=displaySelf([strandA,strandB]).some(r=>[...r.hairpins,...r.dimers].some(c=>c.strong));
   const tails=result.overhangs?Object.entries(result.overhangs).filter(([,v])=>v.length)
    .map(([end,v])=>end[0].toUpperCase()+' '+end[1]+'′ '+v.length+' nt').join(', '):'';
   status.textContent=result.feasibility+' · '+result.pairs.length+' paired · '+(result.mismatchRefs?.length??0)+
    ' mismatch/abasic/unknown'+(tails?' · '+tails:'')+(competition?' · strong competing self-pairing candidate':'');
   if(result.columns.length)diagram.innerHTML=StructurePresentation.duplex([strandA,strandB],result);
   detail.hidden=false;
   detail.querySelector('pre').textContent=[
    'Profile '+result.profile+' · '+result.algorithmVersion,
    'Register '+(result.selectedRegister??'—')+' · longest run '+(result.longestRun??'—'),
    'GC '+(result.gc??'—')+' · AU/AT '+(result.auAt??'—'),
    'Paired fractions '+JSON.stringify(result.pairedFractions??null),
    'Equivalent registers '+(result.equivalentRegisters?.map(r=>r.offset).join(', ')||'—'),
    result.reasonCodes.join(', '),
    ...result.columns.map(c=>(c.a??'—')+' ↔ '+(c.b??'—')+' · '+c.kind)
   ].join('\n');
  }catch(error){status.textContent='Unresolved · '+error.message;}
 }
 $('annealingDuplex').onclick=()=>analyze(true);
 $('annealingSelf').onclick=()=>analyze(false);
})();

