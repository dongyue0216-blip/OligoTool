'use strict';
// UI adapter. Compatibility is evaluated by the reaction engine against the current substrate.
const ReagentSource=(()=>{
 function mount({input,file,language,family,substrate,invalidate,defaultSource='upload'}){
  const label=document.createElement('label'),source=document.createElement('select');
  const entryLabel=document.createElement('label'),entry=document.createElement('select');
  source.id=input.id+'Source';entry.id=input.id+'LibraryEntry';
  label.append(document.createTextNode(''),source);
  entryLabel.append(document.createTextNode(''),entry);
  file.before(label,entryLabel);
  let choices=new Map();
  const english=()=>language.value==='en';
  const text=(zh,en)=>english()?en:zh;
  function localize(){
   label.firstChild.nodeValue=text('试剂来源','Reagent source');
   entryLabel.firstChild.nodeValue=family()==null?text('选择第二反应物','Choose Secondary Reagent'):text('兼容试剂','Compatible reagent');
   const selected=source.value||defaultSource;
   source.replaceChildren(new Option('Upload MOL / SDF','upload'),new Option(text('内置反应试剂','Built-in Reaction Reagents'),'builtin'),new Option(text('用户库','User Library'),'user'));
   source.value=selected;
  }
  function refresh(enabled=true,visible=true){
   const upload=source.value==='upload';
   entryLabel.firstChild.nodeValue=family()==null?text('选择第二反应物','Choose Secondary Reagent'):text('兼容试剂','Compatible reagent');
   label.hidden=!visible;source.disabled=!enabled||!visible;
   entryLabel.hidden=!visible||upload;entry.disabled=!enabled||entryLabel.hidden;
   input.hidden=file.hidden=!visible||!upload;
   input.disabled=file.disabled=!enabled||input.hidden;
   if(!visible||upload||!enabled)return;
   const selected=entry.value;
   const starting=substrate();
   choices=new Map(starting?Product.store.reagents(source.value,family(),starting).map(r=>[r.id,r]):[]);
   entry.replaceChildren(new Option(choices.size?text('选择试剂','Select reagent'):text('无兼容试剂','No compatible reagents'),''));
   for(const row of choices.values())entry.add(new Option(row.name,row.id));
   entry.value=choices.has(selected)?selected:'';
  }
  function graph(){
   if(source.value==='upload')return Reactions.v2.parseReagent(input.value,family()??'CAP');
   const row=choices.get(entry.value);
   if(!row)throw Error(text('请选择兼容试剂','Select a compatible reagent'));
   return row.graph;
  }
  source.onchange=()=>{entry.value='';invalidate();};
  entry.onchange=invalidate;
  language.addEventListener('change',localize);
  localize();
  return {graph,refresh,hasSelection:()=>source.value==='upload'?!!input.value.trim():choices.has(entry.value),
   reset(){source.value=defaultSource;entry.value='';input.value='';file.value='';}};
 }
 return {mount};
})();
