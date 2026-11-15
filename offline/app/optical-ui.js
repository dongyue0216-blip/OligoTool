'use strict';
const OpticalUI=(()=>{
 const t=key=>UILanguage.text('optical.'+key);
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
  const status=optical.supported?(optical.estimated?t('estimated'):
   optical.evidence.basis==='measured'?t('measured'):t('validated')):t('unavailable');
  const assumptions=optical.evidence.assumptions;
  return '<div class="metric"><small>'+t('mass')+'</small><span data-mass-per-od>'+
   (optical.supported?approx+formatMass.format(optical.ugPerOD260)+' µg/OD₂₆₀':'—')+'</span></div>'+
   metric(t('mw'),format(record.metrics.average_mw,3)+' Da')+
   metric(t('formula'),escape(record.metrics.formula))+
   '<details class="optical-details" style="grid-column:1/-1"><summary>'+status+' · '+t('details')+'</summary>'+
   '<p>'+t('extinction')+' ε₂₆₀ '+display(optical.epsilon260,0)+' M⁻¹ cm⁻¹</p>'+
   '<p>'+escape(UILanguage.status(optical.method))+' · '+escape(optical.evidence.parameterSetId)+' · '+escape(optical.molecularForm)+
   ' · '+format(optical.nmolPerOD260,3)+' nmol/OD₂₆₀ · '+escape(optical.evidence.conditions)+'</p>'+
   '<p>'+t('definition')+' '+format(record.metrics.exact_mass,5)+
   ' Da. '+optical.evidence.coverage.unresolved+' '+t('unresolved')+'</p>'+
   (optical.missing.length?'<ul>'+optical.missing.map(x=>'<li>'+escape(UILanguage.status(x.detail))+'</li>').join('')+'</ul>':'')+
   (assumptions.length?'<ul>'+assumptions.map(x=>'<li>'+escape(UILanguage.status(x))+'</li>').join('')+'</ul>':'')+
   (optical.partialEpsilon?'<p>'+t('partial')+' ε₂₆₀ '+format(optical.partialEpsilon,0)+'</p>':'')+
   '<p>'+optical.evidence.sourceRefs.map(escape).join('<br>')+'</p>'+
   (optical.supported?'<form class="optical-conversion" data-epsilon="'+optical.epsilon260+
   '" data-mw="'+optical.averageMW_g_mol+'"><label>A₂₆₀ <input name="absorbance" type="number" required min="0" step="any"></label> '+
   '<label>'+t('path')+' <input name="pathLengthCm" type="number" value="1" required min="0.000001" step="any"></label> '+
   '<label>'+t('dilution')+' <input name="dilutionFactor" type="number" value="1" required min="1" step="any"></label> '+
   '<label>'+t('volume')+' <input name="volumeMl" type="number" value="1" required min="0" step="any"></label> '+
   '<button>'+t('convert')+'</button> <output aria-live="polite"></output></form>':'')+(allowOverride?'<details class="optical-override"><summary>'+t('override')+'</summary>'+ 
    '<form><p>'+t('override.help')+'</p>'+ 
    '<label>ε₂₆₀ <input name="value" type="number" required min="0.000001" step="any"></label> '+ 
    '<label>'+t('unit')+' <select name="unit"><option>M^-1 cm^-1</option><option>mM^-1 cm^-1</option></select></label> '+ 
    '<label>'+t('source')+' <input name="source" required></label> <label>'+t('conditions')+' <input name="conditions" required></label> '+ 
    '<label><input name="measured" type="checkbox"> '+t('measured')+'</label> <button>'+t('apply')+'</button> '+ 
    '<button type="button" data-reset-optical>'+t('reset')+'</button> <output aria-live="polite"></output></form></details>':'')+'</details>';
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
    if(!result.supported){form.querySelector('output').textContent=UILanguage.error(result.reason);return;}
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
 function relocalize(record){
  const metrics=document.getElementById('metrics');
  const open=[...metrics.querySelectorAll('details')].map(node=>node.open);
  const fields=[...metrics.querySelectorAll('input,select,output')].map(node=>[node.value,node.checked]);
  metrics.innerHTML=markup(record,true);
  metrics.querySelectorAll('details').forEach((node,i)=>node.open=!!open[i]);
  metrics.querySelectorAll('input,select,output').forEach((node,i)=>{
   if(fields[i]){node.value=fields[i][0];if(node.type==='checkbox')node.checked=fields[i][1];}
  });
 }
 return {relocalize,markup};
})();


