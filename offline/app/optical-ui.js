'use strict';
const OpticalUI=(()=>{
 const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const format=(number,precision)=>number==null?'—':new Intl.NumberFormat('en',{maximumFractionDigits:precision}).format(number);
 const formatMass=new Intl.NumberFormat('en',{minimumFractionDigits:2,maximumFractionDigits:2});
 let overrideRecord=null,overrideResult=null;
 function markup(record,allowOverride=false){
  const optical=(allowOverride&&record===overrideRecord?overrideResult:null)||
   (record.optical?.schema==='OpticalResult/2'?record.optical:Optical.analyze(record.moleculeState||record));
  const tier=optical.evidence.tier;
  const approx=optical.estimated&&optical.supported?'≈ ':'';
  const display=(value,digits)=>value==null?'—':approx+format(tier==='heuristic'?Number(value.toPrecision(3)):value,digits);
  const metric=(label,value)=>'<div class="metric"><small>'+label+'</small>'+value+'</div>';
  const status=optical.supported?(optical.estimated?'≈ Estimated':
   optical.evidence.basis==='measured'?'Measured':'Validated model'):'Mass per OD₂₆₀ unavailable';
  const assumptions=optical.evidence.assumptions;
  return '<div class="metric"><small>Mass per OD₂₆₀</small><span data-mass-per-od>'+
   (optical.supported?approx+formatMass.format(optical.ugPerOD260)+' µg/OD₂₆₀':'—')+'</span></div>'+
   metric('AVERAGE MW',format(record.metrics.average_mw,3)+' Da')+
   metric('FORMULA',escape(record.metrics.formula))+
   '<details class="optical-details" style="grid-column:1/-1"><summary>'+status+' · Optical details</summary>'+
   '<p>Extinction coefficient ε₂₆₀ '+display(optical.epsilon260,0)+' M⁻¹ cm⁻¹</p>'+
   '<p>'+escape(optical.method)+' · '+escape(optical.evidence.parameterSetId)+' · '+escape(optical.molecularForm)+
   ' · '+format(optical.nmolPerOD260,3)+' nmol/OD₂₆₀ · '+escape(optical.evidence.conditions)+'</p>'+
   '<p>1 OD₂₆₀ = A₂₆₀ 1 in 1 mL at 1 cm. Exact mass '+format(record.metrics.exact_mass,5)+
   ' Da. '+optical.evidence.coverage.unresolved+' unresolved contribution(s).</p>'+
   (optical.missing.length?'<ul>'+optical.missing.map(x=>'<li>'+escape(x.detail)+'</li>').join('')+'</ul>':'')+
   (assumptions.length?'<ul>'+assumptions.map(x=>'<li>'+escape(x)+'</li>').join('')+'</ul>':'')+
   (optical.partialEpsilon?'<p>Modeled portion only ε₂₆₀ '+format(optical.partialEpsilon,0)+'</p>':'')+
   '<p>'+optical.evidence.sourceRefs.map(escape).join('<br>')+'</p>'+
   (optical.supported?'<form class="optical-conversion" data-epsilon="'+optical.epsilon260+
   '" data-mw="'+optical.averageMW_g_mol+'"><label>A₂₆₀ <input name="absorbance" type="number" required min="0" step="any"></label> '+
   '<label>Path (cm) <input name="pathLengthCm" type="number" value="1" required min="0.000001" step="any"></label> '+
   '<label>Dilution <input name="dilutionFactor" type="number" value="1" required min="1" step="any"></label> '+
   '<label>Original volume (mL) <input name="volumeMl" type="number" value="1" required min="0" step="any"></label> '+
   '<button>Convert</button> <output aria-live="polite"></output></form>':'')+(allowOverride?'<details class="optical-override"><summary>Use a whole-molecule ε₂₆₀</summary>'+ 
    '<form><p>Enter a 260 nm value for this exact molecule and measurement conditions. Applies to this view.</p>'+ 
    '<label>ε₂₆₀ <input name="value" type="number" required min="0.000001" step="any"></label> '+ 
    '<label>Unit <select name="unit"><option>M^-1 cm^-1</option><option>mM^-1 cm^-1</option></select></label> '+ 
    '<label>Source <input name="source" required></label> <label>Conditions <input name="conditions" required></label> '+ 
    '<label><input name="measured" type="checkbox"> Measured</label> <button>Apply value</button> '+ 
    '<button type="button" data-reset-optical>Reset</button> <output aria-live="polite"></output></form></details>':'')+'</details>';
 }
 function refresh(record){
  const metrics=document.getElementById('metrics');
  metrics.innerHTML=markup(record,true);
  metrics.querySelector('.optical-details').open=true;
 }
 function mount(){
  document.addEventListener('click',event=>{
   if(!event.target.matches('[data-reset-optical]'))return;
   overrideRecord=null;overrideResult=null;if(UI.current)refresh(UI.current);
  });
  document.addEventListener('submit',event=>{
   const form=event.target;
   if(form.matches('.optical-override form')){
    event.preventDefault();const record=UI.current;if(!record)return;
    const data=new FormData(form);const result=Optical.analyze(record.moleculeState||record,Optical.pack,{
     kind:'wholeMolecule',wavelength:260,identity:Optical.chemicalIdentity(record.graph),value:Number(data.get('value')),
     unit:data.get('unit'),source:data.get('source'),conditions:data.get('conditions'),measured:data.has('measured')});
    if(!result.supported){form.querySelector('output').textContent=result.reason;return;}
    overrideRecord=record;overrideResult=result;refresh(record);return;
   }
   if(!form.matches('.optical-conversion'))return;
   event.preventDefault();
   const values=Object.fromEntries([...new FormData(form)].map(([key,value])=>[key,Number(value)]));
   const result=Optical.convert({...values,epsilon:Number(form.dataset.epsilon),averageMW:Number(form.dataset.mw)});
   form.querySelector('output').textContent=format(result.concentrationUM,4)+' µM · '+format(result.concentrationUgMl,4)+
    ' µg/mL · '+format(result.totalNmol,4)+' nmol · '+format(result.totalUg,4)+' µg · '+format(result.totalOD260,4)+' OD₂₆₀';
  });
 }
 mount();
 return {markup};
})();


